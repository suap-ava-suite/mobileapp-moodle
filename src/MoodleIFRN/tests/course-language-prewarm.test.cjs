const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadLanguageService() {
    const filename = path.join(__dirname, '..', 'services_mobile', 'ifrn-language.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    let currentLanguage = 'en';
    let resolveChange;
    let changeCalls = 0;
    const translations = [];
    const module = { exports: {} };
    const CoreLang = {
        getCurrentLanguageSync: () => currentLanguage,
        changeCurrentLanguage: async language => {
            changeCalls++;
            await new Promise(resolve => { resolveChange = resolve; });
            currentLanguage = language;
        },
    };
    const Translate = { setTranslation: (...args) => translations.push(args) };

    vm.runInNewContext(output, {
        module,
        exports: module.exports,
        require: id => {
            if (id === '@services/lang') return { CoreLang };
            if (id === '@singletons') return { Translate };
            throw new Error(`Unexpected import: ${id}`);
        },
    }, { filename });

    return {
        service: module.exports,
        get changeCalls() { return changeCalls; },
        get translations() { return translations; },
        finishChange: () => resolveChange(),
        get currentLanguage() { return currentLanguage; },
    };
}

test('Painel prewarm and first course click share one pending language change', async () => {
    const harness = loadLanguageService();
    const prewarm = harness.service.useIfrnBrazilianPortuguese();
    const courseClick = harness.service.useIfrnBrazilianPortuguese();

    assert.equal(harness.changeCalls, 1);
    assert.equal(harness.translations.length, 1);
    harness.finishChange();
    await Promise.all([prewarm, courseClick]);

    assert.equal(harness.currentLanguage, 'pt-br');
    assert.equal(harness.translations.length, 2);
    await harness.service.useIfrnBrazilianPortuguese();
    assert.equal(harness.changeCalls, 1);
});
