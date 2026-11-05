const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const {DesktopSQLitePort, SecureStorageFixture, SessionPersistenceAdapter, method, actualClass} =
    require('./fixtures/session-persistence-adapter.cjs');

const SITE = 'https://academic.synthetic.invalid';
async function fixture(t, options = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moodle-ifrn-p07-'));
    const filename = path.join(directory, 'session.sqlite');
    const ports = [];
    const open = () => { const port = new DesktopSQLitePort(filename); ports.push(port); return port; };
    const port = open();
    const secure = new SecureStorageFixture({durableAck: options.durableAck ?? true});
    const adapter = new SessionPersistenceAdapter(port, secure);
    t.after(() => {
        for (const p of ports) { try { p.close(); } catch {} }
        // Only the known synthetic test directory; no recursive deletion or shell cleanup.
        assert.equal(path.dirname(fs.realpathSync(directory)).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
        assert(path.basename(directory).startsWith('moodle-ifrn-p07-'));
        for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
        fs.rmdirSync(directory);
    });
    await adapter.initialize();
    const identity = await adapter.setSuap('synthetic-A');
    return {adapter, port, secure, identity, open, filename};
}
const begin = (a, id, options = {}) => a.begin({id, site: SITE, siteId: 'synthetic-site', course: 'synthetic-course', ...options});
const input = (h, overrides = {}) => ({owner: h.owner, site: SITE, siteId: 'synthetic-site', course: 'synthetic-course',
    token: `synthetic-token-${h.id}`, privateToken: `synthetic-private-${h.id}`, ...overrides});
async function complete(a, id, options) {
    const h = await begin(a, id, options);
    assert.equal(await a.stageValidatedCandidate(h, input(h, options)), true);
    assert.deepEqual(await a.publish(h), {state: 'confirmed', ack: 'received', current: true});
    return h;
}

test('persistence: real SQLite persists a confirmed version across a fresh connection', async t => {
    const {adapter: a, identity, open, secure} = await fixture(t);
    const A = await complete(a, 'A');
    const next = new SessionPersistenceAdapter(open(), secure);
    await next.initialize();
    const restored = await next.recover(identity);
    assert.equal(restored.id, A.id);
    assert.equal(restored.token, 'synthetic-token-A');
    const B = await begin(next, 'B');
    assert.equal(B.generation, A.generation + 1);
    assert.notEqual(B.key, A.key);
});

test('persistence: actual core executeBatch rolls back the full SQL batch on the native-style desktop driver', async t => {
    const {port} = await fixture(t);
    await port.batch('probe-schema', ['CREATE TABLE probe(id INTEGER PRIMARY KEY)']);
    await assert.rejects(port.batch('probe-rollback', ['INSERT INTO probe VALUES(1)', 'INSERT INTO probe VALUES(1)']));
    assert.deepEqual(await port.rows('SELECT * FROM probe'), []);
});

test('persistence: actual web sqlBatch leaves a partial batch; adapter refuses this capability', async () => {
    const port = new DesktopSQLitePort(':memory:', {mode: 'web-actual-method'});
    try {
        await port.batch('probe-schema', ['CREATE TABLE probe(id INTEGER PRIMARY KEY)']);
        await assert.rejects(port.batch('probe-partial', ['INSERT INTO probe VALUES(1)', 'INSERT INTO probe VALUES(1)']));
        assert.equal((await port.rows('SELECT * FROM probe')).length, 1);
        assert.throws(() => new SessionPersistenceAdapter(port, new SecureStorageFixture()), /atomic sqlBatch unavailable/);
    } finally { port.close(); }
});

test('persistence: apply-style ACK and successful readback do not demonstrate secure durability', async () => {
    const secure = new SecureStorageFixture();
    await secure.store({token: 'synthetic-token', version: 'A'}, 'synthetic-A');
    assert.equal((await secure.get(['token'], 'synthetic-A')).token, 'synthetic-token');
    secure.loseProcess();
    assert.deepEqual(await secure.get(['token'], 'synthetic-A'), {});
});

for (const missing of [false, true]) {
    test(`persistence: ${missing ? 'missing plugin' : 'current apply-style secure contract'} cannot publish`, async t => {
        const f = await fixture(t, {durableAck: false});
        const a = missing ? new SessionPersistenceAdapter(f.port, undefined) : f.adapter;
        const A = await begin(a, 'A');
        assert.equal(await a.stageValidatedCandidate(A, input(A)), false);
        assert.equal((await a.publish(A)).state, 'rejected');
        assert.equal(await a.restore(f.identity), null);
        assert.equal(f.secure.memory.size, 0);
    });
}

for (const sameAccount of [false, true]) {
    for (const held of ['metadata', 'secure-apply', 'secure-ack', 'publish']) {
        test(`persistence: late ${held} A cannot replace B (${sameAccount ? 'same account' : 'account switch'})`, async t => {
            const f = await fixture(t), {adapter: a, port, secure} = f;
            const A = await begin(a, 'A');
            const storeLabel = `secure:${A.key}`;
            if (held === 'metadata') port.gates.hold('metadata:A');
            if (held === 'secure-apply') secure.gates.hold(storeLabel);
            if (held === 'secure-ack') secure.gates.hold(storeLabel, 'ack');
            let pending = a.stageValidatedCandidate(A, input(A));
            if (held === 'publish') {
                assert.equal(await pending, true);
                port.gates.hold('publish:A');
                pending = a.publish(A);
                await port.gates.wait('publish:A');
            } else if (held === 'metadata') await port.gates.wait('metadata:A');
            else await secure.gates.wait(storeLabel, held === 'secure-ack' ? 'ack' : 'apply');
            assert.equal(await a.cancel(A), 'cancelled');
            const identity = sameAccount ? f.identity : await a.setSuap('synthetic-B');
            const B = await complete(a, 'B');
            if (held === 'metadata') await port.gates.run('metadata:A');
            else if (held === 'publish') await port.gates.run('publish:A');
            else await secure.gates.run(storeLabel, held === 'secure-ack' ? 'ack' : 'apply');
            const result = await pending;
            assert.equal(held === 'publish' ? result.state : result, held === 'publish' ? 'cancelled' : false);
            assert.equal((await a.restore(identity)).id, B.id);
            assert.equal((await a.restore(identity)).token, 'synthetic-token-B');
            assert.equal((await a.attempt(A.id)).state, 'cancelled');
            assert.notEqual(A.key, B.key);
            await a.collect(A);
            assert(secure.memory.has(B.key));
        });
    }
}

test('persistence: superseding begin alone fences A, without needing an explicit cancel', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    port.gates.hold('publish:A');
    const pending = a.publish(A);
    await port.gates.wait('publish:A');
    const B = await complete(a, 'B');
    await port.gates.run('publish:A');
    assert.equal((await pending).current, false);
    assert.equal((await a.restore(identity)).id, B.id);
});

test('persistence: same-account logout/reentry increments epoch and fences the old physical writer', async t => {
    const {adapter: a, secure} = await fixture(t);
    const A = await begin(a, 'A');
    secure.gates.hold(`secure:${A.key}`);
    const pending = a.stageValidatedCandidate(A, input(A));
    await secure.gates.wait(`secure:${A.key}`);
    const logout = await a.setSuap(null);
    await assert.rejects(begin(a, 'absent'), /SUAP identity required/);
    const identity = await a.setSuap('synthetic-A');
    assert(identity.epoch > logout.epoch && identity.epoch > A.epoch);
    const B = await complete(a, 'B');
    await secure.gates.run(`secure:${A.key}`);
    assert.equal(await pending, false);
    assert.equal((await a.restore(identity)).id, B.id);
});

for (const position of ['metadata', 'secure', 'partial-secure', 'secure-ack']) {
    test(`persistence: failure at ${position} never exposes a partially prepared session`, async t => {
        const {adapter: a, secure, port, identity} = await fixture(t);
        const A = await begin(a, 'A');
        const label = `secure:${A.key}`;
        if (position === 'metadata') port.gates.hold('metadata:A');
        if (position === 'secure') secure.gates.hold(label);
        if (position === 'secure-ack') secure.gates.hold(label, 'ack');
        if (position === 'partial-secure') secure.partial = true;
        const pending = a.stageValidatedCandidate(A, input(A));
        if (position === 'metadata') await port.gates.run('metadata:A', 'apply', 'synthetic SQL error');
        if (position === 'secure') await secure.gates.run(label, 'apply', 'synthetic plugin error');
        if (position === 'secure-ack') await secure.gates.run(label, 'ack', 'synthetic ACK error');
        assert.equal(await pending, false);
        assert.equal((await a.publish(A)).state, 'rejected');
        assert.equal(await a.restore(identity), null);
        await a.collect(A);
        assert.equal(secure.memory.size, 0);
    });
}

test('persistence: failure between state change and pointer update rolls back both in SQLite', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    const result = await a.publish(A, ['INSERT INTO p07_missing_table VALUES(1)']);
    assert.equal(result.ack, 'unknown');
    assert.equal(result.state, 'prepared');
    assert.equal((await a.authority()).published, null);
    assert.equal(await a.restore(identity), null);
    assert.equal((await port.rows('PRAGMA integrity_check'))[0].integrity_check, 'ok');
});

for (const lost of [false, true]) {
    test(`persistence: ${lost ? 'lost' : 'delayed'} commit ACK cannot roll back a durable confirmation`, async t => {
        const {adapter: a, port, identity, open, secure} = await fixture(t);
        const A = await begin(a, 'A');
        await a.stageValidatedCandidate(A, input(A));
        port.gates.hold('publish:A', 'ack');
        const pending = a.publish(A);
        await port.gates.wait('publish:A', 'ack');
        assert.equal((await a.attempt(A.id)).state, 'confirmed');
        assert.equal(await a.cancel(A), 'confirmed');
        assert.equal((await a.restore(identity)).id, A.id);
        await port.gates.run('publish:A', 'ack', lost ? 'synthetic lost ACK' : undefined);
        const receipt = await pending;
        assert.equal(receipt.state, 'confirmed');
        assert.equal(receipt.ack, lost ? 'unknown' : 'received');
        assert.equal(receipt.current, false, 'local cancellation revoked delivery even though commit already won');
        const next = new SessionPersistenceAdapter(open(), secure);
        assert.equal((await next.recover(identity)).id, A.id);
    });
}

test('persistence: B completes while the durable A ACK is pending; A receipt cannot authorize delivery', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    port.gates.hold('publish:A', 'ack');
    const pending = a.publish(A);
    await port.gates.wait('publish:A', 'ack');
    const B = await complete(a, 'B');
    await port.gates.run('publish:A', 'ack');
    assert.equal((await pending).current, false);
    assert.equal((await a.restore(identity)).id, B.id);
});

for (const phase of ['created', 'prepared', 'publish-queued', 'confirmed-no-ack']) {
    test(`persistence: fresh-connection recovery at ${phase} restores only confirmed versions`, async t => {
        const {adapter: a, port, secure, open, identity} = await fixture(t);
        const A = await begin(a, 'A');
        let pending;
        if (phase !== 'created') await a.stageValidatedCandidate(A, input(A));
        if (phase === 'publish-queued') {
            port.gates.hold('publish:A');
            pending = a.publish(A);
            await port.gates.wait('publish:A');
        }
        if (phase === 'confirmed-no-ack') {
            port.gates.hold('publish:A', 'ack');
            pending = a.publish(A);
            await port.gates.wait('publish:A', 'ack');
        }
        const next = new SessionPersistenceAdapter(open(), secure);
        const restored = await next.recover(identity);
        assert.equal(restored?.id ?? null, phase === 'confirmed-no-ack' ? A.id : null);
        if (pending) {
            await port.gates.run('publish:A', phase === 'publish-queued' ? 'apply' : 'ack');
            await pending;
        }
        assert.equal((await next.restore(identity))?.id ?? null, phase === 'confirmed-no-ack' ? A.id : null);
    });
}

test('persistence: missing/version-mismatched credentials or wrong SUAP identity fail closed on restore', async t => {
    const {adapter: a, identity, secure} = await fixture(t);
    const A = await complete(a, 'A');
    for (const owner of ['synthetic-B', null]) assert.equal(await a.restore({owner, epoch: identity.epoch}), null);
    assert.equal(await a.restore({...identity, epoch: identity.epoch + 1}), null);
    secure.memory.get(A.key).version = 'synthetic-wrong-version';
    assert.equal(await a.restore(identity), null);
    secure.memory.delete(A.key);
    assert.equal(await a.restore(identity), null);
});

test('persistence: async secure read rechecks publication after B replaces A', async t => {
    const {adapter: a, secure, identity} = await fixture(t);
    const A = await complete(a, 'A');
    secure.gates.hold(`read:${A.key}`);
    const restoring = a.restore(identity);
    await secure.gates.wait(`read:${A.key}`);
    const B = await complete(a, 'B');
    await secure.gates.run(`read:${A.key}`);
    assert.equal(await restoring, null);
    assert.equal((await a.restore(identity)).id, B.id);
});

test('persistence: logout while async secure read is pending prevents restore', async t => {
    const {adapter: a, secure, identity} = await fixture(t);
    const A = await complete(a, 'A');
    secure.gates.hold(`read:${A.key}`);
    const restoring = a.restore(identity);
    await secure.gates.wait(`read:${A.key}`);
    await a.setSuap(null);
    await secure.gates.run(`read:${A.key}`);
    assert.equal(await restoring, null);
});

test('persistence: tombstone collection before late secure write cannot delete B', async t => {
    const {adapter: a, secure, identity} = await fixture(t);
    const A = await begin(a, 'A');
    secure.gates.hold(`secure:${A.key}`);
    const pending = a.stageValidatedCandidate(A, input(A));
    await secure.gates.wait(`secure:${A.key}`);
    await a.cancel(A);
    await a.collect(A);
    const B = await complete(a, 'B');
    await secure.gates.run(`secure:${A.key}`);
    assert.equal(await pending, false);
    assert(secure.memory.has(A.key));
    await a.collect(A);
    assert(!secure.memory.has(A.key));
    assert(secure.memory.has(B.key));
    assert.equal(await a.collect(B), false);
    assert.equal((await a.restore(identity)).id, B.id);
});

test('persistence: native execution checks deadline in SQL, not at submission', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    port.gates.hold('publish:A');
    const pending = a.publish(A);
    await port.gates.wait('publish:A');
    await port.core.execute('UPDATE p07_test_clock SET ms=100');
    await port.gates.run('publish:A');
    assert.equal((await pending).state, 'expired');
    assert.equal(await a.restore(identity), null);
});

test('persistence: duplicate IDs cannot overwrite a credential version or regress generation', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await complete(a, 'A');
    const previous = await a.authority();
    await assert.rejects(begin(a, 'A'));
    assert.deepEqual(await a.authority(), previous, 'failed begin is fully rolled back');
    assert.equal((await a.restore(identity)).id, A.id);
    const B = await begin(a, 'B');
    assert.equal(B.generation, A.generation + 1);
    const records = await port.rows('SELECT * FROM p07_attempt');
    assert(records.every(row => !('token' in row) && !('privateToken' in row)));
});

test('persistence: repeated publication/cancel is idempotent; confirmed versions are never collected', async t => {
    const {adapter: a, identity} = await fixture(t);
    const A = await complete(a, 'A');
    assert.equal((await a.publish(A)).state, 'confirmed');
    assert.equal(await a.cancel(A), 'confirmed');
    assert.equal(await a.cancel(A), 'confirmed');
    assert.equal(await a.collect(A), false);
    assert.equal((await a.restore(identity)).id, A.id);
});

test('persistence: SQL lock contention fails closed and cannot publish a partial attempt', async t => {
    const {adapter: a, port, open, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    const other = open();
    other.db.exec('BEGIN IMMEDIATE');
    try {
        const result = await a.publish(A);
        assert.equal(result.state, 'prepared');
        assert.equal(result.ack, 'unknown');
        assert.equal(await a.restore(identity), null);
    } finally { other.db.exec('ROLLBACK'); }
    assert.equal((await a.publish(A)).state, 'confirmed');
    assert.equal((await port.rows('PRAGMA integrity_check'))[0].integrity_check, 'ok');
});

test('persistence: a second process sees the durable SQLite publication, but not an interrupted transaction', async t => {
    const {adapter: a, filename, port} = await fixture(t);
    const worker = path.join(__dirname, 'fixtures/session-sqlite-worker.cjs');
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    const interrupted = cp.spawnSync(process.execPath, [worker, filename, 'exit-with-open-transaction', A.id], {encoding: 'utf8'});
    assert.equal(interrupted.status, 23, interrupted.error?.message || interrupted.stderr);
    const inspect = () => {
        const result = cp.spawnSync(process.execPath, [worker, filename, 'inspect', A.id], {encoding: 'utf8'});
        assert.equal(result.status, 0, result.error?.message || result.stderr);
        return JSON.parse(result.stdout);
    };
    assert.deepEqual(inspect(), {state: 'prepared', published: null});
    await a.publish(A);
    assert.deepEqual(inspect(), {state: 'confirmed', published: A.id});
    assert.equal((await port.rows('PRAGMA integrity_check'))[0].integrity_check, 'ok');
});

test('persistence: metadata and credentials are snapshotted before asynchronous staging', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    const A = await begin(a, 'A');
    const values = input(A);
    port.gates.hold('validate:A');
    const pending = a.stageValidatedCandidate(A, values);
    await port.gates.wait('validate:A');
    values.owner = 'synthetic-other';
    values.token = 'synthetic-other-token';
    await port.gates.run('validate:A');
    assert.equal(await pending, true);
    await a.publish(A);
    assert.equal((await a.restore(identity)).token, 'synthetic-token-A');
});

test('persistence: competing stagers cannot rewrite the same version, even across adapter instances', async t => {
    const {adapter: a, port, secure, open, identity} = await fixture(t);
    const A = await begin(a, 'A');
    const other = new SessionPersistenceAdapter(open(), secure);
    port.gates.hold('validate:A');
    const old = a.stageValidatedCandidate(A, input(A));
    await port.gates.wait('validate:A');
    assert.equal(await other.stageValidatedCandidate(A, input(A, {token: 'synthetic-new-owner-token'})), true);
    await port.gates.run('validate:A');
    assert.equal(await old, false);
    await a.publish(A);
    assert.equal((await a.restore(identity)).token, 'synthetic-new-owner-token');
    assert.equal(await a.stageValidatedCandidate(A, input(A, {token: 'synthetic-late-token'})), false);
    assert.equal((await a.restore(identity)).token, 'synthetic-new-owner-token');
});

test('persistence: schema initialization is repeatable and refuses unknown future versions', async t => {
    const {adapter: a, port} = await fixture(t);
    await complete(a, 'A');
    const before = await a.authority();
    await a.initialize();
    assert.deepEqual(await a.authority(), before);
    await port.core.execute('UPDATE p07_schema SET version=99');
    await assert.rejects(a.initialize(), /unsupported experimental schema/);
    assert.deepEqual(await a.authority(), before);
});

test('persistence: SUAP logout intent blocks local restore and begin while its native transaction is queued', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    await complete(a, 'A');
    port.gates.hold('suap');
    const logout = a.setSuap(null);
    await port.gates.wait('suap');
    assert.equal((await a.authority()).owner, 'synthetic-A', 'durable transition has not happened yet');
    assert.equal(await a.restore(identity), null);
    await assert.rejects(begin(a, 'B'), /SUAP transition unresolved/);
    await port.gates.run('suap');
    await logout;
    assert.equal(await a.restore(identity), null);
});

test('persistence: a failed SUAP revocation ACK stays locally blocked until explicit reconciliation', async t => {
    const {adapter: a, port, identity} = await fixture(t);
    await complete(a, 'A');
    port.gates.hold('suap', 'ack');
    const logout = a.setSuap(null);
    await port.gates.run('suap', 'ack', 'synthetic uncertain ACK');
    await assert.rejects(logout);
    assert.equal(await a.restore(identity), null);
    await assert.rejects(begin(a, 'B'), /SUAP transition unresolved/);
    const fresh = await a.setSuap('synthetic-A');
    await complete(a, 'B');
    assert.equal((await a.restore(fresh)).id, 'B');
});

test('persistence: raw SQL does not automatically refresh a real eager-table getter', async t => {
    const {port} = await fixture(t);
    await port.batch('cache-schema', [
        'CREATE TABLE p07_cache_probe(id TEXT PRIMARY KEY,value TEXT)',
        ["INSERT INTO p07_cache_probe VALUES('current',?)", ['synthetic-A']],
    ]);
    const Getter = actualClass('Getter', [method('src/core/classes/database/eager-database-table.ts', 'getOneByPrimaryKey')]);
    const getter = new Getter();
    getter.serializePrimaryKey = key => key.id;
    getter.records = {current: (await port.rows('SELECT * FROM p07_cache_probe'))[0]};
    await port.core.execute("UPDATE p07_cache_probe SET value='synthetic-B' WHERE id='current'");
    assert.equal((await getter.getOneByPrimaryKey({id: 'current'})).value, 'synthetic-A');
    assert.equal((await port.rows('SELECT * FROM p07_cache_probe'))[0].value, 'synthetic-B');
});

test('persistence: a second connection publishes B without relying on the first adapter local fence', async t => {
    const {adapter: a, port, secure, open, identity} = await fixture(t);
    const A = await begin(a, 'A');
    await a.stageValidatedCandidate(A, input(A));
    const fence = a.localFence;
    port.gates.hold('publish:A');
    const pending = a.publish(A);
    await port.gates.wait('publish:A');
    const other = new SessionPersistenceAdapter(open(), secure);
    const B = await complete(other, 'B');
    assert.equal(a.localFence, fence, 'the first JS instance has not seen the second local coordinator');
    await port.gates.run('publish:A');
    assert.equal((await pending).state, 'cancelled');
    const restored = await a.restore(identity);
    assert.equal(restored.id, B.id);
    assert.equal(restored.privateToken, 'synthetic-private-B');
    assert(Object.isFrozen(restored));
});

test('persistence: Academic and Presential versions are separate and preserve previously confirmed credentials', async t => {
    const {adapter: a, identity, secure, port} = await fixture(t);
    const academic = await complete(a, 'academic');
    const presential = await complete(a, 'presential', {site: 'https://presential.synthetic.invalid',
        siteId: 'synthetic-presential-site', course: 'synthetic-presential-course'});
    const restored = await a.restore(identity);
    assert.equal(restored.id, presential.id);
    assert.equal(restored.site, 'https://presential.synthetic.invalid');
    assert.equal(restored.course, 'synthetic-presential-course');
    assert(secure.memory.has(academic.key) && secure.memory.has(presential.key));
    assert.equal((await port.rows("SELECT id FROM p07_attempt WHERE state='confirmed'")).length, 2);
    assert.equal(await a.collect(academic), false);
});

test('persistence: recovering a newer unfinished attempt preserves the earlier legitimate confirmed publication', async t => {
    const {adapter: a, identity, secure, open} = await fixture(t);
    const A = await complete(a, 'A');
    const B = await begin(a, 'B');
    await a.stageValidatedCandidate(B, input(B));
    const next = new SessionPersistenceAdapter(open(), secure);
    assert.equal((await next.recover(identity)).id, A.id);
    assert.equal((await next.attempt(B.id)).state, 'cancelled');
    assert.equal((await a.publish(B)).current, false);
    assert.equal((await next.restore(identity)).id, A.id);
});
