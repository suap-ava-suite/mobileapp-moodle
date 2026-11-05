const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'services_mobile', 'govbr-redirect-handoff.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
vm.runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: () => ({
        isGovBrAuthenticationUrl: value => {
            try {
                const url = new URL(value);

                return url.protocol === 'https:' && (url.hostname === 'gov.br' || url.hostname.endsWith('.gov.br'));
            } catch {
                return false;
            }
        },
    }),
    Date,
});

test('Gov.br redirect mantém os parâmetros originais em memória e pode ser consumido uma vez', () => {
    const handoff = new compiledModule.exports.GovBrRedirectHandoff();
    const redirect = 'https://sso.acesso.gov.br/authorize?state=synthetic-state&authorization_id=synthetic-id';

    assert.equal(handoff.capture(redirect, 1000), true);
    assert.equal(handoff.consume(2000), redirect);
    assert.equal(handoff.consume(2001), null);
});

test('Gov.br redirect expirado, host inválido ou cancelado não pode ser reaberto', () => {
    const handoff = new compiledModule.exports.GovBrRedirectHandoff();

    assert.equal(handoff.capture('https://sso.acesso.gov.br/authorize?state=synthetic', 1000), true);
    assert.equal(handoff.consume(61_000), null);
    assert.equal(handoff.capture('https://gov.br.example.test/authorize', 1000), false);
    assert.equal(handoff.consume(1001), null);
    assert.equal(handoff.capture('http://sso.acesso.gov.br/authorize', 1000), false);
    assert.equal(handoff.capture('https://sso.acesso.gov.br/authorize?state=synthetic', 1000), true);
    handoff.clear();
    assert.equal(handoff.consume(1001), null);
});
