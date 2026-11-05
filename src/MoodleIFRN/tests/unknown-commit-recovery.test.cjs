'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {UnknownCommitGuard, RecoveryUnavailable} = require('./fixtures/p09/unknown-commit.cjs');

function removeTempFixture(root, prefix) {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const realRoot = fs.realpathSync(root);
    assert.equal(path.dirname(realRoot), fs.realpathSync(os.tmpdir()));
    assert(path.basename(realRoot).startsWith(prefix));
    fs.rmSync(realRoot, {recursive: true, force: true});
}

function directBridgeBatch(port, sql) {
    return new Promise((resolve, reject) => port.dispatch(resolve, reject,
        'backgroundExecuteSqlBatch', [{dbargs: {dbname: port.context.db.dbname}, executes: [{sql, params: []}]}]));
}

const fenceA = () => ({id: 'synthetic-A', owner: 'suap-hash-A', epoch: 1, generation: 1});

test('p09: unknown COMMIT quarantines the ledger and never retries the write', async () => {
    const guard = new UnknownCommitGuard();
    const fence = guard.begin(fenceA());
    guard.commitSubmitted(fence);
    guard.ackUnknown(fence.id);

    assert.equal(guard.canStartAnotherAttempt(), false);
    await assert.rejects(guard.reconcile(fence.id, {}), RecoveryUnavailable);
    assert.equal(guard.canStartAnotherAttempt(), false);
    assert.equal(guard.isPublished(fence.id), false);
});

test('p09: only a native barrier receipt can release a confirmed current generation', async () => {
    const guard = new UnknownCommitGuard();
    const fence = guard.begin(fenceA());
    guard.commitSubmitted(fence);
    guard.ackUnknown(fence.id);
    let calls = 0;
    const nativeApi = {
        capability: 'committed-receipt-barrier-v1',
        async reconcileAfterConnectionBarrier(request) {
            calls++;
            assert.equal(request.operationId, fence.id);
            return {operationId: fence.id, sequence: request.submittedSequence + 1,
                barrierSatisfied: true, outcome: 'committed', matchesDurablePointer: true};
        },
    };

    const result = await guard.reconcile(fence.id, nativeApi);
    assert.deepEqual(result, {state: 'reconciled-committed', operationId: fence.id, publish: true});
    assert.equal(calls, 1, 'reconciliation is a read/barrier; it does not replay the commit');
    assert.equal(guard.canStartAnotherAttempt(), true);
    assert.equal(guard.isPublished(fence.id), true);
});

test('p09: missing or malformed barrier proof leaves the attempt quarantined', async () => {
    for (const receipt of [null, {operationId: 'other', barrierSatisfied: true, outcome: 'committed', sequence: 99}]) {
        const guard = new UnknownCommitGuard();
        const fence = guard.begin(fenceA());
        guard.commitSubmitted(fence);
        guard.ackUnknown(fence.id);
        await assert.rejects(guard.reconcile(fence.id, {
            capability: 'committed-receipt-barrier-v1',
            async reconcileAfterConnectionBarrier() { return receipt; },
        }));
        assert.equal(guard.canStartAnotherAttempt(), false);
        assert.equal(guard.isPublished(fence.id), false);
    }
});

test('p09: a confirmed late commit from an obsolete account epoch is never published', async () => {
    const guard = new UnknownCommitGuard();
    const old = guard.begin(fenceA());
    guard.commitSubmitted(old);
    guard.ackUnknown(old.id);

    // A signed-out/identity-change fence supersedes A, but quarantine still
    // prevents starting/publishing a new session in this ledger.
    guard.advanceIdentityFence({id: 'synthetic-B', owner: 'suap-hash-B', epoch: 2, generation: 2});
    const result = await guard.reconcile(old.id, {
        capability: 'committed-receipt-barrier-v1',
        async reconcileAfterConnectionBarrier(request) {
            return {operationId: request.operationId, sequence: request.submittedSequence + 1,
                barrierSatisfied: true, outcome: 'committed', matchesDurablePointer: true};
        },
    });

    assert.equal(result.publish, false);
    assert.equal(guard.isPublished(old.id), false);
});

test('p09: proven rollback resolves without publication and never retries', async () => {
    const guard = new UnknownCommitGuard();
    const fence = guard.begin(fenceA());
    guard.commitSubmitted(fence);
    guard.ackUnknown(fence.id);
    const result = await guard.reconcile(fence.id, {
        capability: 'committed-receipt-barrier-v1',
        async reconcileAfterConnectionBarrier(request) {
            return {operationId: request.operationId, sequence: request.submittedSequence + 1,
                barrierSatisfied: true, outcome: 'aborted', matchesDurablePointer: false};
        },
    });
    assert.equal(result.state, 'reconciled-aborted');
    assert.equal(result.publish, false);
    assert.equal(guard.isPublished(fence.id), false);
});

test('p09: a direct same-connection receipt read can see uncommitted rows before COMMIT', async t => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const {CordovaJsPort} = require('./fixtures/cordova-sqlite-js-port.cjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-p09-open-tx-'));
    const port = new CordovaJsPort(path.join(dir, 'isolated.sqlite'));
    t.after(() => { port.close(); removeTempFixture(dir, 'ifrn-p09-open-tx-'); });
    await port.open();
    await port.batch('schema', ['CREATE TABLE receipt(op TEXT PRIMARY KEY, state TEXT)']);

    let releaseStatementAck;
    let ready;
    const statementHeld = new Promise(resolve => ready = resolve);
    const nativeDispatch = port.dispatch.bind(port);
    let holdNextReceipt = true;
    port.dispatch = (ok, fail, action, args) => {
        const statements = args?.[0]?.executes || [];
        if (holdNextReceipt && statements.some(({sql}) => sql.includes('INSERT INTO receipt'))) {
            holdNextReceipt = false;
            nativeDispatch(results => { releaseStatementAck = () => ok(results); ready(); }, fail, action, args);
            return;
        }
        nativeDispatch(ok, fail, action, args);
    };

    const A = port.batch('attempt-A', ["INSERT INTO receipt VALUES('A','candidate')"]);
    await statementHeld;
    const response = await directBridgeBatch(port, "SELECT op,state FROM receipt WHERE op='A'");
    assert.equal(response[0].result.rows[0].state, 'candidate', 'the native helper shares the still-open transaction connection');

    releaseStatementAck();
    await A;
    assert.equal((await port.rows('SELECT count(*) AS n FROM receipt WHERE op=\'A\''))[0].n, 1);
});
