const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const rxjs = require('rxjs');

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const panelSource = compile('src/MoodleIFRN/services_mobile/painel-ava.service.ts');
const browserSource = compile('src/MoodleIFRN/services_mobile/suap-profile-browser.service.ts');
const page = { title: 'AVA (Moodle)', url: 'https://suap.ifrn.edu.br/centralservicos/',
    allowedHosts: ['suap.ifrn.edu.br'] };
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(preferVerifiedSuapDisplayName = () => {}) {
    const windows = [];
    const timers = new Set();
    const scripts = [];
    const opener = { openInApp(url) {
        // The real Android plugin dismisses the preceding dialog without sending it an exit event.
        const previous = windows.at(-1);
        if (previous) previous.visible = false;
        const listeners = new Map();
        const browser = { url, visible: false, closed: 0,
            on(name) { return { subscribe(callback) {
                if (!listeners.has(name)) listeners.set(name, new Set());
                listeners.get(name).add(callback);
                return { unsubscribe: () => listeners.get(name).delete(callback) };
            } }; },
            emit(name, event = {}) { for (const listener of [...listeners.get(name) || []]) listener(event); },
            show() { browser.visible = true; },
            close() { browser.closed++; browser.visible = false; browser.emit('exit'); },
            async insertCSS() {},
            async executeScript({ code }) { scripts.push(code); },
            _loadAfterBeforeload() {},
        };
        windows.push(browser);
        return browser;
    }, closeInAppBrowser() { windows.at(-1)?.close(); } };
    const common = { URL, console, performance, setTimeout: callback => { timers.add(callback); return callback; },
        clearTimeout: callback => timers.delete(callback) };
    const panelMocks = {
        '@angular/core': { Injectable: () => value => value },
        '@static/opener': { CoreOpener: opener },
        rxjs,
        './suap-login-telemetry': { consumeFreshPanelProfile: () => false, reportSuapDuration() {} },
        './painel-ava.config': { PAINEL_AVA_CONFIG: {
            baseUrl: 'https://ava.ifrn.edu.br', usuarioInfoPath: '/api/v2/usuario/info/',
        }, isGovBrAuthenticationUrl: () => false },
        '../mobilemoodle/core_mobile/oauth-profile': { readOAuthProfile: () => ({ identity: 'synthetic-owner' }) },
        '../mobilemoodle/core_mobile/profile-refresh': { hasVerifiedSuapDisplayName: () => false, preferVerifiedSuapDisplayName },
    };
    const panelContext = { ...common, exports: {}, require: id => panelMocks[id] || {} };
    vm.runInNewContext(panelSource, panelContext);
    const panel = Object.create(panelContext.exports.PainelAvaService.prototype);
    panel.courseSsoBrowserLeaseCount = 0;
    panel.govBrRedirectHandoff = { clear() {} };
    class NgZone {}
    const browserMocks = {
        '@angular/core': { Injectable: () => value => value, NgZone,
            inject: token => token === NgZone ? { run: callback => callback() } : panel },
        '@static/opener': { CoreOpener: opener },
        './painel-ava.service': { PainelAvaService: panelContext.exports.PainelAvaService },
        './govbr-browser.service': { GovBrBrowserService: class {}, isGovBrAuthorizationUrl: () => false },
    };
    const browserContext = { ...common, exports: {}, require: id => browserMocks[id] || {} };
    vm.runInNewContext(browserSource, browserContext);
    const service = new browserContext.exports.SuapProfileBrowserService();
    return { panel, service, windows, timers, opener, scripts };
}

test('primeiro login consulta o SUAP na janela autenticada mesmo quando o AVA já informou a identidade', async () => {
    const old = { identificacao: 'conta-ficticia', nome_usual: 'Nom Antig' };
    const official = { identificacao: 'conta-ficticia', nome_usual: 'Nome Usual' };
    const s = setup((panel, suap) => {
        assert.equal(panel, old);
        assert.equal(suap, official);
        return { ...panel, nome_exibicao: suap.nome_usual };
    });
    const response = rxjs.firstValueFrom(s.panel.authenticateWithBrowser({ readOnly: true, verifySuapDisplayName: true }));
    const browser = s.windows[0];
    browser.emit('message', { data: { type: 'ifrn-painel-diarios', ok: true, profile: old, payload: { diarios: [] } } });
    assert.match(s.scripts[0], /https:\/\/suap\.ifrn\.edu\.br\//);
    assert.equal(browser.closed, 0);
    browser.emit('loadstop', { url: 'https://suap.ifrn.edu.br/' });
    assert.match(s.scripts[1], /\/api\/rh\/eu\//);
    browser.emit('message', { data: { type: 'ifrn-suap-identity', profile: official } });
    const result = await response;
    assert.equal(result.diagnosticProfile.nome_exibicao, 'Nome Usual');
    assert.equal(result.diagnosticOwner, 'conta-ficticia');
    assert.equal(s.windows.length, 1);
    assert.equal(s.timers.size, 0);
});

test('erro na consulta complementar do SUAP mantém o perfil já autenticado do Painel', async () => {
    const profile = { identificacao: 'conta-ficticia', nome_usual: 'Nome Usual' };
    const s = setup();
    const response = rxjs.firstValueFrom(s.panel.authenticateWithBrowser({ readOnly: true, verifySuapDisplayName: true }));
    const browser = s.windows[0];
    browser.emit('message', { data: { type: 'ifrn-painel-diarios', ok: true, profile, payload: { diarios: [] } } });
    browser.emit('loaderror');
    assert.equal((await response).diagnosticProfile, profile);
    assert.equal(s.windows.length, 1);
    assert.equal(s.timers.size, 0);
});

test('profile refresh cannot replace a visible Help browser and leave Angular waiting for its lost exit', async () => {
    const s = setup();
    const states = [];
    s.service.openPage(page, { onReady: () => states.push('ready'), onError: assert.fail,
        onExit: () => states.push('exit') });
    await tick();
    const help = s.windows[0];
    help.emit('loadstop', { url: page.url });
    assert.equal(help.visible, true);

    const refresh = s.panel.refreshSavedProfile();
    await tick();
    const windowCount = s.windows.length;
    const helpStillVisible = help.visible;
    // Release a competing refresh even on the old, failing implementation.
    s.panel.stopProfileRefresh();
    await refresh;
    help.close();
    assert.equal(windowCount, 1, 'a background refresh must not open a second native window');
    assert.equal(helpStillVisible, true, 'the Help page stays visible throughout the refresh request');
    assert.deepEqual(states, ['ready', 'exit']);
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);

    s.service.openPage(page, { onReady() {}, onError: assert.fail, onExit() {} });
    await tick();
    assert.equal(s.windows.length, 2, 'another Help item works after returning');
    s.service.close();
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
});

test('opening Help drains an existing background profile browser before creating the interactive window', async () => {
    const s = setup();
    const refresh = s.panel.refreshSavedProfile();
    const profile = s.windows[0];
    s.service.openPage(page, { onReady() {}, onError: assert.fail, onExit() {} });
    await tick();
    const closedBeforeHelp = profile.closed;
    const windowCount = s.windows.length;
    s.panel.stopProfileRefresh();
    await refresh;
    s.service.close();
    assert.equal(closedBeforeHelp, 1, 'the pending profile window must be closed first');
    assert.equal(windowCount, 2);
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
    assert.equal(s.timers.size, 0);
});

test('closing Help while the profile browser drains cannot open a late window or retain its lease', async () => {
    const s = setup();
    let finishRefresh;
    s.panel.profileRefresh = new Promise(resolve => finishRefresh = resolve);
    s.panel.cancelProfileRefresh = () => {};
    let exits = 0;
    s.service.openPage(page, { onReady: assert.fail, onError: assert.fail, onExit: () => exits++ });
    s.service.close();
    const windowsBeforeDrain = s.windows.length;
    finishRefresh(false);
    await tick();
    assert.equal(windowsBeforeDrain, 0);
    assert.equal(s.windows.length, 0);
    assert.equal(exits, 1);
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
});

test('blocked navigation releases the reservation once and another Help item remains usable', async () => {
    const s = setup();
    const states = [];
    const handlers = { onReady() {}, onError: message => states.push(message), onExit: () => states.push('exit') };
    s.service.openPage(page, handlers);
    await tick();
    const first = s.windows[0];
    first.emit('beforeload', { url: 'https://attacker.example/login' });
    assert.match(states[0], /não autorizado/);
    assert.equal(states[1], 'exit');
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
    first.emit('exit');
    assert.equal(states.length, 2, 'duplicate or late exit cannot affect another request');
    s.service.openPage(page, handlers);
    await tick();
    assert.equal(s.windows.length, 2);
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 1);
    first.emit('exit');
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 1);
    s.service.close();
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
});

test('native browser creation failure releases the reservation without leaving Help locked', async () => {
    const s = setup();
    const errors = [];
    let exits = 0;
    s.opener.openInApp = () => { throw new Error('synthetic native error'); };
    s.service.openPage(page, { onReady: assert.fail, onError: message => errors.push(message), onExit: () => exits++ });
    await tick();
    assert.equal(errors.length, 1);
    assert.doesNotMatch(errors[0], /synthetic/);
    assert.equal(exits, 1);
    assert.equal(s.panel.courseSsoBrowserLeaseCount, 0);
    assert.equal(s.service.attempt, undefined);
});
