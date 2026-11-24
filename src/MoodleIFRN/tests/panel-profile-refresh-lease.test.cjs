const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function loadPainelAvaService(mocks = {}) {
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
        require: id => id === '@angular/core' ? { Injectable: injectable } : mocks[id] ?? {},
        console, URL, setTimeout, clearTimeout,
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

function setupProfileRefresh() {
    const baseUrl = 'https://ava.ifrn.edu.br';
    const usuarioInfoPath = '/api/v2/usuario/info/';
    const endpoint = baseUrl + usuarioInfoPath;
    const listeners = new Map();
    const scripts = [];
    const updates = [];
    let closed = 0;
    const browser = {
        on(type) {
            return { subscribe(handler) {
                listeners.set(type, handler);
                return { unsubscribe: () => listeners.delete(type) };
            } };
        },
        close() { closed++; },
        async executeScript({ code }) { scripts.push(code); },
    };
    const PainelAvaService = loadPainelAvaService({
        '@static/opener': { CoreOpener: { openInApp: url => {
            assert.equal(url, endpoint);
            return browser;
        } } },
        './painel-ava.config': { PAINEL_AVA_CONFIG: { baseUrl, usuarioInfoPath } },
        './suap-login-telemetry': { consumeFreshPanelProfile: () => false },
        '../mobilemoodle/core_mobile/oauth-profile': { readOAuthProfile: () => ({ identity: 'conta-ficticia' }) },
        '../mobilemoodle/core_mobile/profile-refresh': { hasVerifiedSuapDisplayName: () => false, refreshSavedProfileNames: (...args) => {
            updates.push(args.slice(0, 3));
            return true;
        } },
    });
    const service = Object.create(PainelAvaService.prototype);
    service.courseSsoBrowserLeaseCount = 0;

    return { service, endpoint, baseUrl, scripts, updates, closed: () => closed,
        emit: (type, value) => listeners.get(type)?.(value) };
}

test('a revalidação aceita o parâmetro lang que o CoreOpener acrescenta ao endpoint autorizado', async () => {
    const s = setupProfileRefresh();
    const result = s.service.refreshSavedProfile();
    const navigationUrl = s.endpoint + '?lang=pt_br';
    s.emit('loadstart', { url: navigationUrl });
    s.emit('loadstop', { url: navigationUrl });
    const profile = { id: 5, identificacao: 'conta-ficticia', nome_usual: 'Nome Usual' };
    s.emit('message', { data: { type: 'ifrn-profile-refresh', profile, url: s.endpoint } });
    assert.equal(await result, true);
    assert.equal(s.scripts.length, 1);
    assert.deepEqual(s.updates, [[profile, s.endpoint, s.baseUrl]]);
    assert.equal(s.closed(), 1);
});

test('a revalidação recusa outro destino e parâmetros alheios ao idioma', async () => {
    for (const url of [
        'https://externo.example/api/v2/usuario/info/', 'https://ava.ifrn.edu.br/login/',
        'https://ava.ifrn.edu.br/api/v2/usuario/info/?lang=pt_br&next=login',
    ]) {
        const s = setupProfileRefresh();
        const result = s.service.refreshSavedProfile();
        s.emit('loadstart', { url });
        s.emit('loadstop', { url });
        s.emit('exit', {});
        assert.equal(await result, false);
        assert.equal(s.closed(), 1);
        assert.equal(s.scripts.length, 0);
        assert.equal(s.updates.length, 0);
    }
});
