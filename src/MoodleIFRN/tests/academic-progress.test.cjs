const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');

const root = 'src/MoodleIFRN/academic-progress/';
function load(name, mocks = {}, globals = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(root + name + '.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    }).outputText;
    vm.runInNewContext(code, { exports, require(id) {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id === './progress-model') return model;
        if (id === './progress-store') return storeModule;
        throw new Error('Import não simulado: ' + id);
    }, setTimeout, clearTimeout, ...globals }, { filename: root + name + '.ts' });
    return exports;
}
const model = load('progress-model');
const storeModule = load('progress-store');
const { AcademicProgressStore } = storeModule;
const context = { owner: 'CONTA_FICTICIA_A', siteId: 'site-A', siteUrl: 'https://example.test', userId: 11, courseId: 7 };
const activity = (cmid, state, fields = {}) => ({ cmid, state, tracking: 2, ...fields });
const payload = (states, percent = null) => ({ enabled: true, percent, activities: states.map((state, i) => activity(i + 1, state)) });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

for (const [states, expected] of [[[0, 0], 0], [[1, 0], 50], [[1, 2], 100]]) {
    test(`progresso real por atividades: ${expected}%`, () => {
        const result = model.summarizeProgress(payload(states), 100);
        assert.equal(result.percent, expected);
        assert.equal(result.total, 2);
        assert.equal(result.completed, expected / 50);
        assert.equal(result.source, 'activities');
    });
}
test('conclusão desabilitada, curso vazio e ausência não inventam 0%', () => {
    assert.equal(model.summarizeProgress({ ...payload([0]), enabled: false }, 1).status, 'disabled');
    const empty = model.summarizeProgress(payload([]), 1);
    assert.equal(empty.status, 'empty'); assert.equal(empty.percent, null);
    assert.equal(model.panelProgress(null, true).percent, null);
    assert.equal(model.panelProgress(0, true).percent, 0);
    assert.equal(model.panelProgress(100, false).percent, null);
    for (const value of [NaN, Infinity, -1, 101, '50', undefined]) assert.equal(model.validPercent(value), null);
});
test('somente atividades elegíveis entram no denominador; restrição não muda a regra acadêmica', () => {
    const result = model.summarizeProgress({ enabled: true, percent: null, activities: [
        activity(1, 1, { tracking: 0 }), activity(2, 0), activity(3, 1, { uservisible: false }),
        activity(4, 1, { istrackeduser: false }), activity(5, 1, { hascompletion: false }),
    ] }, 1);
    assert.equal(result.total, 2); assert.equal(result.completed, 1); assert.equal(result.percent, 50);
});
test('percentual do Moodle é preservado separadamente da contagem das atividades', () => {
    const result = model.summarizeProgress(payload([1, 0], 100), 1);
    assert.equal(result.percent, 100); assert.equal(result.activityPercent, 50);
    assert.equal(result.completed, 1); assert.equal(result.total, 2); assert.equal(result.source, 'moodle');
});
test('conclusão manual e automática confirmadas têm texto/ícone; offline não vira sucesso', () => {
    for (const tracking of [1, 2]) {
        const label = model.activityLabel(activity(1, 1, { tracking }));
        assert.equal(label.completed, true); assert.match(label.text, /Concluído/); assert.ok(label.icon);
        assert.equal(label.tracking, tracking === 1 ? 'Conclusão manual' : 'Conclusão automática');
    }
    const offline = activity(1, 1, { tracking: 1, offline: true });
    assert.equal(model.activityLabel(offline).text, 'Pendente de sincronização');
    assert.equal(model.summarizeProgress({ enabled: true, percent: null, activities: [offline] }, 1).completed, 0);
});
test('aprovação, reprovação, ausência de estado e nota oculta não produzem rótulos falsos', () => {
    assert.equal(model.activityLabel(activity(1, 2)).text, 'Concluído · aprovado');
    assert.equal(model.activityLabel(activity(1, 3)).completed, false);
    assert.equal(model.activityLabel(activity(1, 3)).text, 'Não aprovado');
    assert.equal(model.activityLabel(activity(1, 4)).text, 'Pendente', 'não revela reprovação de nota oculta');
    assert.equal(model.activityLabel(undefined).text, 'Estado indisponível');
    assert.equal(model.activityLabel(activity(1, 0, { tracking: 0 })).text, 'Sem acompanhamento de conclusão');
});
test('critério de nota pendente não comprova envio nem avaliação em andamento ou atividade não iniciada', () => {
    const row = activity(1, 0, { details: [{ rulename: 'completionusegrade', rulevalue: { status: 0, description: 'Exige nota' } }] });
    assert.equal(model.activityLabel(row).text, 'Pendente');
    assert.equal(model.isConfirmedComplete(row), false);
    assert.equal(model.isConfirmedComplete(activity(1, 0, { isoverallcomplete: true })), true);
});
test('schemas inválidos, cmid duplicado e estados inválidos são rejeitados', () => {
    for (const data of [null, '', [], { 1: null }, { 1: activity(1, 99) }, { 1: activity(1, 0, { tracking: 5 }) },
        { 1: activity(-1, 0) }, { 1: activity(1, 1), 2: activity(1, 0) }]) assert.throws(() => model.validateActivities(data));
    assert.equal(model.validateActivities({ 1: activity(1, 0) }).length, 1);
    assert.equal(model.validateActivities({}).length, 0);
});
test('rotas de atividade não são confundidas com o retorno ao curso ou ao painel', () => {
    assert.equal(model.isProgressRoute('/main/home/course/7/contents', 7), true);
    assert.equal(model.isProgressRoute('/main/home/course/17', 7), false);
    assert.equal(model.isProgressRoute('/main/home/course/7/mod/quiz', 7), false);
    assert.equal(model.isProgressRoute('/login/painel'), true);
    assert.equal(model.isProgressRoute('/login/marketplace-ifrn'), false);
});
test('cache usa site, usuário, proprietário e curso; IDs iguais em ambientes diferentes não colidem', () => {
    const original = model.contextKey(context);
    for (const fields of [{ owner: 'B' }, { siteId: 'B' }, { siteUrl: 'https://other.test' }, { userId: 22 }, { courseId: 8 }]) {
        assert.notEqual(model.contextKey({ ...context, ...fields }), original);
    }
});
test('requisições simultâneas do mesmo contexto são coalescidas', async () => {
    const store = new AcademicProgressStore(); const request = deferred(); let calls = 0;
    const read = () => { calls++; return request.promise; };
    const one = store.load(context, read, () => true); const two = store.load(context, read, () => true);
    assert.equal(one, two); await tick(); assert.equal(calls, 1);
    request.resolve(payload([1, 0])); assert.equal((await one).percent, 50);
    store.clear();
});
test('falha de rede conserva apenas cache confirmado do mesmo contexto, marcado antigo', async () => {
    const store = new AcademicProgressStore(); await store.load(context, async () => payload([1, 0]), () => true);
    const failure = async () => { throw new Error('OFFLINE_MARCADOR_SECRETO'); };
    const cached = await store.load(context, failure, () => true);
    assert.equal(cached.status, 'stale'); assert.equal(cached.percent, 50);
    const other = await store.load({ ...context, owner: 'B' }, failure, () => true);
    assert.equal(other.status, 'unavailable'); assert.equal(other.percent, null); store.clear();
});
test('sessão expirada/permissão negada remove cache em vez de apresentá-lo como atual', async () => {
    for (const errorcode of ['invalidtoken', 'accessexception', 'requireloginerror', 'nopermissions']) {
        const store = new AcademicProgressStore(); await store.load(context, async () => payload([1]), () => true);
        const result = await store.load(context, async () => { throw { errorcode }; }, () => true);
        assert.equal(result.percent, null); assert.equal(store.peek(context), undefined); store.clear();
    }
});
test('timeout encerra loading e resposta atrasada não é publicada', async () => {
    const store = new AcademicProgressStore(); const request = deferred();
    const result = await store.load(context, () => request.promise, () => true, 5);
    assert.equal(result.status, 'unavailable'); request.resolve(payload([1])); await tick();
    assert.equal(store.peek(context), undefined); store.clear();
});
test('troca de conta em voo e cleanup idempotente impedem publicação tardia', async () => {
    const store = new AcademicProgressStore(); const request = deferred(); let current = true;
    const pending = store.load(context, () => request.promise, () => current);
    await tick(); current = false; request.resolve(payload([1]));
    assert.equal((await pending).percent, null); assert.equal(store.peek(context), undefined);
    const next = store.load(context, () => new Promise(() => {}), () => true);
    store.clear(); store.clear(); assert.equal((await next).status, 'unavailable');
});

function serviceHarness(options = {}) {
    const listeners = new Map(); const dom = new Map(); const windowEvents = new Map();
    const storage = new Map([['ifrn_username', 'A'], ['ifrn_painel_owner', 'A']]);
    let account = { id: 'SITE_A', user: 11, url: 'https://example.test', loggedOut: false };
    let courses = [{ id: 7, progress: 50, enablecompletion: true }, { id: 8, progress: 0, enablecompletion: true }];
    let activities = { 1: activity(1, 1), 2: activity(2, 0) };
    const calls = { courses: [], completion: [], auth: 0, writes: 0 };
    const moodleToken = {};
    const moodle = { hasMatchingPresencialSession: () => options.match !== false };
    let courseReader, activityReader;
    class NavigationEnd {}
    const router = { url: options.panel ? '/login/painel' : '/main/home/course/7/contents',
        events: { subscribe(callback) { listeners.set('router', callback); return { unsubscribe() { listeners.delete('router'); } }; } } };
    const events = { on(event, callback) {
        assert.equal(listeners.has(event), false, 'apenas um listener compartilhado por evento');
        listeners.set(event, callback); return { off() { listeners.delete(event); } };
    } };
    for (const name of ['LOGIN', 'SITE_UPDATED', 'LOGOUT', 'SESSION_EXPIRED', 'MANUAL_COMPLETION_CHANGED', 'COMPLETION_MODULE_VIEWED']) events[name] = name;
    const listen = target => ({ addEventListener: (name, callback) => target.set(name, callback),
        removeEventListener: (name, callback) => { if (target.get(name) === callback) target.delete(name); } });
    const site = () => ({ getId: () => account.id, getUserId: () => account.user, getURL: () => account.url,
        isLoggedOut: () => account.loggedOut });
    const { IfrnAcademicProgressService } = load('progress.service', {
        '@angular/core': { Injectable: () => type => type, inject: token => token === moodleToken ? moodle : router },
        '@angular/router': { NavigationEnd, Router: class {} },
        '@services/sites': { CoreSites: { getCurrentSite: site, getCurrentSiteId: () => account.id, getSite: async () => site() }, CoreSitesReadingStrategy: { ONLY_NETWORK: 3 } },
        '@features/course/services/course': { CoreCourse: { getActivitiesCompletionStatus: async (...args) => {
            calls.completion.push(args); return activityReader ? activityReader(...args) : activities;
        } } },
        '@features/courses/services/courses': { CoreCourses: { getUserCourses: async (...args) => {
            calls.courses.push(args); return courseReader ? courseReader(...args) : courses;
        } } },
        '@features/course/services/course-completion': { CoreCourseCompletion: { isCompletionEnabledInSite: () => true } },
        '@features/course/constants': { CORE_COURSE_AUTO_SYNCED: 'SYNC', CORE_COURSE_PROGRESS_UPDATED_EVENT: 'PROGRESS' },
        '@static/events': { CoreEvents: events },
        '../services_mobile/moodle-site.service': { MoodleSiteService: moodleToken },
    }, { sessionStorage: { getItem: key => storage.get(key) ?? null }, localStorage: { getItem: () => null },
        document: { ...listen(dom), visibilityState: 'visible' }, window: listen(windowEvents) });
    const service = new IfrnAcademicProgressService();
    const snapshots = [];
    return { service, calls, router, listeners, dom, windowEvents, storage, snapshots,
        watch(id = 7, details = !options.panel, url = account.url) { return service.watch(id, url, details, snapshot => snapshots.push(snapshot)); },
        event(name, data = {}) { listeners.get(name)?.(data); },
        route(url) { router.url = url; listeners.get('router')?.(new NavigationEnd()); },
        setAccount(value) { account = { ...account, ...value }; },
        setCourses(value) { courses = value; }, setActivities(value) { activities = value; },
        setCourseReader(value) { courseReader = value; }, setActivityReader(value) { activityReader = value; },
    };
}
test('adaptador usa serviços oficiais de leitura, usuário/site explícitos e exclui conclusão offline', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick();
    assert.deepEqual(h.calls.completion[0], [7, 'SITE_A', 11, false, true, false]);
    assert.deepEqual(h.calls.courses[0], [false, 'SITE_A', 3]);
    assert.equal(h.snapshots.at(-1).percent, 50); assert.equal(h.calls.auth, 0); assert.equal(h.calls.writes, 0); release();
});
test('conclusão confirmada, retorno de atividade e retomada após Web consultam estado novo', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick();
    h.setCourses([{ id: 7, progress: 100, enablecompletion: true }]); h.setActivities({ 1: activity(1, 1), 2: activity(2, 1) });
    h.event('MANUAL_COMPLETION_CHANGED'); await tick(); assert.equal(h.snapshots.at(-1).percent, 100);
    h.route('/main/home/course/7/mod/assign'); await tick(); const before = h.calls.completion.length;
    h.event('COMPLETION_MODULE_VIEWED'); await tick(); assert.equal(h.calls.completion.length, before);
    h.route('/main/home/course/7/contents'); await tick(); assert.equal(h.calls.completion.length, before + 1);
    h.setCourses([{ id: 7, progress: 50, enablecompletion: true }]); h.dom.get('resume')(); await tick();
    assert.equal(h.snapshots.at(-1).percent, 50); release();
});
test('cartões compartilham uma consulta de cursos e não buscam conclusão de cada atividade', async () => {
    const h = serviceHarness({ panel: true }); const a = h.watch(7); const b = h.watch(8); await tick();
    assert.equal(h.calls.courses.length, 1); assert.equal(h.calls.completion.length, 0);
    assert.equal(h.listeners.size, 9); a(); assert.ok(h.listeners.size); b();
    assert.equal(h.listeners.size, 0); assert.equal(h.dom.size, 0); assert.equal(h.windowEvents.size, 0);
});
test('sem sessão nativa correspondente usa só o agregado do Painel, sem iniciar SSO', async () => {
    const h = serviceHarness({ panel: true, match: false }); const release = h.watch(); await tick();
    assert.equal(h.snapshots.at(-1), null); assert.equal(h.calls.courses.length, 0); assert.equal(h.calls.completion.length, 0);
    release();
});
test('painel sem nenhum site Moodle ativo ainda pode apresentar o agregado validado', async () => {
    const h = serviceHarness({ panel: true, match: false }); h.setAccount({ id: '', user: 0 });
    const release = h.watch(); await tick(); assert.equal(h.snapshots.at(-1), null);
    assert.equal(h.calls.courses.length, 0); release();
});
test('troca de conta não herda dados nem agregado antigo; novo vínculo é necessário', async () => {
    const h = serviceHarness({ panel: true }); const release = h.watch(); await tick();
    h.storage.set('ifrn_username', 'B'); h.storage.set('ifrn_painel_owner', 'B'); h.setAccount({ id: 'SITE_B', user: 22 });
    h.event('LOGIN'); await tick(); assert.equal(h.snapshots.at(-1).percent, null);
    assert.notEqual(h.snapshots.at(-1), null); assert.equal(h.calls.courses.length, 1);
    release(); h.setCourses([{ id: 7, progress: 0, enablecompletion: true }]); const next = h.watch(); await tick();
    assert.equal(h.snapshots.at(-1).percent, 0); assert.equal(h.calls.courses.at(-1)[1], 'SITE_B'); next();
});
test('mesmo curso em outro ambiente não consulta o site atual por engano', async () => {
    const h = serviceHarness({ panel: true }); const release = h.watch(7, false, 'https://another.test'); await tick();
    assert.equal(h.calls.courses.length, 0); assert.equal(h.snapshots.at(-1), null); release();
});
test('eventos duplicados no mesmo turno são coalescidos e não criam polling', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick(); const before = h.calls.courses.length;
    for (let i = 0; i < 8; i++) h.event('MANUAL_COMPLETION_CHANGED');
    await tick(); assert.equal(h.calls.courses.length, before + 1); await tick(); assert.equal(h.calls.courses.length, before + 1); release();
});
test('evento durante uma leitura em voo agenda uma atualização final única', async () => {
    const h = serviceHarness(); const request = deferred(); h.setActivityReader(() => request.promise);
    const release = h.watch(); await tick(); h.event('MANUAL_COMPLETION_CHANGED'); await tick();
    h.setActivityReader(undefined); request.resolve({ 1: activity(1, 1), 2: activity(2, 1) }); await tick(); await tick();
    assert.equal(h.calls.completion.length, 2); release();
});
test('retorno curso/painel durante consulta não dispara uma cascata de atualizações', async () => {
    const h = serviceHarness({ panel: true }); const request = deferred(); h.setCourseReader(() => request.promise);
    const panel = h.watch(); await tick(); h.route('/main/home/course/7/contents'); const course = h.watch(7, true); await tick();
    request.resolve([{ id: 7, progress: 50, enablecompletion: true }]);
    await tick(); await tick(); const completed = h.calls.courses.length;
    await tick(); await tick(); assert.equal(h.calls.courses.length, completed);
    assert.equal(h.snapshots.at(-1).total, 2); panel(); course();
});
test('eventos de outro site não causam consulta nem misturam o curso de ID igual', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick(); const before = h.calls.completion.length;
    h.event('COMPLETION_MODULE_VIEWED', { siteId: 'OUTRO_SITE', courseId: 7 }); await tick();
    assert.equal(h.calls.completion.length, before); release();
});
test('expiração de sessão oculta progresso e impede novas consultas até novo login', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick(); h.event('SESSION_EXPIRED', { siteId: 'SITE_A' });
    assert.equal(h.snapshots.at(-1).percent, null); const before = h.calls.courses.length;
    h.dom.get('resume')(); await tick(); assert.equal(h.calls.courses.length, before); release();
});
test('mount/unmount repetido não deixa listeners, observers ou publicações tardias', async () => {
    const h = serviceHarness();
    for (let i = 0; i < 20; i++) {
        const request = deferred(); h.setActivityReader(() => request.promise); const release = h.watch(); await tick();
        release(); release(); const length = h.snapshots.length;
        request.resolve({ 1: activity(1, 1) }); await tick();
        assert.equal(h.snapshots.length, length); assert.equal(h.listeners.size, 0); assert.equal(h.dom.size, 0); assert.equal(h.windowEvents.size, 0);
    }
});
for (const [scenario, failure] of [
    ['offline', new Error('Offline')], ['conexão recusada', new Error('ECONNREFUSED')],
    ['401', { errorcode: 'invalidtoken' }], ['403', { errorcode: 'nopermissions' }], ['500', new Error('HTTP 500')],
    ['JSON vazio', new Error('Unexpected end of JSON input')], ['JSON inválido', new SyntaxError('Invalid JSON')],
]) {
    test(`resiliência: ${scenario} não bloqueia o curso nem inventa progresso`, async () => {
        const h = serviceHarness(); h.setActivityReader(async () => { throw failure; }); const release = h.watch(); await tick();
        assert.equal(h.snapshots.at(-1).status, 'unavailable'); assert.equal(h.snapshots.at(-1).percent, null);
        assert.equal(h.calls.completion.length, 1, 'nenhum retry automático'); release();
    });
}
test('schema inesperado do adaptador não vira 0%', async () => {
    const h = serviceHarness(); h.setActivities({ unexpected: true }); const release = h.watch(); await tick();
    assert.equal(h.snapshots.at(-1).status, 'unavailable'); release();
});
test('curso sem conclusão habilitada não depende da disponibilidade da API de atividades', async () => {
    const h = serviceHarness(); h.setCourses([{ id: 7, progress: null, enablecompletion: false }]);
    h.setActivityReader(async () => { throw new Error('Completion disabled'); }); const release = h.watch(); await tick();
    assert.equal(h.snapshots.at(-1).status, 'disabled'); assert.equal(h.snapshots.at(-1).percent, null); release();
});
test('curso que deixou de constar na matrícula não reapresenta o snapshot anterior', async () => {
    const h = serviceHarness(); const release = h.watch(); await tick(); assert.equal(h.snapshots.at(-1).percent, 50);
    h.setCourses([]); h.event('MANUAL_COMPLETION_CHANGED'); await tick();
    assert.equal(h.snapshots.at(-1).percent, null); assert.equal(h.snapshots.at(-1).status, 'unavailable'); release();
});
test('usuário não rastreado no curso não recebe barra de 0% mesmo com agregado numérico', async () => {
    const h = serviceHarness(); h.setCourses([{ id: 7, progress: 0, enablecompletion: true, completionusertracked: false }]);
    const release = h.watch(); await tick(); assert.equal(h.snapshots.at(-1).status, 'disabled');
    assert.equal(h.snapshots.at(-1).percent, null); release();
});
test('metadados maliciosos dos erros não aparecem em snapshots nem são registrados pelo adaptador', async () => {
    const markers = ['TOKEN_SINTETICO', 'COOKIE_SINTETICO', 'PESSOA_SINTETICA', 'CURSO_PRIVADO_SINTETICO'];
    const h = serviceHarness(); h.setActivityReader(async () => { throw new Error(markers.join(' ')); });
    const release = h.watch(); await tick(); const serialized = JSON.stringify(h.snapshots);
    for (const marker of markers) assert.equal(serialized.includes(marker), false);
    for (const file of ['progress-model', 'progress-store', 'progress.service', 'progress.component']) {
        assert.doesNotMatch(fs.readFileSync(root + file + '.ts', 'utf8'), /console\.|\.write\(|setInterval|setItem\(/);
    }
    release();
});
test('componente mantém sinais, troca de curso e teardown idempotente; nomes são texto escapado', async () => {
    const angular = await import('@angular/core'); const watches = []; const released = [];
    const progress = { watch: (...args) => { watches.push(args); return () => released.push(args); }, refresh() {} };
    const { IfrnAcademicProgressComponent } = load('progress.component', {
        '@angular/core': { ...angular, Component: () => type => type, Input: () => () => {}, inject: () => progress },
        '@/core/shared.module': { CoreSharedModule: {} },
        '@features/course/services/course': { CoreCourse: { getSectionsModules: sections => sections.flatMap(s => s.modules) } },
        './progress.service': {},
    });
    const component = new IfrnAcademicProgressComponent();
    component.courseId = 7; component.siteUrl = 'https://example.test';
    component.sections = [{ modules: [{ id: 1, course: 7, name: '<script>FICTICIO</script>', uservisible: true, completion: 2 },
        { id: 2, course: 8, name: 'OUTRO_CURSO', uservisible: true, completion: 2 }] }];
    component.ngOnChanges({ courseId: {}, sections: {} });
    assert.equal(component.activityRows().length, 0, 'sem contexto confirmado não mostra nomes antigos');
    watches[0][3](model.summarizeProgress(payload([1]), 1));
    assert.equal(component.activityRows()[0].status.text, 'Concluído'); assert.equal(component.percentage, 100);
    assert.equal(component.activityRows().length, 1, 'itens de outra disciplina são ignorados');
    component.courseId = 8; component.ngOnChanges({ courseId: {} });
    assert.equal(released.length, 1); assert.equal(component.view.percent, null); assert.equal(watches[1][0], 8);
    assert.equal(component.activityRows().length, 0);
    component.ngOnDestroy(); component.ngOnDestroy(); assert.equal(released.length, 2);
    const template = fs.readFileSync(root + 'progress.component.html', 'utf8');
    assert.match(template, /\{\{ activity.name \}\}/); assert.doesNotMatch(template, /\[innerHTML\]/);
});
test('HTML acessível e SCSS responsivo compilam sem CDN, tamanho fixo ou dependência de cor isolada', async () => {
    const { parseTemplate } = await import('@angular/compiler');
    const html = fs.readFileSync(root + 'progress.component.html', 'utf8');
    assert.equal(parseTemplate(html, 'progress.component.html').errors, null);
    for (const expected of ['role="progressbar"', 'aria-valuemin="0"', 'aria-valuemax="100"', '[attr.aria-valuenow]', 'aria-live="polite"', '<summary>', 'activity.status.text']) assert.ok(html.includes(expected), expected);
    const css = require('sass').compile(path.resolve(root + 'progress.component.scss')).css;
    for (const expected of ['flex-wrap: wrap', 'overflow-wrap: anywhere', 'prefers-reduced-motion', '.ion-palette-dark', 'forced-colors: active', ':focus-visible']) assert.ok(css.includes(expected), expected);
    assert.doesNotMatch(css, /!important|https?:\/\/|width:\s*\d{3,}px/);
    const course = fs.readFileSync('src/MoodleIFRN/moodle-course/course-menu.html', 'utf8');
    const panel = fs.readFileSync('src/MoodleIFRN/painel/painel-native.html', 'utf8');
    assert.ok(course.includes('<ifrn-academic-progress')); assert.ok(panel.includes('<ifrn-academic-progress'));
    assert.ok(panel.includes('course.is_enrolled &&'), 'não mostra progresso para autoinscrição ainda não efetivada');
});
test('normalização do Painel rejeita valores inválidos sem limitar silenciosamente para 0/100', () => {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/painel/painel-native-model.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, URL, require: () => ({ resolveCourseSite: () => 'https://example.test' }) });
    for (const value of [-1, 101, Infinity, NaN, null, '50']) {
        const result = exports.buildNativePainelModel({ diarios: [{ id: 7, progress: value, hasprogress: true }] }, null);
        assert.equal(result.groups.diarios[0].progress, null);
    }
    const result = exports.buildNativePainelModel({ diarios: [{ id: 7, progress: 0, hasprogress: true }] }, null);
    assert.equal(result.groups.diarios[0].progress, 0);
});
test('indicador nativo só é oculto na aba ativa com o resumo IFRN, evitando duas barras', () => {
    const { JSDOM } = require('jsdom'); const source = fs.readFileSync('src/MoodleIFRN/moodle-course/moodle-course.scss', 'utf8');
    const start = source.indexOf('html.ifrn-course-context page-core-course-index:has(');
    const rule = source.slice(start, source.indexOf('}', start) + 1);
    assert.ok(start > 0); const css = require('sass').compileString(rule).css;
    const dom = new JSDOM(`<html class="ifrn-course-context"><head><style>${css}</style></head><body>
        <page-core-course-index><div class="core-course-header"><div class="core-course-progress"></div></div>
        <page-core-course-contents><ifrn-academic-progress data-progress-context="course"></ifrn-academic-progress></page-core-course-contents>
        </page-core-course-index></body></html>`);
    const win = dom.window; const bar = win.document.querySelector('.core-course-progress');
    assert.equal(win.getComputedStyle(bar).display, 'none');
    win.document.querySelector('page-core-course-contents').classList.add('ion-page-hidden');
    assert.notEqual(win.getComputedStyle(bar).display, 'none');
    win.document.querySelector('ifrn-academic-progress').remove();
    assert.notEqual(win.getComputedStyle(bar).display, 'none'); dom.window.close();
});
