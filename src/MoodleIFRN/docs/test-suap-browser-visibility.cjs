// node src/MoodleIFRN/docs/test-suap-browser-visibility.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rxjs = require('rxjs');
const events = new Map();
let shown = 0;
let hidden = 0;
let closed = 0;
let scripts = 0;
const browser = {
    on(name) {
        if (!events.has(name)) events.set(name, new rxjs.Subject());
        return events.get(name);
    },
    show() { shown++; },
    hide() { hidden++; },
    insertCSS: async () => {},
    executeScript: async () => { scripts++; },
};
const dependencies = {
    '@angular/common/http': { HttpErrorResponse: class extends Error {} },
    '@angular/core': { Injectable: () => value => value },
    '@static/opener': { CoreOpener: {
        openInApp: () => browser,
        closeInAppBrowser() { closed++; },
    } },
    rxjs,
    '../mobilemoodle/core_mobile/oauth-profile': {},
};
const mod = { exports: {} };
for (const name of ['./painel-ava.config', './painel-courses']) {
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services_mobile', name + '.ts'), 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    }).outputText;
    const module = {exports:{}};
    vm.runInNewContext(compiled, {module, exports:module.exports, URL});
    dependencies[name] = module.exports;
}
const source = fs.readFileSync(path.join(__dirname, '../services_mobile/painel-ava.service.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
} }).outputText, {
    module: mod, exports: mod.exports, URL, console,
    require: name => {
        assert.ok(dependencies[name], name);
        return dependencies[name];
    },
});
const service = new mod.exports.PainelAvaService();
let failure;
const start = () => service.authenticateWithBrowser({ readOnly: true }).subscribe({ error: error => failure = error });
const emit = (name, url) => events.get(name).next({ url });
start();
// Exibir antes do loadstop, inclusive MFA e novas rotas do SUAP.
emit('loadstart', 'https://suap.ifrn.edu.br/accounts/two_factor/');
assert.equal(shown, 1);
emit('loadstart', 'https://ava.ifrn.edu.br/authenticate/');
assert.equal(hidden, 1);
emit('loadstop', 'https://suap.ifrn.edu.br/confirmar-acesso/');
assert.equal(shown, 2);
emit('loadstart', 'https://suap.ifrn.edu.br.evil.invalid/login/');
assert.equal(hidden, 2);
emit('loaderror', 'https://suap.ifrn.edu.br/accounts/login/');
assert.match(failure.message, /conexão/);
assert.equal(closed, 1);
assert.ok([...events.values()].every(event => !event.observed));
// Cancelar a assinatura também fecha o navegador oculto.
const subscription = start();
subscription.unsubscribe();
assert.equal(closed, 2);
// A consulta de identidade após o login continua oculta.
start();
events.get('message').next({ data: {
    type: 'ifrn-painel-diarios', ok: true, payload: { diarios: [] }, profile: null,
} });
emit('loadstart', 'https://suap.ifrn.edu.br/');
emit('loadstop', 'https://suap.ifrn.edu.br/');
assert.equal(shown, 2);
emit('exit', '');
assert.equal(closed, 3);
// O redirect publicado deve iniciar a coleta; uma origem com prefixo igual não pode fazê-lo.
const originTest = start();
const before = scripts;
emit('loadstop', 'https://ava.ifrn.edu.br.evil.invalid/');
assert.equal(scripts, before);
emit('loadstop', 'https://painel.ead.ifrn.edu.br/');
assert.equal(scripts, before + 1);
originTest.unsubscribe();
console.log('OK: visibilidade SUAP, falha de carga, cancelamento e identidade oculta.');
