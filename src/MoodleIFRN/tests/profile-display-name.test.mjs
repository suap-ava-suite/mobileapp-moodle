import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';

function loadFunction(path, declaration) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const start = source.indexOf(declaration);
    assert.notEqual(start, -1, `Function not found: ${declaration}`);
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
    assert.notEqual(end, -1, `Incomplete function: ${declaration}`);
    const functionSource = `${source.slice(start, end)}\nmodule.exports = ${declaration.match(/function\s+(\w+)/)[1]};`;
    const js = transformSync(functionSource, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
    const context = vm.createContext({ module: { exports: {} }, sessionStorage: { getItem: () => null } });
    vm.runInContext(js, context);
    return context.module.exports;
}

const painelName = loadFunction('../mobilemoodle/core_mobile/api-painel.ts', 'function profileDisplayName(');
const suapName = loadFunction('../mobilemoodle/core_mobile/api-suap.ts', 'function displayName(');

test('short AVA display name wins over registered name', () => {
    const profile = {
        nome_social: 'Synthetic Short Social',
        nome_usual: 'Synthetic Short Usual',
        nome_registro: 'Synthetic Complete Registered Name',
    };
    assert.equal(painelName(profile), 'Synthetic Short Usual');
    assert.equal(painelName({ ...profile, nome_exibicao: 'Synthetic Short Official Display' }), 'Synthetic Short Official Display');
    assert.equal(suapName(profile), 'Synthetic Short Usual');
});

test('display aliases remain fallbacks when the registered name is absent', () => {
    assert.equal(painelName({ nome_exibicao: 'Synthetic Official Display', nome_usual: 'Synthetic Usual Name' }), 'Synthetic Official Display');
    assert.equal(painelName({ nome_usual: 'Synthetic Usual Name', nome_social: 'Synthetic Social Name' }), 'Synthetic Usual Name');
    assert.equal(suapName({ nome_exibicao: 'Synthetic Official Display', nome_usual: 'Synthetic Usual Name' }), 'Synthetic Official Display');
});

test('registered name is used when no usual or social display name exists', () => {
    assert.equal(painelName({ nome_usual: 'Synthetic Usual Name' }), 'Synthetic Usual Name');
    assert.equal(painelName({ nome_social: 'Synthetic Social Name' }), 'Synthetic Social Name');
    assert.equal(suapName({ nome_social: 'Synthetic Social Name' }), 'Synthetic Social Name');
    assert.equal(painelName({ nome_registro: 'Synthetic Registered Name' }), 'Synthetic Registered Name');
    assert.equal(suapName({ nome_registro: 'Synthetic Registered Name' }), 'Synthetic Registered Name');
});
