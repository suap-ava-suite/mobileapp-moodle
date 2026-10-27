const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const ssoModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/course-sso-browser.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: ssoModule.exports, URL, setTimeout, clearTimeout });

class FakeCourseOpeningAttempt {
    cancel() {}
}

function loadService() {
    const file = 'src/MoodleIFRN/services_mobile/moodle-site.service.ts';
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const injectable = () => target => target;
    const subscriptions = new Map();
    let browserOptions;
    let browserUrl;
    let browserClosed = false;
    let browserShown = false;
    let browserHidden = false;
    let callbackUrl;
    let browserScriptResult = false;
    let externalFallbackCalls = 0;
    let lastTriggeredEvent;
    const session = new Map([['ifrn_moodle_oauth_pending', '1']]);
    const browser = {
        close: () => browserClosed = true,
        show: () => browserShown = true,
        hide: () => browserHidden = true,
        _loadAfterBeforeload() {},
        executeScript: async () => browserScriptResult,
        on: event => ({ subscribe: callback => {
            subscriptions.set(event, callback);
            return { unsubscribe() {} };
        } }),
    };
    const mocks = {
        './course-sso-browser': ssoModule.exports,
        '@singletons': { InAppBrowser: { create: (url, target, options) => {
            assert.equal(target, '_blank'); browserUrl = url; browserOptions = options; return browser;
        } } },
        '@angular/core': { Injectable: injectable, inject: () => ({}) },
        '@angular/router': { NavigationEnd: class {}, NavigationError: class {}, Router: class {} },
        '../navigation/course-opening-attempt': { CourseOpeningAttempt: FakeCourseOpeningAttempt },
        '@features/login/services/login-helper': { CoreLoginHelper: {
            prepareForSSOLogin: async (...args) => {
                assert.equal(args[0], 'https://academico.ava.ifrn.edu.br');
                assert.equal(args[4], undefined);
                return 'https://academico.ava.ifrn.edu.br/admin/tool/mobile/launch.php';
            },
            openBrowserForOAuthLogin: async () => { externalFallbackCalls++; return true; },
        } },
        '@services/config': { CoreConfig: { delete: async () => {} } },
        '@services/urlschemes': { CoreCustomURLSchemes: {
            isCustomURLToken: url => url.startsWith('moodlemobile://token='),
            handleCustomURL: async url => callbackUrl = url,
            isCustomURL: () => true,
        } },
        '@static/opener': { CoreOpener: { openInApp: (url, options) => {
            browserUrl = url;
            browserOptions = options;
            return browser;
        } } },
        '@static/events': { CoreEvents: { trigger: (event, data) => lastTriggeredEvent = { event, data } } },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL,
        sessionStorage: { getItem: key => session.get(key) || null, removeItem: key => session.delete(key) },
        window: { handleOpenURL: url => callbackUrl = url } };
    vm.runInNewContext(output, context);

    return {
        MoodleSiteService: context.exports.MoodleSiteService,
        state: () => ({ subscriptions, browserOptions, browserUrl, browserClosed, browserShown, browserHidden,
            callbackUrl, session, externalFallbackCalls, lastTriggeredEvent,
            setBrowserScriptResult: value => browserScriptResult = value,
            markExternalFallbackCall: () => externalFallbackCalls++ }),
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(done => resolve = done);

    return { promise, resolve };
}

test('same course and Moodle site join one in-progress native opening', async () => {
    const { MoodleSiteService } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    const result = deferred();
    let calls = 0;
    service.performEnsureSessionAndOpenCourse = () => { calls++; return result.promise; };
    service.isNativeCourseHandoffActive = () => true;

    const first = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br', 'Curso');
    const duplicate = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br', 'Curso');

    assert.strictEqual(duplicate, first);
    assert.equal(calls, 1);
    result.resolve('opened');
    assert.equal(await first, 'opened');
});
test('a different course or Moodle site cannot join the active opening', async () => {
    const { MoodleSiteService } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    const result = deferred();
    let calls = 0;
    service.performEnsureSessionAndOpenCourse = () => { calls++; return result.promise; };
    service.isNativeCourseHandoffActive = () => true;

    const first = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br');

    await assert.rejects(
        service.ensureSessionAndOpenCourse(2836, 'https://presencial.ava.ifrn.edu.br'),
        /Uma abertura de curso já está em andamento/,
    );
    await assert.rejects(
        service.ensureSessionAndOpenCourse(4022, 'https://presencial.ava.ifrn.edu.br'),
        /Uma abertura de curso já está em andamento/,
    );
    assert.equal(calls, 1);

    result.resolve('opened');
    assert.equal(await first, 'opened');
});

test('course tabs use the activated course route, not the previous bridge URL', () => {
    const source = fs.readFileSync('src/core/features/course/pages/index/index.ts', 'utf8');

    assert.match(source, /const path\s*=\s*CoreNavigator\.getRouteFullPath\(this\.route\)/);
    assert.match(source, /this\.currentPagePath\s*=\s*path/);
    assert.doesNotMatch(source, /this\.currentPagePath\s*=\s*CoreNavigator\.getCurrentPath\(\)/);
});

test('course OAuth stays hidden inside the app and resumes the selected course natively', () => {
    const page = fs.readFileSync('src/MoodleIFRN/moodle-open-course/moodle-open-course.ts', 'utf8');
    const service = fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8');

    assert.match(page, /await this\.tryOpenOrPromptConnect\(true\)/);
    assert.match(service, /CoreLoginHelper\.prepareForSSOLogin\(/);
    assert.match(service, /isSitePath:\s*false/);
    assert.match(service, /path:\s*'\/login\/moodle-open-course'/);
    assert.match(service, /openCourseOAuthInApp/);
    assert.doesNotMatch(service, /CoreLoginHelper\.openBrowserForOAuthLogin\(/);
    assert.match(service, /hidden:\s*'yes'/);
});

test('native course SSO preserves cookies, stays hidden and delegates token validation to Moodle', async () => {
    const { MoodleSiteService, state } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    const pending = service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state().browserOptions.hidden,'yes');
    assert.equal(state().browserOptions.clearcache,'no');
    assert.equal(state().browserOptions.clearsessioncache,'no');
    assert.equal(state().browserOptions.beforeload,'get');
    assert.match(state().browserUrl,/auth\/suap\/login\.php\?next=/);
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=official-callback'});
    await pending;
    assert.equal(state().callbackUrl,'moodlemobile://token=official-callback');
    assert.equal(state().externalFallbackCalls,0);
    assert.equal(state().browserShown,false);
    assert.equal(state().browserClosed,true);
    assert.equal(service.oauthCallbackReceived,true);
});

test('course tap resets the Ionic login route before entering the OAuth bridge', () => {
    const panel = fs.readFileSync('src/MoodleIFRN/painel/painel.ts', 'utf8');
    const navigation = panel.match(/this\.router\.navigate\(\['\/login\/moodle-open-course'\],[\s\S]*?\n            \}\);/);

    assert.ok(navigation, 'Panel must navigate directly to the course bridge');
    assert.match(navigation[0], /replaceUrl:\s*true/);
    assert.match(navigation[0], /queryParams:/);
});
