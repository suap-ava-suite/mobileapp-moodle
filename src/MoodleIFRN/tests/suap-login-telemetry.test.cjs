'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync('src/MoodleIFRN/services_mobile/suap-login-telemetry.ts', 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load(storage) {
    const module = { exports: {} };
    const build = { isProduction: false, isTesting: false };
    const defaultLogs = [];
    vm.runInNewContext(compiled, {
        module, exports: module.exports, sessionStorage: storage,
        require: name => {
            if (name === '@static/logger') {
                return { CoreLogger: { getInstance: () => ({ info: line => defaultLogs.push(line) }) } };
            }
            assert.equal(name, '@/core/constants');
            return { CoreConstants: { BUILD: build } };
        },
    });
    return { ...module.exports, build, defaultLogs };
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
    };
}

test('profile refresh skip is short-lived and consumed exactly once', () => {
    const storage = memoryStorage();
    const { markFreshPanelProfile, consumeFreshPanelProfile, FRESH_PROFILE_SKIP_KEY } = load(storage);
    markFreshPanelProfile('20232014050033', storage, 10_000);

    assert.deepEqual(JSON.parse(storage.getItem(FRESH_PROFILE_SKIP_KEY)), {
        owner: '20232014050033', until: 70_000,
    });
    assert.equal(consumeFreshPanelProfile('20232014050033', storage, 20_000), true);
    assert.equal(storage.getItem(FRESH_PROFILE_SKIP_KEY), null);
    assert.equal(consumeFreshPanelProfile('20232014050033', storage, 20_001), false);
});

test('expired or malformed profile marker never skips a future refresh', () => {
    const storage = memoryStorage();
    const { markFreshPanelProfile, consumeFreshPanelProfile, FRESH_PROFILE_SKIP_KEY } = load(storage);

    markFreshPanelProfile('synthetic-user', storage, 1_000);
    assert.equal(consumeFreshPanelProfile('different-user', storage, 1_001), false);
    assert.equal(storage.getItem(FRESH_PROFILE_SKIP_KEY), null);
    storage.setItem(FRESH_PROFILE_SKIP_KEY, 'not-json');
    assert.equal(consumeFreshPanelProfile('synthetic-user', storage, 1_000), false);
    storage.setItem(FRESH_PROFILE_SKIP_KEY, 'not-a-time');
    assert.equal(consumeFreshPanelProfile('synthetic-user', storage, 1_000), false);
    assert.equal(storage.getItem(FRESH_PROFILE_SKIP_KEY), null);
});

test('timing logs contain only a bounded stage label and a numeric duration', () => {
    const { reportSuapDuration } = load(memoryStorage());
    const lines = [];
    reportSuapDuration('courses-api-response', 12.6, line => lines.push(line));
    reportSuapDuration('bad stage with matrícula', 10, line => lines.push(line));
    reportSuapDuration('20232014050033', 10, line => lines.push(line));
    reportSuapDuration('browser-flow', Number.NaN, line => lines.push(line));

    assert.equal(lines.length, 1);
    assert.deepEqual(JSON.parse(lines[0].replace(/^\[IFRN-SUAP-TIMING\] /, '')),
        { stage: 'courses-api-response', durationMs: 13 });
    assert.doesNotMatch(lines[0], /token|cookie|senha|matr[ií]cula|https?:/i);
});

test('production and testing builds suppress timing messages', () => {
    const telemetry = load(memoryStorage());
    telemetry.build.isProduction = true;
    telemetry.reportSuapDuration('courses-api-response', 12);
    telemetry.build.isProduction = false;
    telemetry.build.isTesting = true;
    telemetry.reportSuapDuration('courses-api-response', 12);

    assert.deepEqual(telemetry.defaultLogs, []);
});

test('fresh profile bypass is wired only to the post-login refresh path', () => {
    const painel = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const suap = fs.readFileSync('src/MoodleIFRN/services_mobile/suap-entry.service.ts', 'utf8');

    assert.match(painel, /if \(consumeFreshPanelProfile\(savedProfile\.identity\)\) \{\s*return Promise\.resolve\(false\);/);
    assert.match(suap, /markFreshPanelProfile\(ownerKey\);[\s\S]*?this\.authService\.openMobileMoodle\('\/painel'\);/);
    assert.match(suap, /cancel\(\): void \{\s*clearFreshPanelProfile\(\);/);
});

test('actual profile refresh method skips the redundant browser after successful SUAP commit', async () => {
    const painelSource = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const ast = ts.createSourceFile('painel-ava.service.ts', painelSource, ts.ScriptTarget.Latest, true);
    let method;
    for (const declaration of ast.statements.filter(ts.isClassDeclaration)) {
        for (const member of declaration.members) {
            if (ts.isMethodDeclaration(member) && member.name.getText(ast) === 'refreshSavedProfile') {
                method = member.getText(ast);
            }
        }
    }
    assert.ok(method, 'expected the production refresh method');

    const storage = memoryStorage();
    const telemetry = load(storage);
    telemetry.markFreshPanelProfile('synthetic-user', storage, 10_000);
    let browserOpens = 0;
    const context = {
        Promise,
        consumeFreshPanelProfile: owner => telemetry.consumeFreshPanelProfile(owner, storage, 10_001),
        readOAuthProfile: () => ({ identity: 'synthetic-user' }),
        CoreOpener: { openInApp: () => { browserOpens++; } },
    };
    const runnable = ts.transpileModule(`class PanelHarness { ${method} }; this.PanelHarness = PanelHarness;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(runnable, context);

    const result = await new context.PanelHarness().refreshSavedProfile();
    assert.equal(result, false);
    assert.equal(browserOpens, 0);
});

test('actual SUAP commit binds the one-shot profile marker and dashboard to the validated owner', () => {
    const suapSource = fs.readFileSync('src/MoodleIFRN/services_mobile/suap-entry.service.ts', 'utf8');
    const ast = ts.createSourceFile('suap-entry.service.ts', suapSource, ts.ScriptTarget.Latest, true);
    const methods = new Map();
    for (const declaration of ast.statements.filter(ts.isClassDeclaration)) {
        for (const member of declaration.members) {
            if (ts.isMethodDeclaration(member) && ['commit', 'cancel'].includes(member.name.getText(ast))) {
                methods.set(member.name.getText(ast), member.getText(ast));
            }
        }
    }
    assert.ok(methods.has('commit') && methods.has('cancel'), 'expected production commit and cancel methods');

    const session = memoryStorage();
    const local = memoryStorage();
    const telemetry = load(session);
    telemetry.markFreshPanelProfile('old-owner', session, 10_000);
    const dashboard = { diarios: [{ id: 43 }] };
    const context = {
        CoreSites: { getCurrentSite: () => null },
        OAUTH_PROFILE_KEY: 'oauth-profile',
        OAUTH_PROFILE_MAX_AGE_SECONDS: 60,
        FRESH_PROFILE_SKIP_KEY: telemetry.FRESH_PROFILE_SKIP_KEY,
        profileIdentity: profile => String(profile.identificacao || ''),
        markFreshPanelProfile: (owner, storage) => telemetry.markFreshPanelProfile(owner, storage, 11_000),
        clearFreshPanelProfile: storage => telemetry.clearFreshPanelProfile(storage),
        endNativeSuapEntry() {},
        sessionStorage: session,
        localStorage: local,
        Promise,
    };
    const runnable = ts.transpileModule(`class CommitHarness {
      constructor() {
        this.staged = { profile: { identificacao: '20232014050033' }, dashboard: ${JSON.stringify(dashboard)}, until: Date.now() + 60_000 };
        this.authService = {
          saveOAuthSession: profile => {
            const value = JSON.stringify({ identity: profile.identificacao, profile, expiresAt: 30_000 });
            sessionStorage.setItem(OAUTH_PROFILE_KEY, value);
            localStorage.setItem(OAUTH_PROFILE_KEY, value);
          },
          openMobileMoodle: route => { this.route = route; },
        };
        this.biometricService = { disable() {} };
      }
      ${methods.get('commit')}
      ${methods.get('cancel')}
    }; this.CommitHarness = CommitHarness;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(runnable, context);
    const harness = new context.CommitHarness();
    harness.commit();

    const marker = JSON.parse(session.getItem(telemetry.FRESH_PROFILE_SKIP_KEY));
    assert.equal(marker.owner, '20232014050033');
    assert.equal(marker.until, 71_000);
    assert.equal(session.getItem('ifrn_painel_owner'), '20232014050033');
    assert.equal(JSON.parse(session.getItem('ifrn_painel_dashboard')).diarios[0].id, 43);
    assert.equal(harness.route, '/painel');
});
