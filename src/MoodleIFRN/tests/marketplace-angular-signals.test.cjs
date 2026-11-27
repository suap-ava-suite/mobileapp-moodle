const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const angular = require('@angular/core');

function token(name) {
    return { [name]: class {} }[name];
}

function loadMarketplace() {
    const tokens = {
        AuthService: token('AuthService'),
        ActivatedRoute: token('ActivatedRoute'),
        Router: token('Router'),
        CoreSharedModule: token('CoreSharedModule'),
        PainelAvaService: token('PainelAvaService'),
        CoreLang: token('CoreLang'),
        CorePlatform: token('CorePlatform'),
        CoreNavigator: token('CoreNavigator'),
        CoreOpener: token('CoreOpener'),
        SuapEntryService: token('SuapEntryService'),
        SuapEntryAccountError: class SuapEntryAccountError extends Error {},
        CoreEvents: token('CoreEvents'),
        GovBrBrowserService: token('GovBrBrowserService'),
        NgZone: token('NgZone'),
    };
    const dependencies = new Map(Object.values(tokens).map(value => [value, {}]));
    const state = { nativeEntry: null };
    const listeners = new Map();
    const storage = new Map();
    let metadata;
    const angularMock = {
        ChangeDetectionStrategy: angular.ChangeDetectionStrategy,
        computed: angular.computed,
        signal: angular.signal,
        NgZone: tokens.NgZone,
        inject: dependency => dependencies.get(dependency) || {},
        Component: value => component => {
            metadata = value;
            return component;
        },
    };
    const mocks = {
        '@angular/core': angularMock,
        '@/MoodleIFRN/services_mobile/auth.service': { AuthService: tokens.AuthService },
        '@angular/router': { ActivatedRoute: tokens.ActivatedRoute, Router: tokens.Router },
        '../navigation/suap-entry-state': { readNativeSuapEntry: () => state.nativeEntry },
        '@/core/shared.module': { CoreSharedModule: tokens.CoreSharedModule },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService: tokens.PainelAvaService },
        '@services/lang': { CoreLang: tokens.CoreLang },
        '@services/platform': { CorePlatform: tokens.CorePlatform },
        '@services/navigator': { CoreNavigator: tokens.CoreNavigator },
        '@static/opener': { CoreOpener: tokens.CoreOpener },
        '@/MoodleIFRN/services_mobile/suap-entry.service': {
            SuapEntryService: tokens.SuapEntryService,
            SuapEntryAccountError: tokens.SuapEntryAccountError,
        },
        '../services_mobile/suap-login-telemetry': { reportSuapDuration() {} },
        '@static/events': { CoreEvents: tokens.CoreEvents },
        '../services_mobile/painel-ava.config': { GOVBR_MOBILE_UNAVAILABLE_MESSAGE: 'unavailable' },
        '../services_mobile/govbr-browser.service': { GovBrBrowserService: tokens.GovBrBrowserService },
    };
    const context = {
        exports: {},
        require: id => mocks[id] || {},
        console,
        Error,
        document: {
            addEventListener: (name, callback) => listeners.set(name, callback),
            removeEventListener: name => listeners.delete(name),
        },
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            removeItem: key => storage.delete(key),
        },
        performance: require('node:perf_hooks').performance,
        window: { requestAnimationFrame: callback => callback() },
    };
    const source = fs.readFileSync('src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts', 'utf8');
    const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(javascript, context);

    return {
        MarketplaceIfrnPage: context.exports.MarketplaceIfrnPage,
        metadata,
        dependencies,
        tokens,
        state,
        listeners,
    };
}

test('Marketplace usa OnPush e signals Angular para estado reativo de transição', () => {
    const { MarketplaceIfrnPage, metadata } = loadMarketplace();
    const page = new MarketplaceIfrnPage();

    assert.equal(metadata.changeDetection, angular.ChangeDetectionStrategy.OnPush);
    assert.equal(page.showTransition, false);
    assert.equal(page.transitionCaption, 'Carregando painel...');

    page.loading = true;
    assert.equal(page.showTransition, true);
    assert.equal(page.transitionCaption, 'Carregando painel...');

    page.govBrBrowserOpening = true;
    assert.equal(page.transitionCaption, 'Abrindo o navegador seguro...');

    page.govBrBrowserOpening = false;
    page.waitingBrowser = true;
    assert.equal(page.transitionCaption, 'Conclua o login no navegador');

    page.waitingBrowser = false;
    page.loading = false;
    page.statusMessage = 'Validando acesso';
    assert.equal(page.showTransition, false);
    assert.equal(page.transitionCaption, 'Validando acesso');
});

test('primeiro login sem sessão não navega para a mesma rota e ignora clique duplicado', async () => {
    const { MarketplaceIfrnPage, dependencies, tokens } = loadMarketplace();
    const page = new MarketplaceIfrnPage();
    const route = dependencies.get(tokens.ActivatedRoute);
    const router = dependencies.get(tokens.Router);
    const auth = dependencies.get(tokens.AuthService);
    const painel = dependencies.get(tokens.PainelAvaService);
    const suap = dependencies.get(tokens.SuapEntryService);
    let loginCalls = 0;
    let signalLoginStarted;
    let finishLogin;
    const loginStarted = new Promise(resolve => signalLoginStarted = resolve);
    const loginPending = new Promise(resolve => finishLogin = resolve);

    route.snapshot = undefined;
    router.navigate = async () => assert.fail('não deve navegar sem query de retorno');
    auth.isAuthenticated = () => false;
    painel.hasDashboard = () => false;
    suap.loginWithSuap = () => {
        loginCalls++;
        signalLoginStarted();
        return loginPending;
    };

    const firstAttempt = page.enterAva();
    await loginStarted;
    await page.enterAva();

    assert.equal(loginCalls, 1);
    assert.equal(page.loading, true);

    finishLogin();
    await firstAttempt;
    assert.equal(page.loading, false);
});

test('entrada após callback limpa a query nativeSuapReturn antes do novo login', async () => {
    const { MarketplaceIfrnPage, dependencies, tokens } = loadMarketplace();
    const page = new MarketplaceIfrnPage();
    const route = dependencies.get(tokens.ActivatedRoute);
    const router = dependencies.get(tokens.Router);
    const auth = dependencies.get(tokens.AuthService);
    const painel = dependencies.get(tokens.PainelAvaService);
    const suap = dependencies.get(tokens.SuapEntryService);
    const navigationCalls = [];

    route.snapshot = { queryParamMap: { has: key => key === 'nativeSuapReturn' } };
    router.navigate = async (...args) => navigationCalls.push(args);
    auth.isAuthenticated = () => false;
    painel.hasDashboard = () => false;
    suap.loginWithSuap = async () => {};

    await page.enterAva();

    assert.equal(navigationCalls.length, 1);
    assert.equal(navigationCalls[0][1].queryParams.nativeSuapReturn, null);
    assert.equal(navigationCalls[0][1].queryParamsHandling, 'merge');
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });

    return { promise, resolve, reject };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function setupLifecycle() {
    const h = loadMarketplace();
    const get = key => ['CorePlatform', 'CoreNavigator', 'CoreEvents'].includes(key)
        ? h.tokens[key] : h.dependencies.get(h.tokens[key]);
    const page = new h.MarketplaceIfrnPage();
    const suap = get('SuapEntryService');
    const route = { nativeSuapReturn: false };
    const stats = { eventRegistrations: 0, eventOff: 0, queryOff: 0 };
    const nativeReturn = () => ({ get: key => route[key] ? 'true' : null });
    function emitQuery() { stats.query?.(nativeReturn()); }
    get('AuthService').isAuthenticated = () => false;
    get('PainelAvaService').hasDashboard = () => false;
    get('PainelAvaService').clearGovBrRedirectUrl = () => {};
    get('CorePlatform').ready = async () => {};
    get('CoreNavigator').getRouteBooleanParam = key => !!route[key];
    get('NgZone').run = callback => callback();
    get('ActivatedRoute').queryParamMap = { subscribe(callback) {
        stats.query = callback;
        emitQuery();

        return { unsubscribe: () => { stats.queryOff++; stats.query = undefined; } };
    } };
    get('CoreEvents').on = (_name, callback) => {
        stats.eventRegistrations++;
        stats.authFailure = callback;

        return { off: () => { stats.eventOff++; stats.authFailure = undefined; } };
    };
    suap.cancelConnection = () => {};
    suap.cancel = () => { h.state.nativeEntry = null; };

    return { ...h, get, page, suap, route, stats, emitQuery };
}

test('destruição antes da plataforma ficar pronta impede o registro de listeners', async () => {
    const h = setupLifecycle();
    const platform = deferred();
    h.get('CorePlatform').ready = () => platform.promise;
    const initializing = h.page.ngOnInit();
    h.page.ngOnDestroy();
    platform.resolve();
    await initializing;
    assert.equal(h.stats.eventRegistrations, 0);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.stats.query, undefined);
});

test('cancelamento seguido de nova tentativa ignora status, erro e finally antigos', async () => {
    const h = setupLifecycle();
    const first = deferred();
    const second = deferred();
    let oldStatus;
    let calls = 0;
    h.suap.loginWithSuap = (_identity, status) => {
        if (++calls === 1) {
            oldStatus = status;
            return first.promise;
        }
        return second.promise;
    };

    const old = h.page.enterAva();
    await tick();
    h.page.cancelConnection();
    const current = h.page.enterAva();
    await tick();
    oldStatus('Status antigo');
    first.reject(new Error('Erro antigo'));
    await old;
    assert.equal(h.page.statusMessage, 'Acessando o SUAP…');
    assert.equal(h.page.formError, '');
    assert.equal(h.page.loading, true);
    second.reject(new Error('Sem conexão'));
    await current;
    assert.equal(h.page.formError, 'Sem conexão');
    assert.equal(h.page.loading, false);
});

test('retorno duplicado durante o login abre uma única conclusão e ignora retorno antigo após cancelamento', async () => {
    const h = setupLifecycle();
    const login = deferred();
    const completion = deferred();
    let completeCalls = 0;
    let oldStatus;
    h.suap.loginWithSuap = () => login.promise;
    h.suap.complete = (status) => {
        completeCalls++;
        oldStatus = status;
        return completion.promise;
    };
    await h.page.ngOnInit();
    const opening = h.page.enterAva();
    await tick();
    h.state.nativeEntry = {};
    h.route.nativeSuapReturn = true;
    h.emitQuery();
    h.emitQuery();
    login.resolve();
    await tick();
    h.emitQuery();
    assert.equal(completeCalls, 1);
    h.page.cancelConnection();
    oldStatus('Retorno antigo');
    completion.reject(new Error('Erro antigo'));
    await opening;
    assert.equal(h.page.formError, '');
    assert.equal(h.page.statusMessage, '');
});

test('tela cacheada ignora eventos enquanto oculta, reassume o retorno e libera listeners ao destruir', async () => {
    const h = setupLifecycle();
    let completions = 0;
    const completion = deferred();
    h.suap.complete = () => { completions++; return completion.promise; };
    await h.page.ngOnInit();
    h.page.ionViewWillLeave();
    h.state.nativeEntry = {};
    h.route.nativeSuapReturn = true;
    h.emitQuery();
    h.stats.authFailure({ message: 'Evento na tela oculta' });
    assert.equal(h.page.formError, '');
    assert.equal(completions, 0);
    h.page.ionViewWillEnter();
    assert.equal(completions, 1);
    assert.equal(h.stats.eventRegistrations, 1);
    h.page.ngOnDestroy();
    completion.reject(new Error('Falha após destruir'));
    await tick();
    assert.equal(h.page.formError, '');
    assert.equal(h.stats.eventOff, 1);
    assert.equal(h.stats.queryOff, 1);
    assert.equal(h.listeners.size, 0);
});

test('retorno do navegador Gov.br que chega antes da resolução não reativa a espera', async () => {
    const h = setupLifecycle();
    const opened = deferred();
    h.get('PainelAvaService').consumeGovBrRedirectUrl = () => 'https://gov.example.test/';
    h.get('GovBrBrowserService').open = (_url, onReturned) => {
        onReturned();
        return opened.promise;
    };
    h.page.govBrUnavailable = true;
    const pending = h.page.continueGovBrInBrowser();
    opened.resolve();
    await pending;
    assert.equal(h.page.govBrBrowserOpened, false);
    assert.equal(h.page.govBrBrowserOpening, false);
});
