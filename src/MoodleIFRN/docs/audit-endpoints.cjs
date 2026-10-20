// Consultas públicas, sem cookies/tokens, sem executar operações que alteram estado.
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'auditoria-fluxo-2026-10-19');
const panel = 'https://ava.ifrn.edu.br';
const suap = 'https://suap.ifrn.edu.br';
const cases = [];
function add(base, method, route, body) { cases.push({ base, method, route, body }); }
for (const route of ['/', '/api/v1/diarios/', '/api/v1/diarios/?page=1&page_size=9&ambiente=',
    '/api/v1/progresso/', '/api/v1/atualizacoes_counts/', '/api/v2/usuario/info/',
    '/api/v2/usuario/preferencia/', '/api/v2/sala/tipo/', '/api/v2/sala/tipo/quantidades/',
    ...['inicio', 'diario', 'coordenacao', 'laboratorio', 'autoinscricoes', 'backup'].map(t => '/api/v2/sala/tipo/' + t + '/'),
    '/api/v2/notificacao/', '/api/v2/conversa/', '/get_tour_status/']) add(panel, 'GET', route);
for (const route of ['/api/v1/authenticate/', '/api/v1/verify/', '/api/v2/token/pair/',
    '/api/v2/token/refresh/', '/api/v2/token/verify/']) add(panel, 'POST', route, {});
for (const route of ['/api/rh/eu/', '/api/ensino/meus-periodos-letivos/', '/api/ensino/meus-diarios/',
    '/api/docs/', '/api/openapi.json']) add(suap, 'GET', route);
for (const route of ['/api/token/pair', '/api/token/refresh', '/api/token/verify']) add(suap, 'POST', route, {});
for (const base of ['https://academico.ava.ifrn.edu.br', 'https://presencial.ava.ifrn.edu.br']) {
    add(base, 'GET', '/lib/ajax/service.php?info=tool_mobile_get_public_config');
    add(base, 'POST', '/lib/ajax/service.php?info=tool_mobile_get_public_config',
        [{index: 0, methodname: 'tool_mobile_get_public_config', args: {}}]);
}
async function probe(test) {
    const start = performance.now();
    const chain = [];
    let url = test.base + test.route;
    try {
        for (let hop = 0; hop < 6; hop++) {
            const response = await fetch(url, { method: test.method, redirect: 'manual',
                headers: {Accept: 'application/json', ...(test.body ? {'Content-Type': 'application/json'} : {})},
                ...(test.body ? {body: JSON.stringify(test.body)} : {}), signal: AbortSignal.timeout(15000) });
            const type = response.headers.get('content-type');
            const location = response.headers.get('location');
            const safeUrl = u => { const p = new URL(u); return p.origin + p.pathname; };
            chain.push({url: safeUrl(url), status: response.status, type,
                ...(location ? {location: safeUrl(new URL(location, url))} : {})});
            if ([301, 302, 307, 308].includes(response.status) && location) {
                const next = new URL(location, url);
                // Nenhum Authorization/cookie é enviado. Só segue hosts institucionais.
                if (next.protocol !== 'https:' || !next.hostname.endsWith('.ifrn.edu.br')) break;
                url = next.href;
                await response.body?.cancel();
                continue;
            }
            const body = await response.text();
            let shape;
            if (type?.includes('json')) {
                try {
                    const parsed = JSON.parse(body);
                    shape = Array.isArray(parsed) ? {type: 'array', count: parsed.length,
                        firstKeys: Object.keys(parsed[0] || {})} : {type: typeof parsed, keys: Object.keys(parsed || {})};
                    if (test.route.includes('get_public_config') && Array.isArray(parsed)) {
                        const data = parsed[0]?.data;
                        shape.publicConfig = data ? {wwwroot: data.wwwroot, typeoflogin: data.typeoflogin,
                            identityproviders: (data.identityproviders || []).map(p => ({name:p.name,
                                url: p.url ? safeUrl(p.url) : undefined}))} : undefined;
                    }
                } catch { shape = {type: 'invalid-json'}; }
            } else shape = {type: 'html-or-text', loginForm: /type=["']password|name=["']password/i.test(body)};
            return {...test, authentication: 'nenhuma enviada', chain, shape, ms: Math.round(performance.now() - start)};
        }
        return {...test, chain, ms: Math.round(performance.now() - start), error: 'redirect-limit-or-host'};
    } catch (e) { return {...test, chain, ms: Math.round(performance.now() - start), error: e.name}; }
}
(async () => {
    const results = [];
    for (let i = 0; i < cases.length; i += 3) {
        results.push(...await Promise.all(cases.slice(i, i + 3).map(probe)));
    }
    fs.mkdirSync(output, {recursive: true});
    fs.writeFileSync(path.join(output, 'endpoints-publicos.json'), JSON.stringify({
        at: new Date().toISOString(), context: 'Node fetch, sem sessão; corpos POST vazios validam somente o contrato de erro', results,
    }, null, 2));
    console.log(JSON.stringify(results.map(r => ({method:r.method,route:r.route,status:r.chain.at(-1)?.status,ms:r.ms,error:r.error}))));
})().catch(e => {console.error(e.name); process.exitCode = 1;});
