const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'services_mobile', 'suap-entry.service.ts');
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === 'mergeVerifiedPanelProfile');
assert.ok(declaration, 'expected the production mergeVerifiedPanelProfile function');

const harness = `
const PHOTO_KEYS = ['url_foto_150x200', 'url_foto_75x100', 'foto'];
const present = value => value !== undefined && value !== null && String(value).trim() !== '';
const panelIdentity = profile => String(profile?.matricula || profile?.identificacao || profile?.username || '').trim();
const usablePhoto = value => typeof value === 'string' && value.trim() && !/defaultuserpic|gravatar\\.com\\/avatar/i.test(value)
    ? value.trim() : '';
${declaration.getText(ast)}
module.exports = { mergeVerifiedPanelProfile };
`;
const output = ts.transpileModule(harness, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const harnessModule = { exports: {} };
vm.runInNewContext(output, { module: harnessModule, exports: harnessModule.exports });
const { mergeVerifiedPanelProfile } = harnessModule.exports;

test('perfil do Painel validado substitui nome nativo incompleto antes do primeiro desenho', () => {
    const merged = mergeVerifiedPanelProfile({
        matricula: 'synthetic-student',
        nome: 'Synthetic Incomplete',
        nome_usual: 'Synthetic Incomplete',
    }, {
        matricula: 'synthetic-student',
        nome_usual: 'Synthetic Official Name',
        nome_registro: 'Synthetic Official Name',
        _name_source: 'GET /api/v2/usuario/info/',
    }, 'synthetic-student');

    assert.equal(merged.nome_usual, 'Synthetic Official Name');
    assert.equal(merged.nome_exibicao, 'Synthetic Official Name');
});

test('nome registrado completo prevalece sobre aliases abreviados do Painel', () => {
    const merged = mergeVerifiedPanelProfile({
        matricula: 'synthetic-student',
        nome_usual: 'Synthetic Short Usual',
    }, {
        matricula: 'synthetic-student',
        nome_usual: 'Synthetic Short Usual',
        nome_social: 'Synthetic Short Social',
        nome_registro: 'Synthetic Complete Registered Name',
        _name_source: 'GET /api/v2/usuario/info/',
    }, 'synthetic-student');

    assert.equal(merged.nome_exibicao, 'Synthetic Complete Registered Name');
    assert.equal(merged.nome_usual, 'Synthetic Short Usual');
    assert.equal(merged.nome_registro, 'Synthetic Complete Registered Name');
});

test('nome registrado completo prevalece sobre alias explícito abreviado', () => {
    const merged = mergeVerifiedPanelProfile({ matricula: 'synthetic-student' }, {
        matricula: 'synthetic-student',
        nome_exibicao: 'Synthetic Official Display',
        nome_registro: 'Synthetic Complete Registered Name',
    }, 'synthetic-student');

    assert.equal(merged.nome_exibicao, 'Synthetic Complete Registered Name');
});

test('nome do Painel de outra identidade não substitui o perfil Moodle', () => {
    const profile = { matricula: 'synthetic-student', nome_usual: 'Synthetic Moodle Name' };
    const merged = mergeVerifiedPanelProfile(profile, {
        matricula: 'different-student', nome_usual: 'Synthetic Other Name',
    }, 'synthetic-student');

    assert.equal(merged.nome_usual, 'Synthetic Moodle Name');
    assert.equal(merged.nome_exibicao, undefined);
});

test('perfil sem nome útil do Painel preserva fallback e dados de identidade', () => {
    const merged = mergeVerifiedPanelProfile({
        matricula: 'synthetic-student', nome_usual: 'Synthetic Moodle Name',
    }, { matricula: 'synthetic-student' }, 'synthetic-student');

    assert.equal(merged.nome_usual, 'Synthetic Moodle Name');
    assert.equal(merged.matricula, 'synthetic-student');
});
