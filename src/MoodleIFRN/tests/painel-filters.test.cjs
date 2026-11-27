const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function load(file, imports = {}) {
    const { outputText } = ts.transpileModule(read(file), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    });
    const exports = {};
    vm.runInNewContext(outputText, { exports, URL, require: id => imports[id] || {} });

    return exports;
}

const filters = load('painel/painel-filters.ts');
const { DEFAULT_PAINEL_FILTERS, filterPainelCourses, listPainelFilterOptions, reconcilePainelFilters } = filters;
const { buildNativePainelModel } = load('painel/painel-native-model.ts', {
    './painel-filters': filters, '../mobilemoodle/core_mobile/course-target': load('mobilemoodle/core_mobile/course-target.ts'),
});

const presencial = { id: 11, titulo: 'Presencial' };
const academico = { id: 22, titulo: 'Acadêmico' };
const row = (id, fullname, extra) => ({ id, fullname, ambiente: presencial, ...extra });
const raw = {
    semestres: [{ id: '', label: 'Semestres...' }, { id: '2026/1', label: '2026.1' }, { id: '2026.2', label: '2026.2' }],
    disciplinas: [{ id: 14, label: 'Álgebra' }, { id: '20', label: 'Oficina' }, { id: 99, label: 'Sem oferta na lista' }],
    cursos: [{ id: '111', label: 'Técnico em Redes' }, { id: 222, label: 'Licenciatura' }],
    ambientes: [{ id: 11, label: 'Presencial' }, { id: 22, label: 'Acadêmico' }, { id: 33, label: 'Sem diário' }],
    diarios: [
        row(17, 'Álgebra aplicada', { shortname: '20261.2.111.1A.MAT.10#101', turma_ano_periodo: '2026/1',
            curso_codigo: '111', disciplina_id: '14', progress: 100, hasprogress: true }),
        row(17, 'Oficina de arte', { shortname: '20262.4.222.1A.ART.20', turma_ano_periodo: '2026.2',
            curso: { codigo: 222 }, disciplina_id: 20, ambiente: academico }),
        row(18, 'Álgebra avançada', { shortname: '20262.4.111.2A.MAT.10', turma_ano_periodo: '2026/2',
            curso_codigo: '111', disciplina_id: 14, visible: false, isfavourite: true }),
        row(19, 'Sem metadados', { shortname: 'A019' }),
    ],
    coordenacoes: [row(21, 'Coordenação', { ambiente: academico })],
};
const model = buildNativePainelModel(raw, null, 'conta-a-ficticia');
const courses = model.groups.diarios;
const names = result => Array.from(result, course => course.name);
const matching = (selection, result = courses) => names(filterPainelCourses(result, {
    ...DEFAULT_PAINEL_FILTERS, ...selection,
}, course => course.isfavourite));
const optionIds = options => Array.from(options, option => option.id);

test('opções correspondem aos diários carregados, com IDs oficiais e rótulos distintos', () => {
    const options = listPainelFilterOptions(courses);
    assert.deepEqual(optionIds(options.semester), ['2026.2', '2026.1']);
    assert.deepEqual(optionIds(options.discipline), ['14', '20']);
    assert.deepEqual(optionIds(options.academicCourse), ['222', '111']);
    assert.deepEqual(optionIds(options.environment), ['22', '11']);
    assert.deepEqual(optionIds(options.module), []);
    assert.equal(courses[0].filterOptions.discipline.label, 'Álgebra');
    assert.equal(courses[0].filterOptions.academicCourse.label, 'Técnico em Redes');
    assert.equal(courses[0].moodle_course_id, courses[1].moodle_course_id);
    assert.notEqual(courses[0].moodle_site_url, courses[1].moodle_site_url);
    assert.equal(courses[3].filterOptions.academicCourse, undefined, 'ID Moodle nunca vira código de curso acadêmico');
});

for (const [key, id, expected] of [
    ['semester', '2026.2', ['Oficina de arte', 'Álgebra avançada']],
    ['period', '4', ['Oficina de arte', 'Álgebra avançada']],
    ['discipline', '14', ['Álgebra aplicada', 'Álgebra avançada']],
    ['academicCourse', '222', ['Oficina de arte']],
    ['environment', '11', ['Álgebra aplicada', 'Álgebra avançada', 'Sem metadados']],
]) {
    test(`aplica filtro independente por ${key}`, () => {
        assert.deepEqual(matching({ selected: { [key]: id } }), expected);
    });
}

test('só aceita período curricular do código oficial do diário quando os campos concordam', () => {
    const result = buildNativePainelModel({
        diarios: [...raw.diarios, row(30, 'Código divergente', {
            shortname: '20261.7.111.2A.MAT.10', turma_ano_periodo: '2026/2', curso_codigo: '111',
        }), row(31, 'Código incompleto', { shortname: '20261.99.111' })],
        coordenacoes: [raw.diarios[0]],
    }, null);
    assert.equal(result.groups.diarios[0].filterOptions.semester.id, '2026.1');
    assert.equal(result.groups.diarios[0].filterOptions.period.id, '2');
    assert.equal(result.groups.diarios[1].filterOptions.period.id, '4');
    assert.equal(result.groups.diarios.at(-2).filterOptions.period, undefined);
    assert.equal(result.groups.diarios.at(-1).filterOptions.period, undefined);
    assert.equal(result.groups.coordenacoes[0].filterOptions.period, undefined);
});

test('módulo só é opção quando o AVA declara a associação e o identificador', () => {
    const result = buildNativePainelModel({ ...raw, modulos: [{ id: 'm1', label: 'Módulo da resposta simulada' }],
        diarios: [{ ...raw.diarios[0], modulo: 'm1' }, { ...raw.diarios[1], modulo: 'ausente' }, raw.diarios[2]],
    }, null).groups.diarios;
    assert.deepEqual(optionIds(listPainelFilterOptions(result).module), ['m1']);
    assert.deepEqual(matching({ selected: { module: 'm1' } }, result), ['Álgebra aplicada']);
    assert.deepEqual(optionIds(listPainelFilterOptions(buildNativePainelModel({
        ...raw, modulos: [{ id: 'm1', label: 'Sem associação' }],
    }, null).groups.diarios).module), []);
});

test('andamento respeita a lista do AVA inclusive com 100% de progresso, mais favoritos e não publicados', () => {
    assert.deepEqual(matching({}), names(courses));
    assert.equal(courses[0].progress, 100);
    assert.deepEqual(matching({ situation: 'favourites' }), ['Álgebra avançada']);
    assert.deepEqual(matching({ situation: 'unpublished' }), ['Álgebra avançada']);
});

test('pesquisa sem acentos combina título, código e ambiente com a interseção de critérios', () => {
    assert.deepEqual(matching({ query: '  ALGEBRA ', selected: { discipline: '14', period: '2' } }), ['Álgebra aplicada']);
    assert.deepEqual(matching({ query: 'MAt.10', selected: { semester: '2026.2' } }), ['Álgebra avançada']);
    assert.deepEqual(matching({ query: 'ACADEMICO', selected: { academicCourse: '222' } }), ['Oficina de arte']);
    assert.deepEqual(matching({ query: 'algebra', selected: { academicCourse: '222' } }), []);
});

test('ambiente restringe as opções e remove seleções incompatíveis sem perder as compartilhadas', () => {
    const choices = listPainelFilterOptions(courses, '22');
    assert.deepEqual(optionIds(choices.academicCourse), ['222']);
    assert.deepEqual(optionIds(choices.environment), ['22', '11']);
    const next = reconcilePainelFilters({
        ...DEFAULT_PAINEL_FILTERS, query: 'oficina', selected: { environment: '22', semester: '2026.2', academicCourse: '111' },
    }, courses);
    assert.equal(next.query, 'oficina');
    assert.deepEqual({ ...next.selected }, { environment: '22', semester: '2026.2' });
    assert.deepEqual({ ...reconcilePainelFilters(next, []).selected }, {});
});

async function mountPanel(t) {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://ifrn.example.test' });
    const names = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Event', 'navigator', 'sessionStorage', 'localStorage'];
    const previous = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
    let TestBed, angular;
    t.after(() => {
        TestBed?.resetTestEnvironment();
        angular?.destroyPlatform();
        for (const [name, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
        dom.window.close();
    });
    await import('@angular/compiler');
    angular = await import('@angular/core');
    const testing = await import('@angular/platform-browser-dynamic/testing');
    ({ TestBed } = await import('@angular/core/testing'));
    TestBed.initTestEnvironment(testing.BrowserDynamicTestingModule, testing.platformBrowserDynamicTesting());

    const { PainelNativeComponent } = load('painel/painel-native.ts', {
        '@angular/core': { ...angular, input: angular.signal, Component: metadata => {
            const { templateUrl, styleUrls, ...inline } = metadata;
            return angular.Component({ ...inline, imports: [], schemas: [angular.CUSTOM_ELEMENTS_SCHEMA],
                template: read('painel/' + templateUrl) });
        } },
        './painel-filters': filters,
        '../mobilemoodle/core_mobile/course-favourites': { createCourseFavourites: () => ({ isFavourite: course => course.isfavourite }) },
        '../services_mobile/painel-help-links': { PAINEL_HELP_LINKS: {} },
    });
    TestBed.configureTestingModule({ imports: [PainelNativeComponent], providers: [angular.provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(PainelNativeComponent);
    const element = fixture.nativeElement;
    const update = value => { fixture.componentInstance.data.set(value); fixture.detectChanges(); };
    const click = selector => {
        const control = element.querySelector(selector);
        assert.ok(control, selector);
        control.click();
        fixture.detectChanges();
    };
    const open = () => click('.painel-filter-button');
    const expand = key => click('#native-filter-trigger-' + key);
    const choose = (key, value) => {
        expand(key);
        click(`#native-filter-options-${key} input[value="${value}"]`);
    };
    const search = value => {
        const input = element.querySelector('.native-filter-search input');
        input.value = value;
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        fixture.detectChanges();
    };
    const key = (key, target = document.activeElement) => {
        const allowed = target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();

        return allowed;
    };
    const cards = () => Array.from(element.querySelectorAll('.painel-card-title'), card => card.textContent.trim());
    update(model);

    return { fixture, element, update, click, open, expand, choose, search, key, cards };
}

test('filtros ocupam uma seção antes dos cards, conservam o rascunho até aplicar e devolvem o foco', async t => {
    const { fixture, element, click, open, expand, choose, search, key, cards } = await mountPanel(t);
    const trigger = element.querySelector('.painel-filter-button');
    const panel = element.querySelector('#native-course-filters');
    const list = element.querySelector('.card-container');
    assert.equal(panel.closest('ion-content'), list.closest('ion-content'));
    assert.equal(panel.previousElementSibling, trigger.parentElement);
    assert.equal(Boolean(panel.compareDocumentPosition(list) & window.Node.DOCUMENT_POSITION_FOLLOWING), true);
    assert.equal(panel.hasAttribute('inert'), true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(cards(), names(courses));
    trigger.focus();
    open();
    assert.equal(trigger.getAttribute('aria-controls'), panel.id);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(panel.getAttribute('aria-hidden'), 'false');
    assert.equal(panel.hasAttribute('inert'), false);
    assert.equal(element.querySelector('[role="dialog"]'), null);
    assert.equal(list.closest('[inert]'), null);
    assert.equal(document.activeElement, trigger);
    assert.deepEqual(Array.from(panel.querySelectorAll('.native-filter-category-trigger > span'), span => span.textContent.trim()), [
        'Diários em andamento', 'Semestres...', 'Períodos...', 'Módulos...', 'Disciplinas...', 'Cursos...', 'Ambientes...',
    ]);
    const clear = panel.querySelector('.modal-content-body-filter-clear');
    clear.focus();
    assert.equal(key('Tab', clear), true);
    assert.equal(document.activeElement, clear);
    expand('module');
    assert.match(element.querySelector('#native-filter-options-module').textContent, /Nenhum módulo/);
    expand('module');
    assert.equal(element.querySelector('#native-filter-options-module').hidden, true);
    choose('semester', '2026.1');
    search('algebra');
    assert.deepEqual(cards(), names(courses));
    panel.querySelector('input[type="search"]').focus();
    key('Escape');
    assert.equal(panel.hasAttribute('inert'), true);
    assert.equal(panel.getAttribute('aria-hidden'), 'true');
    assert.equal(document.activeElement, trigger);

    open();
    assert.equal(element.querySelector('.native-filter-search input').value, '');
    choose('semester', '2026.1');
    search('ALGEBRA');
    click('.modal-content-body-filter-button');
    assert.deepEqual(cards(), ['Álgebra aplicada']);
    assert.equal(element.querySelector('ifrn-academic-progress').serverProgress, 100);
    assert.match(element.querySelector('.painel-filter-chip').textContent, /2 filtros ativos/);
    const opened = [];
    fixture.componentInstance.openCourse.subscribe(course => opened.push(course));
    click('.course-open');
    assert.deepEqual(opened.map(course => course.moodle_course_id), [17]);

    open();
    expand('semester');
    assert.ok(element.querySelector('#native-filter-options-semester input[value="2026.1"]').checked);
    click('#native-filter-options-semester input[value=""]');
    search('sem resultados');
    click('.modal-content-body-filter-button');
    assert.deepEqual(cards(), []);
    assert.match(element.querySelector('.card-container [role="status"]').textContent, /Nenhuma disciplina/);
    click('.native-filter-reset');
    assert.deepEqual(cards(), names(courses));
    assert.match(element.querySelector('.painel-filter-chip').textContent, /Diários em andamento/);
    await fixture.whenStable();
    assert.equal(document.activeElement, element.querySelector('.painel-filter-button'));
});

test('edição rápida, revalidação da mesma conta, troca de aba e troca de conta reconciliam estado sem dados cruzados', async t => {
    const { fixture, element, update, click, open, expand, choose, search, cards } = await mountPanel(t);
    open();
    choose('discipline', '14');
    choose('environment', '22');
    expand('discipline');
    assert.equal(element.querySelector('#native-filter-options-discipline input[value="14"]'), null);
    search('Oficina');
    click('.modal-content-body-filter-button');
    assert.deepEqual(cards(), ['Oficina de arte']);
    open();
    search('algebra');
    update(buildNativePainelModel(raw, { nome: 'Nome revalidado' }, 'conta-a-ficticia'));
    assert.deepEqual(cards(), ['Oficina de arte']);
    assert.equal(element.querySelector('.native-filter-search input').value, 'algebra');
    click('.painel-filter-chip');
    assert.equal(element.querySelector('#native-course-filters').hasAttribute('inert'), true);
    click('[role="tab"]:nth-child(2)');
    assert.deepEqual(cards(), []);
    click('.native-filter-reset');
    assert.deepEqual(cards(), ['Coordenação']);
    click('[role="tab"]:nth-child(1)');

    open();
    choose('semester', '2026.1');
    search('termo da conta anterior');
    const other = buildNativePainelModel({ ...raw, diarios: [row(30, 'Turma de B', { turma_ano_periodo: '2026.1' })] },
        null, 'conta-b-ficticia');
    update(other);
    assert.equal(element.querySelector('.native-filter-search input').value, '');
    assert.equal(fixture.componentInstance.activeFilterCount(), 0);
    click('.modal-content-body-filter-button');
    assert.deepEqual(cards(), ['Turma de B']);
    open();
    click('.modal-content-body-filter-clear');
    assert.deepEqual(cards(), ['Turma de B']);
    open();
    search('perda de sessão');
    update(null);
    assert.deepEqual(cards(), []);
    assert.equal(element.querySelector('.sidebar-modal'), null);
});

test('Coordenação e Autoinscrição exibem os estados do Figma e preservam as ações dos cursos', async t => {
    const { fixture, element, update, click } = await mountPanel(t);
    const opened = [];
    const managed = [];
    fixture.componentInstance.openCourse.subscribe(course => opened.push(course.moodle_course_id));
    fixture.componentInstance.manageEnrolment.subscribe(course => managed.push(course.moodle_course_id));
    update(buildNativePainelModel({
        ...raw,
        coordenacoes: [row(21, 'Sala de coordenação', {
            ambiente: academico, shortname: 'AA.00000', professores: ['Docente de teste'],
            curso_nome: 'Programa de teste', visible: true, progress: 100, hasprogress: true,
        })],
        autoinscricoes: [
            row(27, 'Oferta inscrita', { is_enrolled: true, visible: true, progress: 100, hasprogress: true,
                curso: { nome: 'Curso de formação' }, professores: ['Professor de teste'] }),
            row(28, 'Oferta disponível', { is_enrolled: false, visible: true }),
        ],
    }, null, 'conta-a-ficticia'));

    click('[role="tab"]:nth-child(2)');
    const coordination = element.querySelector('.painel-card--coordenacao');
    assert.match(coordination.textContent, /Sala de coordenação.*AA\.00000/s);
    assert.match(coordination.textContent, /Coordenador\(a\): Docente de teste/);
    assert.match(coordination.textContent, /Acadêmico.*Publicado/s);
    assert.equal(coordination.querySelector('.painel-card-program').textContent.trim(), 'Programa de teste');
    assert.ok(coordination.querySelector('.painel-card-favourite'));
    assert.equal(coordination.querySelector('ifrn-academic-progress'), null);

    click('[role="tab"]:nth-child(3)');
    const [enrolled, available] = element.querySelectorAll('.painel-card--autoinscricao');
    assert.match(enrolled.textContent, /Aberto.*Inscrito/s);
    assert.match(available.textContent, /Aberto.*Inscreva-se/s);
    assert.equal(enrolled.querySelector('.painel-card-program').textContent.trim(), 'Curso de formação');
    assert.match(enrolled.textContent, /Professor\(a\): Professor de teste/);
    assert.match(available.textContent, /Professor\(a\): não informado/);
    assert.equal(available.querySelector('.painel-card-program'), null);
    assert.equal(enrolled.querySelector('ifrn-academic-progress').serverProgress, 100);
    assert.equal(available.querySelector('ifrn-academic-progress'), null);
    for (const card of [enrolled, available]) {
        assert.doesNotMatch(card.textContent, /Publicado/);
        assert.equal(card.querySelector('.painel-card-favourite'), null);
    }
    click('.painel-card--autoinscricao .painel-card-open');
    click('.painel-card-enrolment-status');
    click('.painel-card-enrolment-cta');
    assert.deepEqual(opened, [27, 28]);
    assert.deepEqual(managed, [27]);
});

test('Voltar e Fechar descartam rascunhos repetidamente e a destruição desliga o handler do painel', async t => {
    const { fixture, element, click, open, search, cards } = await mountPanel(t);
    const backHandler = () => {
        let registered;
        document.dispatchEvent(new window.CustomEvent('ionBackButton', { detail: {
            register: (priority, handler) => {
                assert.equal(priority, 101);
                registered = handler;
            },
        } }));

        return registered;
    };
    for (let cycle = 0; cycle < 3; cycle++) {
        open();
        search('rascunho descartado');
        const back = backHandler();
        assert.equal(typeof back, 'function');
        back();
        fixture.detectChanges();
        assert.equal(element.querySelector('#native-course-filters').hasAttribute('inert'), true);
        assert.deepEqual(cards(), names(courses));
    }
    open();
    click('.sidebar-modal__close');
    assert.equal(backHandler(), undefined);
    open();
    fixture.destroy();
    assert.equal(backHandler(), undefined);
});

test('alternar os dois gatilhos mantém o foco correto e deixa os cards disponíveis para abrir o curso', async t => {
    const { fixture, element, click, open, expand, search, cards } = await mountPanel(t);
    const trigger = element.querySelector('.painel-filter-button');
    const chip = element.querySelector('.painel-filter-chip');
    const panel = element.querySelector('#native-course-filters');
    const close = panel.querySelector('[aria-label="Fechar filtros"]');
    for (let cycle = 0; cycle < 3; cycle++) {
        open();
        assert.equal(chip.getAttribute('aria-expanded'), 'true');
        expand('semester');
        click('.painel-filter-chip');
        assert.equal(trigger.getAttribute('aria-expanded'), 'false');
        assert.equal(panel.hasAttribute('inert'), true);
        assert.equal(panel.querySelector('#native-filter-options-semester').hidden, false, 'preserva a altura ao recolher');
        click('.painel-filter-chip');
        assert.equal(panel.hasAttribute('inert'), false);
        assert.equal(panel.querySelector('#native-filter-options-semester').hidden, true, 'reabre sem a expansão anterior');
        close.focus();
        click('[aria-label="Fechar filtros"]');
        assert.equal(document.activeElement, chip);
    }

    open();
    search('oficina');
    click('.modal-content-body-filter-button');
    assert.deepEqual(cards(), ['Oficina de arte']);
    open();
    click('.modal-content-body-filter-clear');
    assert.deepEqual(cards(), names(courses));
    open();
    assert.equal(panel.querySelector('input[type="search"]').value, '');
    const opened = [];
    fixture.componentInstance.openCourse.subscribe(course => opened.push(course));
    const course = element.querySelector('.course-open');
    course.focus();
    click('.course-open');
    assert.deepEqual(opened.map(value => value.moodle_course_id), [17]);
    assert.equal(panel.hasAttribute('inert'), true);
    assert.equal(document.activeElement, course);
});

test('SCSS do filtro recolhe a altura no fluxo e respeita movimento reduzido', () => {
    const css = require('sass').compile(path.join(root, 'painel/painel-native.scss')).css;
    assert.match(css, /\.native-filter-panel\s*\{[^}]*grid-template-rows: 0fr[^}]*pointer-events: none/);
    assert.match(css, /\.native-filter-panel\.is-open\s*\{[^}]*grid-template-rows: 1fr/);
    assert.match(css, /\.native-filter-panel__clip\s*\{[^}]*min-block-size: 0[^}]*overflow: clip/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.native-filter-panel\s*\{\s*transition: none/);
    assert.match(css, /--dsgov-blue-70/);
    assert.match(css, /min-block-size: 44px/);
    assert.match(css, /:focus-visible/);
});
