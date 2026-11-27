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
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports = {};
    vm.runInNewContext(outputText, { exports, URL, require: id => imports[id] || {} });

    return exports;
}

const target = load('mobilemoodle/core_mobile/course-target.ts');
const filters = load('painel/painel-filters.ts');
const { buildNativePainelModel, withMoodleTeacherNames } = load('painel/painel-native-model.ts', {
    '../mobilemoodle/core_mobile/course-target': target,
    './painel-filters': filters,
});

test('metadata Acadêmico and Publicado require matching trusted target and explicit visible state', () => {
    const model = buildNativePainelModel({ diarios: [
        { id: 21, fullname: 'Disciplina acadêmica', ambiente: { titulo: 'Acadêmico' },
            viewurl: 'https://academico.ava.ifrn.edu.br/course/view.php?id=21', visible: 1 },
        { id: 22, fullname: 'Disciplina presencial', ambiente: { titulo: 'Presencial' },
            viewurl: 'https://presencial.ava.ifrn.edu.br/course/view.php?id=22', visible: false },
        { id: 23, fullname: 'Sem visibilidade', ambiente: { titulo: 'Acadêmico' },
            viewurl: 'https://academico.ava.ifrn.edu.br/course/view.php?id=23' },
    ] }, null);

    assert.equal(model.groups.diarios[0].isAcademicEnvironment, true);
    assert.equal(model.groups.diarios[0].publicationStatus, 'published');
    assert.equal(model.groups.diarios[1].isAcademicEnvironment, false);
    assert.equal(model.groups.diarios[1].publicationStatus, 'unpublished');
    assert.equal(model.groups.diarios[2].isAcademicEnvironment, true);
    assert.equal(model.groups.diarios[2].publicationStatus, undefined,
        'missing visible must not be rendered as published');
});

test('card model keeps program, discipline, full code and available lecturers separate', () => {
    const model = buildNativePainelModel({ cursos: [{ id: '111', label: 'Tecnologia em Redes' }], diarios: [
        { id: 31, fullname: 'Nome completo do diário', shortname: '2026.2.111.1A.RED.10#31', curso_codigo: '111',
            disciplina: { descricao: 'Fundamentos de Redes de Computadores' },
            turma: { professores: [{ nome_usual: 'Docente Um' }, { nome: 'Docente Dois' }] },
            ambiente: { titulo: 'Acadêmico' }, viewurl: 'https://academico.ava.ifrn.edu.br/course/view.php?id=31' },
        { id: 32, fullname: 'Disciplina sem detalhes', ambiente: { titulo: 'Presencial' },
            viewurl: 'https://presencial.ava.ifrn.edu.br/course/view.php?id=32' },
        { id: 33, fullname: 'Disciplina com sigla acadêmica', disciplina: { sigla: 'MAT-101' },
            ambiente: { titulo: 'Acadêmico' }, viewurl: 'https://academico.ava.ifrn.edu.br/course/view.php?id=33' },
    ] }, null);
    const [complete, partial, fallbackCode] = model.groups.diarios;

    assert.equal(complete.academicProgram, 'Tecnologia em Redes');
    assert.equal(complete.name, 'Fundamentos de Redes de Computadores');
    assert.equal(complete.academicCode, '2026.2.111.1A.RED.10#31');
    assert.equal(complete.teacherNames, 'Docente Um, Docente Dois');
    assert.equal(partial.academicProgram, undefined);
    assert.equal(partial.academicCode, undefined);
    assert.equal(partial.teacherNames, undefined);
    assert.equal(fallbackCode.academicCode, 'MAT-101');
});

test('prefers the registered academic program and skips AVA labels made from codes', () => {
    const model = buildNativePainelModel({
        cursos: [
            { id: '101', label: 'Curso do catálogo' },
            { id: '102', label: 'Tecnologia em Sistemas' },
            { id: '103', label: 'Curso [103], favor solicitar o cadastro' },
        ],
        diarios: [
            { id: 31, curso_codigo: '101', curso: { codigo: '101', nome: 'Tecnologia em Redes de Computadores' },
                curso_nome: 'Redes', curso_descricao: 'TRC', disciplina_descricao: 'Redes I', turma: '2026/2' },
            { id: 32, curso_codigo: '102', curso: { codigo: '102', nome: 'Curso 102' }, curso_descricao: 'TS' },
            { id: 33, curso_codigo: '103', curso: { codigo: '103', nome: 'Curso Desconhecido' }, curso_descricao: '103' },
        ],
    }, null);
    const [registered, catalog, unavailable] = model.groups.diarios;

    assert.equal(registered.academicProgram, 'Tecnologia em Redes de Computadores');
    assert.equal(registered.name, 'Redes I');
    assert.equal(catalog.academicProgram, 'Tecnologia em Sistemas');
    assert.equal(unavailable.academicProgram, undefined);
});

test('Autoinscrição uses the Moodle title and shares a real program only for the exact same course and site', () => {
    const academic = 'https://academico.ava.ifrn.edu.br';
    const presencial = 'https://presencial.ava.ifrn.edu.br';
    const course = (id, site) => ({ id, viewurl: site + '/course/view.php?id=' + id, fullname: 'Nome Moodle por extenso' });
    const model = buildNativePainelModel({
        diarios: [
            { ...course(21, academic), curso: { nome: 'Formação institucional' } },
            { ...course(22, academic), curso: { nome: 'Programa A' } },
        ],
        coordenacoes: [{ ...course(22, academic), curso: { nome: 'Programa B' } }],
        autoinscricoes: [
            { ...course(21, academic), disciplina_descricao: 'Descrição diferente' },
            course(21, presencial),
            course(22, academic),
        ],
    }, null);
    const [sameCourse, anotherSite, conflicting] = model.groups.autoinscricoes;
    assert.equal(sameCourse.name, 'Nome Moodle por extenso');
    assert.equal(sameCourse.academicProgram, 'Formação institucional');
    assert.match(sameCourse.searchableText, /formacao institucional/);
    assert.equal(anotherSite.academicProgram, undefined);
    assert.equal(conflicting.academicProgram, undefined);
});

test('only shows teachers with an available name and no inactive assignment in the initial dashboard', () => {
    const model = buildNativePainelModel({ diarios: [
        { id: 31, professores: [
            { nome: 'Docente vigente', status: 'ativo' },
            { nome: 'Docente anterior', status: 'inativo' },
            { nome: 'Docente suspenso', situacao_diario: ' Suspenso ', status: 'ativo' },
            { nome: 'Docente sem indicador' },
        ] },
        { id: 32, professores: [{ nome: 'Docente anterior', status: 'inativo' }] },
    ] }, null);

    assert.equal(model.groups.diarios[0].teacherNames, 'Docente vigente, Docente sem indicador');
    assert.equal(model.groups.diarios[1].teacherNames, '');
    assert.doesNotMatch(model.groups.diarios[0].searchableText, /anterior|suspenso/);
});

test('reads Moodle teachers for the same account and exact course without replacing names from the panel', async () => {
    const academic = 'https://academico.ava.ifrn.edu.br';
    const inPerson = 'https://presencial.ava.ifrn.edu.br';
    const owner = 'aluno-ficticio';
    const info = { username: owner };
    const sitesRead = [];
    const requests = [];
    const makeSite = (url, username) => ({
        wsAvailable: method => method === 'core_enrol_get_enrolled_users',
        getURL: () => url + '/',
        getInfo: () => ({ username }),
        getToken: () => 'simulated-session',
        getUserId: () => 42,
        isLoggedOut: () => false,
    });
    const { loadMoodleTeacherNames } = load('painel/painel-course-teachers.ts', {
        '../mobilemoodle/core_mobile/course-target': target,
        '@services/sites': { CoreSites: {
            getSites: async () => [
                { id: 'another-account', siteUrl: academic, info: { username: 'outro-aluno' } },
                { id: 'logged-out', siteUrl: inPerson, info, loggedOut: true },
                { id: 'academic', siteUrl: academic, info },
                { id: 'in-person', siteUrl: inPerson, info },
            ],
            getSite: async id => {
                sitesRead.push(id);

                return id === 'academic' ? makeSite(academic, owner) : makeSite(inPerson, 'outra-conta');
            },
        } },
        '@services/ws': { CoreWS: {
            call: async (method, params, options) => {
                requests.push({ method, params, options });
                return [
                    { fullname: 'Docente Um', roles: [{ shortname: 'editingteacher' }] },
                    { fullname: 'Docente Dois', roles: [{ shortname: 'teacher' }] },
                    { fullname: 'Docente Um', roles: [{ shortname: 'teacher' }] },
                    { fullname: 'Estudante fictício', roles: [{ shortname: 'student' }] },
                    { fullname: 'Gestor fictício', roles: [{ shortname: 'manager' }] },
                ];
            },
        } },
    });
    const row = url => ({ id: 21, viewurl: url + '/course/view.php?id=21', fullname: 'Disciplina fictícia' });
    const model = buildNativePainelModel({ diarios: [
        row(academic), row(inPerson), row(academic),
        { id: 22, viewurl: academic + '/course/view.php?id=22', professores: [{ nome: 'Docente do diário' }] },
        row('https://outra-origem.example'),
        { id: 23, viewurl: academic + '/course/view.php?id=23', professores: [{ nome: 'Docente anterior', status: 'inativo' }] },
    ] }, null, owner);
    const names = await loadMoodleTeacherNames(model.groups.diarios, owner, () => true);
    const updated = withMoodleTeacherNames(model.groups.diarios, names);

    assert.deepEqual(sitesRead.sort(), ['academic', 'in-person']);
    assert.equal(requests.length, 1, 'same course shares a request and another account never gets queried');
    assert.equal(requests[0].method, 'core_enrol_get_enrolled_users');
    assert.equal(requests[0].params.courseid, 21);
    assert.equal(requests[0].options.siteUrl, academic);
    assert.equal(requests[0].params.options.find(option => option.name === 'userfields').value, 'id,fullname,roles');
    assert.equal(updated[0].teacherNames, 'Docente Um, Docente Dois');
    assert.match(updated[0].searchableText, /docente um/);
    assert.equal(updated[1].teacherNames, undefined);
    assert.equal(updated[2].teacherNames, updated[0].teacherNames);
    assert.equal(updated[3].teacherNames, 'Docente do diário');
    assert.equal(updated[4].teacherNames, undefined);
    assert.equal(updated[5].teacherNames, '');
});

test('consults advertised theme, core contacts and teacher roles in order, for authorized enrolled IDs only', async () => {
    const url = 'https://academico.ava.ifrn.edu.br';
    const info = { username: 'aluno-ficticio' };
    const requests = [];
    const site = {
        getURL: () => url, getInfo: () => info, getUserId: () => 42, getToken: () => 'simulated-session',
        isLoggedOut: () => false, wsAvailable: () => true,
    };
    const { loadMoodleTeacherNames } = load('painel/painel-course-teachers.ts', {
        '../mobilemoodle/core_mobile/course-target': target,
        '@services/sites': { CoreSites: {
            getSites: async () => [{ id: 'saved-site', siteUrl: url, info }],
            getSite: async () => site,
        } },
        '@services/ws': { CoreWS: { call: async (method, params) => {
            requests.push([method, params]);
            if (method === 'theme_ifrn_dsgov_get_teacher_data') {
                return { courses: [
                    { id: 21, has_teachers: true, teacherfullname: ' Docente do tema ' },
                    { id: 24, has_teachers: true, teacherfullname: 'Oferta sem inscrição' },
                ] };
            }
            if (method === 'core_course_get_courses_by_field') {
                return { courses: [{ id: 22, contacts: [{ fullname: 'Docente de contato' }, { fullname: 'Docente de contato' }] }] };
            }
            return [{ fullname: 'Docente de papel', roles: [{ shortname: 'teacher' }] }];
        } } },
    });
    const model = buildNativePainelModel({ autoinscricoes: [21, 22, 23, 24].map(id => ({
        id, viewurl: url + '/course/view.php?id=' + id, is_enrolled: id !== 24,
    })) }, null);
    const courses = model.groups.autoinscricoes;
    const updated = withMoodleTeacherNames(courses, await loadMoodleTeacherNames(courses, info.username, () => true));

    assert.deepEqual(requests.map(([method]) => method),
        ['theme_ifrn_dsgov_get_teacher_data', 'core_course_get_courses_by_field', 'core_enrol_get_enrolled_users']);
    assert.deepEqual(Array.from(requests[0][1].courseids), [21, 22, 23]);
    assert.equal(requests[0][1].courseid, 0);
    assert.equal(requests[1][1].value, '22,23');
    assert.equal(requests[2][1].courseid, 23);
    assert.deepEqual(Array.from(updated, course => course.teacherNames),
        ['Docente do tema', 'Docente de contato', 'Docente de papel', undefined]);
});

test('discards the Moodle response when the Panel session changes during the request', async () => {
    const url = 'https://academico.ava.ifrn.edu.br';
    const info = { username: 'aluno-ficticio' };
    const site = {
        getURL: () => url, getInfo: () => info, getUserId: () => 42, getToken: () => 'simulated-session',
        isLoggedOut: () => false, wsAvailable: () => true,
    };
    let active = true;
    let requests = 0;
    const { loadMoodleTeacherNames } = load('painel/painel-course-teachers.ts', {
        '../mobilemoodle/core_mobile/course-target': target,
        '@services/sites': { CoreSites: {
            getSites: async () => [{ id: 'saved-site', siteUrl: url, info }],
            getSite: async () => site,
        } },
        '@services/ws': { CoreWS: { call: async () => {
            requests++;
            active = false;

            return [{ fullname: 'Docente de outra sessão', roles: [{ shortname: 'editingteacher' }] }];
        } } },
    });
    const model = buildNativePainelModel({ diarios: [21, 22].map(id => ({
        id, viewurl: url + '/course/view.php?id=' + id,
    })) }, null);
    const names = await loadMoodleTeacherNames(model.groups.diarios, info.username, () => active);

    assert.equal(requests, 1, 'the next course is skipped after canceling the first request');
    assert.equal(names.size, 0);
});

test('card displays fields in reference order and badges immediately after the progress', () => {
    const template = read('painel/painel-native.html');
    const styles = read('painel/painel-native.scss');
    const progressTemplate = read('academic-progress/progress.component.html');
    const progressStyles = read('academic-progress/progress.component.scss');
    const programPosition = template.indexOf('course.academicProgram');
    const favouritePosition = template.indexOf('painel-card-favourite');
    const titlePosition = template.indexOf('course.name');
    const codePosition = template.indexOf('course.academicCode');
    const teacherPosition = template.indexOf('course.teacherNames');
    const progressPosition = template.indexOf('<ifrn-academic-progress');
    const metadataPosition = template.indexOf('<div class="painel-card-details">', progressPosition);
    const favouriteClosePosition = template.indexOf('</button>', favouritePosition);
    const courseOpenPosition = template.indexOf('class="painel-card-link course-open painel-card-open"');

    assert.ok(programPosition >= 0 && favouritePosition > programPosition);
    assert.ok(titlePosition > favouritePosition && codePosition > titlePosition && teacherPosition > codePosition);
    assert.ok(progressPosition > teacherPosition && metadataPosition > progressPosition);
    assert.ok(favouriteClosePosition < courseOpenPosition, 'favorite must be a separate button and not open the course');
    assert.match(template, /Professor\(a\): <span class="painel-card-teacher-name">\{\{ course\.teacherNames \|\| 'não informado' \}\}<\/span>/);
    assert.match(template, /course\.isAcademicEnvironment[\s\S]*?<span>Acadêmico<\/span>/);
    assert.match(template, /painel-card-info-icon--academic/);
    assert.match(template, /painel-card-info-icon--environment[\s\S]*?course\.environment/);
    assert.match(template, /course\.publicationStatus === 'published'[\s\S]*?<span>Publicado<\/span>/);
    assert.match(template, /course\.publicationStatus === 'unpublished'[\s\S]*?<span>Não publicado<\/span>/);
    assert.match(template, /\[showHeading\]="false"/);
    assert.match(template, /\[showSummary\]="false"/);
    assert.match(progressTemplate, /@if \(showHeading\)/);
    assert.match(progressTemplate, /compact && showSummary/);
    assert.doesNotMatch(progressTemplate, /compact && view\.total !== null/);
    assert.match(styles, /\.painel-card:not\(\.painel-card--autoinscricao\) \.painel-card-details\s*\{\s*order:\s*0;/);
    assert.match(styles, /flex-wrap:\s*wrap/);
    assert.match(styles, /overflow-wrap:\s*anywhere/);
    assert.match(styles, /\.painel-card-info-icon--academic\s*\{[^}]*background:\s*#d4e5ff;[^}]*color:\s*#155bcb;[^}]*font-size:\s*14px/s);
    assert.match(styles, /\.painel-card-info-icon--academic\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*111px;[^}]*white-space:\s*nowrap;/s);
    assert.match(styles, /\.painel-card-info-icon--academic\s*\{[\s\S]*?\bspan\s*\{[^}]*white-space:\s*nowrap;/);
    assert.match(styles, /\.painel-card-info-icon--academic\s*\{[\s\S]*?\bspan\s*\{[^}]*overflow-wrap:\s*normal;/);
    assert.match(styles, /\.painel-card-info-icon:not\(\.painel-card-info-icon--academic\) span/);
    assert.match(styles, /\.painel-card-info-icon--environment\s*\{[^}]*background:\s*#d4e5ff;[^}]*color:\s*#155bcb;/s);
    assert.match(styles, /\.painel-card-details-info-published\s*\{[^}]*background:\s*#e3f5e1;/s);
    assert.doesNotMatch(styles, /\.painel-card\s*\{[^}]*?(?<!min-)height:\s*\d+px/s);
});

test('Diários uses the exported Figma badge colors and its own compact meter spacing', () => {
    const template = read('painel/painel-native.html');
    const styles = read('painel/painel-native.scss');
    const progressStyles = read('academic-progress/progress.component.scss');
    const diariosStyles = styles.slice(styles.indexOf('.native-panel-frame--diarios .diarios-page {'));

    assert.match(template, /\[class\.native-panel-frame--diarios\]="group\(\) === 'diarios'"/);
    assert.match(styles, /\.painel-card-info-icon--academic \{ background: #daf8f8; color: #000; \}/);
    assert.match(styles, /\.painel-card-details-info-published \{ background: #e3f5e1; color: #000; \}/);
    assert.match(diariosStyles, /--academic-compact-meter-gap: 15px;/);
    assert.match(progressStyles, /gap: var\(--academic-compact-meter-gap, 13px\);/);
});
