import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';

function loadFunction(path, declaration) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const start = source.indexOf(declaration);
    assert.notEqual(start, -1, `Não encontrou ${declaration}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (let index = bodyStart; index < source.length; index++) {
        if (source[index] === '{') depth++;
        if (source[index] === '}' && --depth === 0) {
            end = index + 1;
            break;
        }
    }
    assert.notEqual(end, -1, `Corpo incompleto em ${declaration}`);
    const functionSource = `${source.slice(start, end)}\nmodule.exports = ${declaration.match(/function\s+(\w+)/)[1]};`;
    const js = transformSync(functionSource, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
    const context = vm.createContext({ module: { exports: {} }, sessionStorage: { getItem: () => null } });
    vm.runInContext(js, context);
    return context.module.exports;
}

const painelName = loadFunction('../mobilemoodle/core_mobile/api-painel.ts', 'function profileDisplayName(');
const suapName = loadFunction('../mobilemoodle/core_mobile/api-suap.ts', 'function displayName(');

test('nome oficial calculado pelo backend tem prioridade sobre os campos separados', () => {
    const profile = { nome_social: 'Matheu Soare', nome_usual: 'Matheus Soares', nome_registro: 'Matheus Soares Silva' };
    assert.equal(painelName(profile), 'Matheus Soares');
    assert.equal(painelName({ ...profile, nome_exibicao: 'Matheus Soares' }), 'Matheus Soares');
    assert.equal(painelName({ ...profile, nome_exibicao: 'Matheus Soares', nome_usual: 'Matheu Soare' }), 'Matheus Soares');
    assert.equal(suapName(profile), 'Matheus Soares');
    assert.equal(painelName({ nome_usual: 'Nome incompleto', show_name: 'Nome oficial completo' }), 'Nome oficial completo');
    assert.equal(suapName({ nome_usual: 'Nome incompleto', show_name: 'Nome oficial completo' }), 'Nome oficial completo');
    assert.equal(suapName({ nome_usual: 'Nome incompleto', nome_exibicao: 'Nome oficial completo' }), 'Nome oficial completo');
});

test('usa nome social ou de registro quando não há nome usual válido', () => {
    assert.equal(painelName({ nome_usual: 'Matheus...', nome_social: 'Matheus Soares' }), 'Matheus Soares');
    assert.equal(painelName({ nome_registro: 'Matheus Soares' }), 'Matheus Soares');
    assert.equal(suapName({ nome_social: 'Matheus Soares' }), 'Matheus Soares');
});
