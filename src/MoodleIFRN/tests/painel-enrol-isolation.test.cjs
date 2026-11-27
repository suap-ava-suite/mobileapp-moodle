const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const rxjs = require('rxjs');

function setup() {
    const ownerKey = 'ifrn_painel_owner';
    const epochKey = 'ifrn_moodle_session_epoch';
    const pendingKey = 'ifrn_painel_pending_enrol';
    const values = new Map([[ownerKey, 'conta-a'], ['ifrn_username', 'conta-a'], [epochKey, '1'], ['expiry', 1]]);
    const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
    const browsers = [];
    const navigations = [];
    const errors = [];
    const timers = new Map();
    const window = {
        setTimeout: callback => { const id = Symbol(); timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
    };
    const load = (path, mocks) => {
        const source = ts.transpileModule(fs.readFileSync('src/MoodleIFRN/' + path, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const exports = {};
        vm.runInNewContext(source, { exports, require: key => mocks[key] || {}, AbortController,
            Error, URL, window, sessionStorage: storage, localStorage: storage });

        return exports;
    };
    const { PainelAvaService } = load('services_mobile/painel-ava.service.ts', {
        '@angular/core': { Injectable: () => type => type },
        'rxjs': rxjs,
        './govbr-redirect-handoff': { GovBrRedirectHandoff: class {} },
        '../mobilemoodle/core_mobile/oauth-profile': {
            hasOAuthProfileMode: () => true,
            readOAuthProfile: () => ({ identity: values.get('ifrn_username'), expiresAt: values.get('expiry') }),
        },
        '../mobilemoodle/core_mobile/course-session-flags': { COURSE_SESSION_EPOCH_KEY: epochKey },
        './painel-ava.config': {
            PAINEL_AVA_CONFIG: { baseUrl: 'https://ava.example.test', diariosPath: '/diarios/' },
            isPainelAvaBrowserUrl: url => url.startsWith('https://ava.example.test/'),
        },
        '@static/opener': { CoreOpener: { getInAppBrowserInstance: () => browsers.at(-1), openInApp() {
            const events = new Map();
            const browser = {
                closes: 0,
                scripts: [],
                on(name) {
                    if (!events.has(name)) events.set(name, new rxjs.Subject());
                    return events.get(name);
                },
                fire(name, data = {}) { events.get(name)?.next(data); },
                close() { this.closes++; this.fire('exit'); },
                hide() {},
                insertCSS: async () => {},
                async executeScript({ code }) { this.scripts.push(code); },
            };
            browsers.push(browser);
            return browser;
        } } },
    });
    const service = new PainelAvaService();
    const platform = { ready: async () => {} };
    const alerts = { async showError(message) { errors.push(message); } };
    const route = { courseId: 42, ambienteId: 3 };
    const { PainelEnrolPage } = load('painel-enrol/painel-enrol.ts', {
        '@angular/core': { Component: () => type => type, inject: () => service },
        'rxjs': rxjs,
        '@services/platform': { CorePlatform: platform },
        '@services/overlays/alerts': { CoreAlerts: alerts },
        '@services/navigator': { CoreNavigator: {
            getRouteNumberParam: key => route[key],
            async navigate(path) { navigations.push(path); return true; },
        } },
    });
    const begin = (browser) => {
        browser.fire('loadstop', { url: 'https://ava.example.test/' });
        return Number(browser.scripts[0].match(/attempt: (\d+)/)[1]);
    };
    const answer = (browser, attempt, courseid = 42, status = 'enrolled') => browser.fire('message', { data: {
        type: 'ifrn-painel-enrol', attempt, ok: true, result: { status, courseid }, dashboard: { diarios: [courseid] },
    } });
    const changeOwner = (id, epoch) => {
        values.set(ownerKey, id);
        values.set('ifrn_username', id);
        values.set(epochKey, epoch);
    };
    return { service, platform, alerts, route, pendingKey, values, browsers, navigations, errors, timers, begin, answer,
        changeOwner, page: () => new PainelEnrolPage() };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('resposta aceita da tentativa atual salva o dashboard, fecha a janela e volta ao Painel', async () => {
    const h = setup();
    const page = h.page();
    const done = page.ngOnInit();
    await tick();
    const [browser] = h.browsers;
    const attempt = h.begin(browser);
    assert.match(browser.scripts[0], /\/curso\/3\/42\/enrol\//);
    h.answer(browser, attempt, 42, 'reactivated');
    await done;
    assert.equal(page.message, 'Inscrição reativada.');
    assert.equal(h.values.get('ifrn_painel_dashboard'), '{"diarios":[42]}');
    assert.equal(h.values.get('ifrn_painel_owner'), 'conta-a');
    assert.deepEqual(h.navigations, ['/login/painel']);
    assert.equal(browser.closes, 1);
    assert.equal(h.timers.size, 0);
});

test('mudança de conta e retorno tardio não gravam nem navegam, inclusive após voltar à mesma identidade', async () => {
    for (const switchBack of [false, true]) {
        const h = setup();
        const done = h.page().ngOnInit();
        await tick();
        const [browser] = h.browsers;
        const attempt = h.begin(browser);
        h.changeOwner('conta-b', '2');
        if (switchBack) h.changeOwner('conta-a', '3');
        h.answer(browser, attempt);
        await done;
        assert.equal(h.values.has('ifrn_painel_dashboard'), false);
        assert.deepEqual(h.navigations, []);
        assert.deepEqual(h.errors, []);
        assert.equal(browser.closes, 1);
    }
});

test('cancelamento explícito e saída da tela liberam a janela e descartam a resposta', async () => {
    const h = setup();
    const scope = h.service.prepareCourseEnrolment(42, 3);
    const result = rxjs.firstValueFrom(scope.result, { defaultValue: null });
    const attempt = h.begin(h.browsers[0]);
    scope.cancel();
    h.answer(h.browsers[0], attempt);
    assert.equal(await result, null);

    const page = h.page();
    const done = page.ngOnInit();
    await tick();
    const second = h.browsers[1];
    const secondId = h.begin(second);
    page.ionViewWillLeave();
    h.answer(second, secondId);
    await done;
    assert.equal(h.values.has('ifrn_painel_dashboard'), false);
    assert.deepEqual(h.navigations, []);
    assert.deepEqual(h.browsers.map(browser => browser.closes), [1, 1]);
});

test('nova sessão OAuth da mesma conta invalida uma resposta da sessão anterior', async () => {
    const h = setup();
    const done = h.page().ngOnInit();
    await tick();
    const browser = h.browsers[0];
    const attempt = h.begin(browser);
    h.values.set('expiry', 2);
    h.answer(browser, attempt);
    await done;
    assert.equal(h.values.has('ifrn_painel_dashboard'), false);
    assert.deepEqual(h.navigations, []);
});

test('tentativas sucessivas rejeitam mensagens antigas e só concluem o curso atual', async () => {
    const h = setup();
    const old = h.page().ngOnInit();
    await tick();
    const oldId = h.begin(h.browsers[0]);
    h.route.courseId = 43;
    const current = h.page().ngOnInit();
    await tick();
    const browser = h.browsers[1];
    const currentId = h.begin(browser);
    assert.notEqual(oldId, currentId);
    h.answer(browser, oldId);
    h.answer(h.browsers[0], oldId);
    assert.equal(h.values.has('ifrn_painel_dashboard'), false);
    h.answer(browser, currentId, 43);
    await Promise.all([old, current]);
    assert.equal(h.values.get('ifrn_painel_dashboard'), '{"diarios":[43]}');
    assert.deepEqual(h.navigations, ['/login/painel']);
});

test('falha de comunicação avisa, mas sair enquanto o aviso está aberto impede retorno tardio', async () => {
    const h = setup();
    let dismiss;
    const alert = new Promise(resolve => dismiss = resolve);
    h.alerts.showError = message => { h.errors.push(message); return alert; };
    const page = h.page();
    const done = page.ngOnInit();
    await tick();
    h.browsers[0].fire('loaderror');
    await tick();
    assert.match(h.errors[0], /conectar ao Painel AVA/);
    page.ionViewWillLeave();
    dismiss();
    await done;
    assert.deepEqual(h.navigations, []);
    assert.equal(h.values.has('ifrn_painel_dashboard'), false);
    assert.equal(h.timers.size, 0);
});

test('sair antes de a plataforma ficar pronta impede abrir o navegador', async () => {
    const h = setup();
    let ready;
    h.platform.ready = () => new Promise(resolve => ready = resolve);
    const page = h.page();
    const done = page.ngOnInit();
    page.ngOnDestroy();
    ready();
    await done;
    assert.equal(h.browsers.length, 0);
});
