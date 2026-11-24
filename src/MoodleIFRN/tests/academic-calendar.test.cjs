const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../academic-calendar');
const scripts = new Map();
function load(file, mocks = {}, globals = {}) {
    const filename = path.resolve(root, file + '.ts');
    if (!scripts.has(filename)) {
        const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
        });
        scripts.set(filename, new vm.Script(outputText, { filename }));
    }
    const exports = {};
    scripts.get(filename).runInNewContext({
        exports, require(id) {
            if (!Object.hasOwn(mocks, id)) {
                throw new Error('Import não simulado: ' + id);
            }
            return mocks[id];
        }, URL, AbortController, setTimeout, clearTimeout, ...globals,
    });

    return exports;
}

const model = load('calendar-model');
const reads = load('calendar-read');
const scope = { owner: 'conta-ficticia-a', siteId: 'site-a', userId: 11, courseId: 7, siteUrl: 'https://academico.ava.ifrn.edu.br' };
const feb = { year: 2028, month: 2, day: 29 };
const selection = { ...feb, courseId: 7, view: 'month' };
const plain = (value = '') => value.replace(/<[^>]*>/g, '');
const tick = () => new Promise(resolve => setImmediate(resolve));
const serializable = value => JSON.parse(JSON.stringify(value));
function deferred() {
    let resolve, reject;
    const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse; });

    return { promise, resolve, reject };
}
function event(fields = {}) {
    return {
        id: 10, name: 'Prazo de exemplo', course: { id: 7, fullname: 'Disciplina fictícia' },
        normalisedeventtype: 'course', eventtype: 'due', timestart: 1835458800, formattedtime: 'Até 23:59',
        url: '/mod/assign/view.php?id=73', modulename: 'assign', ...fields,
    };
}
function month(date = feb, events = [event()], firstDay = 1) {
    return {
        date: { year: date.year, mon: date.month },
        daynames: [{ dayno: firstDay }],
        weeks: [{ days: [{ mday: date.day, istoday: true, neweventtimestamp: 1835458800, events }] }],
    };
}
const render = (fixture, courseId = 7) => model.calendarMonthView(fixture, feb, feb, scope, courseId, plain);

test('mês atual no fuso do Moodle, meia-noite, nomes pt-BR e navegação na virada de ano', () => {
    const instant = new Date('2028-01-01T01:30:00Z');
    assert.deepEqual(serializable(model.calendarToday(instant, 'America/Sao_Paulo')), { year: 2027, month: 12, day: 31 });
    assert.equal(model.calendarToday(instant, 'UTC').day, 1);
    assert.deepEqual(serializable(model.shiftCalendarMonth({ year: 2027, month: 12 }, 1)), { year: 2028, month: 1 });
    assert.deepEqual(serializable(model.shiftCalendarMonth({ year: 2028, month: 1 }, -1)), { year: 2027, month: 12 });
    assert.match(model.calendarMonthLabel(feb), /fevereiro de 2028/);
    assert.match(model.calendarDayLabel(feb), /terça-feira, 29 de fevereiro de 2028/);
    for (const zone of ['99', 'Inexistente/Fuso', '', undefined]) {
        assert.equal(model.calendarTimeZone(zone), undefined);
    }
});

test('grade bissexta respeita o primeiro dia definido pelo Moodle e mantém semanas completas', () => {
    const monday = render(month());
    assert.equal(monday.weekdays[0].label, 'segunda-feira');
    assert.equal(monday.cells[0], null);
    assert.equal(monday.cells[1].day, 1);
    assert.equal(monday.cells.length % 7, 0);
    assert.equal(monday.days.length, 29);
    assert.equal(monday.days.at(-1).today, true);
    assert.equal(render(month(feb, [], 0)).weekdays[0].label, 'domingo');
    const normal = { year: 2027, month: 2, day: 28 };
    assert.equal(model.calendarMonthView(month(normal), normal, normal, scope, 7, plain).days.length, 28);
});

test('filtro pelo ID da disciplina, Todos deste AVA, eventos do dia inteiro, simultâneos e sem horário', () => {
    const items = [
        event({ id: 12, formattedtime: '', timestart: 200 }),
        event({ id: 11, formattedtime: 'Dia inteiro', timestart: 100 }),
        event({ id: 13, timestart: 200, overdue: true }),
        event({ id: 14, course: { id: 8, fullname: 'Disciplina fictícia' } }),
        event({ id: 15, course: undefined, normalisedeventtype: 'site', url: '' }),
        event({ id: 16, course: undefined, normalisedeventtype: 'user', userid: 22 }),
        event({ id: 17, course: undefined, normalisedeventtype: 'user', userid: 11 }),
    ];
    const selected = render(month(feb, items)).days.at(-1).events;
    assert.deepEqual(Array.from(selected, item => item.id), [11, 12, 13]);
    assert.deepEqual(Array.from(selected, item => item.time), ['Dia inteiro', '', 'Até 23:59']);
    assert.equal(selected[2].overdue, true);
    const all = render(month(feb, items), null).days.at(-1).events;
    assert.deepEqual(Array.from(all, item => item.id), [11, 12, 13, 14, 15, 17]);
    assert.equal(model.calendarEventKind(all.find(item => item.id === 15)).label, 'Institucional');
});

test('lista mensal não duplica eventos distribuídos em mais de um dia', () => {
    const fixture = month(feb, [event(), event()]);
    fixture.weeks[0].days.push({ mday: 28, istoday: false, events: [event()] });
    const view = render(fixture);
    assert.equal(view.days[27].events.length, 1);
    assert.equal(view.days[28].events.length, 1);
    assert.equal(model.calendarListDays(view.days).length, 1);
});

test('resposta sem eventos é tratada como vazia, resposta inválida ou de outro mês é rejeitada', () => {
    assert.equal(render(month(feb, [])).days.some(day => day.events.length), false);
    for (const invalid of [null, {}, { weeks: [] }, month({ ...feb, month: 3 })]) {
        assert.throws(() => render(invalid), /Resposta mensal inválida/);
    }
});

test('URLs de atividades se reduzem a IDs do mesmo AVA e rejeitam destinos ou parâmetros ambíguos', () => {
    const base = 'https://moodle.example.test/ava';
    const valid = base + '/mod/quiz/view.php?id=81';
    const target = model.calendarActivity(valid + '&token=MARCADOR_SINTETICO', base, 7, 'quiz');
    assert.deepEqual(serializable(target), { courseId: 7, moduleId: 81, moduleName: 'quiz' });
    assert.doesNotMatch(JSON.stringify(target), /MARCADOR_SINTETICO/);
    for (const unsafe of [
        valid + '&id=5', valid.replace('/ava/', '/outro/'), valid.replace('https', 'http'), valid.replace('/view.php', '/edit.php'),
        'https://moodle.example.test.invalid/ava/mod/quiz/view.php?id=81', valid.replace('//', '//outro@'),
        'javascript:alert(1)', '/ava/mod/quiz/view.php?id=0', '/ava/mod/quiz/view.php?id=-2',
    ]) {
        assert.equal(model.calendarActivity(unsafe, base, 7, 'quiz'), undefined, unsafe);
    }
    assert.equal(model.calendarActivity(valid, base, 7, 'assign'), undefined);
    assert.equal(model.calendarActivity(valid, base, undefined, 'quiz'), undefined);
});

test('timeout, aborto e chamadas duplicadas são limitados; uma falha não impede a próxima consulta', async () => {
    const controller = new AbortController();
    const pending = deferred();
    const cache = new reads.CalendarPendingReads();
    let starts = 0;
    const read = () => cache.get('mes-curso', () => reads.calendarRead(() => { starts++; return pending.promise; }, controller.signal, 8));
    const first = read();
    assert.equal(first, read());
    await assert.rejects(first, reads.CalendarReadTimeout);
    assert.equal(starts, 1);
    assert.notEqual(first, read());
    controller.abort();
    await assert.rejects(read(), /Leitura encerrada/);
    pending.resolve('tarde');
    await tick();
    assert.equal(starts, 1);
});

const decorator = () => () => {};
const stubCore = { Injectable: decorator, Component: decorator, Input: decorator, ChangeDetectionStrategy: { OnPush: 0 } };
function signal(initial) {
    let value = initial;
    return Object.assign(() => value, { set(next) { value = next; }, update(update) { value = update(value); } });
}
function dataFixture() {
    const allowed = new Set([
        'core_calendar_get_calendar_monthly_view', 'core_calendar_get_calendar_event_by_id',
        'core_calendar_get_allowed_event_types', 'core_calendar_submit_create_update_form',
        'core_enrol_get_users_courses', 'core_user_get_users_by_field',
    ]);
    const calls = [];
    const identity = { active: true, owner: scope.owner, panel: scope.owner, user: scope.userId, url: scope.siteUrl, siteId: scope.siteId };
    const logged = { out: false, disabled: false, allowCreate: true };
    const enrollment = [
        { id: 7, fullname: 'Curso A', visible: 1 }, { id: 8, fullname: 'Curso B', visible: 1 },
        { id: 8, fullname: 'Curso B', visible: 1 }, { id: 9, fullname: 'Curso oculto', visible: 0 },
        { id: 1, fullname: 'Página inicial' },
    ];
    const edges = {
        monthly: () => Promise.resolve(month()),
        detail: () => Promise.resolve(event({ description: '<p>Descrição.</p>' })),
        profile: () => Promise.resolve({ timezone: 'America/Sao_Paulo' }),
        module: () => Promise.resolve({ id: 73, course: 7, modname: 'assign', uservisible: true }),
        activity: () => Promise.resolve(),
    };
    const site = {
        getId: () => identity.siteId, getURL: () => identity.url, getUserId: () => identity.user,
        wsAvailable: ws => allowed.has(ws), isLoggedOut: () => logged.out, isFeatureDisabled: () => logged.disabled,
        getSiteHomeId: () => 1, getStoredConfig: () => 'UTC',
    };
    const CoreSites = { getCurrentSite: () => site, getCurrentSiteId: () => site.getId() };
    const recorded = (label, operation) => (...args) => { calls.push([label, ...args]); return operation(...args); };
    const loaded = load('calendar-data.service', {
        '@angular/core': { ...stubCore, inject: () => ({ hasMatchingPresencialSession: url => identity.active && url === identity.url }) },
        './calendar-model': model,
        '@addons/calendar/services/calendar': { AddonCalendar: {
            getMonthlyEvents: recorded('mês Moodle', (...args) => edges.monthly(...args)),
            getEventById: recorded('detalhe Moodle', (...args) => edges.detail(...args)),
        } },
        '@addons/calendar/services/calendar-helper': { AddonCalendarHelper: { canEditEvents: recorded('permissão Moodle', async () => logged.allowCreate) } },
        '@addons/calendar/constants': { ADDONS_CALENDAR_MENU_FEATURE_NAME: 'AddonCalendar' },
        '@features/courses/services/courses': { CoreCourses: { getUserCourses: recorded('matrículas Moodle', async () => enrollment) } },
        '@features/course/services/course': { CoreCourse: { getModule: recorded('módulo Moodle', (...args) => edges.module(...args)) } },
        '@features/course/services/module-delegate': { CoreCourseModuleDelegate: {
            getModuleDataFor: async () => ({ action: () => { throw new Error('A ação genérica não deve abrir o navegador'); } }),
            openActivityPage: recorded('atividade nativa', (...args) => edges.activity(...args)),
        } },
        '@features/user/services/user': { CoreUser: { getProfile: recorded('fuso Moodle', (...args) => edges.profile(...args)) } },
        '@services/sites': { CoreSites }, '@static/text': { CoreText: { cleanTags: plain } },
        '../services_mobile/moodle-site.service': {},
    }, {
        localStorage: { getItem: () => null },
        sessionStorage: { getItem: key => key === 'ifrn_username' ? identity.owner : identity.panel },
    });

    return { ...loaded, data: new loaded.IfrnCalendarDataService(), allowed, calls, edges, identity, logged, CoreSites };
}

test('adaptador usa as APIs existentes com site explícito, filtro e cache nativo', async () => {
    const { data, calls, edges } = dataFixture();
    assert.deepEqual(serializable(data.scope(7)), scope);
    await data.loadMonth(scope, feb, 7, false);
    await data.loadMonth(scope, feb, null, true);
    assert.deepEqual(calls.slice(0, 2), [
        ['mês Moodle', 2028, 2, 7, undefined, false, 'site-a'],
        ['mês Moodle', 2028, 2, undefined, undefined, true, 'site-a'],
    ]);
    assert.deepEqual(Array.from(await data.courses(scope), course => course.id), [7, 8]);
    assert.equal(await data.timeZone(scope), 'America/Sao_Paulo');
    edges.profile = async () => { throw new Error('Offline'); };
    assert.equal(await data.timeZone(scope), 'UTC');
    const detail = await data.detail(scope, model.calendarEvent(event(), scope, 7, plain));
    assert.equal(detail.description, '<p>Descrição.</p>');
    assert.deepEqual(serializable(calls.find(call => call[0] === 'detalhe Moodle')), ['detalhe Moodle', 10, { siteId: 'site-a', filter: false }]);
});

test('desabilita calendário, detalhes e criação conforme capacidades, permissão e sessão', async () => {
    const { data, logged, identity, allowed, calls } = dataFixture();
    assert.equal(await data.canCreate(scope, 7), true);
    logged.allowCreate = false;
    assert.equal(await data.canCreate(scope, 7), false);
    allowed.delete('core_calendar_submit_create_update_form');
    assert.equal(await data.canCreate(scope, 7), false);
    assert.equal(calls.filter(call => call[0] === 'permissão Moodle').length, 2);
    allowed.delete('core_calendar_get_calendar_event_by_id');
    const item = model.calendarEvent(event(), scope, 7, plain);
    assert.equal(await data.detail(scope, item), item);
    allowed.delete('core_calendar_get_calendar_monthly_view');
    assert.equal(data.isAvailable(), false);
    allowed.add('core_calendar_get_calendar_monthly_view');
    logged.disabled = true;
    assert.equal(data.isAvailable(), false);
    logged.disabled = false;
    identity.panel = 'conta-ficticia-b';
    assert.throws(() => data.loadMonth(scope, feb, 7, false), /Sessão do calendário encerrada/);
});

test('atividade exige o curso e tipo esperados, visibilidade e sessão ativa na hora de navegar', async () => {
    const { data, edges, identity, calls } = dataFixture();
    const target = { courseId: 7, moduleId: 73, moduleName: 'assign' };
    const launch = await data.prepareActivity(scope, target);
    await launch();
    const native = calls.find(call => call[0] === 'atividade nativa');
    assert.equal(native[1], 'assign');
    assert.deepEqual(serializable(native[4]), { siteId: 'site-a', preferCurrentTab: true });
    edges.module = async () => ({ id: 73, course: 8, modname: 'assign', uservisible: false });
    await assert.rejects(data.prepareActivity(scope, target), /Atividade indisponível/);
    identity.user = 22;
    assert.throws(launch, /Sessão do calendário encerrada/);
});

test('detalhe atrasado ou pertencente a outro curso não fornece conteúdo à conta ativa', async () => {
    const { data, edges, identity } = dataFixture();
    const item = model.calendarEvent(event(), scope, 7, plain);
    edges.detail = async () => event({ course: { id: 8 } });
    await assert.rejects(data.detail(scope, item), /Evento fora do contexto/);
    const old = deferred();
    edges.detail = () => old.promise;
    const detail = data.detail(scope, item);
    identity.siteId = 'site-b';
    old.resolve(event());
    await assert.rejects(detail, /Sessão do calendário encerrada/);
});

function componentFixture({ dependencies = dataFixture(), dismiss = async () => true } = {}) {
    const online = signal(true);
    const { IfrnCourseCalendarComponent } = load('course-calendar.component', {
        '@angular/core': { ...stubCore, inject: () => dependencies.data, signal, computed: calculate => calculate, viewChild: () => () => undefined },
        '@/core/shared.module': {}, '@services/network': { CoreNetwork: { onlineSignal: online } },
        '@singletons': { ModalController: { dismiss } },
        './calendar-data.service': dependencies, './calendar-model': model, './calendar-read': reads,
    });
    const component = new IfrnCourseCalendarComponent();
    const journey = new AbortController();
    Object.assign(component, { scope, courseName: 'Curso A', modalId: 'calendario-teste', journeySignal: journey.signal, initialSelection: selection });
    return { ...dependencies, component, online, journey };
}

test('trocas rápidas de mês e disciplina ignoram respostas fora de ordem; Mês e Lista conservam o dia', async t => {
    const { component, edges } = componentFixture();
    t.after(() => component.ngOnDestroy());
    const requests = [];
    edges.monthly = (year, number, courseId) => {
        const read = deferred();
        requests.push({ read, year, number, courseId });
        return read.promise;
    };
    component.ngOnInit();
    await tick();
    component.moveMonth(1);
    component.chooseCourse('8');
    await tick();
    assert.deepEqual(requests.map(({ number, courseId }) => [number, courseId]), [[2, 7], [3, 7], [3, 8]]);
    requests[2].read.resolve(month({ ...feb, month: 3 }, [event({ id: 30, course: { id: 8 } })]));
    await tick();
    component.selectDay(29);
    assert.equal(component.displayedDays()[0].events[0].id, 30);
    requests[0].read.resolve(month());
    requests[1].read.resolve(month({ ...feb, month: 3 }));
    await tick();
    component.chooseView('list');
    assert.equal(component.selection().day, 29);
    assert.equal(component.selection().courseId, 8);
    assert.equal(component.displayedDays()[0].events[0].id, 30);
    assert.equal(component.loading(), false);
});

test('rede indisponível, erro de autorização e retry encerram o spinner sem reaproveitar cache após 401', async t => {
    const { component, edges, online, calls } = componentFixture();
    t.after(() => component.ngOnDestroy());
    edges.monthly = async () => { throw { status: 401, message: 'token=SEGREDO_FICTICIO' }; };
    component.ngOnInit();
    await tick();
    assert.match(component.error(), /confirme|confirmar o acesso/);
    assert.doesNotMatch(component.error(), /SEGREDO_FICTICIO/);
    assert.equal(component.canCreate(), false);
    online.set(false);
    await component.refresh();
    assert.equal(calls.filter(call => call[0] === 'mês Moodle').length, 1);
    assert.equal(component.monthView(), undefined);
    online.set(true);
    edges.monthly = async () => { throw { status: 500 }; };
    await component.refresh();
    assert.match(component.error(), /conexão/);
    assert.equal(component.loading(), false);
    let completed = 0;
    edges.monthly = async () => month(feb, []);
    await component.refresh({ complete: async () => { completed++; } });
    assert.equal(completed, 1);
    assert.equal(component.error(), '');
    assert.equal(component.hasMonthEvents(), false);
    assert.ok(calls.filter(call => call[0] === 'mês Moodle').slice(1).every(call => call[5] === true));
});

test('sair, destruir a tela e trocar a conta invalidam a leitura em andamento e a interface', async () => {
    for (const end of ['fechar', 'destruir', 'trocar']) {
        const { component, journey, edges, identity } = componentFixture();
        const request = deferred();
        edges.monthly = () => request.promise;
        component.ngOnInit();
        await tick();
        if (end === 'fechar') {
            await component.close();
        } else if (end === 'destruir') {
            component.ngOnDestroy();
        } else {
            identity.user = 22;
            journey.abort();
        }
        request.resolve(month());
        await tick();
        assert.equal(component.monthView(), undefined);
        assert.equal(component.detail(), undefined);
        component.ngOnDestroy();
    }
});

test('se o modal não puder encerrar, o botão restaura o estado e não deixa ação pendente', async t => {
    const { component } = componentFixture({ dismiss: async () => { throw new Error('Erro simulado'); } });
    t.after(() => component.ngOnDestroy());
    component.ngOnInit();
    await tick();
    assert.equal(component.canCreate(), true);
    await component.newEvent();
    assert.equal(component.actionPending(), false);
    assert.match(component.error(), /Tente novamente/);
    await component.refresh();
    assert.equal(component.error(), '');
});

function navigationFixture() {
    const dependencies = dataFixture();
    const coursePath = '/main/home/course/7/contents';
    let currentPath = '/login/painel';
    const transitions = [currentPath];
    const opened = [];
    const errors = [];
    const routes = new Set();
    const coreListeners = new Set();
    const domListeners = new Set();
    const DOM = {
        addEventListener: (type, fn) => domListeners.add(fn),
        removeEventListener: (type, fn) => domListeners.delete(fn),
    };
    // A mesma função é registrada em dois alvos DOM.
    const documentListeners = new Set();
    const document = {
        addEventListener: (type, fn) => documentListeners.add(fn),
        removeEventListener: (type, fn) => documentListeners.delete(fn),
    };
    const Router = class {};
    const NavigationEnd = class {};
    const visit = target => {
        transitions.push(target);
        currentPath = target;
        [...routes].forEach(fn => fn(new NavigationEnd()));
    };
    const CoreNavigator = {
        getCurrentPath: () => currentPath, getCurrentMainMenuTab: () => 'home',
        async navigate(target, options) { opened.at(-1).destination = options; visit(target); return true; },
    };
    const CoreEvents = {
        LOGIN: 'login', LOGOUT: 'logout', SESSION_EXPIRED: 'expired', SITE_UPDATED: 'site', on(type, fn, site) {
            const listener = { type, fn, site };
            coreListeners.add(listener);
            return { off: () => coreListeners.delete(listener) };
        },
    };
    const emit = (type, siteId) => [...coreListeners].forEach(listener => {
        if (type === listener.type && (!listener.site || listener.site === siteId)) listener.fn({ siteId });
    });
    const ModalController = {
        async dismiss(value, role, id) {
            const modal = opened.findLast(entry => entry.options.id === id && !entry.closed);
            if (!modal) return false;
            modal.closed = true;
            modal.component.ngOnDestroy();
            modal.result.resolve(value);
            return true;
        },
    };
    const CoreModals = { async openModal(options) {
        const { component } = componentFixture({ dependencies, dismiss: ModalController.dismiss });
        Object.assign(component, options.componentProps);
        const result = deferred();
        opened.push({ component, options, result });
        component.ngOnInit();
        return result.promise;
    } };
    const CoreAlerts = { showError: async error => errors.push(error) };
    const nav = load('calendar-navigation.service', {
        '@angular/core': { ...stubCore, inject: type => type === Router
            ? { events: { subscribe(fn) { routes.add(fn); return { unsubscribe: () => routes.delete(fn) }; } } }
            : dependencies.data },
        '@angular/router': { NavigationEnd, Router },
        '@addons/calendar/constants': { ADDON_CALENDAR_PAGE_NAME: 'calendar' },
        '@services/navigator': { CoreNavigator }, '@services/overlays/modals': { CoreModals }, '@services/overlays/alerts': { CoreAlerts },
        '@static/events': { CoreEvents }, '@singletons': { ModalController }, './calendar-data.service': dependencies,
        './calendar-model': model, './course-calendar.component': { IfrnCourseCalendarComponent: class {} },
    }, { window: DOM, document });
    const service = new nav.IfrnCalendarNavigationService();
    const { IfrnCourseMenuComponent } = load('../moodle-course/course-menu', {
        '@angular/core': { ...stubCore, inject: () => service }, '@ionic/core': {}, '@/core/shared.module': {}, '@/core/constants': {},
        '@services/sites': { CoreSites: dependencies.CoreSites }, '@services/navigator': { CoreNavigator },
        '@services/overlays/modals': { CoreModals }, '@services/overlays/alerts': { CoreAlerts },
        '@addons/messages/services/messages': { AddonMessages: { isPluginEnabled: async () => true } },
        '@addons/messages/constants': {}, '@addons/notifications/constants': {},
        '../academic-progress/progress.component': {}, '../academic-calendar/calendar-navigation.service': nav, './course-accessibility': {},
    });
    const menu = new IfrnCourseMenuComponent({ init() {} });
    menu.courseId = 7;
    menu.format = { course: { id: 7, fullname: 'Curso A' } };
    const listenerCounts = () => [routes.size, coreListeners.size, domListeners.size, documentListeners.size];

    return { ...dependencies, service, menu, coursePath, transitions, opened, errors, visit, emit, listenerCounts, ModalController };
}

test('Painel → curso → menu → calendário → detalhe → atividade nativa → volta ao mesmo mês e ao curso', async t => {
    const { service, menu, coursePath, transitions, opened, errors, visit, edges, calls, listenerCounts } = navigationFixture();
    t.after(() => service.ngOnDestroy());
    edges.monthly = async (year, number) => month({ year, month: number, day: 10 });
    edges.activity = async () => visit('/main/home/mod_assign/7/73');
    visit(coursePath);
    await menu.openMenu();
    menu.choose('calendar');
    menu.choose('calendar');
    assert.equal(opened.length, 0, 'fecha o menu antes de abrir o modal');
    const openedFromMenu = menu.menuDismissed();
    await tick();
    assert.equal(opened.length, 1);
    let calendar = opened[0].component;
    assert.equal(calendar.selection().courseId, 7);
    assert.equal(calendar.courseName, 'Curso A');
    calendar.moveMonth(1);
    await tick();
    await calendar.openEvent(calendar.monthView().days[9].events[0], 10);
    assert.equal(calendar.detail().description, '<p>Descrição.</p>');
    const selected = serializable(calendar.selection());
    await calendar.openActivity();
    await openedFromMenu;
    assert.equal(menu.busy, false);
    assert.equal(transitions.at(-1), '/main/home/mod_assign/7/73');
    visit(coursePath);
    await tick();
    assert.equal(opened.length, 2);
    calendar = opened[1].component;
    assert.deepEqual(serializable(calendar.selection()), selected);
    assert.equal(opened[1].options.componentProps.refreshOnEnter, true);
    assert.equal(calls.findLast(call => call[0] === 'mês Moodle')[5], true);
    await calendar.close();
    await tick();
    assert.equal(transitions.at(-1), coursePath);
    assert.equal(errors.length, 0);
    assert.deepEqual(listenerCounts(), [0, 0, 0, 0]);
});

test('editor oficial abre com disciplina e data escolhidas, atualiza após voltar e recusa permissão ausente', async t => {
    const { service, opened, visit, coursePath, edges, logged, transitions, listenerCounts } = navigationFixture();
    t.after(() => service.ngOnDestroy());
    edges.monthly = async (year, number) => month({ year, month: number, day: 10 });
    visit(coursePath);
    logged.allowCreate = false;
    const going = service.open(7, 'Curso A');
    await tick();
    await opened[0].component.newEvent();
    assert.equal(transitions.at(-1), coursePath);
    await opened[0].component.close();
    await going;

    logged.allowCreate = true;
    const opening = service.open(7, 'Curso A');
    await tick();
    const calendar = opened[1].component;
    calendar.selectDay(10);
    await calendar.newEvent();
    await opening;
    assert.equal(transitions.at(-1), '/main/home/calendar/edit/0');
    assert.deepEqual(serializable(opened[1].destination), { params: { courseId: 7, timestamp: 1835458800000 } });
    visit(coursePath);
    await tick();
    assert.equal(opened[2].component.selection().day, 10);
    await opened[2].component.close();
    await tick();
    assert.deepEqual(listenerCounts(), [0, 0, 0, 0]);
});

test('nova disciplina, logout e login em outro site fecham o calendário antigo e removem observadores', async () => {
    for (const action of ['curso', 'logout', 'login']) {
        const { service, visit, coursePath, emit, opened, identity, edges, listenerCounts } = navigationFixture();
        visit(coursePath);
        edges.monthly = async (year, number) => month({ year, month: number, day: 10 });
        const opening = service.open(7, 'Curso A');
        await tick();
        assert.ok(opened[0].component.monthView());
        if (action === 'curso') {
            visit('/main/home/course/8/contents');
        } else if (action === 'logout') {
            emit('logout', 'site-a');
        } else {
            identity.siteId = 'site-b';
            identity.user = 22;
            emit('login', 'site-b');
        }
        await opening;
        assert.equal(opened[0].component.monthView(), undefined);
        assert.equal(opened[0].options.componentProps.journeySignal.aborted, true);
        assert.deepEqual(listenerCounts(), [0, 0, 0, 0]);
    }
});

test('resultado de outro modal (callback obsoleto) nunca abre o editor nem navega', async () => {
    const { service, visit, coursePath, opened, transitions, ModalController, listenerCounts } = navigationFixture();
    visit(coursePath);
    const opening = service.open(7, 'Curso A');
    await tick();
    await ModalController.dismiss({ modalId: 'janela-anterior', exit: { type: 'create', selection } }, undefined, opened[0].options.id);
    await opening;
    assert.equal(transitions.at(-1), coursePath);
    assert.deepEqual(listenerCounts(), [0, 0, 0, 0]);
});

test('template Angular delega sanitização ao Moodle e SCSS compila grade de sete colunas sem largura fixa', async () => {
    const { parseTemplate } = await import('@angular/compiler');
    const html = fs.readFileSync(path.join(root, 'course-calendar.component.html'), 'utf8');
    assert.equal(parseTemplate(html, 'course-calendar.component.html').errors, null);
    assert.match(html, /<core-format-text \[text\]="event.description" \[siteId\]="scope.siteId" \[sanitize\]="true"/);
    assert.doesNotMatch(html, /innerHTML|iframe/);
    for (const label of ['Voltar à disciplina', 'aria-current', 'aria-pressed', 'role="status"', 'role="alert"']) assert.ok(html.includes(label));
    const css = require('sass').compile(path.join(root, 'course-calendar.component.scss')).css;
    for (const declaration of ['repeat(7, minmax(0, 1fr))', 'overflow-wrap: anywhere', 'ion-safe-area', ':focus-visible',
        '.ion-palette-dark', 'prefers-reduced-motion', 'forced-colors: active']) assert.ok(css.includes(declaration), declaration);
    const course = fs.readFileSync(path.join(root, '../moodle-course/course-menu.html'), 'utf8');
    assert.equal((course.match(/choose\('calendar'\)/g) ?? []).length, 1);
    assert.ok(course.includes('<ifrn-academic-progress'));
});

test('template renderizado por Angular seleciona dias e sanitiza a descrição recebida do Moodle', async () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const names = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Event', 'navigator'];
    const previous = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
    let TestBed, angular;
    try {
        await import('@angular/compiler');
        angular = await import('@angular/core');
        const { NgTemplateOutlet } = await import('@angular/common');
        const { DomSanitizer } = await import('@angular/platform-browser');
        const testing = await import('@angular/platform-browser-dynamic/testing');
        ({ TestBed } = await import('@angular/core/testing'));
        TestBed.initTestEnvironment(testing.BrowserDynamicTestingModule, testing.platformBrowserDynamicTesting());

        class DetailHost {}
        angular.Input()(DetailHost.prototype, 'isOpen');
        angular.ContentChild(angular.TemplateRef)(DetailHost.prototype, 'content');
        angular.Component({ selector: 'ion-modal', imports: [NgTemplateOutlet],
            template: '@if (isOpen) {<ng-container [ngTemplateOutlet]="content" />}' })(DetailHost);

        class FormatText {
            sanitizer = angular.inject(DomSanitizer);
            get formatted() {
                assert.equal(this.siteId, 'site-a');
                assert.equal(this.filter, false);
                assert.equal(this.sanitize, true);
                return this.sanitizer.sanitize(angular.SecurityContext.HTML, this.text);
            }
        }
        for (const input of ['text', 'siteId', 'filter', 'sanitize']) angular.Input()(FormatText.prototype, input);
        angular.Component({ selector: 'core-format-text', template: '<div [innerHTML]="formatted"></div>' })(FormatText);

        const dependencies = dataFixture();
        dependencies.edges.detail = async () => event({
            description: '<p>Texto de teste</p><script>MARCADOR_SINTETICO</script><img src="/picture" onerror="alert(1)">',
        });
        const { IfrnCourseCalendarComponent } = load('course-calendar.component', {
            '@angular/core': { ...angular, viewChild: () => () => undefined, Component: metadata => {
                const { templateUrl, styleUrls, ...inline } = metadata;
                return angular.Component({ ...inline, imports: [DetailHost, FormatText], schemas: [angular.CUSTOM_ELEMENTS_SCHEMA],
                    template: fs.readFileSync(path.join(root, templateUrl), 'utf8') });
            } },
            '@/core/shared.module': {}, '@services/network': { CoreNetwork: { onlineSignal: angular.signal(true) } },
            '@singletons': {}, './calendar-data.service': dependencies, './calendar-model': model, './calendar-read': reads,
        });
        TestBed.configureTestingModule({ imports: [IfrnCourseCalendarComponent], providers: [
            { provide: dependencies.IfrnCalendarDataService, useValue: dependencies.data }, angular.provideZonelessChangeDetection(),
        ] });
        const fixture = TestBed.createComponent(IfrnCourseCalendarComponent);
        for (const [key, value] of Object.entries({ scope, modalId: 'id-teste', journeySignal: new AbortController().signal,
            initialSelection: { ...selection, day: 1 }, courseName: 'Curso A' })) {
            fixture.componentRef.setInput(key, value);
        }
        fixture.detectChanges();
        await tick();
        fixture.detectChanges();
        const rootElement = fixture.nativeElement;
        assert.equal(rootElement.querySelectorAll('.calendar-day').length, 29);
        assert.match(rootElement.querySelector('.calendar-events').textContent, /Nenhum evento nesta data/);
        const day = rootElement.querySelector('[aria-current="date"]');
        day.click();
        fixture.detectChanges();
        assert.equal(day.getAttribute('aria-pressed'), 'true');
        assert.match(day.getAttribute('aria-label'), /1 evento/);
        rootElement.querySelector('.calendar-event').click();
        await tick();
        fixture.detectChanges();
        const description = rootElement.querySelector('core-format-text');
        assert.match(description.textContent, /Texto de teste/);
        assert.equal(description.querySelector('script, [onerror]'), null);
        assert.doesNotMatch(description.innerHTML, /MARCADOR_SINTETICO/);
        fixture.destroy();
    } finally {
        TestBed?.resetTestEnvironment();
        angular?.destroyPlatform();
        for (const [name, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
        dom.window.close();
    }
});
