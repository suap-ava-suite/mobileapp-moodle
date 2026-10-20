// Somente leitura via CDP. Não exporta cookies, tokens, perfil nem nomes.
const fs = require('node:fs');
const path = require('node:path');
async function evaluate(page, expression) {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.close(); reject(new Error('CDP timeout')); }, 45000);
        socket.onopen = () => socket.send(JSON.stringify({id:1, method:'Runtime.evaluate',
            params:{expression, returnByValue:true, awaitPromise:true}}));
        socket.onmessage = event => {
            const result = JSON.parse(event.data);
            if (result.id !== 1) return;
            clearTimeout(timer); socket.close();
            if (result.result?.exceptionDetails) reject(new Error('CDP expression failed'));
            else resolve(result.result?.result?.value);
        };
        socket.onerror = () => {clearTimeout(timer); reject(new Error('CDP connection failed'));};
    });
}
(async () => {
    const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
    const panel = pages.find(p => p.url.startsWith('https://painel.ead.ifrn.edu.br/'));
    const app = pages.find(p => p.url.startsWith('http://localhost/'));
    const summary = {at:new Date().toISOString()};
    if (app) summary.app = await evaluate(app, `({path:location.pathname,
        hasProfile:!!sessionStorage.getItem('ifrn_painel_profile'),
        hasDashboard:!!sessionStorage.getItem('ifrn_painel_dashboard'),
        loading:!!document.querySelector('page-marketplace-ifrn .ifrn-entry-transition'),
        angularDebug:!!window.ng?.getComponent})`);
    if (panel) summary.panel = await evaluate(panel, `(async () => {
        const results = [];
        for (const route of ['/api/v1/diarios/?q=&situacao=inprogress&semestre=&disciplina=&curso=&ambiente=&page=1&page_size=9',
            '/api/v1/atualizacoes_counts/', '/api/v2/usuario/info/']) {
            const start = performance.now();
            try {
                const r = await fetch(route, {credentials:'same-origin', headers:{Accept:'application/json'},
                    signal:AbortSignal.timeout(15000)});
                const type = r.headers.get('content-type');
                let payload = null;
                if (type?.includes('json')) payload = await r.json();
                const lists = {};
                for (const key of ['diarios','coordenacoes','praticas','autoinscricoes','reutilizaveis']) {
                    if (!Array.isArray(payload?.[key])) continue;
                    lists[key] = payload[key].map(c => ({id:c.id, ambiente:c.ambiente,
                        enrolled:c.is_enrolled, keys:Object.keys(c),
                        viewurl:(() => {try {const u=new URL(c.viewurl || c.url);return u.origin+u.pathname+'?id='+u.searchParams.get('id');}catch{return null;}})()}));
                }
                results.push({route,status:r.status,type,ms:Math.round(performance.now()-start),
                    keys:payload ? Object.keys(payload) : [], lists,
                    pagination:payload?.pagination, count:payload?.count,
                    next:typeof payload?.next === 'string' ? 'present' : payload?.next});
            } catch(e) {results.push({route,error:e.name,ms:Math.round(performance.now()-start)});}
        }
        return {origin:location.origin, results};
    })()`);
    const target = path.join(__dirname,'auditoria-fluxo-2026-10-19','aparelho-leitura.json');
    fs.writeFileSync(target, JSON.stringify(summary,null,2));
    console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
