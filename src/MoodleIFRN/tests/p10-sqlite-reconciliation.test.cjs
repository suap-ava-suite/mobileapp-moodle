'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionLedger } = require('./fixtures/p10-sqlite-extension/ledger.cjs');

async function withLedger(t, run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-p10-'));
    const filename = path.join(dir, 'ledger.sqlite');
    let ledger = new SessionLedger(filename);
    t.after(() => {
        try { ledger?.close(); } catch { /* already closed for restart case */ }
        fs.rmSync(dir, { recursive: true, force: true });
    });
    await run({ filename, get ledger() { return ledger; }, getLedger: () => ledger,
        replace: () => { try { ledger.close(); } catch { /* the injected I/O fault already closed it */ }
            ledger = new SessionLedger(filename); } });
}

const meta = (operationId, overrides = {}) => ({
    operationId, attemptId: `attempt-${operationId}`, owner: 'suap-test-A', epoch: 1, generation: 1, ...overrides,
});

test('p10: receipt and publication pointer commit atomically and ACK reconciles', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-1'));
    const result = ledger.publish(reserved);
    assert.equal(result.status, 'committed');
    assert.equal(ledger.reconcile(reserved).status, 'committed');
    assert.equal(ledger.pointer().operation_id, 'op-1');
    assert.equal(ledger.receipt('op-1').sequence, reserved.sequence);
}));

test('p10: failure before COMMIT rolls back pointer and receipt without automatic replay', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-precommit'));
    assert.throws(() => ledger.publish(reserved, { beforeCommit() { throw new Error('synthetic pre-commit failure'); } }));
    assert.equal(ledger.reconcile(reserved).status, 'rolled-back');
    assert.equal(ledger.receipt('op-precommit'), undefined);
    assert.equal(ledger.pointer(), undefined);
}));

test('p10: lost ACK after COMMIT is unknown until close/reopen proves the durable receipt', async t => withLedger(t, async ({ ledger, replace, getLedger }) => {
    const reserved = ledger.reserve(meta('op-lost-ack'));
    assert.throws(() => ledger.publish(reserved, { afterCommit() { throw new Error('lost JS ACK'); } }));
    assert.equal(ledger.reconcile(reserved).status, 'unknown');
    replace();
    const barrier = { kind: 'p10-ledger-close-reopen-v1', operationId: reserved.operationId, sequence: reserved.sequence };
    assert.equal(getLedger().reconcile(reserved, barrier).status, 'committed');
    assert.equal(getLedger().receipt('op-lost-ack').sequence, reserved.sequence);
}));

test('p10: an older operation cannot publish after a newer reservation (A then B)', async t => withLedger(t, async ({ ledger }) => {
    const a = ledger.reserve(meta('op-A'));
    const b = ledger.reserve(meta('op-B', { owner: 'suap-test-B', epoch: 2, generation: 2 }));
    assert.equal(ledger.publish(a).status, 'rejected-stale');
    assert.equal(ledger.publish(b).status, 'committed');
    assert.equal(ledger.pointer().owner, 'suap-test-B');
}));

test('p10: same-owner reentry uses a newer epoch and generation', async t => withLedger(t, async ({ ledger }) => {
    const first = ledger.reserve(meta('op-reentry-1'));
    ledger.publish(first);
    const second = ledger.reserve(meta('op-reentry-2', { epoch: 2, generation: 2 }));
    assert.equal(ledger.publish(first).status, 'committed'); // idempotent receipt lookup, no write replay.
    assert.equal(ledger.publish(second).status, 'committed');
    assert.equal(ledger.pointer().operation_id, 'op-reentry-2');
    assert.ok(second.sequence > first.sequence);
}));

test('p10: unknown terminality remains quarantined and cannot be reconciled from a guessed absence', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-unknown'));
    assert.deepEqual(ledger.reconcile(reserved), { status: 'unknown', reason: 'transaction-terminality-unproven' });
    assert.equal(ledger.pointer(), undefined);
}));

test('p10: physically open transaction is unknown until isolated connection close/reopen rolls it back', async t => withLedger(t, async ({ filename, ledger, replace, getLedger }) => {
    const reserved = ledger.reserve(meta('op-open-txn'));
    ledger.db.exec('BEGIN IMMEDIATE');
    ledger.db.prepare(`INSERT INTO session_pointer(id, operation_id, sequence, attempt_id, owner, epoch, generation)
        VALUES(1, ?, ?, ?, ?, ?, ?)`)
        .run(reserved.operationId, reserved.sequence, reserved.attemptId, reserved.owner, reserved.epoch, reserved.generation);
    ledger.db.prepare(`INSERT INTO session_receipt(operation_id, sequence, attempt_id, owner, epoch, generation,
        publication_result, confirmation_state) VALUES(?, ?, ?, ?, ?, ?, 'published', 'committed')`)
        .run(reserved.operationId, reserved.sequence, reserved.attemptId, reserved.owner, reserved.epoch, reserved.generation);
    assert.equal(ledger.reconcile(reserved).status, 'unknown');
    replace(); // Close/reopen is isolated to this test ledger; SQLite rolls back open txn.
    const barrier = { kind: 'p10-ledger-close-reopen-v1', operationId: reserved.operationId, sequence: reserved.sequence };
    assert.equal(getLedger().reconcile(reserved, barrier).status, 'rolled-back');
    assert.equal(getLedger().receipt(reserved.operationId), undefined);
    assert.ok(fs.statSync(filename).size > 0);
}));

test('p10: injected failure between pointer and receipt rolls back both', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-atomic'));
    assert.throws(() => ledger.publish(reserved, { beforeCommit(db) {
        db.prepare(`INSERT INTO session_pointer(id, operation_id, sequence, attempt_id, owner, epoch, generation)
            VALUES(1, ?, ?, ?, ?, ?, ?)`)
            .run(reserved.operationId, reserved.sequence, reserved.attemptId, reserved.owner, reserved.epoch, reserved.generation);
        throw new Error('failure after pointer write');
    } }));
    assert.equal(ledger.pointer(), undefined);
    assert.equal(ledger.receipt('op-atomic'), undefined);
    assert.equal(ledger.reconcile(reserved).status, 'rolled-back');
}));

test('p10: delayed callback does not hold ledger transaction queue after terminal COMMIT', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-delayed'));
    let releaseAck;
    const ack = new Promise(resolve => { releaseAck = resolve; });
    const write = ledger.publish(reserved);
    const delayedResponse = ack.then(() => write);
    assert.equal(ledger.reconcile(reserved).status, 'committed');
    releaseAck();
    assert.equal((await delayedResponse).status, 'committed');
}));

test('p10: process restart recovers only a committed receipt', async t => withLedger(t, async ({ filename, ledger, replace, getLedger }) => {
    const reserved = ledger.reserve(meta('op-restart'));
    ledger.publish(reserved);
    replace();
    assert.equal(getLedger().reconcile(reserved).status, 'unknown');
    // Fresh connection is the experiment's explicit close/reopen terminality barrier.
    const barrier = { kind: 'p10-ledger-close-reopen-v1', operationId: reserved.operationId, sequence: reserved.sequence };
    assert.equal(getLedger().reconcile(reserved, barrier).status, 'committed');
    assert.ok(fs.statSync(filename).size > 0);
}));

test('p10: receipt from another operation or altered epoch is rejected', async t => withLedger(t, async ({ ledger }) => {
    const reserved = ledger.reserve(meta('op-valid'));
    ledger.publish(reserved);
    assert.equal(ledger.reconcile({ ...reserved, operationId: 'op-forged' }).status, 'unknown');
    assert.equal(ledger.reconcile({ ...reserved, epoch: 99 }).status, 'rejected-invalid-receipt');
}));

test('p10: consecutive operations do not inherit an old callback result', async t => withLedger(t, async ({ ledger }) => {
    const a = ledger.reserve(meta('op-consecutive-A'));
    ledger.publish(a);
    const b = ledger.reserve(meta('op-consecutive-B', { generation: 2 }));
    ledger.publish(b);
    assert.equal(ledger.reconcile(a).status, 'rejected-stale');
    assert.equal(ledger.reconcile(b).status, 'committed');
}));

test('p10: a confirmed receipt is insufficient after a newer attempt reserves the fence', async t => withLedger(t, async ({ ledger }) => {
    const a = ledger.reserve(meta('op-confirmed-A'));
    ledger.publish(a);
    ledger.reserve(meta('op-pending-B', { owner: 'suap-test-B', epoch: 2, generation: 2 }));
    assert.equal(ledger.reconcile(a).status, 'rejected-stale');
    assert.equal(ledger.pointer().operation_id, 'op-confirmed-A');
}));

test('p10: simultaneous old/new publications are ordered by the durable generation fence', async t => withLedger(t, async ({ ledger }) => {
    const a = ledger.reserve(meta('op-race-A'));
    const b = ledger.reserve(meta('op-race-B', { owner: 'suap-test-B', epoch: 2, generation: 2 }));
    const results = await Promise.all([Promise.resolve().then(() => ledger.publish(a)), Promise.resolve().then(() => ledger.publish(b))]);
    assert.deepEqual(results.map(result => result.status), ['rejected-stale', 'committed']);
    assert.equal(ledger.pointer().operation_id, 'op-race-B');
}));

test('p10: I/O failure during reconciliation remains unknown until a fresh connection barrier', async t => withLedger(t, async ({ ledger, replace, getLedger }) => {
    const reserved = ledger.reserve(meta('op-reconcile-io'));
    ledger.publish(reserved);
    ledger.db.close();
    assert.equal(ledger.reconcile(reserved).status, 'unknown');
    replace();
    const barrier = { kind: 'p10-ledger-close-reopen-v1', operationId: reserved.operationId, sequence: reserved.sequence };
    assert.equal(getLedger().reconcile(reserved, barrier).status, 'committed');
}));

test('p10 bridge: unknown is quarantined and no operation is automatically replayed', async () => {
    const calls = [];
    const { SQLiteSessionLedgerBridge } = require('./fixtures/p10-sqlite-extension/SQLiteSessionLedgerBridge.js');
    const bridge = new SQLiteSessionLedgerBridge((success, failure, service, action, args) => {
        calls.push({ service, action, args }); success({ state: 'unknown' });
    });
    const attempt = { ...meta('bridge-op'), sequence: 7 };
    assert.deepEqual(await bridge.publish(attempt), { state: 'unknown', quarantined: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, 'sessionLedgerPublish');
});
