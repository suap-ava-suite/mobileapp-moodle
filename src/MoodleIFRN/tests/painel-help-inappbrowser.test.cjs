const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const linksPath = path.join(root, 'services_mobile', 'painel-help-links.ts');
const linksSource = fs.readFileSync(linksPath, 'utf8');
const linksCode = ts.transpileModule(linksSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const linksModule = { exports: {} };
vm.runInNewContext(linksCode, { module: linksModule, exports: linksModule.exports });
const links = linksModule.exports.PAINEL_HELP_LINKS;

function loadPainelPage(openPage) {
    class DomSanitizer {}
    class Router {}
    class AuthService {}
    class PainelAvaService {}
    class MoodleSiteService {}
    class SuapProfileBrowserService {}
    const dependencies = new Map([
        [DomSanitizer, { bypassSecurityTrustResourceUrl: url => url }],
        [Router, {}],
        [AuthService, {}],
        [PainelAvaService, {}],
        [MoodleSiteService, {}],
        [SuapProfileBrowserService, { openPage }],
    ]);
    const angular = {
        Component: () => component => component,
        ViewChild: () => () => {},
        inject: token => dependencies.get(token) || {},
    };
    const mocks = {
        '@angular/core': angular,
        '@angular/platform-browser': { DomSanitizer },
        '@angular/router': { Router },
        '@/core/shared.module': { CoreSharedModule: class {} },
        '@services/navigator': { CoreNavigator: {} },
        '@services/lang': { CoreLang: {} },
        '@services/platform': { CorePlatform: {} },
        '@/MoodleIFRN/services_mobile/auth.service': { AuthService },
        '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService },
        '@/MoodleIFRN/services_mobile/moodle-site.service': { MoodleSiteService },
        '../mobilemoodle/core_mobile/course-target': { resolveCourseSite: () => undefined },
        '@services/overlays/alerts': { CoreAlerts: {} },
        '../navigation/painel-host-layout': { readPainelHostLayout: () => undefined },
        '../services_mobile/suap-login-telemetry': { reportSuapDuration: () => undefined },
        '../services_mobile/suap-profile-browser.service': {
            SUAP_PROFILE_PAGE: { title: 'Perfil SUAP', url: 'https://suap.ifrn.edu.br/comum/minha_conta/', allowedHosts: ['suap.ifrn.edu.br'] },
            SuapProfileBrowserService,
        },
        '../services_mobile/painel-help-links': { getPainelHelpLink: linksModule.exports.getPainelHelpLink },
    };
    const context = {
        exports: {},
        require: id => mocks[id] || {},
        window: { location: { origin: 'https://app.ifrn.test' } },
        document: {},
        performance: require('node:perf_hooks').performance,
    };
    const panelSource = fs.readFileSync(path.join(root, 'painel', 'painel.ts'), 'utf8');
    const panelCode = ts.transpileModule(panelSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(panelCode, context, { filename: 'src/MoodleIFRN/painel/painel.ts' });

    return context.exports.PainelPage;
}

const expected = {
    'central-ajuda': ['Central de Ajuda', 'https://ajuda.ead.ifrn.edu.br/'],
    ouvidoria: ['Ouvidoria', 'https://ead.ifrn.edu.br/acesso-a-informacao/ouvidoria/'],
    contatos: ['Contatos', 'https://ajuda.ead.ifrn.edu.br/agenda-telefonica-2022-campus-natal-zona-leste/'],
    'ava-moodle': ['AVA (Moodle)', 'https://bit.ly/41734xv'],
    'secretaria-academica': ['Secretaria Acadêmica', 'https://bit.ly/3odPfis'],
    'central-servico-suap': ['Central de serviço SUAP', 'https://bit.ly/3KXiQEH'],
};

test('os seis itens mantêm título e URL originais em uma configuração local única', () => {
    assert.deepEqual(Object.keys(links), Object.keys(expected));
    const resolveLink = linksModule.exports.getPainelHelpLink;
    for (const [id, [title, url]] of Object.entries(expected)) {
        assert.equal(links[id].title, title);
        assert.equal(links[id].url, url);
        assert.ok(Array.isArray(links[id].allowedHosts));
        assert.equal(resolveLink(id).url, url);
    }
    assert.equal(resolveLink('https://attacker.example/'), undefined);

    assert.deepEqual(Array.from(links['ava-moodle'].allowedUrls), ['https://bit.ly/41734xv']);
    assert.deepEqual(Array.from(links['secretaria-academica'].allowedUrls), ['https://bit.ly/3odPfis']);
    assert.deepEqual(Array.from(links['central-servico-suap'].allowedUrls), ['https://bit.ly/3KXiQEH']);
});

test('links de Ajuda não usam target externo e encaminham somente o identificador ao host Angular', () => {
    const html = fs.readFileSync(path.join(root, 'mobilemoodle', 'index.html'), 'utf8');
    const anchors = [...html.matchAll(/<a\b([^>]*data-ifrn-help-id="[^"]+"[^>]*)>([^<]*)<\/a>/g)];
    assert.equal(anchors.length, 6);

    for (const [, attributes, label] of anchors) {
        const id = attributes.match(/data-ifrn-help-id="([^"]+)"/)?.[1];
        assert.ok(id && expected[id], `unexpected help id: ${id}`);
        assert.match(attributes, new RegExp(`href="${links[id].url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
        assert.equal(label, links[id].title);
        assert.doesNotMatch(attributes, /\btarget\s*=/i);
    }

    const sidebar = fs.readFileSync(path.join(root, 'mobilemoodle', 'core_mobile', 'app-sidebar.ts'), 'utf8');
    const panel = fs.readFileSync(path.join(root, 'painel', 'painel.ts'), 'utf8');
    const browserService = fs.readFileSync(path.join(root, 'services_mobile', 'suap-profile-browser.service.ts'), 'utf8');
    assert.match(sidebar, /MOODLE_IFRN_OPEN_HELP_LINK', helpId/);
    const helpHandler = sidebar.match(/const helpLink =[\s\S]*?if \(helpLink\) \{([\s\S]*?)\n\s*}\n\n\s*const profileLink/)?.[1];
    assert.ok(helpHandler, 'help click handler should exist');
    assert.doesNotMatch(helpHandler, /closeModal\(\)/, 'keep Ajuda open underneath the internal page');
    assert.match(panel, /event\.origin !== window\.location\.origin/);
    assert.match(panel, /case 'MOODLE_IFRN_OPEN_HELP_LINK':\s*this\.openHelpLink\(data\.helpId\)/);
    assert.match(panel, /getPainelHelpLink\(helpId\)/);
    assert.match(browserService, /title: 'Perfil SUAP'/);
});

test('cada uma das seis mensagens de Ajuda abre seu destino configurado dentro do app', () => {
    for (const [id, [title, url]] of Object.entries(expected)) {
        const opened = [];
        const PainelPage = loadPainelPage((...args) => opened.push(args));
        const page = new PainelPage();
        const frameWindow = {};
        page.painelFrame = { nativeElement: { contentWindow: frameWindow } };

        page.onWindowMessage({
            source: frameWindow,
            origin: 'https://app.ifrn.test',
            data: { type: 'MOODLE_IFRN_OPEN_HELP_LINK', helpId: id },
        });

        assert.equal(opened.length, 1, `${id} deve abrir uma página interna`);
        assert.equal(opened[0][0].title, title);
        assert.equal(opened[0][0].url, url);
        assert.equal(page.internalPageTitle, title);
        assert.equal(page.internalPageLoading, true);
    }
});

test('mensagem de Ajuda ignora origem, iframe e identificador não autorizados', () => {
    const opened = [];
    const PainelPage = loadPainelPage((...args) => opened.push(args));
    const page = new PainelPage();
    const frameWindow = {};
    page.painelFrame = { nativeElement: { contentWindow: frameWindow } };

    for (const event of [
        { source: frameWindow, origin: 'https://attacker.example', data: { type: 'MOODLE_IFRN_OPEN_HELP_LINK', helpId: 'central-ajuda' } },
        { source: {}, origin: 'https://app.ifrn.test', data: { type: 'MOODLE_IFRN_OPEN_HELP_LINK', helpId: 'central-ajuda' } },
        { source: frameWindow, origin: 'https://app.ifrn.test', data: { type: 'MOODLE_IFRN_OPEN_HELP_LINK', helpId: 'https://attacker.example/' } },
    ]) {
        page.onWindowMessage(event);
    }

    assert.equal(opened.length, 0);
});
