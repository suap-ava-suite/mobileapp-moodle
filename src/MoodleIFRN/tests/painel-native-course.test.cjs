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
function setup(open = async () => 'opened') {
    const token = {};
    const calls = [];
    const navigation = [];
    const errors = [];
    const routerToken = {};
    const router = { navigate: async (...args) => navigation.push(args) };
    const win = { location: { origin: 'http://localhost' }, addEventListener() {}, removeEventListener() {} };
    const service = { ensureSessionAndOpenCourse: async (...args) => {
        calls.push(args);
        return open(...args);
    } };
    const { PainelPage } = load('src/MoodleIFRN/painel/painel.ts', {
        '@angular/core': { Component: () => c => c, ViewChild: () => () => {},
            inject: id => id === token ? service : id === routerToken ? router : { stopProfileRefresh() {} } },
        '@angular/router': { Router: routerToken },
        '@/MoodleIFRN/services_mobile/moodle-site.service': { MoodleSiteService: token },
        '../mobilemoodle/core_mobile/course-target': load('src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts', {}),
        '@services/navigator': { CoreNavigator: { navigate: async (...args) => navigation.push(args) } },
        '@services/overlays/alerts': { CoreAlerts: { showError: async error => errors.push(error) } },
    }, { window: win, document: { documentElement: { classList: { remove() {} } } } });
    return { page: new PainelPage(), Page: PainelPage, win, service, calls, navigation, errors };
}
const academic = 'https://academico.ava.ifrn.edu.br';
const presencial = 'https://presencial.ava.ifrn.edu.br';
test('panel opens native course directly and permits another click after completion', async () => {
    const s = setup();
    await s.page.handleOpenCourse(7, 'Course', academic);
    await s.page.handleOpenCourse(7, 'Other environment', presencial);
    assert.equal(s.calls.length, 2);
    assert.equal(s.calls[0][2], 'Course');
    assert.equal(s.calls[0][1], academic);
    assert.equal(s.calls[1][1], presencial);
    assert.equal(s.navigation.length, 0);
});
test('no native session keeps the official connection route scoped to the target environment', async () => {
    const s = setup(async () => 'need-connect');
    await s.page.handleOpenCourse(7, 'Course', presencial);
    assert.equal(s.navigation[0][0][0], '/login/moodle-open-course');
    assert.equal(s.navigation[0][1].queryParams.siteUrl, presencial);
    assert.equal(s.navigation[0][1].queryParams.identityOnly, false);
    assert.equal(s.navigation[0][1].replaceUrl, true);
});
test('read, permission and identity errors open recovery without automatic OAuth', async () => {
    const s = setup(async () => { throw new Error('Unavailable'); });
    await s.page.handleOpenCourse(7, 'Course', academic);
    assert.equal(s.navigation[0][1].queryParams.identityOnly, true);
    assert.ok(s.service.lastError);
});
test('duplicate bridge messages cannot replace an in-progress course or environment', async () => {
    let complete;
    const s = setup(() => new Promise(resolve => { complete = resolve; }));
    const pending = s.page.handleOpenCourse(7, 'Course', academic);
    await s.page.handleOpenCourse(7, 'Other environment', presencial);
    assert.equal(s.calls.length, 1);
    complete('opened');
    await pending;
    assert.equal(s.navigation.length, 0);
});
test('unconfirmed environment never selects a default Moodle', async () => {
    const s = setup();
    for (const site of [undefined, 'https://example.org', 'https://academico.ava.ifrn.edu.br.evil.example']) {
        await s.page.handleOpenCourse(7, 'Course', site);
    }
    assert.equal(s.calls.length, 0);
    assert.equal(s.errors.length, 3);
});

test('destroying an old Ionic panel does not unregister the active panel bridge', () => {
    const s = setup();
    s.page.registerBridge();
    const current = new s.Page();
    current.ionViewDidEnter();
    const active = s.win.MoodleIfrnBridge;
    s.page.ngOnDestroy();
    assert.equal(s.win.MoodleIfrnBridge, active);
    current.ngOnDestroy();
    assert.equal(s.win.MoodleIfrnBridge, undefined);
});

test('only the panel iframe on the app origin can post course commands', async () => {
    const s = setup();
    const source = {};
    s.page.painelFrame = { nativeElement: { contentWindow: source } };
    const data = { type: 'MOODLE_IFRN_OPEN_COURSE', courseId: 7, siteUrl: academic };
    s.page.onWindowMessage({ source: {}, origin: 'http://localhost', data });
    s.page.onWindowMessage({ source, origin: 'https://other.example', data });
    assert.equal(s.calls.length, 0);
    s.page.onWindowMessage({ source, origin: 'http://localhost', data });
    assert.equal(s.calls.length, 1);
    await Promise.resolve();
});
