const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

test('a suíte atual contém exatamente 19 testes de unidade e exclui o probe Android', () => {
    const testDirectory = path.resolve('src/MoodleIFRN/tests');
    const testFiles = readdirSync(testDirectory)
        .filter(file => /\.test\.(?:cjs|mjs)$/.test(file))
        .sort();

    assert.equal(testFiles.length, 19);
    assert.ok(testFiles.every(file => /\.test\.(?:cjs|mjs)$/.test(file)));
    assert.ok(!testFiles.includes('painel-first-paint.android.mjs'));
});
