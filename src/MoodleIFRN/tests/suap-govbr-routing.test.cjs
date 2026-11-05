const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function extractFunction(source, declaration) {
    const start = source.indexOf(declaration);
    assert.notEqual(start, -1, `missing ${declaration}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index++) {
        if (source[index] === '{') depth++;
        if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    assert.fail(`unterminated ${declaration}`);
}

const root = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.config.ts'), 'utf8');
const configJavaScript = ts.transpileModule(configSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const configModule = { exports: {} };
vm.runInNewContext(configJavaScript, { module: configModule, exports: configModule.exports, URL });

test('Gov.br URL detection accepts official HTTPS hosts and rejects lookalike origins', () => {
    const { isGovBrAuthenticationUrl } = configModule.exports;

    assert.equal(isGovBrAuthenticationUrl('https://sso.acesso.gov.br/authorize'), true);
    assert.equal(isGovBrAuthenticationUrl('https://gov.br/'), true);
    assert.equal(isGovBrAuthenticationUrl('http://sso.acesso.gov.br/authorize'), false);
    assert.equal(isGovBrAuthenticationUrl('https://gov.br.example.com/'), false);
    assert.equal(isGovBrAuthenticationUrl('https://example.gov.br.attacker.test/'), false);
    assert.equal(isGovBrAuthenticationUrl('not a url'), false);
});

test('Gov.br ends the in-app attempt and offers an explicit external-browser choice', () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const marketplace = fs.readFileSync(path.join(root, 'marketplace-ifrn', 'marketplace-ifrn.ts'), 'utf8');
    const template = fs.readFileSync(path.join(root, 'marketplace-ifrn', 'marketplace-ifrn.html'), 'utf8');

    assert.match(source, /hasEnteredSuapAuthentication && isGovBrAuthenticationUrl\(url\)/);
    assert.match(source, /hasEnteredSuapAuthentication = true;/);
    assert.match(source, /finishWithError\(GOVBR_MOBILE_UNAVAILABLE_MESSAGE\)/);
    assert.doesNotMatch(source, /authorization_id/);
    assert.match(source, /const loadStartSubscription = browser\.on\('loadstart'\)[\s\S]*?if \(hasEnteredSuapAuthentication && isGovBrAuthenticationUrl\(url\)\)[\s\S]*?return;/);
    assert.match(marketplace, /consumeGovBrRedirectUrl\(\)/);
    assert.match(marketplace, /this\.govBrBrowser\.open\(redirectUrl\)/);
    assert.doesNotMatch(marketplace, /window\.open\(redirectUrl, '_system'\)/);
    assert.doesNotMatch(marketplace, /window\.open\('https:\/\/suap\.ifrn\.edu\.br\/accounts\/login\//);
    assert.match(source, /this\.govBrRedirectHandoff\.capture\(url\)/);
    assert.match(source, /consumeGovBrRedirectUrl\(\): string \| null/);
    assert.match(marketplace, /error\.message === GOVBR_MOBILE_UNAVAILABLE_MESSAGE/);
    assert.match(template, /govBrBrowserReturned \? 'Você voltou ao Moodle IFRN'/);
    assert.match(template, /não criou uma sessão no aplicativo/);
    assert.match(template, /Abrir Gov\.br no navegador/);
    assert.match(template, /Voltar ao login SUAP no app/);
});

test('a delayed profile response keeps the AVA header display name when the API has no explicit alias', async () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const start = source.indexOf('var currentProfile = profileFromDocument(document');
    const endMarker = '}).catch(function () {\n                                sendSuccess(currentProfile || null);\n                            });';
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, 'expected the production profile selection code');

    let result;
    let resolveResult;
    const completed = new Promise(resolve => { resolveResult = resolve; });
    let rootRequests = 0;
    const profile = {
        matricula: 'synthetic-user', identificacao: 'synthetic-user',
        nome_usual: 'Synthetic Abbreviated Alias',
    };
    const mergeProfiles = vm.runInNewContext(`(${extractFunction(source, 'function mergeProfiles(')})`, {
        cleanName: value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '',
    });
    const context = {
        Promise,
        cleanName: value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '',
        document: {},
        setTimeout: callback => setTimeout(callback, 0),
        profileFromDocument: () => ({ matricula: 'synthetic-user', nome: 'Synthetic Full AVA Header Name',
            nome_exibicao: 'Synthetic Full AVA Header Name' }),
        sendSuccess: value => { result = value; resolveResult(); },
        mergeProfiles,
        fetchUserInfo: () => new Promise(resolve => setTimeout(() => resolve(profile), 20)),
        fetch: () => { rootRequests++; return Promise.resolve({ ok: false }); },
        parseRootProfile: () => null,
    };
    vm.runInNewContext(`(function () { ${source.slice(start, end + endMarker.length)} })();`, context);
    await completed;

    assert.equal(result.matricula, 'synthetic-user');
    assert.equal(result.nome_usual, 'Synthetic Abbreviated Alias');
    assert.equal(result.nome_exibicao, 'Synthetic Full AVA Header Name');
    assert.equal(result.nome, undefined);
    assert.equal(rootRequests, 0);
});

test('an explicit API display name wins, and a DOM alias from another identity is rejected', () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const mergeProfiles = vm.runInNewContext(`(${extractFunction(source, 'function mergeProfiles(')})`, {
        cleanName: value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '',
    });
    const apiProfile = {
        identificacao: 'synthetic-user',
        nome_exibicao: 'Synthetic Official Display Name',
        nome_registro: 'Synthetic Registered Full Name',
        nome: 'Synthetic Registered Full Name',
    };
    const staleDom = {
        nome_exibicao: 'Synthetic Stale Header Name',
        nome_usual: 'Synthetic Stale Header Name',
        foto: 'https://example.test/avatar.png',
    };
    const merged = mergeProfiles(apiProfile, staleDom);

    assert.equal(merged.nome_exibicao, 'Synthetic Official Display Name');
    assert.equal(merged.nome_usual, undefined);
    assert.equal(merged.nome_registro, 'Synthetic Registered Full Name');
    assert.equal(merged.foto, staleDom.foto);

    const apiWithoutName = mergeProfiles({ identificacao: 'synthetic-user' }, {
        matricula: 'another-synthetic-user', nome_exibicao: 'Synthetic Other Account Name',
    });
    assert.equal(apiWithoutName.nome_exibicao, undefined);
});

test('SUAP and Painel profile mappers follow the AVA web display-name precedence', () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const cleanName = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    const suapFromJson = vm.runInNewContext(`(${extractFunction(source, 'function fromJson(data, source)')})`, { cleanName });
    const panelFromUserInfo = vm.runInNewContext(
        `(${extractFunction(source, 'function profileFromUserInfo(data, source)')})`,
        { cleanName, absoluteUrl: value => value, location: { origin: 'https://ava.ifrn.edu.br' } },
    );
    const response = {
        matricula: 'synthetic-user',
        nome_usual: 'Synthetic Incomplete Usual',
        nome_registro: 'Synthetic Complete Registered Name',
    };

    for (const mapped of [suapFromJson(response, 'synthetic SUAP response'),
        panelFromUserInfo(response, 'synthetic Panel response')]) {
        assert.equal(mapped.nome_exibicao, undefined);
        assert.equal(mapped.nome, 'Synthetic Incomplete Usual');
        assert.equal(mapped.nome_registro, 'Synthetic Complete Registered Name');
        assert.equal(mapped.nome_usual, 'Synthetic Incomplete Usual');
    }

    const explicitPanelName = panelFromUserInfo({
        ...response, nome_exibicao: 'Synthetic Explicit Display Name',
    }, 'synthetic Panel response');
    assert.equal(explicitPanelName.nome_exibicao, 'Synthetic Explicit Display Name');
});
