const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const attemptContext = { exports: {}, performance, AbortController, setTimeout, clearTimeout,
    console: { info() {} } };
vm.runInNewContext(compile('src/MoodleIFRN/navigation/course-opening-attempt.ts'), attemptContext);
const { CourseOpeningAttempt } = attemptContext.exports;
const serviceSource = compile('src/MoodleIFRN/services_mobile/moodle-site.service.ts');
const courseId = 4022;
const siteUrl = 'https://academico.ava.ifrn.edu.br';

function setup(navigate) {
    const timers = new Map();
    let timerSequence = 0;
    let listener;
    let disposed = 0;
    let readinessCalls = 0;
    let clearedOrigins = 0;
    class NavigationEnd {
        constructor(url) { this.url = url; this.urlAfterRedirects = url; }
    }
    class NavigationError {
        constructor(url, error) { this.url = url; this.error = error; }
    }
    const router = { events: { subscribe(callback) {
        listener = callback;
        return { unsubscribe() { disposed++; listener = undefined; } };
    } } };
    const site = { getURL: () => siteUrl, getInfo: () => ({ username: 'synthetic-owner', userid: 7 }) };
    const mocks = {
        '@angular/core': { Injectable: () => target => target },
        '@angular/router': { NavigationEnd, NavigationError },
        '@services/sites': { CoreSites: { getCurrentSite: () => site,
            getCurrentSiteId: () => 'synthetic-site', isLoggedIn: () => true } },
        '@services/navigator': { CoreNavigator: { getCurrentPath: () => '/login/painel' } },
        '@features/courses/services/courses': { CoreCourses: { getUserCourses: async () => [{ id: courseId }] } },
        '../navigation/open-native-course': { openNativeCourse: (...args) => navigate(...args) },
        './ifrn-language': { useIfrnBrazilianPortuguese: async () => {} },
        '@/MoodleIFRN/navigation/handoff-loading': { hideHandoffLoading() {} },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, URL,
        console: { log() {}, warn() {}, error() {}, info() {} },
        document: { querySelectorAll: () => [] },
        window: {
            setTimeout(callback) { const id = ++timerSequence; timers.set(id, callback); return id; },
            clearTimeout(id) { timers.delete(id); },
        },
    };
    vm.runInNewContext(serviceSource, context);
    const service = Object.create(context.exports.MoodleSiteService.prototype);
    Object.assign(service, {
        router,
        getPendingOpenCourse: () => ({ courseId, siteUrl }),
        hasPresencialSession: () => true,
        matchCurrentMoodleIdentity: () => ({ hasExpected: true, matches: true }),
        getCurrentMoodleIdentity: () => 'synthetic-owner',
        markCourseOriginFromPainel() {},
        startNativeCourseProgression() {},
        clearCourseOriginFlags() { clearedOrigins++; },
        waitForNativeCourseShell: async () => { readinessCalls++; },
        waitForNativeCourseContent: async () => { readinessCalls++; },
    });
    return {
        service,
        emitEnd: id => listener?.(new NavigationEnd(`/main/home/course/${id}`)),
        emitError: error => listener?.(new NavigationError(`/main/home/course/${courseId}`, error)),
        expireRoute: () => [...timers.values()].forEach(callback => callback()),
        state: () => ({ timers: timers.size, disposed, readinessCalls, clearedOrigins }),
    };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('a refused native navigation reports its error without waiting for the 45-second route timeout', async () => {
    const failure = new Error('synthetic navigation refused');
    const s = setup(async () => { throw failure; });
    let result;
    const opening = s.service.performOpenCourseById(courseId, new CourseOpeningAttempt())
        .then(() => { result = 'opened'; }, error => { result = error; });
    await tick();
    const beforeTimeout = result;
    const beforeCleanup = s.state();
    // Also releases the old implementation so a failed regression never leaves an opening pending.
    s.expireRoute();
    await opening;
    assert.equal(beforeTimeout, failure);
    assert.equal(beforeCleanup.timers, 0);
    assert.equal(beforeCleanup.disposed, 1);
    assert.equal(beforeCleanup.readinessCalls, 0);
    assert.equal(beforeCleanup.clearedOrigins, 1);
});

test('an early router failure is handled while the non-cancellable navigation is still pending', async () => {
    let finishNavigation;
    const navigation = new Promise(resolve => finishNavigation = resolve);
    const s = setup(() => navigation);
    const failure = new Error('synthetic router failure');
    let result;
    const opening = s.service.performOpenCourseById(courseId, new CourseOpeningAttempt())
        .then(() => { result = 'opened'; }, error => { result = error; });
    await tick();
    s.emitError(failure);
    await tick();
    assert.equal(result, undefined, 'keep the operation locked until native navigation settles');
    finishNavigation();
    await opening;
    assert.equal(result, failure);
    assert.equal(s.state().readinessCalls, 0);
    assert.equal(s.state().timers, 0);
    assert.equal(s.state().disposed, 1);
});

test('successful navigation still waits for the selected course route before testing content readiness', async () => {
    const s = setup(async () => {});
    let result;
    const opening = s.service.performOpenCourseById(courseId, new CourseOpeningAttempt())
        .then(value => { result = value; });
    await tick();
    s.emitEnd(999);
    await tick();
    assert.equal(result, undefined);
    assert.equal(s.state().readinessCalls, 0);
    s.emitEnd(courseId);
    await opening;
    assert.equal(result, courseId);
    assert.equal(s.state().readinessCalls, 2);
    assert.equal(s.state().disposed, 1);
    assert.equal(s.state().timers, 0);
});

test('user cancellation keeps the native operation locked and cannot report a late route as success', async () => {
    let finishNavigation;
    const navigation = new Promise(resolve => finishNavigation = resolve);
    const s = setup(() => navigation);
    const attempt = new CourseOpeningAttempt();
    let result;
    const opening = s.service.performOpenCourseById(courseId, attempt)
        .then(() => { result = 'opened'; }, error => { result = error; });
    await tick();
    attempt.cancel();
    s.emitEnd(courseId);
    await tick();
    assert.equal(result, undefined);
    finishNavigation();
    await opening;
    assert.match(result.message, /cancelada/);
    assert.equal(s.state().readinessCalls, 0);
    assert.equal(s.state().disposed, 1);
});

test('cancelling after navigation settles does not wait 45 seconds for a missing route event', async () => {
    const s = setup(async () => {});
    const attempt = new CourseOpeningAttempt();
    let result;
    const opening = s.service.performOpenCourseById(courseId, attempt)
        .then(() => { result = 'opened'; }, error => { result = error; });
    await tick();
    attempt.cancel();
    await tick();
    const beforeTimeout = result;
    s.expireRoute();
    await opening;
    assert.match(beforeTimeout?.message || '', /cancelada/);
    assert.equal(s.state().timers, 0);
    assert.equal(s.state().disposed, 1);
    assert.equal(s.state().readinessCalls, 0);
});

test('a missing route still times out as a failure, never as a user cancellation', async () => {
    const s = setup(async () => {});
    const attempt = new CourseOpeningAttempt();
    const opening = s.service.performOpenCourseById(courseId, attempt);
    await tick();
    s.expireRoute();
    await assert.rejects(opening, /não confirmou a rota nativa em 45 segundos/);
    assert.equal(attempt.cancelled, false);
    assert.equal(s.state().timers, 0);
    assert.equal(s.state().disposed, 1);
    assert.equal(s.state().readinessCalls, 0);
});
