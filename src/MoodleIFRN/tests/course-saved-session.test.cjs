const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const url = 'https://academico.ava.ifrn.edu.br';
function setup(entries) {
    let current;
    const session = new Map();
    const navigations = [];
    const sites = {
        getCurrentSite: () => current,
        isLoggedIn: () => !!current?.token,
        loadSite: async id => { current = await sites.getSite(id); return true; },
        getSites: async () => Object.keys(entries).map(id => ({ id, siteUrl: entries[id].url || url })),
        getSiteIdsFromUrl: async () => { throw new Error('Do not eagerly load tokens from all environments'); },
        createSiteID: () => 'canonical',
        getSite: async id => {
            if (entries[id] instanceof Error) throw entries[id];
            const entry = entries[id];
            return { getId: () => id, getURL: () => entry.url || url, getInfo: () => ({ username: entry.username || '123' }),
                token: entry.missingToken ? '' : 'test-token', isLoggedOut: () => !!entry.loggedOut };
        },
    };
    const mocks = {
        '@angular/core': { Injectable: () => c => c, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({}) } },
        '@services/sites': { CoreSites: sites },
        '@services/navigator': { CoreNavigator: { navigate: async (...args) => navigations.push(args) } },
        '@static/url': { CoreUrl: { sameDomainAndPath: (a, b) => a.replace(/\/$/, '') === b.replace(/\/$/, '') } },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL,
        sessionStorage: {
            getItem: key => session.get(key) ?? null,
            setItem: (key, value) => session.set(key, value),
            removeItem: key => session.delete(key),
        },
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    const service = new context.exports.MoodleSiteService();
    service.getExpectedIdentityCandidates = () => [{ key: 'perfil.matricula', value: '123' }];
    const find = () => service.findStoredSiteIdForExpectedIdentities(url);
    find.service = service;
    find.sites = sites;
    find.session = session;
    find.navigations = navigations;
    return find;
}
test('restores a valid historical session even when canonical entry is logged out', async () => {
    assert.equal(await setup({ canonical: { loggedOut: true }, historical: {} })(), 'historical');
});
test('canonical ID never substitutes account and environment verification', async () => {
    assert.equal(await setup({ canonical: { username: '456' }, wrongEnvironment: {
        url: 'https://presencial.ava.ifrn.edu.br',
    } })(), undefined);
});
test('read failures propagate instead of triggering browser authentication', async () => {
    const error = new Error('storage unavailable');
    await assert.rejects(setup({ canonical: error }), error);
});
test('explicitly logged out account is returned only when no usable session exists', async () => {
    assert.equal(await setup({ canonical: { loggedOut: true } })(), 'canonical');
});

test('after restart, restores the saved matching account and subsequently reuses current session', async () => {
    const s = setup({ canonical: {} });
    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'loaded-stored');
    s.sites.getSites = async () => { throw new Error('Current session needs no database lookup'); };
    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'matched-current');
});

test('secure storage failure in another environment never affects the selected session', async () => {
    const unrelated = Object.assign(new Error('secure storage unavailable'), { url: 'https://presencial.ava.ifrn.edu.br' });
    const s = setup({ unrelated, canonical: {} });
    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'loaded-stored');
});

test('metadata read failure is propagated instead of being classified as missing session', async () => {
    const s = setup({});
    s.sites.getSites = async () => { throw new Error('metadata unavailable'); };
    await assert.rejects(() => s.service.ensureMatchingMoodleSession(url), /metadata unavailable/);
});

test('account metadata without a native token offers connection instead of loading an unusable session', async () => {
    const s = setup({ canonical: { missingToken: true } });
    s.sites.loadSite = async () => assert.fail('Metadata without token must not activate the account');
    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'need-oauth');
});

test('a tokenless canonical entry does not hide a usable historical session', async () => {
    const s = setup({ canonical: { missingToken: true }, historical: {} });
    assert.equal(await s(), 'historical');
});

test('a previous Moodle account requests connection for the new Panel account without reusing the old session', async () => {
    const s = setup({ previous: { username: '456' } });
    await s.sites.loadSite('previous');
    const previous = s.sites.getCurrentSite();
    s.service.getPendingOpenCourse = () => ({ courseId: 42, siteUrl: url });
    s.service.openCourseById = async () => assert.fail('The previous account cannot open the selected course');
    s.service.reportCourseAccessIssue = () => assert.fail('A previous session is not a failed new callback');

    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'need-oauth');
    assert.strictEqual(s.sites.getCurrentSite(), previous, 'Session inspection must not publish another account');
    assert.equal(s.session.has('ifrn_moodle_identity_mismatch'), false);
    assert.equal(s.navigations.length, 0);
});

test('a changed Panel account restores its own stored session and then reuses it without another connection', async () => {
    const s = setup({ previous: { username: '456' }, canonical: {} });
    await s.sites.loadSite('previous');

    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'loaded-stored');
    assert.equal(s.sites.getCurrentSite().getInfo().username, '123');
    s.sites.getSites = async () => assert.fail('The matching current session needs no storage lookup');
    assert.equal(await s.service.ensureMatchingMoodleSession(url), 'matched-current');
});

test('a previous session cannot authorize a course when the new Panel identity is missing', async () => {
    const s = setup({ previous: { username: '456' } });
    await s.sites.loadSite('previous');
    s.service.getExpectedIdentityCandidates = () => [];

    await assert.rejects(() => s.service.ensureMatchingMoodleSession(url), /confirmar sua conta/);
    assert.equal(s.sites.getCurrentSite().getInfo().username, '456');
    assert.equal(s.navigations.length, 0);
});

test('a new OAuth return for a different account remains blocked without restarting authentication', async () => {
    const s = setup({ previous: { username: '456' } });
    await s.sites.loadSite('previous');
    s.service.getPendingOpenCourse = () => ({ courseId: 42, siteUrl: url });
    s.service.hideNativeCourseHandoff = () => {};
    s.service.clearCourseOriginFlags = () => {};
    s.service.openCourseById = async () => assert.fail('A mismatched OAuth return cannot open a course');
    s.service.startSuapOAuthLogin = async () => assert.fail('A mismatched OAuth return cannot restart automatically');

    await s.service.afterOAuthLogin();

    assert.equal(s.service.isIdentityMismatchPending(), true);
    assert.equal(s.service.lastCourseAccessIssue.kind, 'identity-mismatch');
    assert.equal(s.navigations.length, 1);
    assert.equal(s.navigations[0][0], '/login/moodle-open-course');
    assert.equal(s.navigations[0][1].params.identityOnly, true);
    assert.equal(s.navigations[0][1].params.courseId, 42);
    assert.equal(s.sites.getCurrentSite().getInfo().username, '456');
});
