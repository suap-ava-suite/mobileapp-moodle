const assert = require('node:assert/strict');
const vm = require('node:vm');
const test = require('node:test');
const { buildSync } = require('esbuild');

const apiBundle = buildSync({
    entryPoints: ['src/MoodleIFRN/mobilemoodle/core_mobile/api.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
}).outputFiles[0].text;

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });

    return { promise, resolve, reject };
}

function setup() {
    const dashboardRequests = [];
    const courseRequests = [];
    const window = {
        MobileMoodle: {
            ApiError: class ApiError extends Error {
                constructor(status, message) {
                    super(message);
                    this.status = status;
                }
            },
            hasPainelSession: () => true,
            fetchPainelDashboard: () => {
                const request = deferred();
                dashboardRequests.push(request);

                return request.promise;
            },
            fetchSuapCourse: () => {
                const request = deferred();
                courseRequests.push(request);

                return request.promise;
            },
        },
    };

    vm.runInNewContext(apiBundle, { window, Promise, Map, WeakSet, Date, console });

    return { api: window.MobileMoodleApi, dashboardRequests, courseRequests };
}

test('resposta de perfil anterior à invalidação não repovoa o cache após logout/troca de conta', async () => {
    const { api, dashboardRequests } = setup();
    const oldRequest = api.getDashboard();

    api.invalidateCache();
    const currentRequest = api.getDashboard();
    assert.equal(dashboardRequests.length, 2);

    dashboardRequests[1].resolve({ owner: 'conta-atual', diarios: [] });
    assert.deepEqual(await currentRequest, { owner: 'conta-atual', diarios: [] });

    dashboardRequests[0].resolve({ owner: 'conta-anterior', diarios: [] });
    await assert.rejects(oldRequest, /sessão mudou/i);

    assert.deepEqual(await api.getDashboard(), { owner: 'conta-atual', diarios: [] });
    assert.equal(dashboardRequests.length, 2);
});

test('atualizações forçadas do Painel compartilham o pedido atual e ignoram resposta antiga', async () => {
    const { api, dashboardRequests } = setup();
    const initial = api.getDashboard();
    const refresh = api.getDashboard(true);
    const duplicateRefresh = api.getDashboard(true);

    assert.equal(dashboardRequests.length, 2);
    assert.equal(refresh, duplicateRefresh);

    dashboardRequests[1].resolve({ owner: 'atual', diarios: [] });
    await refresh;
    dashboardRequests[0].resolve({ owner: 'antigo', diarios: [] });
    await initial;

    assert.deepEqual(await api.getDashboard(), { owner: 'atual', diarios: [] });
    assert.equal(dashboardRequests.length, 2);
});

test('atualização forçada do mesmo curso não permite que a resposta antiga sobrescreva a nova', async () => {
    const { api, courseRequests } = setup();
    const initial = api.getCourse(42);
    const refresh = api.getCourse(42, true);
    const duplicateRefresh = api.getCourse(42, true);

    assert.equal(courseRequests.length, 2);
    assert.equal(refresh, duplicateRefresh);

    courseRequests[1].resolve({ id: 42, name: 'curso atualizado' });
    await refresh;
    courseRequests[0].resolve({ id: 42, name: 'curso antigo' });
    await initial;

    assert.equal((await api.getCourse(42)).name, 'curso atualizado');
    assert.equal(courseRequests.length, 2);
});
