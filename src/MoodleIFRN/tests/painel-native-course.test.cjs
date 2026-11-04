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

function setup(navigate = async () => true) {
    const tokens = { auth: {}, painel: {}, dashboard: {}, router: {} };
    const calls = [];
    const errors = [];
    const stoppedRefreshes = [];
    const rootClasses = new Set(['ifrn-course-context']);
    const router = { navigate: async (...args) => { calls.push(args); return navigate(...args); } };
    const painelAva = { stopProfileRefresh: () => stoppedRefreshes.push(true) };
    const dashboard = {};
    const alerts = { showError: async error => errors.push(error) };
    const { PainelPage } = load('src/MoodleIFRN/painel/painel.ts', {
        '@angular/core': {
            Component: () => component => component,
            HostListener: () => () => {},
            ViewChild: () => () => {},
            inject: token => token === tokens.router ? router
                : token === tokens.painel ? painelAva
                    : token === tokens.dashboard ? dashboard : {},
        },
        '@angular/router': { Router: tokens.router },
        '@/core/shared.module': { CoreSharedModule: class {} },
        '@/MoodleIFRN/services_mobile/auth.service': { AuthService: tokens.auth },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService: tokens.painel },
        '../mobilemoodle/core_mobile/course-target': load(
            'src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts', {},
        ),
        '@services/navigator': { CoreNavigator: { navigate: async () => true } },
        '@services/platform': { CorePlatform: { ready: async () => {} } },
        '@services/overlays/alerts': { CoreAlerts: alerts },
        '../services_mobile/suap-login-telemetry': { reportSuapDuration() {} },
        '../services_mobile/ifrn-language': { useIfrnBrazilianPortuguese: async () => {} },
        './painel-course-card': { PainelCourseCardComponent: class {} },
        './painel-dashboard.service': { PainelDashboardService: tokens.dashboard },
    }, {
        document: { documentElement: { classList: { remove: name => rootClasses.delete(name) } } },
        sessionStorage: { setItem() {} },
    });

    return { page: new PainelPage(), calls, errors, stoppedRefreshes, rootClasses };
}

const academic = 'https://academico.ava.ifrn.edu.br';
const presencial = 'https://presencial.ava.ifrn.edu.br';

test('panel routes the selected Moodle course directly to the native course bridge', async () => {
    const state = setup();
    state.page.openCourse({ moodle_course_id: 7, name: 'Curso teste', moodle_site_url: `${academic}/course/view.php?id=7` });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0][0][0], '/login/moodle-open-course');
    assert.equal(state.calls[0][1].replaceUrl, true);
    assert.deepEqual(JSON.parse(JSON.stringify(state.calls[0][1].queryParams)), {
        courseId: 7, courseName: 'Curso teste', siteUrl: academic, identityOnly: false, startOAuth: false,
    });
});

test('duplicate course taps are ignored while the bridge navigation is pending', async () => {
    let finishNavigation;
    const state = setup(() => new Promise(resolve => { finishNavigation = resolve; }));
    state.page.openCourse({ moodle_course_id: 7, name: 'Primeiro', moodle_site_url: academic });
    state.page.openCourse({ moodle_course_id: 8, name: 'Segundo', moodle_site_url: presencial });
    assert.equal(state.calls.length, 1);
    assert.equal(state.stoppedRefreshes.length, 1);

    finishNavigation(true);
    await new Promise(resolve => setImmediate(resolve));
    state.page.openCourse({ moodle_course_id: 8, name: 'Segundo', moodle_site_url: presencial });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.calls.length, 2);
    assert.equal(state.calls[1][1].queryParams.siteUrl, presencial);
});

test('unconfirmed Moodle origins are rejected without falling back to a default site', async () => {
    const state = setup();
    for (const site of [undefined, 'https://example.org', 'https://academico.ava.ifrn.edu.br.evil.example']) {
        state.page.openCourse({ moodle_course_id: 7, name: 'Curso', moodle_site_url: site });
        await new Promise(resolve => setImmediate(resolve));
    }

    assert.equal(state.calls.length, 0);
    assert.equal(state.errors.length, 3);
});

test('panel teardown stops profile refresh and removes stale course context', () => {
    const state = setup();
    state.page.ngOnDestroy();
    state.page.ionViewDidEnter();

    assert.equal(state.stoppedRefreshes.length, 1);
    assert.equal(state.rootClasses.has('ifrn-course-context'), false);
});
