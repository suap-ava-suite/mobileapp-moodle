const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Testes para validação de múltiplos ambientes Moodle e resolução de cursos
const moodleSiteServicePath = path.join(__dirname, '../services_mobile/moodle-site.service.ts');
const source = fs.readFileSync(moodleSiteServicePath, 'utf8');

// Transpila para extrair funções puras
const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const sandbox = {
    exports: {},
    require: (id) => {
        if (id === '@angular/core') return { Injectable: () => (c) => c, inject: () => ({}) };
        return {};
    },
    console,
    sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
    URL,
};

vm.runInNewContext(transpiled.outputText, sandbox);

const { resolveMoodleSiteUrl, IFRN_MOODLE_PRESENCIAL_URL } = sandbox.exports;

assert.equal(typeof resolveMoodleSiteUrl, 'function', 'resolveMoodleSiteUrl deve ser exportada');
assert.equal(IFRN_MOODLE_PRESENCIAL_URL, 'https://presencial.ava.ifrn.edu.br');

// 1. Resolução de URLs de diferentes ambientes Moodle
assert.equal(
    resolveMoodleSiteUrl('https://academico.ava.ifrn.edu.br/course/view.php?id=101'),
    'https://academico.ava.ifrn.edu.br',
    'Deve resolver ambiente Acadêmico',
);

assert.equal(
    resolveMoodleSiteUrl('https://presencial.ava.ifrn.edu.br/course/view.php?id=202'),
    'https://presencial.ava.ifrn.edu.br',
    'Deve resolver ambiente Presencial',
);

assert.equal(
    resolveMoodleSiteUrl('https://ead.ava.ifrn.edu.br/course/view.php?id=303'),
    'https://ead.ava.ifrn.edu.br',
    'Deve resolver ambiente EAD',
);

// Invalid targets must never silently become Presencial.
for (const candidate of [null, '', 'http://127.0.0.1:8000', 'http://localhost:8080',
    'https://evil.invalid', 'https://user:pass@ead.ava.ifrn.edu.br']) {
    assert.throws(() => resolveMoodleSiteUrl(candidate), /Ambiente do curso inválido/);
}

// 3. Teste do módulo de idioma otimizado
const langPath = path.join(__dirname, '../services_mobile/ifrn-language.ts');
const langSource = fs.readFileSync(langPath, 'utf8');
const langTranspiled = ts.transpileModule(langSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

let langChanges = 0;
const langSandbox = {
    exports: {},
    require: (id) => {
        if (id === '@services/lang') return { CoreLang: langSandbox.CoreLang };
        if (id === '@singletons') return { Translate: langSandbox.Translate };
        return {};
    },
    console,
    Translate: {
        setTranslation: () => {},
    },
    CoreLang: {
        getCurrentLanguageSync: () => 'pt-br',
        changeCurrentLanguage: async () => { langChanges++; },
    },
};

vm.runInNewContext(langTranspiled.outputText, langSandbox);
const { useIfrnBrazilianPortuguese } = langSandbox.exports;

(async () => {
    // 1ª chamada: carrega
    await useIfrnBrazilianPortuguese();
    assert.equal(langChanges, 1, 'Deve carregar na primeira chamada');

    // 2ª chamada: se já estiver em pt-br e inicializado, não reexecuta
    await useIfrnBrazilianPortuguese();
    assert.equal(langChanges, 1, 'Não deve chamar changeCurrentLanguage repetidamente na 2ª vez');

    console.log('OK: resolução de múltiplos ambientes Moodle e otimização de idioma.');
})();
