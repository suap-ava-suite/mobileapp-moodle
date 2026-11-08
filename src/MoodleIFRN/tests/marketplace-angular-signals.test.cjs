const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const angular = require('@angular/core');

function token(name) {
    return { [name]: class {} }[name];
}

function loadMarketplace() {
    const tokens = {
        AuthService: token('AuthService'),
        ActivatedRoute: token('ActivatedRoute'),
        Router: token('Router'),
        CoreSharedModule: token('CoreSharedModule'),
        PainelAvaService: token('PainelAvaService'),
        CoreLang: token('CoreLang'),
        CorePlatform: token('CorePlatform'),
        CoreNavigator: token('CoreNavigator'),
        CoreOpener: token('CoreOpener'),
        SuapEntryService: token('SuapEntryService'),
        SuapEntryAccountError: class SuapEntryAccountError extends Error {},
        CoreEvents: token('CoreEvents'),
        GovBrBrowserService: token('GovBrBrowserService'),
        NgZone: token('NgZone'),
    };
    const dependencies = new Map(Object.values(tokens).map(value => [value, {}]));
    let metadata;
    const angularMock = {
        ChangeDetectionStrategy: angular.ChangeDetectionStrategy,
        computed: angular.computed,
        signal: angular.signal,
        inject: dependency => dependencies.get(dependency) || {},
        Component: value => component => {
            metadata = value;
            return component;
        },
    };
    const mocks = {
        '@angular/core': angularMock,
        '@/MoodleIFRN/services_mobile/auth.service': { AuthService: tokens.AuthService },
        '@angular/router': { ActivatedRoute: tokens.ActivatedRoute, Router: tokens.Router },
        '../navigation/suap-entry-state': { readNativeSuapEntry: () => null },
        '@/core/shared.module': { CoreSharedModule: tokens.CoreSharedModule },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService: tokens.PainelAvaService },
        '@services/lang': { CoreLang: tokens.CoreLang },
        '@services/platform': { CorePlatform: tokens.CorePlatform },
        '@services/navigator': { CoreNavigator: tokens.CoreNavigator },
        '@static/opener': { CoreOpener: tokens.CoreOpener },
        '@/MoodleIFRN/services_mobile/suap-entry.service': {
            SuapEntryService: tokens.SuapEntryService,
            SuapEntryAccountError: tokens.SuapEntryAccountError,
        },
        '../services_mobile/suap-login-telemetry': { reportSuapDuration() {} },
        '@static/events': { CoreEvents: tokens.CoreEvents },
        '../services_mobile/painel-ava.config': { GOVBR_MOBILE_UNAVAILABLE_MESSAGE: 'unavailable' },
        '../services_mobile/govbr-browser.service': { GovBrBrowserService: tokens.GovBrBrowserService },
    };
    const context = {
        exports: {},
        require: id => mocks[id] || {},
        console,
    };
    const source = fs.readFileSync('src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts', 'utf8');
    const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(javascript, context);

    return { MarketplaceIfrnPage: context.exports.MarketplaceIfrnPage, metadata };
}

test('Marketplace usa OnPush e signals Angular para estado reativo de transição', () => {
    const { MarketplaceIfrnPage, metadata } = loadMarketplace();
    const page = new MarketplaceIfrnPage();

    assert.equal(metadata.changeDetection, angular.ChangeDetectionStrategy.OnPush);
    assert.equal(page.showTransition, false);
    assert.equal(page.transitionCaption, 'Carregando painel...');

    page.loading = true;
    assert.equal(page.showTransition, true);
    assert.equal(page.transitionCaption, 'Carregando painel...');

    page.govBrBrowserOpening = true;
    assert.equal(page.transitionCaption, 'Abrindo o navegador seguro...');

    page.govBrBrowserOpening = false;
    page.waitingBrowser = true;
    assert.equal(page.transitionCaption, 'Conclua o login no navegador');

    page.waitingBrowser = false;
    page.loading = false;
    page.statusMessage = 'Validando acesso';
    assert.equal(page.showTransition, false);
    assert.equal(page.transitionCaption, 'Validando acesso');
});
