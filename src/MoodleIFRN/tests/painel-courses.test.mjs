import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../services_mobile/painel-courses.ts', import.meta.url), 'utf8');
const js = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
const course = (ambiente, id, name = '') => ({ ambiente: { id: ambiente }, id, fullname: name });
const page = (diarios = [], extra = {}) => ({ diarios, autoinscricoes: [course(3, 1)], ...extra });
function setup(pages, progress = { progresso: [] }) {
    const calls = [];
    const context = vm.createContext({
        module: { exports: {} }, URL, AbortController, AbortSignal, Map, Set, setTimeout, clearTimeout,
        location: { origin: 'https://ava.ifrn.edu.br' },
        fetch: async (path, options) => {
            assert.equal(options.credentials, 'same-origin');
            calls.push(path);
            const url = new URL(path, 'https://ava.ifrn.edu.br');
            const data = url.pathname.endsWith('/progresso/') ? progress : pages[Number(url.searchParams.get('page')) - 1];
            if (data instanceof Error) throw data;
            assert.ok(data, 'Requisição de página inesperada');
            return { ok: true, headers: { get: () => 'application/json' }, json: async () => data };
        },
    });
    vm.runInContext(js, context);
    // Valida também a função serializada que será executada no InAppBrowser.
    const fn = vm.runInContext(`(${context.module.exports.PAINEL_COURSES_SCRIPT})`, context);
    return { fn, calls };
}

function setupWithFetch(fetchImpl, timers = {}) {
    const context = vm.createContext({
        module: { exports: {} }, URL, AbortController, AbortSignal, Map, Set,
        setTimeout: timers.setTimeout || setTimeout,
        clearTimeout: timers.clearTimeout || clearTimeout,
        location: { origin: 'https://ava.ifrn.edu.br' },
        fetch: fetchImpl,
    });
    vm.runInContext(js, context);
    return vm.runInContext(`(${context.module.exports.PAINEL_COURSES_SCRIPT})`, context);
}

test('reúne páginas, mantém IDs iguais de ambientes distintos e encerra com vitrine repetida', async () => {
    const { fn, calls } = setup([
        page([course(1, 7)], { praticas: [course(1, 8)] }),
        page([course(2, 7)], { coordenacoes: [course(2, 9)] }),
        page(),
    ], { progresso: [{ ambiente_id: 1, id: 7, progress: 40, hasprogress: true },
        { ambiente_id: 2, id: 7, progress: 90, hasprogress: true }] });
    const data = await fn('/api/v1/diarios/?situacao=inprogress&ambiente=');
    assert.equal(data.diarios.length, 2);
    assert.equal(data.diarios[0].progress, 40);
    assert.equal(data.diarios[1].progress, 90);
    assert.equal(data.praticas.length, 1);
    assert.equal(data.coordenacoes.length, 1);
    assert.equal(data.autoinscricoes.length, 1);
    assert.equal(calls.length, 4);
    assert.match(calls[0], /situacao=inprogress/);
    assert.match(calls[0], /page_size=100/);
});
test('falha de progresso preserva os cursos', async () => {
    const { fn } = setup([page([course(1, 5)]), page()], new Error('offline'));
    assert.equal((await fn('/api/v1/diarios/')).diarios.length, 1);
});

test('integração Ninja recusa destino fora da API v1 antes de enviar cookies', async () => {
    for (const endpoint of ['https://outro.example/api/v1/diarios/', '/api/v2/sala/']) {
        const { fn, calls } = setup([]);
        await assert.rejects(fn(endpoint), /Destino de consulta/);
        assert.equal(calls.length, 0);
    }
});
test('falha numa página não entrega silenciosamente uma lista incompleta', async () => {
    const { fn } = setup([page([course(1, 5)]), new Error('offline')]);
    await assert.rejects(fn('/api/v1/diarios/'), /offline/);
});
test('rejeita corpo sem listas de cursos', async () => {
    const { fn } = setup([{ detail: 'sessão expirada' }]);
    await assert.rejects(fn('/api/v1/diarios/'), /Resposta de cursos inválida/);
});

test('trata HTTP 401, 403 e 500 sem converter falha em lista vazia', async () => {
    for (const status of [401, 403, 500]) {
        const fn = setupWithFetch(async () => ({
            status,
            ok: false,
            redirected: false,
            headers: { get: () => 'application/json' },
            json: async () => ({}),
        }));
        await assert.rejects(fn('/api/v1/diarios/'), status === 500
            ? /HTTP 500/ : /sessão do Painel AVA precisa ser renovada/);
    }
});

test('rejeita resposta sem JSON e JSON malformado', async () => {
    const wrongContentType = setupWithFetch(async () => ({
        status: 200, ok: true, redirected: false,
        headers: { get: () => 'text/html' }, json: async () => ({ diarios: [] }),
    }));
    await assert.rejects(wrongContentType('/api/v1/diarios/'), /HTTP 200/);

    const invalidJson = setupWithFetch(async () => ({
        status: 200, ok: true, redirected: false,
        headers: { get: () => 'application/json' }, json: async () => { throw new SyntaxError('invalid JSON'); },
    }));
    await assert.rejects(invalidJson('/api/v1/diarios/'), /invalid JSON/);
});

test('timeout aborta a requisição idempotente de leitura e propaga erro', async () => {
    const scheduled = [];
    const fn = setupWithFetch((_path, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('request aborted')));
    }), {
        setTimeout: callback => { scheduled.push(callback); return scheduled.length; },
        clearTimeout: () => {},
    });
    const pending = fn('/api/v1/diarios/');
    assert.equal(scheduled.length, 1);
    scheduled[0]();
    await assert.rejects(pending, /request aborted/);
});

test('conexão recusada na consulta principal é propagada; falha no progresso é opcional', async () => {
    const refused = setupWithFetch(async () => { throw new TypeError('connection refused'); });
    await assert.rejects(refused('/api/v1/diarios/'), /connection refused/);

    let requests = 0;
    const progressUnavailable = setupWithFetch(async path => {
        requests++;
        if (path.startsWith('/api/v1/progresso/')) throw new TypeError('offline');
        return {
            status: 200, ok: true, redirected: false,
            headers: { get: () => 'application/json' },
            json: async () => ({ diarios: [course(1, 42)] }),
        };
    });
    const result = await progressUnavailable('/api/v1/diarios/');
    assert.equal(requests, 3);
    assert.equal(result.diarios.length, 1);
});

test('script continua autônomo após transformação async de produção e minificação', async () => {
    const { transformSync: babelTransform } = await import('@babel/core');
    const transformed = babelTransform(js, {
        configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-async-to-generator'],
    }).code;
    const production = transformSync(transformed, { minify: true, target: 'es2020' }).code;
    const exportsContext = vm.createContext({ module: { exports: {} } });
    vm.runInContext(production, exportsContext);
    const browser = vm.createContext({
        URL, AbortController, AbortSignal, setTimeout, clearTimeout,
        location: { origin: 'https://ava.ifrn.edu.br' },
        fetch: async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ diarios: [] }) }),
    });
    // A janela do SUAP não possui os helpers ou variáveis do bundle Angular.
    const data = await vm.runInContext(`${exportsContext.module.exports.PAINEL_COURSES_SCRIPT}('/api/v1/diarios/')`, browser);
    assert.equal(data.diarios.length, 0);
});
