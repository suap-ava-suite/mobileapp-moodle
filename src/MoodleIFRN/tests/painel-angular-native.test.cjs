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
const modelModule = load('src/MoodleIFRN/painel/painel-native-model.ts', { '../mobilemoodle/core_mobile/course-target': target });
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
            output: () => ({ emit: value => events.push(value) }) },
        '../mobilemoodle/core_mobile/course-favourites': favourites,
        '../services_mobile/painel-help-links': { PAINEL_HELP_LINKS: {} },
    });
    const page = new PainelNativeComponent();
    page.data.set(build(raw, null));
    const course = page.courses()[0];
    page.busy.set(true);
    page.selectCourse(course);
    assert.equal(events.length, 0);
    page.busy.set(false);
    page.selectCourse({ ...course, moodle_site_url: undefined });
    assert.equal(events.length, 0);
    page.selectCourse(course);
    assert.equal(events.length, 1);
    page.search.set('NOT_FOUND');
    assert.equal(page.courses().length, 0);
    page.search.set('fictícia');
    page.toggleFavourite(course);
    page.onlyFavourites.set(true);
    assert.equal(page.courses().length, 1);
    storage.set('ifrn_username', 'SYNTHETIC_B');
    page.data.set(build(raw, null));
    assert.equal(page.courses().length, 0, 'new account cannot inherit account A favourites');
    page.data.set(null);
    assert.equal(page.courses().length, 0, 'missing/invalid owner data clears the rendered list');
});
