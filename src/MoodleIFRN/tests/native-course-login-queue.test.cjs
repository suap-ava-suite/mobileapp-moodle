const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/navigation/native-course-login-queue.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: moduleValue.exports });
const { NativeCourseLoginQueue } = moduleValue.exports;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('native callback lane retains non-cancellable work until it settles before the next account', async () => {
    const queue = new NativeCourseLoginQueue();
    const pending = deferred();
    const events = [];
    let activeA = true;
    const a = queue.run(async () => { events.push('A-start'); await pending.promise; events.push('A-settled'); }, () => {
        if (!activeA) throw new Error('stale account');
    });
    const rejected = assert.rejects(a, /stale account/);
    await Promise.resolve();
    activeA = false;
    const b = queue.run(async () => { events.push('B-start'); }, () => {});
    await Promise.resolve();
    assert.deepEqual(events, ['A-start']);
    pending.resolve();
    await rejected;
    await b;
    assert.deepEqual(events, ['A-start', 'A-settled', 'B-start']);
    await queue.idle();
});

test('cancelled queued callback never runs and a rejection permits a later retry', async () => {
    const queue = new NativeCourseLoginQueue();
    let runs = 0;
    await assert.rejects(queue.run(async () => { runs++; }, () => { throw new Error('cancelled'); }), /cancelled/);
    await assert.rejects(queue.run(async () => { throw new Error('network'); }, () => {}), /network/);
    await queue.run(async () => { runs++; }, () => {});
    assert.equal(runs, 1);
});
