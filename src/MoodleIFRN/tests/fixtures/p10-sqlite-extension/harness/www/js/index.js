'use strict';

const output = document.getElementById('results');
const state = document.getElementById('state');
const results = [];
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function check(name, condition, detail) {
    results.push({ name, passed: Boolean(condition), detail });
    output.textContent = JSON.stringify(results, null, 2);
    if (!condition) throw new Error(`${name}: ${detail}`);
}

function base(operationId, generation = 1, owner = 'synthetic-owner', epoch = 1) {
    return { operationId: `${runId}-${operationId}`, attemptId: `${runId}-attempt-${operationId}`,
        owner, epoch, generation };
}

function call(method, attempt) {
    return new Promise((resolve, reject) => window.sqlitePlugin[method](attempt, resolve, reject));
}

async function prepare(attempt) {
    const response = await call('sessionLedgerPublish', { ...attempt, phase: 'reserve' });
    if (response.state !== 'prepared') throw new Error(`reserve returned ${response.state}`);
    return { ...attempt, sequence: response.sequence };
}

async function publish(attempt) {
    const prepared = attempt.sequence ? attempt : await prepare(attempt);
    return call('sessionLedgerPublish', { ...prepared, phase: 'commit' });
}

function reconcile(attempt) {
    return call('sessionLedgerReconcile', attempt);
}

async function run() {
    try {
        const normal = await publish(base('normal'));
        check('Cordova exec → dispatcher → SQLite publish callback', normal.state === 'committed', normal.state);
        const recovered = await reconcile({ ...base('normal'), sequence: normal.sequence });
        check('native close/reopen reconciliation finds committed receipt', recovered.state === 'committed', recovered.state);

        const droppedAttempt = await prepare(base('lost-ack'));
        let deliberatelyIgnoredCallback = false;
        cordova.exec(() => { deliberatelyIgnoredCallback = true; }, error => { throw new Error(String(error)); },
            'SQLitePlugin', 'sessionLedgerPublish', [{ ...droppedAttempt, phase: 'commit' }]);
        await new Promise(resolve => setTimeout(resolve, 300));
        const afterLostAck = await reconcile(droppedAttempt);
        check('ignored JS ACK after native callback reconciles to commit', deliberatelyIgnoredCallback && afterLostAck.state === 'committed', afterLostAck.state);

        const delayedAttempt = await prepare(base('delayed-callback'));
        const delayedResult = new Promise((resolve, reject) => window.sqlitePlugin.sessionLedgerPublish(
            { ...delayedAttempt, phase: 'commit' }, result => setTimeout(() => resolve(result), 450), reject));
        const parallelReconcile = reconcile(delayedAttempt);
        const [late, reconciled] = await Promise.all([delayedResult, parallelReconcile]);
        check('delayed JS callback cannot invalidate native reconciliation', late.state === 'committed' && reconciled.state === 'committed', `${late.state}/${reconciled.state}`);

        const a = await prepare(base('account-A', 1, 'synthetic-A', 1));
        const b = await prepare(base('account-B', 2, 'synthetic-B', 2));
        const aResult = await call('sessionLedgerPublish', { ...a, phase: 'commit' });
        const bResult = await call('sessionLedgerPublish', { ...b, phase: 'commit' });
        check('new B reservation fences cancelled A', aResult.state === 'rejected-stale' && bResult.state === 'committed', `${aResult.state}/${bResult.state}`);

        const reentryA = await publish(base('reentry-old', 4, 'synthetic-A', 4));
        const reentryB = await publish(base('reentry-new', 5, 'synthetic-A', 5));
        const oldRead = await reconcile({ ...base('reentry-old', 4, 'synthetic-A', 4), sequence: reentryA.sequence });
        check('same identity re-entry with new epoch/generation fences old receipt', reentryB.state === 'committed' && oldRead.state === 'rejected-stale', `${reentryB.state}/${oldRead.state}`);

        state.textContent = 'Harness concluído';
        check('all Cordova bridge scenarios passed', results.every(item => item.passed), `${results.length} checks`);
    } catch (error) {
        state.textContent = 'Harness falhou';
        results.push({ name: 'fatal', passed: false, detail: String(error) });
        output.textContent = JSON.stringify(results, null, 2);
    }
}

document.addEventListener('deviceready', () => {
    state.textContent = `Cordova ${cordova.version} pronto; banco sintético isolado`;
    run();
}, false);
