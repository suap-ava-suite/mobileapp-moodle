const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function element() {
    return {
        textContent: '', hidden: false, innerHTML: '', value: 0, attributes: {}, children: [],
        setAttribute(name, value) { this.attributes[name] = value; },
        appendChild(child) { this.children.push(child); },
    };
}

test('renderCurso mantém cabeçalho, dados de progresso e seção vazia no fallback atual', () => {
    const ids = [
        'curso-breadcrumb-name', 'curso-title', 'curso-teacher', 'curso-workload',
        'curso-progress-text', 'curso-progress-label', 'curso-env-tag', 'curso-open-external',
        'curso-summary-block', 'curso-summary', 'curso-progress-bar', 'curso-sections',
        'sidebar-user-name', 'btn-toggle-profile', 'menu-user-avatar',
    ];
    const elements = new Map(ids.map(id => [id, element()]));
    const app = {
        title: element(), subtitle: element(), toolbarAvatar: element(), menuUserInfo: null,
        content: { innerHTML: '', children: [], appendChild(child) { this.children.push(child); } },
        cloneTemplate: () => ({}),
        initials: () => 'F',
    };
    const exports = {};
    const mocks = {
        './namespace': { MM: {}, App: app },
        './course-favourites': { createCourseFavourites: () => ({}), favouriteCourseKey: () => null },
        './course-target': { resolveCourseSite: () => undefined },
    };
    const output = ts.transpileModule(fs.readFileSync('src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(output, {
        exports,
        require: name => {
            assert.ok(name in mocks, `import inesperado: ${name}`);
            return mocks[name];
        },
        document: { getElementById: id => elements.get(id) || null },
    });

    app.renderCurso({
        id: 'fixture-course', name: 'Curso fixture', teacher: 'Docente fixture', workload: '40h',
        progress: 150, moodle: 'Acadêmico', external_url: 'https://example.invalid/course',
        summary: '<b>Resumo fixture</b>', sections: [],
    }, { nome: 'Perfil fixture', courses: [] });

    assert.equal(app.title.textContent, 'Curso fixture');
    assert.equal(app.subtitle.textContent, 'Painel AVA');
    assert.equal(elements.get('curso-breadcrumb-name').textContent, 'Curso fixture');
    assert.equal(elements.get('curso-teacher').textContent, 'Docente fixture');
    assert.equal(elements.get('curso-progress-text').textContent, '100%');
    assert.equal(elements.get('curso-progress-bar').value, 1);
    assert.equal(elements.get('curso-summary').textContent, 'Resumo fixture');
    assert.equal(elements.get('curso-open-external').attributes.href, 'https://example.invalid/course');
    assert.match(elements.get('curso-sections').innerHTML, /Nenhuma seção disponível/);
});
