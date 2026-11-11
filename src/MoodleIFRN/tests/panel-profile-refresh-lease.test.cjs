const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function loadPainelAvaService() {
    const module = { exports: {} };
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: {
            experimentalDecorators: true,
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
    }).outputText;
    const injectable = () => target => target;
    vm.runInNewContext(output, {
        exports: module.exports,
        require: id => id === '@angular/core' ? { Injectable: injectable } : {},
        console,
    });

    return module.exports.PainelAvaService;
}

function deferred() {
    let resolve;
    const promise = new Promise(done => resolve = done);

    return { promise, resolve };
}

test('course SSO lease cancels and drains profile refresh, then blocks new refreshes until release', async () => {
    const PainelAvaService = loadPainelAvaService();
    const service = Object.create(PainelAvaService.prototype);
    const refresh = deferred();
    let cancelCount = 0;
    service.courseSsoBrowserLeaseCount = 0;
    service.profileRefresh = refresh.promise;
    service.cancelProfileRefresh = () => {
        cancelCount++;
        refresh.resolve(false);
    };

    const firstLeasePromise = service.acquireCourseSsoBrowserLease();
    assert.equal(cancelCount, 1, 'an active profile browser is closed before the course browser starts');
    const firstRelease = await firstLeasePromise;
    assert.equal(await service.refreshSavedProfile(), false, 'refresh is suppressed during course OAuth');

    const secondRelease = await service.acquireCourseSsoBrowserLease();
    firstRelease();
    assert.equal(await service.refreshSavedProfile(), false, 'one active lease still blocks a competing browser');

    secondRelease();
    secondRelease();
    assert.equal(service.courseSsoBrowserLeaseCount, 0, 'lease release is idempotent');
});
