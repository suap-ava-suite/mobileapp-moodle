const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function loadTypeScript(relative, mocks, globals = {}) {
    const js = ts.transpileModule(read(relative), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = {
        exports: {},
        require: id => mocks[id] || {},
        console,
        URL,
        Headers,
        AbortController,
        TextEncoder,
        Uint8Array,
        Date,
        Promise,
        performance,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        setTimeout: () => 1,
        clearTimeout: () => {},
        document: { addEventListener() {} },
        window: { crypto: webcrypto, open: () => ({}) },
        ...globals,
    };
    vm.runInNewContext(js, context, { filename: relative });

    return context.exports;
}

function makeStorage() {
    const values = new Map();

    return {
        values,
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(done => resolve = done);

    return { promise, resolve };
}

function makeSuapEntryHarness(fetchImpl) {
    const sessionStorage = makeStorage();
    const localStorage = makeStorage();
    const events = [];
    const commits = [];
    const auth = {
        saveOAuthSession: profile => commits.push(profile),
        openMobileMoodle() {},
    };
    const panel = { refreshSavedProfile: async () => {} };
    class AuthService {}
    class BiometricService {}
    class PainelAvaService {}
    class SuapBrowserService {}
    const dependencies = new Map([
        [AuthService, auth],
        [BiometricService, { disable() {} }],
        [PainelAvaService, panel],
        [SuapBrowserService, { cancel() {}, waitFor: promise => promise, login: async () => true }],
    ]);
    const { MobileAuthAttemptCoordinator } = loadTypeScript(
        'src/MoodleIFRN/navigation/mobile-auth-attempt.ts', {},
    );
    const moduleMocks = {
        '@angular/core': { Injectable: () => value => value, inject: token => dependencies.get(token) },
        'rxjs': { firstValueFrom: value => Promise.resolve(value) },
        '@static/events': { CoreEvents: {
            APP_LAUNCHED_URL: 'app-launched-url', LOGIN: 'login',
            on: () => ({ off() {} }), trigger: (event, payload) => events.push({ event, payload }),
        } },
        '@/core/constants': { CoreConstants: { CONFIG: { customurlscheme: 'moodle' } } },
        '@services/overlays/alerts': { CoreAlerts: { showError: async () => {} } },
        '@services/sites': { CoreSites: { getCurrentSite: () => null, isLoggedIn: () => false } },
        '@services/sites-factory': { CoreSitesFactory: {} },
        '@features/login/services/login-helper': { CoreLoginHelper: {} },
        '@features/mainmenu/constants': { MAIN_MENU_HOME_PAGE_NAME: 'home' },
        '@/MoodleIFRN/services_mobile/auth.service': { AuthService },
        '@/MoodleIFRN/services_mobile/biometric.service': { BiometricService },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService },
        './suap-browser.service': { SuapBrowserService },
        '@static/opener': { CoreOpener: { closeInAppBrowser() {} } },
        '../mobilemoodle/core_mobile/oauth-profile': {
            OAUTH_PROFILE_KEY: 'oauth-profile', OAUTH_PROFILE_MAX_AGE_SECONDS: 60,
            profileIdentity: value => String(value?.identificacao || value?.username || ''),
        },
        '../navigation/suap-entry-state': {
            beginNativeSuapEntry() {}, readNativeSuapEntry: () => null,
            endNativeSuapEntry() {}, markNativeSuapEntryAuthenticated() {},
        },
        '../navigation/mobile-auth-attempt': { MobileAuthAttemptCoordinator },
        './suap-login-telemetry': {
            clearFreshPanelProfile() {}, FRESH_PROFILE_SKIP_KEY: 'fresh-profile-skip', reportSuapDuration() {},
        },
        './painel-ava.config': { PAINEL_AVA_CONFIG: { baseUrl: 'https://panel.example.test' } },
    };
    const exports = loadTypeScript('src/MoodleIFRN/services_mobile/suap-entry.service.ts', moduleMocks, {
        sessionStorage,
        localStorage,
        fetch: fetchImpl,
    });
    const service = new exports.SuapEntryService();

    return { service, sessionStorage, events, commits, auth, panel, exports };
}

const okJson = value => ({ ok: true, status: 200, json: async () => value });
const pendingKey = 'ifrn_mobile_suap_pkce_pending_v1';
const seededPending = state => JSON.stringify({ state, verifier: `verifier-${state}`, startedAt: Date.now() });
const callbackUrl = state => `moodle://ifrn-auth/callback?code=fixture-code&state=${state}`;

function makeMoodleSiteHarness() {
    const sessionStorage = makeStorage();
    const navigations = [];
    const logouts = [];
    const calls = [];
    const coreSites = {
        getCurrentSite: () => ({ id: 'active-site' }),
        logout: async options => { logouts.push(options); },
    };
    const mocks = {
        '@angular/core': { Injectable: () => value => value, inject: () => ({}) },
        '@services/navigator': {
            CoreNavigator: { navigate: async (...args) => navigations.push(args) },
        },
        '@services/sites': { CoreSites: coreSites },
    };
    const exports = loadTypeScript('src/MoodleIFRN/services_mobile/moodle-site.service.ts', mocks, {
        sessionStorage,
        localStorage: makeStorage(),
        document: { documentElement: { classList: { remove() {} } } },
    });
    const service = Object.create(exports.MoodleSiteService.prototype);
    service.suapEntry = { cancel: () => calls.push('cancel-suap') };
    service.dismissCourseRecovery = () => calls.push('dismiss-course-flow');
    service.authService = { logout: () => calls.push('clear-app-auth') };
    service.painelAva = { clearSession: () => calls.push('clear-panel-session') };
    service.cancelCourseOAuthBrowser = () => calls.push('cancel-course-browser');

    return { service, sessionStorage, navigations, logouts, calls };
}

function makeCourseRecoveryPage(issue) {
    class MoodleSiteService {}
    const service = { lastCourseAccessIssue: issue, switched: 0 };
    service.switchSuapAccount = async () => { service.switched++; };
    const mocks = {
        '@angular/core': { Component: () => value => value, inject: () => service },
        '@/core/shared.module': {},
        '@/MoodleIFRN/services_mobile/moodle-site.service': {
            IFRN_MOODLE_PRESENCIAL_URL: 'https://course.example.test',
            MoodleSiteService,
            logSiteDiagnostic() {},
            logSiteError() {},
            resolveMoodleSiteUrl: value => value || 'https://course.example.test',
        },
        '@services/navigator': { CoreNavigator: {} },
        '@services/platform': { CorePlatform: { ready: async () => {} } },
    };
    const { MoodleOpenCoursePage } = loadTypeScript('src/MoodleIFRN/moodle-open-course/moodle-open-course.ts', mocks);
    const page = new MoodleOpenCoursePage();
    let oauthStarts = 0;
    page.startOAuthFlow = async () => { oauthStarts++; };

    return { page, service, get oauthStarts() { return oauthStarts; } };
}

test('cada autenticação, inclusive da mesma conta, recebe uma geração distinta', () => {
    const { MobileAuthAttemptCoordinator } = loadTypeScript(
        'src/MoodleIFRN/navigation/mobile-auth-attempt.ts', {},
    );
    const attempts = new MobileAuthAttemptCoordinator();
    const first = attempts.begin();
    assert.equal(attempts.bind(first, 'state-a-1'), true);
    assert.equal(attempts.isCurrent(first, 'state-a-1'), true);
    attempts.invalidate(first);
    const reentry = attempts.begin();
    assert.ok(reentry > first);
    assert.equal(attempts.bind(reentry, 'state-a-2'), true);
    assert.equal(attempts.isCurrent(first, 'state-a-1'), false);
    assert.equal(attempts.isCurrent(reentry, 'state-a-2'), true);
});

test('callback antigo atrasado não grava a Conta A nem remove o login B pendente', async () => {
    const exchangeStarted = deferred();
    const releaseExchange = deferred();
    const h = makeSuapEntryHarness(async url => {
        if (String(url).endsWith('/exchange/')) {
            exchangeStarted.resolve();
            return releaseExchange.promise;
        }

        return { ok: true, status: 200 };
    });
    h.sessionStorage.setItem(pendingKey, seededPending('attempt-a'));
    const oldCallback = h.service.completeMobileAuthCallback(callbackUrl('attempt-a'));
    await exchangeStarted.promise;

    await h.service.loginWithSuap();
    const pendingB = JSON.parse(h.sessionStorage.getItem(pendingKey));
    assert.notEqual(pendingB.state, 'attempt-a');

    releaseExchange.resolve(okJson({ username: 'fixture-account-a', access: 'fixture-access-a' }));
    await oldCallback;

    assert.equal(h.commits.length, 0);
    assert.equal(JSON.parse(h.sessionStorage.getItem(pendingKey)).state, pendingB.state);
    assert.equal(h.events.some(event => event.event === 'IFRN_SUAP_MOBILE_AUTH_FAILED'), false);
});

test('callback duplicado não inicia uma segunda troca de código', async () => {
    const exchangeStarted = deferred();
    const releaseExchange = deferred();
    let exchangeCalls = 0;
    const h = makeSuapEntryHarness(async url => {
        if (String(url).endsWith('/exchange/')) {
            exchangeCalls++;
            exchangeStarted.resolve();
            return releaseExchange.promise;
        }

        return { ok: true, status: 200 };
    });
    h.sessionStorage.setItem(pendingKey, seededPending('attempt-a'));
    const first = h.service.completeMobileAuthCallback(callbackUrl('attempt-a'));
    await exchangeStarted.promise;
    await h.service.completeMobileAuthCallback(callbackUrl('attempt-a'));
    assert.equal(exchangeCalls, 1);

    h.service.cancel();
    releaseExchange.resolve(okJson({ username: 'fixture-account-a', access: 'fixture-access-a' }));
    await first;
    assert.equal(h.commits.length, 0);
});

test('callback de outro state não cancela nem substitui a tentativa atual', async () => {
    const h = makeSuapEntryHarness(async () => ({ ok: true, status: 200 }));
    await h.service.loginWithSuap();
    const pending = h.sessionStorage.getItem(pendingKey);

    await h.service.completeMobileAuthCallback(callbackUrl('old-state'));

    assert.equal(h.sessionStorage.getItem(pendingKey), pending);
    assert.equal(h.events.some(event => event.event === 'IFRN_SUAP_MOBILE_AUTH_FAILED'), false);
});

test('a identidade recebida ainda precisa coincidir com a tentativa esperada', async () => {
    const h = makeSuapEntryHarness(async url => {
        if (String(url).endsWith('/exchange/')) {
            return okJson({ username: 'fixture-account-b', access: 'fixture-access-b' });
        }

        return { ok: true, status: 200 };
    });
    await h.service.loginWithSuap('fixture-account-a');
    const pending = JSON.parse(h.sessionStorage.getItem(pendingKey));

    await h.service.completeMobileAuthCallback(callbackUrl(pending.state));

    assert.equal(h.commits.length, 0);
    assert.equal(h.events.some(event => event.event === 'IFRN_SUAP_MOBILE_AUTH_FAILED'), true);
    assert.equal(h.sessionStorage.getItem(pendingKey), null);
});

test('recuperação expõe autenticação Moodle e troca SUAP; sair encerra o Moodle ativo sem excluir sites', () => {
    const pageHtml = read('src/MoodleIFRN/moodle-open-course/moodle-open-course.html');
    const pageTs = read('src/MoodleIFRN/moodle-open-course/moodle-open-course.ts');
    const moodle = read('src/MoodleIFRN/services_mobile/moodle-site.service.ts');
    const panel = read('src/MoodleIFRN/painel/painel.ts');

    assert.match(pageHtml, /reconnectMoodleAccount\(\)/);
    assert.match(pageHtml, /switchSuapAccount\(\)/);
    assert.match(pageTs, /await this\.startOAuthFlow\(\)/);
    assert.match(pageTs, /await this\.moodleSite\.switchSuapAccount\(\)/);
    assert.match(moodle, /params: \{ forceLogin: true \}/);
    assert.match(moodle, /CoreSites\.logout\(\{ forceLogout: true, removeAccount: false \}\)/);
    assert.match(panel, /await this\.moodleSite\.logoutActiveAccount\(\)/);
});

test('troca SUAP exige nova entrada e não fixa a identidade antiga', async () => {
    const h = makeMoodleSiteHarness();
    h.sessionStorage.setItem('ifrn_mobile_suap_error_v1', 'old error');

    await h.service.switchSuapAccount();

    assert.deepEqual(h.calls, ['cancel-suap', 'dismiss-course-flow', 'clear-app-auth', 'clear-panel-session']);
    assert.equal(h.sessionStorage.getItem('ifrn_mobile_suap_error_v1'), null);
    assert.equal(h.navigations.length, 1);
    assert.equal(h.navigations[0][0], '/login/marketplace-ifrn');
    assert.equal(h.navigations[0][1].params.forceLogin, true);
    assert.equal('username' in h.navigations[0][1].params, false);
    assert.equal(h.logouts.length, 0, 'a troca preserva os sites Moodle salvos de cada conta');
});

test('Sair invalida operações IFRN e desativa somente o site Moodle ativo, sem excluir conta', async () => {
    const h = makeMoodleSiteHarness();

    await h.service.logoutActiveAccount();

    assert.deepEqual(h.calls, ['cancel-suap', 'dismiss-course-flow', 'clear-app-auth', 'clear-panel-session']);
    assert.equal(h.logouts.length, 1);
    assert.equal(h.logouts[0].forceLogout, true);
    assert.equal(h.logouts[0].removeAccount, false);
});

test('ações da recuperação respeitam o tipo de erro e oferecem os dois caminhos corretos', async () => {
    const mismatch = makeCourseRecoveryPage({
        kind: 'identity-mismatch', expectedLogin: 'fixture-account-b', actualLogin: 'fixture-account-a',
    });
    await mismatch.page.reconnectMoodleAccount();
    await mismatch.page.switchSuapAccount();
    assert.equal(mismatch.oauthStarts, 1);
    assert.equal(mismatch.service.switched, 1);

    const enrollment = makeCourseRecoveryPage({
        kind: 'not-enrolled', expectedLogin: 'fixture-account-b', actualLogin: 'fixture-account-b',
    });
    await enrollment.page.reconnectMoodleAccount();
    await enrollment.page.switchSuapAccount();
    assert.equal(enrollment.oauthStarts, 0);
    assert.equal(enrollment.service.switched, 0);
});
