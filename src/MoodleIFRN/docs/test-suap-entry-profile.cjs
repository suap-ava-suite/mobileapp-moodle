// Execute na raiz: node src/MoodleIFRN/docs/test-suap-entry-profile.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'services_mobile/suap-entry.service.ts');
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('const AVA =');
const end = source.indexOf('@Injectable');
assert.ok(start > 0 && end > start, 'helpers do suap-entry não encontrados');

const helpers = source.slice(start, end)
    .replace(/export function/g, 'function')
    .replace(/export const/g, 'const');

const oauth = fs.readFileSync(path.join(root, 'mobilemoodle/core_mobile/oauth-profile.ts'), 'utf8')
    .replace(/export const/g, 'const')
    .replace(/export function/g, 'function')
    .replace(/export interface[^{]+\{[\s\S]*?\n\}/g, '');

const js = ts.transpileModule(`${oauth}\n${helpers}\nmodule.exports = { mapNativeProfile, mergeVerifiedPanelProfile, isPlaceholderPhoto, profileIdentity };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const api = vm.runInNewContext(js, { module: { exports: {} }, exports: {}, console }, { filename: 'suap-entry-helpers.js' });

const moodle = {
    id: 10,
    username: '20211084040',
    fullname: 'Aluno Completo',
    firstname: 'Aluno',
    lastname: 'Completo',
    email: 'aluno@example.invalid',
    profileimageurl: 'https://academico.ava.ifrn.edu.br/pluginfile.php/1/user/icon/f1',
    customfields: [{ shortname: 'nome_apresentacao', value: 'Aluno' }],
};

const previousOther = {
    identificacao: '00999',
    foto: 'https://suap.ifrn.edu.br/media/antiga.jpg',
    url_foto_150x200: 'https://suap.ifrn.edu.br/media/antiga-150.jpg',
};

const mappedFresh = api.mapNativeProfile(moodle, '20211084040', previousOther);
assert.equal(mappedFresh.identificacao, '20211084040');
assert.equal(mappedFresh.foto, moodle.profileimageurl);
assert.equal(mappedFresh.url_foto_150x200, undefined, 'não herda foto de outra conta');

const previousSame = {
    identificacao: '20211084040',
    foto: 'https://old.example/foto.jpg',
    url_foto_150x200: '',
    campus: { sigla: 'CNAT', nome: 'Natal' },
};
const mappedSame = api.mapNativeProfile(moodle, '20211084040', previousSame);
assert.equal(mappedSame.foto, moodle.profileimageurl);
assert.equal(mappedSame.url_foto_150x200, undefined, 'url_foto vazia não permanece para sombrear');
assert.equal(mappedSame.campus.sigla, 'CNAT');

const placeholderMoodle = api.mapNativeProfile({
    ...moodle,
    profileimageurl: 'https://academico.ava.ifrn.edu.br/theme/image.php/boost/core/1/u/f1',
}, '20211084040', {
    identificacao: '20211084040',
    url_foto_150x200: 'https://suap.ifrn.edu.br/media/fotos/aluno.jpg',
});
assert.equal(placeholderMoodle.url_foto_150x200, 'https://suap.ifrn.edu.br/media/fotos/aluno.jpg');

const merged = api.mergeVerifiedPanelProfile(mappedSame, {
    matricula: '20211084040',
    nome_usual: 'Aluno Painel',
    url_foto_150x200: '/media/fotos/aluno.jpg',
}, '20211084040');
assert.equal(merged.url_foto_150x200, 'https://suap.ifrn.edu.br/media/fotos/aluno.jpg');

const rejected = api.mergeVerifiedPanelProfile(mappedSame, {
    matricula: '00000',
    url_foto_150x200: 'https://suap.ifrn.edu.br/media/outra.jpg',
}, '20211084040');
assert.equal(rejected.url_foto_150x200, undefined, 'painel de outra matrícula não altera perfil');

assert.equal(api.isPlaceholderPhoto(''), true);
assert.equal(api.isPlaceholderPhoto(moodle.profileimageurl), false);

console.log('OK: mapNativeProfile, mergeVerifiedPanelProfile e proteção de contas/foto.');
