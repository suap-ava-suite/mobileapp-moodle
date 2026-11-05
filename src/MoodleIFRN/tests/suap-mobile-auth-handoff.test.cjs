const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('SUAP mobile entry opens only the system browser and preflights institutional callback', () => {
    const source = read('src/MoodleIFRN/services_mobile/suap-entry.service.ts');
    const method = source.slice(source.indexOf('async loginWithSuap('), source.indexOf('\n    constructor()'));

    assert.match(method, /\/auth\/mobile\/capability\//);
    assert.match(method, /code_challenge_method', 'S256'/);
    assert.match(method, /window\.open\(startUrl\.toString\(\), '_system'\)/);
    assert.doesNotMatch(method, /api\/v1\/authenticate/);
    assert.match(method, /if \(!capability\.ok\) \{\s*await this\.loginWithLegacySuap/);
    assert.match(source, /private async loginWithLegacySuap\([\s\S]*?authenticateWithBrowser\(\{ readOnly: true, reuseSession: false \}\)/);
});

test('mobile callback is bound to current state, short-lived PKCE, returned username and dashboard owner', () => {
    const source = read('src/MoodleIFRN/services_mobile/suap-entry.service.ts');
    const callback = source.slice(source.indexOf('private async completeMobileAuthCallback'), source.indexOf('private failMobileLogin'));

    assert.match(callback, /state !== pending\.state/);
    assert.match(callback, /pending\.verifier/);
    assert.match(callback, /Date\.now\(\) - Number\(pending\.startedAt\) > 300000/);
    assert.match(callback, /mobile-auth\/exchange/);
    assert.match(callback, /mobile-auth\/bootstrap/);
    assert.match(callback, /identity !== tokens\.username/);
    assert.match(callback, /Array\.isArray\(bootstrap\.dashboard\.diarios\)/);
    assert.match(callback, /\/api\/v2\/usuario\/info\//);
    assert.match(callback, /profileHeaders\.set\('Authorization', `Bearer \$\{tokens\.access\}`\)/);
    assert.match(callback, /if \(profileOwner === identity\)\s*\{\s*profile = mergeVerifiedPanelProfile\(profile, verifiedProfile, identity\)/);
    assert.match(callback, /profile: \{ \.\.\.profile, identificacao: identity \}/);
});

test('returning from the system browser without an OAuth callback cancels the pending mobile attempt', () => {
    const source = read('src/MoodleIFRN/services_mobile/suap-entry.service.ts');
    assert.match(source, /document\.addEventListener\('resume', \(\) => this\.handleMobileAuthResume\(\)\)/);
    assert.match(source, /private handleMobileAuthResume\(\): void/);
    assert.match(source, /this\.failMobileLogin\('Login cancelado ou interrompido/);
    assert.match(source, /}, 1500\)/);
});

test('build patch reserves only the exact app callback before Moodle site creation', () => {
    const patcher = read('src/MoodleIFRN/patch-moodle-ifrn.js');
    const core = read('src/core/services/urlschemes.ts');

    assert.match(patcher, /patchMobileAuthCallback/);
    assert.match(patcher, /--mobile-auth-callback-only/);
    assert.match(core, /callback\.hostname === 'ifrn-auth' && callback\.pathname === '\/callback'/);
    assert.ok(core.indexOf("callback.hostname === 'ifrn-auth'") < core.indexOf('if (!this.isCustomURL(url))'));
});
