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
    let pending = { courseId: 2836, siteUrl: 'https://presencial.ava.ifrn.edu.br' };
    const service = {
        ensureLoginObserver() {}, showNativeCourseHandoff() {}, hideNativeCourseHandoff() {},
        getPendingOpenCourse: () => pending, setPendingOpenCourse: p => { pending = p; },
        hasPresencialSession: () => false, hasMatchingPresencialSession: () => false,
        isIdentityMismatchPending: () => false, setIdentityMismatchPending() {},
        resumePendingOAuthCourse: async () => false,
        shouldResumeOAuthAfterSiteSwitch: () => false,
        ensureSessionAndOpenCourse: async () => 'need-connect',
        startSuapOAuthLogin: async () => { browserCalls++; return 'opened'; },
        releaseOAuthBrowserWait: () => { released++; },
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
        '@services/platform': { CorePlatform: { ready: async () => {} } },
        '@services/overlays/alerts': { CoreAlerts: { showError: async () => {} } },
    }, {
        setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
    });
    return { page: new MoodleOpenCoursePage(), service, timers, navigator,
        get browserCalls() { return browserCalls; }, get released() { return released; },
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
