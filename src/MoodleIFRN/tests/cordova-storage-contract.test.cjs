const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {CordovaJsPort, protocolAvailable} = require('./fixtures/cordova-sqlite-js-port.cjs');
const {SessionPersistenceAdapter, SecureStorageFixture} = require('./fixtures/session-persistence-adapter.cjs');
async function setup(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-p08-sqlite-'));
    const port = new CordovaJsPort(path.join(directory, 'p08.sqlite'));
    t.after(() => {
        port.close();
        assert.equal(path.dirname(fs.realpathSync(directory)).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
        assert(path.basename(directory).startsWith('ifrn-p08-sqlite-'));
        for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
        fs.rmdirSync(directory);
    });
    await port.open();
    return port;
}
const options = id => ({id, site: 'https://synthetic.invalid', siteId: 'synthetic-site', course: 'synthetic-course'});
const values = h => ({owner: h.owner, ...options(h.id), token: `synthetic-token-${h.id}`, privateToken: 'synthetic-private'});

test('cordova-contract: actual JS sqlBatch issues BEGIN/COMMIT and persists its pointer', async t => {
    const p = await setup(t);
    await p.batch('seed', ['CREATE TABLE publication(value TEXT)', "INSERT INTO publication VALUES('synthetic-A')"]);
    assert(p.trace.includes('BEGIN') && p.trace.includes('COMMIT'));
    assert.equal((await p.rows('SELECT value FROM publication'))[0].value, 'synthetic-A');
});
test('cordova-contract: real JS transaction aborts on a statement error and issues ROLLBACK', async t => {
    const p = await setup(t);
    await p.batch('schema', ['CREATE TABLE publication(id INTEGER PRIMARY KEY)']);
    await assert.rejects(p.batch('fail', ['INSERT INTO publication VALUES(1)', 'INSERT INTO publication VALUES(1)']));
    assert(p.trace.includes('ROLLBACK'));
    assert.deepEqual(await p.rows('SELECT * FROM publication'), []);
});
test('cordova-contract: concurrent batches are serialized by the actual JS transaction queue', async t => {
    const p = await setup(t);
    await p.batch('schema', ['CREATE TABLE publication(value INTEGER)']);
    await Promise.all([p.batch('A', ['INSERT INTO publication VALUES(1)']), p.batch('B', ['INSERT INTO publication VALUES(2)'])]);
    assert.deepEqual((await p.rows('SELECT value FROM publication ORDER BY rowid')).map(r => r.value), [1, 2]);
    const boundaries = p.trace.filter(op => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(op));
    assert.deepEqual(boundaries, ['BEGIN', 'COMMIT', 'BEGIN', 'COMMIT', 'BEGIN', 'COMMIT']);
});
test('cordova-contract: unknown COMMIT ACK holds the real JS queue; desktop reread assumptions cannot bypass it', async t => {
    const p = await setup(t);
    await p.batch('schema', ['CREATE TABLE publication(value INTEGER)']);
    const ack = new Promise(resolve => p.ackReady = resolve);
    p.holdCommit = true;
    const A = p.batch('A', ['INSERT INTO publication VALUES(1)']);
    await ack;
    let Bdone = false;
    const B = p.batch('B', ['INSERT INTO publication VALUES(2)']).then(() => Bdone = true);
    assert.equal(p.native.prepare('SELECT count(*) AS n FROM publication').get().n, 1, 'commit is already durable');
    await new Promise(resolve => queueMicrotask(resolve));
    assert.equal(Bdone, false, 'JS tx lock is still held until acknowledgement');
    p.commitAck();
    await Promise.all([A, B]);
    assert.equal(Bdone, true);
});
test('cordova-contract: P0.7 conditional publication works through the actual JS transaction implementation', async t => {
    const p = await setup(t), secure = new SecureStorageFixture({durableAck: true});
    const a = new SessionPersistenceAdapter(p, secure);
    await a.initialize();
    const identity = await a.setSuap('synthetic-A');
    const A = await a.begin(options('A'));
    await a.stageValidatedCandidate(A, values(A));
    await a.cancel(A);
    const B = await a.begin(options('B'));
    await a.stageValidatedCandidate(B, values(B));
    assert.equal((await a.publish(B)).current, true);
    assert.equal((await a.publish(A)).current, false);
    assert.equal((await a.restore(identity)).id, B.id);
});
test('cordova-contract: same-account reentry changes epoch and never restores the old publication', async t => {
    const p = await setup(t), a = new SessionPersistenceAdapter(p, new SecureStorageFixture({durableAck: true}));
    await a.initialize();
    const old = await a.setSuap('synthetic-A');
    const A = await a.begin(options('A'));
    await a.stageValidatedCandidate(A, values(A));await a.publish(A);
    await a.setSuap(null);
    const current = await a.setSuap('synthetic-A');
    assert(current.epoch > old.epoch);
    assert.equal(await a.restore(old), null);
    assert.equal(await a.restore(current), null);
    assert.equal((await a.publish(A)).current, false);
});
test('cordova-contract: legacy SQL sentinel survives protocol installation and failed publication', async t => {
    const p = await setup(t);
    await p.batch('legacy', ["CREATE TABLE sites_2(id TEXT PRIMARY KEY,siteUrl TEXT NOT NULL,token TEXT,info TEXT,privateToken TEXT,config TEXT,loggedOut INTEGER,oauthId INTEGER)",
        "INSERT INTO sites_2 VALUES('synthetic-legacy','https://synthetic.invalid','synthetic-token','synthetic-info','','synthetic-config',0,1)"]);
    const before = await p.rows('SELECT * FROM sites_2');
    const schemaBefore = await p.rows('PRAGMA table_info(sites_2)');
    const a = new SessionPersistenceAdapter(p, new SecureStorageFixture({durableAck: true}));
    await a.initialize();await a.setSuap('synthetic-A');
    const A = await a.begin(options('A'));await a.stageValidatedCandidate(A, values(A));
    await a.publish(A, ['INSERT INTO missing_table VALUES(1)']);
    assert.deepEqual(await p.rows('SELECT * FROM sites_2'), before);
    assert.deepEqual(await p.rows('PRAGMA table_info(sites_2)'), schemaBefore);
});
test('cordova-contract: web/unknown capabilities keep experimental protocol disabled before starting', () => {
    const supported = {enabled: true, platform: 'android', atomicBatch: true, durableCredentials: true};
    assert(protocolAvailable(supported));
    for (const unsupported of [{platform: 'web'}, {enabled: false}, {atomicBatch: false}, {durableCredentials: undefined}]) {
        assert.equal(protocolAvailable({...supported, ...unsupported}), false);
    }
});
