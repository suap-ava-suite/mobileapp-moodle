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
        owner: '20232014050033', until: 70_000, verified: true,
    });
    assert.equal(consumeFreshPanelProfile('20232014050033', storage, 20_000), true);
    assert.equal(storage.getItem(FRESH_PROFILE_SKIP_KEY), null);
    assert.equal(consumeFreshPanelProfile('20232014050033', storage, 20_001), false);
});

test('legacy freshness marker from a login commit does not skip server revalidation', () => {
    const storage = memoryStorage();
    const { consumeFreshPanelProfile, FRESH_PROFILE_SKIP_KEY } = load(storage);
    storage.setItem(FRESH_PROFILE_SKIP_KEY, JSON.stringify({ owner: 'synthetic-user', until: 70_000 }));
    assert.equal(consumeFreshPanelProfile('synthetic-user', storage, 10_000), false);
    assert.equal(storage.getItem(FRESH_PROFILE_SKIP_KEY), null);
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

test('first login revalidates the name before navigation and a reused profile refreshes in the background', () => {
    const painel = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const suap = fs.readFileSync('src/MoodleIFRN/services_mobile/suap-entry.service.ts', 'utf8');

    assert.match(painel, /if \(consumeFreshPanelProfile\(savedProfile\.identity\) \|\| hasVerifiedSuapDisplayName\(savedProfile\.profile\)\) \{\s*return Promise\.resolve\(false\);/);
    assert.match(painel, /refreshSavedProfileNames\(data\.profile, data\.url, origin, true,[\s\S]*?markFreshPanelProfile\(savedProfile\.identity\)/);
    assert.match(suap, /firstAccess && await this\.painel\.refreshSavedProfile\(\)[\s\S]*?this\.authService\.openMobileMoodle\('\/painel'\);/);
    assert.match(suap, /if \(!firstAccess\) \{\s*void this\.painel\.refreshSavedProfile\(\)\.catch\(\(\) => undefined\);/);
    assert.match(suap, /profile: mergeVerifiedPanelProfile\(profile, panel\.diagnosticProfile, identity\),[\s\S]*?this\.authService\.openMobileMoodle\('\/painel'\);/);
    assert.match(suap, /cancel\(\): void \{[\s\S]*?mobileAuthAttempts\.invalidate\(\);[\s\S]*?clearFreshPanelProfile\(\);/);
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

function commitHarness({ saved = false, refresh } = {}) {
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
    const identity = 'conta-ficticia';
    const profileKey = 'oauth-profile';
    const events = [];
    const save = profile => {
        const value = JSON.stringify({ identity, profile, expiresAt: Date.now() + 60_000 });
        session.setItem(profileKey, value);
        local.setItem(profileKey, value);
    };
    const read = () => JSON.parse(session.getItem(profileKey) || 'null');
    if (saved) {
        save({ identificacao: identity, nome_usual: 'Nome Usual' });
    }
    const context = {
        CoreSites: { getCurrentSite: () => null },
        MOBILE_SUAP_PENDING_KEY: 'ifrn_mobile_suap_pkce_pending_v1',
        OAUTH_PROFILE_KEY: profileKey,
        OAUTH_PROFILE_MAX_AGE_SECONDS: 60,
        FRESH_PROFILE_SKIP_KEY: telemetry.FRESH_PROFILE_SKIP_KEY,
        profileIdentity: profile => String(profile.identificacao || ''),
        readOAuthProfile: read,
        markFreshPanelProfile: owner => telemetry.markFreshPanelProfile(owner, session, 11_000),
        clearFreshPanelProfile: () => telemetry.clearFreshPanelProfile(session),
        endNativeSuapEntry() {},
        profileIdentityValue: identity,
        saveProfile: save,
        refreshProfile: () => {
            events.push('refresh');
            return refresh?.(read, save) ?? Promise.resolve(false);
        },
        navigate: () => events.push(['navigate', read().profile.nome_usual]),
        sessionStorage: session,
        localStorage: local,
        Promise,
    };
    const runnable = ts.transpileModule(`class CommitHarness {
      constructor() {
        this.staged = { profile: { identificacao: profileIdentityValue, nome_usual: 'Nom Antig' },
          dashboard: ${JSON.stringify(dashboard)}, until: Date.now() + 60_000 };
        this.authService = {
          saveOAuthSession: saveProfile,
          openMobileMoodle: route => { navigate(); this.route = route; },
        };
        this.painel = { refreshSavedProfile: refreshProfile };
        this.biometricService = { disable() {} };
        this.mobileAuthAttempts = { invalidate() {} };
        this.mobileAuthAbortController = undefined;
        this.mobileAuthLoadingAttempt = undefined;
        this.mobileCallbackProcessingAttempt = undefined;
        this.mobileLoginTimer = undefined;
      }
      ${methods.get('commit')}
      ${methods.get('cancel')}
    }; this.CommitHarness = CommitHarness;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(runnable, context);

    return { service: new context.CommitHarness(), session, telemetry, events, identity };
}

test('actual SUAP commit refreshes a reused profile in the background', async () => {
    const { service, session, telemetry, events, identity } = commitHarness({ saved: true });
    await service.commit();
    assert.equal(session.getItem(telemetry.FRESH_PROFILE_SKIP_KEY), null);
    assert.equal(session.getItem('ifrn_painel_owner'), identity);
    assert.equal(JSON.parse(session.getItem('ifrn_painel_dashboard')).diarios[0].id, 43);
    assert.equal(service.route, '/painel');
    assert.deepEqual(events, [['navigate', 'Nom Antig'], 'refresh']);
});

test('first SUAP login consumes the corrected official name before opening the Panel', async () => {
    let complete;
    const { service, session, telemetry, events, identity } = commitHarness({
        refresh: (read, save) => new Promise(resolve => {
            complete = () => {
                save({ ...read().profile, nome_usual: 'Nome Usual' });
                resolve(true);
            };
        }),
    });
    const opening = service.commit();
    assert.equal(service.route, undefined);
    assert.deepEqual(events, ['refresh']);
    complete();
    await opening;
    assert.deepEqual(events, ['refresh', ['navigate', 'Nome Usual']]);
    assert.equal(session.getItem('ifrn_painel_owner'), identity);
    assert.equal(telemetry.consumeFreshPanelProfile(identity, session, 11_001), true);
});

test('cancelled first SUAP login cannot navigate after a late profile response', async () => {
    let complete;
    const { service, events } = commitHarness({ refresh: () => new Promise(resolve => { complete = resolve; }) });
    const opening = service.commit();
    service.cancel();
    complete(false);
    await opening;
    assert.deepEqual(events, ['refresh']);
    assert.equal(service.route, undefined);
});
