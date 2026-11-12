const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const servicePath = path.join(root, 'services_mobile', 'suap-profile-browser.service.ts');
const source = fs.readFileSync(servicePath, 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

class FakeBrowser {
    constructor() {
        this.events = new Map();
        this.loaded = [];
        this.closed = 0;
        this.shown = 0;
    }

    on(name) {
        const listeners = this.events.get(name) || [];
        this.events.set(name, listeners);

        return {
            subscribe: callback => {
                listeners.push(callback);
                return { unsubscribe: () => listeners.splice(listeners.indexOf(callback), 1) };
            },
        };
    }

    emit(name, event = {}) {
        for (const callback of [...(this.events.get(name) || [])]) callback(event);
    }

    _loadAfterBeforeload(url) { this.loaded.push(url); }
    close() { this.closed++; }
    show() { this.shown++; }
}

function loadService() {
    const browser = new FakeBrowser();
    const nativeCalls = [];
    const zone = { run: callback => callback() };
    let govReturned;
    let secureGovBrowser;
    const govUrls = [];
    const modules = {
        '@angular/core': {
            Injectable: () => value => value,
            NgZone: class NgZone {},
            inject: token => token.name === 'NgZone' ? zone
                : token.name === 'PainelAvaService' ? { acquireInAppBrowserLease: async () => () => {} }
                : secureGovBrowser,
        },
        '@static/opener': { CoreOpener: { openInApp: (url, options) => {
            nativeCalls.push({ url, options });
            return browser;
        } } },
        './govbr-browser.service': {
            GovBrBrowserService: class {},
            isGovBrAuthorizationUrl: url => {
                try {
                    const parsed = new URL(url);
                    return parsed.protocol === 'https:' && parsed.hostname === 'sso.acesso.gov.br'
                        && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443');
                } catch {
                    return false;
                }
            },
        },
        './painel-ava.service': { PainelAvaService: class PainelAvaService {} },
    };
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
        module,
        exports: module.exports,
        URL,
        require: id => modules[id],
    });

    secureGovBrowser = {
        open: (url, returned) => {
            govUrls.push(url);
            govReturned = returned;
            return Promise.resolve('custom-tab');
        },
    };
    const service = new module.exports.SuapProfileBrowserService();

    return {
        service,
        browser,
        nativeCalls,
        govUrls,
        isAllowedInternalBrowserNavigation: module.exports.isAllowedInternalBrowserNavigation,
        isAllowedSuapProfileNavigation: module.exports.isAllowedSuapProfileNavigation,
        returnFromGov: () => govReturned?.(),
    };
}

test('Perfil SUAP aceita apenas HTTPS no host oficial, sem credenciais ou porta alternativa', () => {
    const { isAllowedSuapProfileNavigation } = loadService();

    assert.equal(isAllowedSuapProfileNavigation('https://suap.ifrn.edu.br/comum/minha_conta/'), true);
    assert.equal(isAllowedSuapProfileNavigation('https://suap.ifrn.edu.br/accounts/login/?next=%2Fcomum%2Fminha_conta%2F'), true);
    for (const url of [
        'http://suap.ifrn.edu.br/comum/minha_conta/',
        'https://suap.ifrn.edu.br.attacker.test/comum/minha_conta/',
        'https://user@suap.ifrn.edu.br/comum/minha_conta/',
        'https://suap.ifrn.edu.br:444/comum/minha_conta/',
        ' https://suap.ifrn.edu.br/comum/minha_conta/',
        'not a URL',
    ]) {
        assert.equal(isAllowedSuapProfileNavigation(url), false, url);
    }
});

test('páginas de ajuda aceitam seus hosts e links curtos exatos, sem liberar outros redirecionadores', () => {
    const { isAllowedInternalBrowserNavigation } = loadService();
    const helpPage = {
        title: 'AVA (Moodle)',
        url: 'https://bit.ly/41734xv',
        allowedHosts: ['suap.ifrn.edu.br'],
        allowedUrls: ['https://bit.ly/41734xv'],
    };

    assert.equal(isAllowedInternalBrowserNavigation(helpPage.url, helpPage), true);
    assert.equal(isAllowedInternalBrowserNavigation('https://suap.ifrn.edu.br/accounts/login/', helpPage), true);
    for (const url of [
        'https://bit.ly/outro-link',
        'https://suap.ifrn.edu.br.attacker.test/accounts/login/',
        'http://suap.ifrn.edu.br/accounts/login/',
        'https://user@suap.ifrn.edu.br/accounts/login/',
        'https://suap.ifrn.edu.br:444/accounts/login/',
    ]) {
        assert.equal(isAllowedInternalBrowserNavigation(url, helpPage), false, url);
    }
});

test('página de ajuda reutiliza o mesmo InAppBrowser e rejeita uma segunda janela simultânea', async () => {
    const { service, browser, nativeCalls } = loadService();
    const page = {
        title: 'Central de Ajuda',
        url: 'https://ajuda.ead.ifrn.edu.br/',
        allowedHosts: ['ajuda.ead.ifrn.edu.br'],
    };
    const states = [];

    service.openPage(page, { onReady: () => states.push('ready'), onError: message => states.push(message), onExit: () => {} });
    service.openPage(page, { onReady: assert.fail, onError: message => states.push(message), onExit: () => {} });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(nativeCalls.length, 1);
    assert.equal(nativeCalls[0].url, page.url);
    assert.match(states[0], /já existe uma página aberta/i);
    browser.emit('loadstop', { url: page.url });
    assert.deepEqual(states.slice(1), ['ready']);
});

test('Perfil usa InAppBrowser interno, mantém cookies e mostra a página somente após o primeiro loadstop seguro', async () => {
    const { service, browser, nativeCalls } = loadService();
    const states = [];
    const profileUrl = 'https://suap.ifrn.edu.br/comum/minha_conta/';

    service.open({ onReady: () => states.push('ready'), onError: message => states.push(message), onExit: () => states.push('exit') });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(nativeCalls.length, 1);
    assert.equal(nativeCalls[0].url, profileUrl);
    assert.equal(nativeCalls[0].options.hidden, 'yes');
    assert.equal(nativeCalls[0].options.ifrnlayoutfullscreen, 'yes');
    assert.equal(nativeCalls[0].options.location, 'yes');
    assert.equal(nativeCalls[0].options.footer, 'no');
    assert.equal(nativeCalls[0].options.hardwareback, 'yes');
    assert.equal('closebuttoncaption' in nativeCalls[0].options, false);
    assert.equal(nativeCalls[0].options.clearcache, 'no');
    assert.equal(nativeCalls[0].options.clearsessioncache, 'no');
    assert.equal(nativeCalls[0].options.cleardata, 'no');

    browser.emit('beforeload', { url: profileUrl });
    assert.deepEqual(browser.loaded, [profileUrl]);
    assert.equal(browser.shown, 0);

    browser.emit('loadstop', { url: profileUrl });
    assert.equal(browser.shown, 1);
    assert.deepEqual(states, ['ready']);

    browser.emit('exit', { url: profileUrl });
    assert.deepEqual(states, ['ready', 'exit']);
});

test('a tela Angular de espera usa a superfície neutra do tema IFRN', () => {
    const styles = fs.readFileSync(path.join(root, 'painel', 'painel.scss'), 'utf8');

    assert.match(styles, /ion-modal\.ifrn-suap-profile-modal[\s\S]*?--background:\s*var\(--ifrn-canvas/);
    assert.match(styles, /\.suap-profile-screen__content\s*\{\s*--background:\s*var\(--ifrn-canvas/);
});

test('navegação fora do SUAP é bloqueada e apresentada como erro recuperável', async () => {
    const { service, browser } = loadService();
    const errors = [];

    service.open({ onReady: assert.fail, onError: message => errors.push(message), onExit: () => {} });
    await new Promise(resolve => setImmediate(resolve));
    browser.emit('beforeload', { url: 'https://example.test/profile' });

    assert.equal(browser.loaded.length, 0);
    assert.equal(browser.closed, 1);
    assert.match(errors[0], /não autorizado/i);
    browser.emit('exit');
});

test('redirecionamento Gov.br fecha o InAppBrowser e usa somente o navegador seguro', async () => {
    const { service, browser, govUrls, returnFromGov } = loadService();
    const states = [];
    const govUrl = 'https://sso.acesso.gov.br/authorize?state=synthetic&authorization_id=synthetic';
    const helpPage = {
        title: 'AVA (Moodle)',
        url: 'https://ajuda.ead.ifrn.edu.br/',
        allowedHosts: ['ajuda.ead.ifrn.edu.br'],
    };

    service.openPage(helpPage, { onReady: assert.fail, onError: message => states.push(message), onExit: () => states.push('exit') });
    await new Promise(resolve => setImmediate(resolve));
    browser.emit('beforeload', { url: govUrl });
    assert.equal(browser.loaded.length, 0);
    assert.equal(browser.closed, 1);
    browser.emit('exit');
    await Promise.resolve();

    assert.deepEqual(govUrls, [govUrl]);
    assert.deepEqual(states, []);
    returnFromGov();
    assert.match(states[0], /autenticação Gov\.br.*AVA \(Moodle\)/);
    assert.doesNotMatch(states[0], /synthetic|authorization_id/);
});

test('o link do perfil envia um comando same-origin ao Angular sem target externo', () => {
    const html = fs.readFileSync(path.join(root, 'mobilemoodle', 'index.html'), 'utf8');
    const sidebar = fs.readFileSync(path.join(root, 'mobilemoodle', 'core_mobile', 'app-sidebar.ts'), 'utf8');
    const bundle = fs.readFileSync(path.join(root, 'mobilemoodle', 'mobilemoodle.js'), 'utf8');
    const painel = fs.readFileSync(path.join(root, 'painel', 'painel.ts'), 'utf8');
    const template = fs.readFileSync(path.join(root, 'painel', 'painel.html'), 'utf8');
    const serviceSource = fs.readFileSync(servicePath, 'utf8');

    assert.match(html, /id="profile-suap-link" href="https:\/\/suap\.ifrn\.edu\.br\/comum\/minha_conta\/"/);
    assert.doesNotMatch(html, /id="profile-suap-link"[^>]*target=/);
    assert.match(sidebar, /postIfrnHostMessage\(\{ type: 'MOODLE_IFRN_OPEN_SUAP_PROFILE' \}\)/);
    assert.match(sidebar, /window\.alert\('.*Perfil SUAP dentro do aplicativo/);
    assert.doesNotMatch(sidebar, /window\.open\s*\(/);
    const bridgeCall = bundle.indexOf('MOODLE_IFRN_OPEN_SUAP_PROFILE');
    assert.notEqual(bridgeCall, -1, 'the generated mobilemoodle.js must include the Angular bridge action');
    const generatedHandler = bundle.slice(bridgeCall - 300, bridgeCall + 300);
    assert.doesNotMatch(generatedHandler, /window\.open\s*\(/);
    assert.match(painel, /event\.origin !== window\.location\.origin/);
    assert.match(painel, /case 'MOODLE_IFRN_OPEN_SUAP_PROFILE':\s*this\.openSuapProfile\(\)/);
    assert.match(template, /<ion-title>\{\{ internalPageTitle \}\}<\/ion-title>/);
    assert.match(serviceSource, /title: 'Perfil SUAP'/);
    const helpBridgeCall = bundle.indexOf('MOODLE_IFRN_OPEN_HELP_LINK');
    assert.notEqual(helpBridgeCall, -1, 'the generated panel bundle must include the Help bridge action');
    const helpClickStart = bundle.lastIndexOf('if (helpLink)', helpBridgeCall);
    const profileClickStart = bundle.indexOf('const profileLink', helpBridgeCall);
    assert.ok(helpClickStart >= 0 && profileClickStart > helpClickStart);
    assert.doesNotMatch(bundle.slice(helpClickStart, profileClickStart), /closeModal\(\)/);
    assert.match(template, /Tentar novamente/);
    assert.match(template, /Voltar ao Painel/);
});
