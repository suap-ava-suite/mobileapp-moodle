const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function load(file, mocks, extra = {}) {
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL, ...extra };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    return context.exports;
}
test('iframe forwards clicks without replacing the active pending course, including repeated IDs across sites', () => {
    for (const direct of [true, false]) {
        const App = {};
        const calls = [];
        const entries = new Map([['ifrn_moodle_pending_open_course', 'original-pending']]);
        const parent = direct ? { MoodleIfrnBridge: { openCourse: (...args) => calls.push(args) } }
            : { postMessage: message => calls.push(message) };
        load('src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts', { './namespace': { App, MM: {} } }, {
            window: { parent }, document: {
                getElementsByTagName: () => [{ src: 'http://localhost/mobilemoodle/mobilemoodle.js' }],
            }, sessionStorage: { setItem: (key, value) => entries.set(key, value) },
        });
        App.openMoodleCourse(7, 'Academic', 'https://academico.ava.ifrn.edu.br');
        App.openMoodleCourse(7, 'Presencial', 'https://presencial.ava.ifrn.edu.br');
        assert.equal(calls.length, 2);
        assert.equal(entries.get('ifrn_moodle_pending_open_course'), 'original-pending');
    }
});
function guardSetup() {
    const state = { nativeEntry: null };
    const service = {
        getCourseRecoveryTarget: () => null, isIdentityMismatchPending: () => false,
        isNativeCourseHandoffActive: () => false, returnToPainelOnCourseExit: () => false,
        hasAuthenticatedPainel: () => true, showNativeCourseHandoff() {}, hideNativeCourseHandoff() {},
        setPendingOpenCourse() {},
    };
    const routerToken = {};
    const router = { createUrlTree: (path, options) => ({ path: path[0], ...options }) };
    const guards = load('src/MoodleIFRN/navigation/navigation.guard.ts', {
        '@angular/core': { inject: token => token === routerToken ? router : service },
        '@angular/router': { Router: routerToken },
        './suap-entry-state': { readNativeSuapEntry: () => state.nativeEntry },
        './navigation-policy': load('src/MoodleIFRN/navigation/navigation-policy.ts', {}),
    });
    return { service, guards, state };
}
test('native landing returns to the authenticated panel instead of marketplace', () => {
    const { service, guards } = guardSetup();
    assert.equal(guards.ifrnMainMenuGuard({}, { url: '/main/home/dashboard' }).path, '/login/painel');
    service.hasAuthenticatedPainel = () => false;
    assert.equal(guards.ifrnMainMenuGuard({}, { url: '/main/home/dashboard' }).path, '/login/marketplace-ifrn');
});
test('course opening and course activities are never redirected by the landing guard', () => {
    const { service, guards } = guardSetup();
    service.isNativeCourseHandoffActive = () => true;
    assert.equal(guards.ifrnMainMenuGuard({}, { url: '/main/home/dashboard' }), true);
    service.isNativeCourseHandoffActive = () => false;
    for (const url of ['/main/home/course/7', '/main/home/mod_forum/7']) {
        assert.equal(guards.ifrnMainMenuGuard({}, { url }), true);
    }
});
test('session recovery retains the Moodle environment with the course ID', () => {
    const { service, guards } = guardSetup();
    service.getCourseRecoveryTarget = () => ({ courseId: 7, siteUrl: 'https://presencial.ava.ifrn.edu.br' });
    const route = guards.ifrnReconnectGuard();
    assert.equal(route.queryParams.siteUrl, 'https://presencial.ava.ifrn.edu.br');
});

test('an old login marker cannot interrupt an active course opening', () => {
    const { service, guards, state } = guardSetup();
    state.nativeEntry = { expectedIdentity: 'fixture' };
    service.isNativeCourseHandoffActive = () => true;
    assert.equal(guards.ifrnMainMenuGuard({}, { url: '/main/home/dashboard' }), true);
    service.isNativeCourseHandoffActive = () => false;
    assert.equal(guards.ifrnMainMenuGuard({}, { url: '/main/home/dashboard' }).queryParams.nativeSuapReturn, true);
});
