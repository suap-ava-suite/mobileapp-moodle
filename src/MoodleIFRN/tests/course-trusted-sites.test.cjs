const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function method(file, className, name) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const cls = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === className);
    return cls.members.find(node => node.name?.getText(source) === name).getText(source);
}
const config = JSON.parse(fs.readFileSync('moodle.config.json', 'utf8'));
const helperPath = 'src/core/features/login/services/login-helper.ts';
const sitePath = 'src/core/services/sites.ts';
function setup(allowlist) {
    const deleted = [];
    const tokens = new Map(config.sites.map(site => [site.url, 'test-token']));
    const context = {
        CoreConstants: { CONFIG: { ...config, sites: allowlist ? config.sites : [] } },
        CoreSettingsHelper: { hasEnabledStagingSites: async () => false },
        CoreLoginSiteSelectorListMethod: { SITE_FINDER: 'sitefinder' },
        CoreNative: { plugin: () => ({ deleteCollection: async id => { deleted.push(id); tokens.delete(id); } }) },
        CorePromiseUtils: { allPromisesIgnoringErrors: promises => Promise.all(promises) },
    };
    vm.createContext(context);
    const code = `class Helper {
        ${method(helperPath, 'CoreLoginHelperProvider', 'getAvailableSites')}
        ${method(helperPath, 'CoreLoginHelperProvider', 'hasSiteAllowlist')}
    }
    const CoreLoginHelper = new Helper();
    class Sites { ${method(sitePath, 'CoreSitesProvider', 'deleteTokensFromOtherSites')} }
    globalThis.provider = new Sites();`;
    vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const provider = context.provider;
    provider.sites = {};
    provider.sitesTable = { getMany: async () => config.sites.map(site => ({ id: site.url, siteUrl: site.url })) };
    provider.deleteTokensListeners = [];
    return { provider, deleted, tokens };
}
test('official trusted-site policy preserves tokens across Academic → Presencial → Academic', async () => {
    const s = setup(true);
    for (const url of ['https://academico.ava.ifrn.edu.br', 'https://presencial.ava.ifrn.edu.br',
        'https://academico.ava.ifrn.edu.br']) {
        s.provider.currentSite = { getURL: () => url };
        await s.provider.deleteTokensFromOtherSites();
        assert.equal(s.tokens.get('https://academico.ava.ifrn.edu.br'), 'test-token');
        assert.equal(s.tokens.get('https://presencial.ava.ifrn.edu.br'), 'test-token');
    }
    assert.equal(s.deleted.length, 0);
});
test('without configured trusted sites, upstream behavior reproduces token removal', async () => {
    const s = setup(false);
    s.provider.currentSite = { getURL: () => 'https://presencial.ava.ifrn.edu.br' };
    await s.provider.deleteTokensFromOtherSites();
    assert.equal(s.tokens.has('https://academico.ava.ifrn.edu.br'), false);
    assert.equal(s.tokens.has('https://presencial.ava.ifrn.edu.br'), true);
});
