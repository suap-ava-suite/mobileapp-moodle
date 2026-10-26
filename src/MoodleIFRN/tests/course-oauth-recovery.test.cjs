const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function load(file, mocks, extra = {}) {
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = { exports: {}, require: id => mocks[id] || {}, console, ...extra };
    vm.runInNewContext(js, context);
    return context.exports;
}
test('selects SUAP by name, retaining the ID advertised by each environment', () => {
    const { selectSuapProvider } = load('src/MoodleIFRN/services_mobile/suap-provider.ts', {});
    const google = { name: 'Google', url: 'https://aberto.ava.ifrn.edu.br/auth/oauth2/login.php?id=2' };
    const suap = { name: 'SUAP do IFRN', url: 'https://aberto.ava.ifrn.edu.br/auth/oauth2/login.php?id=4' };
    assert.equal(selectSuapProvider([google, suap]), suap);
    assert.equal(selectSuapProvider([google]), undefined);
    const academic = { name: 'suap', url: 'https://academico.ava.ifrn.edu.br/auth/oauth2/login.php?id=1' };
    assert.equal(selectSuapProvider([academic]), academic);
});
function setup() {
    const timers = new Map(); let sequence = 0; let browserCalls = 0; let released = 0;
    const eventHandlers = new Map();
    let pending = { courseId: 2836, siteUrl: 'https://presencial.ava.ifrn.edu.br' };
    const service = {
        ensureLoginObserver() {}, showNativeCourseHandoff() {}, hideNativeCourseHandoff() {},
        getPendingOpenCourse: () => pending, setPendingOpenCourse: p => { pending = p; },
        hasPresencialSession: () => false, hasMatchingPresencialSession: () => false,
        isIdentityMismatchPending: () => false, setIdentityMismatchPending() {},
        resumePendingOAuthCourse: async () => false,
        shouldResumeOAuthAfterSiteSwitch: () => false,
        consumeOAuthResume: () => false,
        ensureSessionAndOpenCourse: async () => 'need-connect',
        startSuapOAuthLogin: async () => { browserCalls++; return 'opened'; },
        releaseOAuthBrowserWait: () => { released++; },
        hasCourseOAuthCallbackReceived: () => false,
        dismissCourseRecovery: () => { pending = null; },
    };
    const navigator = {
        getRouteNumberParam: () => 2836, getRouteParam: () => undefined,
        getRouteBooleanParam: () => false, getCurrentPath: () => '/login/moodle-open-course',
        navigate: async () => {},
    };
    const { MoodleOpenCoursePage } = load('src/MoodleIFRN/moodle-open-course/moodle-open-course.ts', {
        '@angular/core': { Component: () => c => c, inject: () => service },
        '@/MoodleIFRN/services_mobile/moodle-site.service': {
            resolveMoodleSiteUrl: url => url || 'https://presencial.ava.ifrn.edu.br',
        },
        '@services/navigator': { CoreNavigator: navigator },
        '@static/events': { CoreEvents: { IAB_EXIT: 'iab-exit', on: (event, callback) => {
            eventHandlers.set(event, callback);
            return { off() {} };
        } } },
        '@services/platform': { CorePlatform: { ready: async () => {} } },
        '@services/overlays/alerts': { CoreAlerts: { showError: async () => {} } },
    }, {
        setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        window: { setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; } },
    });
    return { page: new MoodleOpenCoursePage(), service, timers, navigator,
        get browserCalls() { return browserCalls; }, get released() { return released; },
        emitIabExit() { eventHandlers.get('iab-exit')?.(); },
        get pending() { return pending; } };
}
test('missing browser return ends waiting and permits a new official attempt for the same environment', async () => {
    const s = setup(); await s.page.ionViewWillEnter();
    assert.equal(s.page.phase, 'waiting-browser'); assert.equal(s.page.loading, false);
    assert.equal(s.browserCalls, 1);
    const timer = [...s.timers.values()][0]; assert.equal(timer.ms, 180000); timer.fn();
    assert.equal(s.page.phase, 'error'); assert.equal(s.released, 1);
    assert.equal(s.pending.courseId, 2836); assert.equal(s.pending.siteUrl, 'https://presencial.ava.ifrn.edu.br');
    await s.page.retryConnect(); assert.equal(s.browserCalls, 2); assert.equal(s.page.phase, 'waiting-browser');
});
test('leaving, cancelling and destroying the cached bridge remove its browser timer', async () => {
    for (const action of ['ionViewWillLeave', 'cancelOpening', 'ngOnDestroy']) {
        const s = setup(); await s.page.ionViewWillEnter(); assert.equal(s.timers.size, 1);
        s.page[action](); assert.equal(s.timers.size, 0); assert.equal(s.released, 0);
    }
});
test('official callback resuming a course does not start another browser or leave a timeout behind', async () => {
    const s = setup(); await s.page.ionViewWillEnter();
    s.page.ionViewWillLeave(); s.service.resumePendingOAuthCourse = async () => true;
    await s.page.ionViewWillEnter(); assert.equal(s.browserCalls, 1); assert.equal(s.timers.size, 0);
});

test('leaving while session lookup is pending cannot open the browser afterwards', async () => {
    const s = setup();
    await s.page.ionViewWillEnter();
    let finish;
    s.service.ensureSessionAndOpenCourse = () => new Promise(resolve => { finish = resolve; });
    const pending = s.page.tryOpenOrPromptConnect(true);
    const browserCalls = s.browserCalls;
    s.page.ionViewWillLeave();
    finish('need-connect');
    await pending;
    assert.equal(s.browserCalls, browserCalls);
    assert.equal(s.timers.size, 0);
});

test('connect action reuses a session recovered since showing the connection prompt', async () => {
    const s = setup();
    s.service.ensureSessionAndOpenCourse = async () => 'opened';
    await s.page.ionViewWillEnter();
    assert.equal(s.page.phase, 'loading');
    await s.page.connectMoodle();
    assert.equal(s.browserCalls, 0);
});

test('a stale persisted account-switch flag cannot open the browser on another visit', async () => {
    const s = setup();
    s.service.shouldResumeOAuthAfterSiteSwitch = () => true;
    await s.page.ionViewWillEnter();
    assert.equal(s.browserCalls, 1);
    assert.equal(s.page.phase, 'waiting-browser');
});

test('the account-switch redirect cannot start OAuth twice when the cached bridge reenters', async () => {
    const s = setup();
    let consumed = false;
    let firstEntry = true;
    s.navigator.getRouteBooleanParam = key => key === 'startOAuth' && firstEntry;
    s.service.consumeOAuthResume = () => {
        if (consumed) return false;
        consumed = true;
        return true;
    };
    await s.page.ionViewWillEnter();
    assert.equal(s.browserCalls, 1);
    s.page.ionViewWillLeave();
    firstEntry = false;
    s.service.resumePendingOAuthCourse = async () => true;
    await s.page.ionViewWillEnter();
    assert.equal(s.browserCalls, 1);
    assert.equal(s.page.phase, 'loading');
});

function serviceWithStorage(entries) {
    const { MoodleSiteService } = load('src/MoodleIFRN/services_mobile/moodle-site.service.ts', {
        '@angular/core': { Injectable: () => c => c, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({}) } },
        '@services/config': { CoreConfig: { delete: async () => {} } },
    }, { URL, sessionStorage: {
        getItem: key => entries.get(key) ?? null,
        removeItem: key => entries.delete(key),
    } });
    return new MoodleSiteService();
}

test('OAuth resume is one-use, scoped to course and environment, and expires', () => {
    const key = 'ifrn_moodle_resume_oauth';
    const site = 'https://presencial.ava.ifrn.edu.br';
    const entries = new Map();
    const service = serviceWithStorage(entries);
    const marker = { courseId: 2836, siteUrl: site, until: Date.now() + 60000 };
    entries.set(key, JSON.stringify(marker));
    assert.equal(service.consumeOAuthResume(2836, site), true);
    assert.equal(service.consumeOAuthResume(2836, site), false);
    for (const value of [
        { ...marker, courseId: 4022 },
        { ...marker, siteUrl: 'https://academico.ava.ifrn.edu.br' },
        { ...marker, until: Date.now() - 1 },
        1,
    ]) {
        entries.set(key, JSON.stringify(value));
        assert.equal(service.consumeOAuthResume(2836, site), false);
        assert.equal(entries.has(key), false);
    }
});

test('Academic session cannot consume a pending Presencial OAuth return', async () => {
    const key = 'ifrn_moodle_oauth_pending';
    const entries = new Map([[key, '1']]);
    const service = serviceWithStorage(entries);
    service.getPendingOpenCourse = () => ({ courseId: 2836, siteUrl: 'https://presencial.ava.ifrn.edu.br' });
    service.hasMatchingPresencialSession = site => site === 'https://academico.ava.ifrn.edu.br';
    service.afterOAuthLogin = async () => assert.fail('Wrong environment cannot resume the course');
    assert.equal(await service.resumePendingOAuthCourse(), false);
    assert.equal(entries.get(key), '1');
});

test('native session opening skips browser and waiting timer', async () => {
    const s = setup();
    s.service.ensureSessionAndOpenCourse = async () => 'opened';
    await s.page.ionViewWillEnter();
    assert.equal(s.browserCalls, 0);
    assert.equal(s.timers.size, 0);
});

test('session inspection failure displays an error without browser authentication', async () => {
    const s = setup();
    s.service.ensureSessionAndOpenCourse = async () => { throw new Error('storage unavailable'); };
    await s.page.ionViewWillEnter();
    assert.equal(s.browserCalls, 0);
    assert.equal(s.page.phase, 'error');
    assert.ok(s.page.formError);
});
test('releasing a stalled browser preserves the pending course, account checks and saved credentials', () => {
    const entries = new Map([
        ['ifrn_moodle_oauth_pending', '1'], ['ifrn_moodle_resume_oauth', '1'],
        ['ifrn_moodle_pending_open_course', JSON.stringify({courseId:4024,siteUrl:'https://academico.ava.ifrn.edu.br'})],
        ['ifrn_moodle_identity_mismatch', '1'], ['ifrn_painel_profile', 'profile-fixture'],
        ['ifrn_painel_dashboard', 'dashboard-fixture'], ['ifrn_painel_token', 'credential-fixture'],
    ]);
    const { MoodleSiteService } = load('src/MoodleIFRN/services_mobile/moodle-site.service.ts', {
        '@angular/core': { Injectable: () => c => c, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({}) } },
        '@services/config': { CoreConfig: { delete: async () => {} } },
    }, {sessionStorage:{removeItem:key=>entries.delete(key)}});
    const service = new MoodleSiteService(); service.hideNativeCourseHandoff = () => {};
    service.releaseOAuthBrowserWait();
    assert.equal(entries.has('ifrn_moodle_oauth_pending'), false);
    assert.equal(entries.has('ifrn_moodle_resume_oauth'), false);
    assert.equal(entries.size, 5);
    assert.equal(entries.get('ifrn_moodle_identity_mismatch'), '1');
    assert.equal(JSON.parse(entries.get('ifrn_moodle_pending_open_course')).courseId, 4024);
    assert.equal(entries.get('ifrn_painel_token'), 'credential-fixture');
});
