const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
require('zone.js/node');

function load(file, mocks = {}, globals = {}) {
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL, ...globals };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    return context.exports;
}
const target = load('src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts');
const filters = load('src/MoodleIFRN/painel/painel-filters.ts');
const modelModule = load('src/MoodleIFRN/painel/painel-native-model.ts', {
    '../mobilemoodle/core_mobile/course-target': target, './painel-filters': filters,
});
const build = modelModule.buildNativePainelModel;
const site = 'https://presencial.ava.ifrn.edu.br';
const raw = { diarios: [{ id: 17, diario_id: 999, fullname: 'Disciplina fictícia', viewurl: `${site}/course/view.php?id=17`, ambiente: { id: 3, titulo: 'Presencial' } }] };

test('native model uses Moodle id, preserves enrolment groups and refuses untrusted destinations', () => {
    const result = build({ ...raw, coordenacoes: [{ ...raw.diarios[0], id: 18 }], autoinscricoes: [
        { id: 19, viewurl: `${site}/course/view.php?id=19`, autoinscricao: { is_enrolled: false } },
        { id: 20, viewurl: 'https://evil.example/course/view.php?id=20' },
    ] }, { nome_usual: 'Nome social fictício', nome_registro: 'Registro fictício' });
    assert.equal(result.name, 'Nome social fictício');
    assert.equal(result.groups.diarios[0].moodle_course_id, 17);
    assert.equal(result.groups.diarios[0].moodle_site_url, site);
    assert.equal(result.groups.coordenacoes[0].moodle_course_id, 18);
    assert.equal(result.groups.autoinscricoes[0].is_enrolled, false);
    assert.equal(result.groups.autoinscricoes[1].moodle_site_url, undefined);
    assert.equal(build(null, { nome: 'Do not display stale profile' }), null);
});

test('invalid id never falls back to SUAP diário and credentials cannot become a photo URL', () => {
    const result = build({ diarios: [{ id: 'invalid', diario_id: 999, viewurl: `${site}/course/view.php?id=17` }] },
        { foto: 'https://user:password@suap.ifrn.edu.br/photo' });
    assert.equal(result.groups.diarios[0].moodle_course_id, undefined);
    assert.equal(result.photo, undefined);
});

test('Painel header exposes the IFRN brand, accessible actions, existing avatar fallback and no notification bell', () => {
    const template = fs.readFileSync('src/MoodleIFRN/painel/painel-native.html', 'utf8');
    assert.match(template, /ifrn-panel-header__logo[\s\S]*?alt="IFRN"/);
    assert.match(template, /ifrn-panel-header__title">Painel AVA/);
    assert.match(template, /aria-label="Acessibilidade"[\s\S]*?section\.set\('accessibility'\)/);
    assert.match(template, /aria-label="Ajuda"[\s\S]*?section\.set\('help'\)/);
    assert.match(template, /ifrn-panel-header__icon--accessibility/);
    assert.match(template, /ifrn-panel-header__icon--help/);
    assert.match(template, /data\(\)\?\.photo && !photoFailed\(\)/);
    assert.match(template, /\{\{ initials\(\) \}\}/);
    assert.match(template, /chevron-down-outline/);
    assert.doesNotMatch(template, /name="bell(?:-outline)?"/);
});

test('header usa dimensões e ícones do Figma sem divisor entre acessibilidade e ajuda', () => {
    const template = fs.readFileSync('src/MoodleIFRN/painel/painel-native.html', 'utf8');
    const styles = fs.readFileSync('src/MoodleIFRN/painel/painel-native.scss', 'utf8');
    const header = template.slice(0, template.indexOf('<ion-content'));
    const headerStyles = styles.slice(0, styles.indexOf('.painel-card-link'));

    assert.doesNotMatch(header, /ifrn-panel-header__divider|accessibility-outline|help-circle-outline/);
    assert.match(headerStyles, /&__brand \{[\s\S]*?min-height: 28px;/);
    assert.match(headerStyles, /flex: 0 0 24px;[\s\S]*?width: 24px;[\s\S]*?height: 28px;/);
    assert.match(headerStyles, /font-size: 14px;[\s\S]*?font-weight: 700;[\s\S]*?line-height: 13px;/);
    assert.match(headerStyles, /&__action \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;/);
    assert.match(headerStyles, /&__icon--accessibility \{[\s\S]*?width: 35px;[\s\S]*?height: 35px;/);
    assert.match(headerStyles, /&__icon--help \{[\s\S]*?width: 19px;[\s\S]*?height: 30px;/);
});

test('Painel header omits the messages shortcut', () => {
    const template = fs.readFileSync('src/MoodleIFRN/painel/painel-native.html', 'utf8');
    const host = fs.readFileSync('src/MoodleIFRN/painel/painel.html', 'utf8');

    assert.doesNotMatch(template, /aria-label="Mensagens"|chatbubble-ellipses-outline|openMessages/);
    assert.doesNotMatch(host, /openMessages|onNativeMessages/);
});

function setupFirstProfile(savedName, loadMoodleTeacherNames = async () => new Map()) {
    const storage = new Map();
    const sessionStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
    };
    const globals = { sessionStorage, localStorage: sessionStorage };
    const oauth = load('src/MoodleIFRN/mobilemoodle/core_mobile/oauth-profile.ts', {}, globals);
    const { refreshSavedProfileNames } = load('src/MoodleIFRN/mobilemoodle/core_mobile/profile-refresh.ts',
        { './oauth-profile': oauth }, globals);
    const owner = 'conta-ficticia';
    const origin = 'https://ava.ifrn.edu.br';
    oauth.saveOAuthProfile({ identificacao: owner, nome_exibicao: savedName, _profile_origin: origin }, 60);
    storage.set('ifrn_painel_owner', owner);
    storage.set('ifrn_painel_dashboard', JSON.stringify(raw));
    let respond;
    const response = new Promise(resolve => { respond = resolve; });
    let finishLanguage;
    const language = new Promise(resolve => { finishLanguage = resolve; });
    const PanelService = {};
    const MoodleService = {};
    const NgZone = {};
    const dependencies = new Map([
        [PanelService, {
            getDashboard: oauth.readOAuthDashboard,
            refreshSavedProfile: () => response.then(profile =>
                refreshSavedProfileNames(profile, origin + '/api/v2/usuario/info/', origin)),
        }],
        [MoodleService, { prepareCourseLanguage: () => language }],
        [NgZone, { run: action => action() }],
    ]);
    const { PainelPage } = load('src/MoodleIFRN/painel/painel.ts', {
        '@angular/core': { Component: () => type => type, ViewChild: () => () => {}, NgZone,
            inject: token => dependencies.get(token) ?? {} },
        '@services/platform': { CorePlatform: { ready: async () => undefined } },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService: PanelService },
        '@/MoodleIFRN/services_mobile/moodle-site.service': { MoodleSiteService: MoodleService },
        '../mobilemoodle/core_mobile/oauth-profile': oauth,
        './painel-course-teachers': { loadMoodleTeacherNames },
        './painel-native-model': modelModule,
    }, { window: { addEventListener() {} },
        document: { addEventListener() {}, documentElement: { classList: { remove() {} } } }, performance });

    return { page: new PainelPage(), finishLanguage,
        respond: names => respond({ id: 11, identificacao: owner, ...names }) };
}

test('primeiro acesso mostra os cursos sem exibir o nome antigo e usa o nome curto verificado sem esperar pelo idioma', async () => {
    const { page, respond, finishLanguage } = setupFirstProfile('Luca Oliveir');
    page.ngOnInit();
    assert.equal(page.nativeDashboard.groups.diarios[0].moodle_course_id, 17);
    assert.equal(page.nativeDashboard.name, 'Estudante');
    respond({ nome_usual: 'Lucas Oliveira', nome_registro: 'Lucas Henrique Oliveira' });
    try {
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(page.nativeDashboard.name, 'Lucas Oliveira');
    } finally {
        finishLanguage();
    }
});

test('a primeira revalidação também revela o nome curto quando o servidor confirma o mesmo nome do cache', async () => {
    const { page, respond, finishLanguage } = setupFirstProfile('Lucas Oliveira');
    page.ngOnInit();
    respond({ nome_exibicao: 'Lucas Oliveira' });
    finishLanguage();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.nativeDashboard.name, 'Lucas Oliveira');
});

test('docentes carregam em segundo plano sem trocar o contexto do progresso e somem ao sair do Painel', async () => {
    const requests = [];
    const { page, respond, finishLanguage } = setupFirstProfile('Estudante fictício',
        (courses, owner, isCurrent) => new Promise(resolve => requests.push({ courses, owner, isCurrent, resolve })));
    const nextTick = () => new Promise(resolve => setImmediate(resolve));
    try {
        page.ngOnInit();
        page.ionViewDidEnter();
        page.onNativeRefresh();
        await nextTick();
        assert.equal(requests.length, 1);
        assert.equal(requests[0].owner, 'conta-ficticia');
        assert.equal(page.moodleTeacherNames, null);
        const dashboard = page.nativeDashboard;
        const courseKey = dashboard.groups.diarios[0].key;
        requests[0].resolve(new Map([[courseKey, 'Docente fictício']]));
        await nextTick();
        assert.equal(page.nativeDashboard, dashboard, 'the role lookup must not restart the account-scoped progress');
        assert.equal(page.moodleTeacherNames.get(courseKey), 'Docente fictício');

        page.onNativeRefresh();
        await nextTick();
        assert.equal(requests.length, 2);
        page.ionViewWillLeave();
        assert.equal(requests[1].isCurrent(), false);
        requests[1].resolve(new Map([[courseKey, 'Docente atrasado']]));
        await nextTick();
        assert.equal(page.moodleTeacherNames, null);
    } finally {
        respond({ nome_exibicao: 'Estudante fictício' });
        finishLanguage();
    }
});

test('Painel mostra o diário sem sessão Moodle e preenche o docente ao voltar do primeiro curso', async () => {
    const info = { username: 'conta-ficticia' };
    let courseSessionAvailable = false;
    const sessionsRead = [];
    const requests = [];
    const { loadMoodleTeacherNames } = load('src/MoodleIFRN/painel/painel-course-teachers.ts', {
        '../mobilemoodle/core_mobile/course-target': target,
        '@services/sites': { CoreSites: {
            getSites: async () => courseSessionAvailable ? [{ id: 'site-da-conta', siteUrl: site, info }] : [],
            getSite: async id => {
                sessionsRead.push(id);

                return {
                    getURL: () => site, getInfo: () => info, getUserId: () => 42, getToken: () => 'simulated-session',
                    isLoggedOut: () => false, wsAvailable: () => true,
                };
            },
        } },
        '@services/ws': { CoreWS: { call: async (functionName, params) => {
            requests.push([functionName, params.courseid]);

            return [{ fullname: 'Docente da turma', roles: [{ shortname: 'editingteacher' }] }];
        } } },
    });
    const { page, respond, finishLanguage } = setupFirstProfile('Estudante fictício', loadMoodleTeacherNames);
    const nextTick = () => new Promise(resolve => setImmediate(resolve));
    try {
        page.ngOnInit();
        page.ionViewDidEnter();
        await nextTick();
        assert.equal(page.nativeDashboard.groups.diarios[0].moodle_course_id, 17);
        assert.equal(page.moodleTeacherNames, null);
        assert.equal(sessionsRead.length, 0);
        assert.equal(requests.length, 0);

        page.ionViewWillLeave();
        courseSessionAvailable = true;
        page.ionViewDidEnter();
        await nextTick();

        assert.deepEqual(sessionsRead, ['site-da-conta']);
        assert.deepEqual(requests, [['core_enrol_get_enrolled_users', 17]]);
        assert.equal(page.moodleTeacherNames.get(page.nativeDashboard.groups.diarios[0].key), 'Docente da turma');
    } finally {
        respond({ nome_exibicao: 'Estudante fictício' });
        finishLanguage();
    }
});

test('legacy direct bridge reenters real Angular NgZone and preserves its async result/error', async () => {
    const { NgZone } = await import('@angular/core');
    const angularZone = new NgZone({});
    const window = { addEventListener() {}, removeEventListener() {} };
    const { PainelPage } = load('src/MoodleIFRN/painel/painel.ts', {
        '@angular/core': { Component: () => type => type, ViewChild: () => () => {}, NgZone,
            inject: token => token === NgZone ? angularZone : {} },
    }, { window });
    const page = new PainelPage();
    const contexts = [];
    page.handleOpenCourse = id => {
        contexts.push(NgZone.isInAngularZone());
        // Angular's browser builder lowers async functions to ZoneAwarePromise chains.
        // Node's native async/await is not patched by zone.js, so use that same contract here.
        return Promise.resolve().then(() => {
            contexts.push(NgZone.isInAngularZone());
            if (id === 2) throw new Error('Synthetic navigation error');
            return 'opened';
        });
    };
    page.registerBridge();
    assert.equal(NgZone.isInAngularZone(), false);
    assert.equal(await window.MoodleIfrnBridge.openCourse(1), 'opened');
    await assert.rejects(window.MoodleIfrnBridge.openCourse(2), /Synthetic navigation error/);
    assert.deepEqual(contexts, [true, true, true, true]);
});

test('native Angular signals filter data and never emit a blocked/double in-progress navigation', async () => {
    const angular = await import('@angular/core');
    const storage = new Map([['ifrn_username', 'SYNTHETIC_A']]);
    const store = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const favourites = load('src/MoodleIFRN/mobilemoodle/core_mobile/course-favourites.ts', {}, { sessionStorage: store, localStorage: store });
    const events = [];
    const { PainelNativeComponent } = load('src/MoodleIFRN/painel/painel-native.ts', {
        '@angular/core': { ...angular, Component: () => type => type, input: value => angular.signal(value),
            inject: () => null, ViewChild: () => () => {},
            output: () => ({ emit: value => events.push(value) }) },
        '../mobilemoodle/core_mobile/course-favourites': favourites,
        '../services_mobile/painel-help-links': { PAINEL_HELP_LINKS: {} },
        './painel-native-model': modelModule,
        './painel-filters': filters,
    });
    const page = new PainelNativeComponent();
    page.data.set(build(raw, null, 'conta-a-ficticia'));
    page.moodleTeacherNames.set(new Map([[page.courses()[0].key, 'Docente fictício']]));
    const course = page.courses()[0];
    assert.equal(course.teacherNames, 'Docente fictício');
    page.busy.set(true);
    page.selectCourse(course);
    assert.equal(events.length, 0);
    page.busy.set(false);
    page.selectCourse({ ...course, moodle_site_url: undefined });
    assert.equal(events.length, 0);
    page.selectCourse(course);
    assert.equal(events.length, 1);
    page.openFilters();
    page.editFilterQuery('NOT_FOUND');
    page.applyFilters();
    assert.equal(page.courses().length, 0);
    page.openFilters();
    page.editFilterQuery('fictícia');
    page.toggleFavourite(course);
    page.chooseFilter('situation', 'favourites');
    page.applyFilters();
    assert.equal(page.courses().length, 1);
    storage.set('ifrn_username', 'SYNTHETIC_B');
    page.data.set(build(raw, null, 'conta-b-ficticia'));
    assert.equal(page.activeFilterCount(), 0, 'filters reset for a different owner');
    page.openFilters();
    page.chooseFilter('situation', 'favourites');
    page.applyFilters();
    assert.equal(page.courses().length, 0, 'new account cannot inherit account A favourites');
    page.data.set(null);
    assert.equal(page.courses().length, 0, 'missing/invalid owner data clears the rendered list');
});
