const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
class AuthService {}
class PainelAvaService {}
class SuapEntryService {}
class SuapEntryAccountError extends Error {}
class ActivatedRoute {}
class Router {}
let valid = false;
let fail = false;
let calls = 0;
let expected;
let entryState = null;
const params = {};
const navigation = [];
const routeNavigations = [];
const queryHandlers = new Set();
const instances = new Map([
    [AuthService, { isAuthenticated: () => valid }],
    [PainelAvaService, { hasDashboard: () => true }],
    [SuapEntryService, {
        async login() {
            assert.fail('A entrada inicial deve usar o SUAP sem exigir login no Moodle Acadêmico');
        },
        async loginWithSuap(identity, status) {
            calls++; expected = identity; status('Entrando');
            if (fail) throw new Error('Cancelado');
            return false;
        },
        async complete() {},
        cancel() {},
    }],
    [ActivatedRoute, {
        queryParamMap: {
            subscribe(handler) {
                queryHandlers.add(handler);
                return { unsubscribe() { queryHandlers.delete(handler); } };
            },
        },
    }],
    [Router, {
        async navigate(...args) { routeNavigations.push(args); return true; },
    }],
]);
const dependencies = {
    '@angular/core': { Component: () => x => x, inject: t => instances.get(t) },
    '@angular/router': { ActivatedRoute, Router },
    rxjs: { Subscription: class { unsubscribe() {} } },
    '@/core/shared.module': { CoreSharedModule: {} },
    '@/MoodleIFRN/services_mobile/auth.service': { AuthService },
    '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService },
    '@/MoodleIFRN/services_mobile/suap-entry.service': { SuapEntryService, SuapEntryAccountError },
    '../navigation/suap-entry-state': { readNativeSuapEntry: () => entryState },
    '@services/platform': { CorePlatform: { ready: async () => {} } },
    '@services/lang': { CoreLang: { getCurrentLanguageSync: () => 'pt-br' } },
    '@services/navigator': { CoreNavigator: {
        getRouteBooleanParam: k => !!params[k], getRouteParam: k => params[k],
        navigate: async url => { navigation.push(url); return true; },
    } },
};
const m = { exports: {} };
const file = path.join(__dirname, '../marketplace-ifrn/marketplace-ifrn.ts');
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
} }).outputText, { module: m, exports: m.exports, require: n => {
    if (dependencies[n]) return dependencies[n];
    throw new Error('Dependencia inesperada: ' + n);
}, URL, Error,
    document: { querySelector: () => null },
    window: { location: { origin: 'http://localhost', assign: u => navigation.push(u) } },
});
(async () => {
    const page = new m.exports.MarketplaceIfrnPage();
    await page.ngOnInit();
    assert.equal(page.canContinue, false, 'cache sozinho não equivale a sessão válida');
    await page.enterAva();
    assert.equal(calls, 1);
    assert.equal(routeNavigations[0][1].queryParams.nativeSuapReturn, null);
    assert.equal(routeNavigations[0][1].queryParams.directSuap, null,
        'consome os parâmetros de entrada para evitar iniciar o login de novo');
    assert.equal(navigation.length, 0, 'não navega para formulário intermediário');
    fail = true;
    await page.enterAva();
    assert.equal(page.formError, 'Cancelado');
    assert.equal(page.loading, false);
    valid = true;
    await page.ngOnInit();
    page.continueSession();
    assert.match(navigation[0], /painel/);
    page.openingPainel = false;
    params.forceLogin = true; params.directSuap = true; params.username = '00123';
    fail = false; calls = 0;
    await page.ngOnInit();
    assert.equal(expected, '00123', 'recuperação do curso mantém matrícula exigida');
    assert.equal(page.canContinue, false);
    console.log('OK: entrada direta, sessão válida, cancelamento e recuperação de conta.');
})().catch(error => { console.error(error); process.exitCode = 1; });
