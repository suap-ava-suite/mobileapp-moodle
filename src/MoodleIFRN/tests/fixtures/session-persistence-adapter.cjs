// EXPERIMENT ONLY. Real desktop SQLite; secure storage is explicitly a synthetic fixture.
// No imports from this file are permitted in production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const {DatabaseSync} = require('node:sqlite');
const {ControlledIO} = require('./core-session-attempt.cjs');

function method(file, name) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const found = [];
    function visit(node) {
        if (ts.isMethodDeclaration(node) && node.name.getText(ast) === name) found.push(node.getText(ast));
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, `ambiguous/missing real method ${name}`);
    return found[0];
}
function actualClass(name, methods) {
    const context = {};
    vm.runInNewContext(ts.transpileModule(`class ${name} {${methods.join('\n')}}; this.Type = ${name};`, {
        compilerOptions: {target: ts.ScriptTarget.ES2022},
    }).outputText, context);
    return context.Type;
}
const CoreDB = actualClass('SQLiteDB', ['execute', 'executeBatch'].map(name => method('src/core/classes/sqlitedb.ts', name)));
const WebBatch = actualClass('WebBatch', [method('src/core/features/emulator/classes/wa-sqlite-object.ts', 'sqlBatch')]);

class Gates {
    io = new ControlledIO();
    held = new Set();
    hold(label, phase = 'apply') { this.held.add(`${label}:${phase}`); }
    call(label, phase, operation) {
        const key = `${label}:${phase}`;
        if (this.held.delete(key)) return this.io.schedule(key, operation);
        return Promise.resolve().then(operation);
    }
    wait(label, phase = 'apply') { return this.io.wait(`${label}:${phase}`); }
    run(label, phase = 'apply', failure) { return this.io.run(`${label}:${phase}`, failure); }
}

class DesktopSQLitePort {
    constructor(filename, {gates = new Gates(), mode = 'native-style'} = {}) {
        this.db = new DatabaseSync(filename);
        this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0; PRAGMA synchronous=FULL;');
        this.gates = gates;
        this.atomicBatch = mode === 'native-style';
        this.mode = mode;
        this.labels = new WeakMap();
        this.core = new CoreDB();
        const web = new WebBatch();
        web.executeSql = (sql, params) => this.executeSql(sql, params);
        this.core.db = {
            executeSql: (sql, params) => this.executeSql(sql, params),
            sqlBatch: statements => {
                const label = this.labels.get(statements) || 'unlabelled';
                return this.gates.call(label, 'apply', () => {
                    if (!this.atomicBatch) return web.sqlBatch(statements);
                    this.db.exec('BEGIN');
                    try {
                        for (const statement of statements) this.executeSync(...(Array.isArray(statement) ? statement : [statement]));
                        this.db.exec('COMMIT');
                    } catch (error) {
                        this.db.exec('ROLLBACK');
                        throw error;
                    }
                }).then(() => this.gates.call(label, 'ack', () => undefined));
            },
        };
    }
    executeSync(sql, params = []) {
        const statement = this.db.prepare(sql);
        if (statement.columns().length) {
            const rows = statement.all(...params).map(row => ({...row}));
            return {rows: {length: rows.length, item: i => rows[i]}};
        }
        const result = statement.run(...params);
        return {rowsAffected: Number(result.changes), insertId: Number(result.lastInsertRowid), rows: {length: 0, item() {}}};
    }
    async executeSql(sql, params) { return this.executeSync(sql, params); }
    async rows(sql, params = []) {
        const result = await this.core.execute(sql, params);
        return Array.from({length: result.rows.length}, (_, i) => result.rows.item(i));
    }
    async batch(label, statements) {
        this.labels.set(statements, label);
        await this.core.executeBatch(statements);
    }
    close() { this.db.close(); }
}

// A mock of store/get/deleteCollection ONLY. No encryption, Keystore or Android execution.
// durableAck=true is a HYPOTHETICAL stronger contract, NOT a claim about the current plugin.
class SecureStorageFixture {
    constructor({durableAck = false, gates = new Gates()} = {}) {
        this.durableAck = durableAck;
        this.gates = gates;
        this.memory = new Map();
        this.disk = new Map();
        this.partial = false;
    }
    async store(data, collection) {
        for (const value of Object.values(data)) assert.equal(typeof value, 'string');
        await this.gates.call(`secure:${collection}`, 'apply', () => {
            this.memory.set(collection, this.partial ? {token: data.token} : {...data});
            if (this.durableAck) this.disk.set(collection, {...this.memory.get(collection)});
        });
        await this.gates.call(`secure:${collection}`, 'ack', () => undefined);
    }
    async get(names, collection) {
        return this.gates.call(`read:${collection}`, 'apply', () => Object.fromEntries(names
            .filter(name => this.memory.get(collection)?.[name] !== undefined)
            .map(name => [name, this.memory.get(collection)[name]])));
    }
    async deleteCollection(collection) {
        this.memory.delete(collection);
        this.disk.delete(collection);
    }
    loseProcess() { this.memory = new Map([...this.disk].map(([key, value]) => [key, {...value}])); }
}

const PENDING = "('created','validating','prepared')";
const CLOCK = '(SELECT ms FROM p07_test_clock WHERE singleton=1)';
// Conditional UPDATE evaluated INSIDE SQLite at execution, not in a preceding JS SELECT.
const CURRENT = `EXISTS (SELECT 1 FROM p07_authority a WHERE a.singleton=1
    AND a.latest=p07_attempt.id AND a.owner=p07_attempt.owner AND a.epoch=p07_attempt.epoch
    AND a.generation=p07_attempt.generation)`;

class SessionPersistenceAdapter {
    constructor(port, secure) {
        assert(port.atomicBatch, 'atomic sqlBatch unavailable: refuse adapter on this backend');
        this.port = port;
        this.secure = secure;
        this.localFence = 0;
        this.suapTransition = false;
    }
    async initialize() {
        const existing = await this.port.rows("SELECT name FROM sqlite_master WHERE type='table' AND name='p07_schema'");
        if (existing.length) {
            const versions = await this.port.rows('SELECT version FROM p07_schema WHERE singleton=1');
            assert.equal(versions[0]?.version, 1, 'unsupported experimental schema: no automatic migration');
        }
        await this.port.batch('schema', [
            'CREATE TABLE IF NOT EXISTS p07_schema(singleton INTEGER PRIMARY KEY CHECK(singleton=1),version INTEGER NOT NULL)',
            'INSERT OR IGNORE INTO p07_schema VALUES(1,1)',
            `CREATE TABLE IF NOT EXISTS p07_authority(singleton INTEGER PRIMARY KEY CHECK(singleton=1),
                owner TEXT, epoch INTEGER NOT NULL, generation INTEGER NOT NULL, latest TEXT, published TEXT)`,
            'INSERT OR IGNORE INTO p07_authority VALUES(1,NULL,0,0,NULL,NULL)',
            `CREATE TABLE IF NOT EXISTS p07_attempt(id TEXT PRIMARY KEY, owner TEXT NOT NULL, epoch INTEGER NOT NULL,
                generation INTEGER NOT NULL UNIQUE, site TEXT NOT NULL, site_id TEXT NOT NULL, course TEXT NOT NULL,
                deadline INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN
                ('created','validating','prepared','confirmed','cancelled','expired','rejected')),
                secure_key TEXT NOT NULL UNIQUE, stage_claim TEXT, metadata_ready INTEGER NOT NULL DEFAULT 0,
                secure_ready INTEGER NOT NULL DEFAULT 0, collected INTEGER NOT NULL DEFAULT 0)`,
            // Deterministic clock is intentionally a fixture, not a required native SQL extension.
            'CREATE TABLE IF NOT EXISTS p07_test_clock(singleton INTEGER PRIMARY KEY CHECK(singleton=1),ms INTEGER NOT NULL)',
            'INSERT OR IGNORE INTO p07_test_clock VALUES(1,0)',
        ]);
    }
    async authority() { return (await this.port.rows('SELECT * FROM p07_authority WHERE singleton=1'))[0]; }
    async attempt(id) { return (await this.port.rows('SELECT * FROM p07_attempt WHERE id=?', [id]))[0]; }
    async setSuap(owner) {
        const fence = ++this.localFence;
        this.suapTransition = true;
        await this.port.batch('suap', [
            [`UPDATE p07_attempt SET state='cancelled' WHERE state IN ${PENDING}`],
            ['UPDATE p07_authority SET owner=?,epoch=epoch+1,latest=NULL,published=NULL WHERE singleton=1', [owner]],
        ]);
        const {epoch, owner: persistedOwner} = await this.authority();
        assert(this.localFence === fence && persistedOwner === owner, 'superseded SUAP transition');
        this.suapTransition = false;
        return {owner, epoch};
    }
    async begin({id = crypto.randomUUID(), site, siteId, course, ttl = 100} = {}) {
        assert(!this.suapTransition, 'SUAP transition unresolved');
        assert(new URL(site).origin === site && site.startsWith('https://'), 'exact HTTPS environment required');
        assert(Number.isSafeInteger(ttl) && ttl > 0);
        assert(/^[a-zA-Z0-9-]+$/.test(id), 'opaque collection suffix required');
        const fence = ++this.localFence;
        const key = `ifrn-p07-${id}`;
        await this.port.batch(`begin:${id}`, [
            [`UPDATE p07_attempt SET state='cancelled' WHERE state IN ${PENDING}`],
            ['UPDATE p07_authority SET generation=generation+1,latest=? WHERE singleton=1 AND owner IS NOT NULL', [id]],
            [`INSERT INTO p07_attempt(id,owner,epoch,generation,site,site_id,course,deadline,state,secure_key)
                SELECT ?,owner,epoch,generation,?,?,?,${CLOCK}+?,'created',? FROM p07_authority
                WHERE singleton=1 AND owner IS NOT NULL AND latest=?`, [id, site, siteId, course, ttl, key, id]],
        ]);
        const row = await this.attempt(id);
        assert(row, 'SUAP identity required');
        return Object.freeze({id, key, owner: row.owner, epoch: row.epoch, generation: row.generation, fence});
    }
    async cancel(handle) {
        if (handle.fence === this.localFence) this.localFence++;
        await this.port.batch(`cancel:${handle.id}`, [
            [`UPDATE p07_attempt SET state='cancelled' WHERE id=? AND state IN ${PENDING}`, [handle.id]],
        ]);
        return (await this.attempt(handle.id)).state;
    }
    async reject(id) {
        await this.port.batch(`reject:${id}`, [
            [`UPDATE p07_attempt SET state='rejected' WHERE id=? AND state IN ${PENDING}`, [id]],
        ]);
    }
    async expire() {
        await this.port.batch('expire', [
            [`UPDATE p07_attempt SET state='expired' WHERE state IN ${PENDING} AND deadline<=${CLOCK}`],
        ]);
    }
    async stageValidatedCandidate(handle, input) {
        // INTERNAL STORAGE BOUNDARY: caller must have executed official passport/identity/policy validation.
        // This API does not implement OAuth, fetchSiteInfo, passport or enrolment validation.
        input = Object.freeze({...input});
        const claim = crypto.randomUUID();
        const row = await this.attempt(handle.id);
        if (row.state !== 'created') return row.state === 'prepared';
        if (input.owner !== row.owner || input.site !== row.site || input.siteId !== row.site_id
            || input.course !== row.course || typeof input.token !== 'string' || !input.token
            || typeof input.privateToken !== 'string') {
            await this.reject(handle.id);
            return false;
        }
        if (!this.secure || this.secure.durableAck !== true) {
            await this.reject(handle.id);
            return false; // Current Android apply() / optional plugin cannot satisfy durable publication.
        }
        await this.port.batch(`validate:${handle.id}`, [
            [`UPDATE p07_attempt SET state='validating',stage_claim=? WHERE id=? AND state='created' AND ${CURRENT}
                AND deadline>${CLOCK}`, [claim, handle.id]],
        ]);
        const claimed = await this.attempt(handle.id);
        if (claimed.state !== 'validating' || claimed.stage_claim !== claim) return false;
        const results = await Promise.allSettled([
            this.port.batch(`metadata:${handle.id}`, [
                [`UPDATE p07_attempt SET metadata_ready=1 WHERE id=? AND state='validating' AND ${CURRENT}`, [handle.id]],
            ]),
            (async () => {
                await this.secure.store({token: input.token, privateToken: input.privateToken, version: handle.id}, row.secure_key);
                const read = await this.secure.get(['token', 'privateToken', 'version'], row.secure_key);
                assert(read.version === handle.id && read.token === input.token && read.privateToken === input.privateToken,
                    'incomplete or mismatched credential readback');
                await this.port.batch(`secure-ready:${handle.id}`, [
                    [`UPDATE p07_attempt SET secure_ready=1 WHERE id=? AND state='validating' AND ${CURRENT}`, [handle.id]],
                ]);
            })(),
        ]);
        if (results.some(result => result.status === 'rejected')) { await this.reject(handle.id); return false; }
        await this.expire();
        await this.port.batch(`prepare:${handle.id}`, [
            [`UPDATE p07_attempt SET state='prepared' WHERE id=? AND state='validating'
                AND metadata_ready=1 AND secure_ready=1 AND deadline>${CLOCK} AND ${CURRENT}`, [handle.id]],
        ]);
        return (await this.attempt(handle.id)).state === 'prepared';
    }
    async publish(handle, extraStatements = []) {
        let ack = 'received';
        try {
            await this.port.batch(`publish:${handle.id}`, [
                [`UPDATE p07_attempt SET state='expired' WHERE id=? AND state IN ${PENDING} AND deadline<=${CLOCK}`, [handle.id]],
                [`UPDATE p07_attempt SET state='confirmed' WHERE id=? AND state='prepared'
                    AND metadata_ready=1 AND secure_ready=1 AND deadline>${CLOCK} AND ${CURRENT}`, [handle.id]],
                ...extraStatements, // fault injection INSIDE transaction, only in this test fixture.
                [`UPDATE p07_authority SET published=? WHERE singleton=1 AND latest=? AND EXISTS
                    (SELECT 1 FROM p07_attempt t WHERE t.id=? AND t.state='confirmed'
                    AND t.epoch=p07_authority.epoch AND t.owner=p07_authority.owner
                    AND t.generation=p07_authority.generation)`, [handle.id, handle.id, handle.id]],
            ]);
        } catch {
            ack = 'unknown'; // Could have failed BEFORE commit OR after durable commit. Never rollback by inference.
        }
        const row = await this.attempt(handle.id);
        const a = await this.authority();
        return {state: row.state, ack, current: row.state === 'confirmed' && a.published === row.id
            && a.latest === row.id && a.owner === row.owner && a.epoch === row.epoch
            && this.localFence === handle.fence};
    }
    async restore(trustedSuap) {
        if (this.suapTransition) return null;
        const fence = this.localFence;
        const publication = async () => (await this.port.rows(`SELECT t.* FROM p07_attempt t
            JOIN p07_authority a ON a.published=t.id WHERE a.singleton=1 AND a.owner=? AND a.epoch=?
            AND t.owner=a.owner AND t.epoch=a.epoch AND t.state='confirmed'
            AND t.metadata_ready=1 AND t.secure_ready=1`, [trustedSuap.owner, trustedSuap.epoch]))[0];
        const row = await publication();
        if (!row || !this.secure) return null;
        let credentials;
        try { credentials = await this.secure.get(['token', 'privateToken', 'version'], row.secure_key); }
        catch { return null; }
        if (credentials.version !== row.id || !credentials.token || typeof credentials.privateToken !== 'string') return null;
        const current = await publication(); // Recheck AFTER asynchronous native read; A may no longer be published.
        if (current?.id !== row.id || fence !== this.localFence || this.suapTransition) return null;
        // Return a snapshot, NOT a currentSite mutation, LOGIN event, navigation or perpetual lease.
        return Object.freeze({id: row.id, site: row.site, siteId: row.site_id, course: row.course, owner: row.owner,
            epoch: row.epoch, generation: row.generation, token: credentials.token, privateToken: credentials.privateToken});
    }
    async recover(trustedSuap) {
        this.localFence++;
        await this.port.batch('recover', [
            [`UPDATE p07_attempt SET state='cancelled' WHERE state IN ${PENDING}`],
        ]);
        return this.restore(trustedSuap);
    }
    async collect(handle) {
        const row = await this.attempt(handle.id);
        if (!['cancelled', 'expired', 'rejected'].includes(row.state)) return false;
        await this.secure?.deleteCollection(row.secure_key);
        await this.port.batch(`collect:${handle.id}`, [
            ['UPDATE p07_attempt SET collected=1 WHERE id=?', [handle.id]],
        ]);
        return true; // Tombstone survives; repeat after a physically late writer recreates its own orphan.
    }
}

module.exports = {DesktopSQLitePort, SecureStorageFixture, SessionPersistenceAdapter, Gates, method, actualClass};
