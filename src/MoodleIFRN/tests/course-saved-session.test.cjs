const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const url = 'https://academico.ava.ifrn.edu.br';
function setup(entries) {
    let current;
    const sites = {
        getCurrentSite: () => current,
        isLoggedIn: () => !!current,
        loadSite: async id => { current = await sites.getSite(id); return true; },
        getSites: async () => Object.keys(entries).map(id => ({ id, siteUrl: entries[id].url || url })),
        getSiteIdsFromUrl: async () => { throw new Error('Do not eagerly load tokens from all environments'); },
        createSiteID: () => 'canonical',
        getSite: async id => {
            if (entries[id] instanceof Error) throw entries[id];
            const entry = entries[id];
            return { getId: () => id, getURL: () => entry.url || url, getInfo: () => ({ username: entry.username || '123' }),
                isLoggedOut: () => !!entry.loggedOut };
        },
    };
    const mocks = {
        '@angular/core': { Injectable: () => c => c, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({}) } },
        '@services/sites': { CoreSites: sites },
        '@static/url': { CoreUrl: { sameDomainAndPath: (a, b) => a.replace(/\/$/, '') === b.replace(/\/$/, '') } },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    const service = new context.exports.MoodleSiteService();
    service.getExpectedIdentityCandidates = () => [{ key: 'perfil.matricula', value: '123' }];
    const find = () => service.findStoredSiteIdForExpectedIdentities(url);
    find.service = service;
    find.sites = sites;
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
