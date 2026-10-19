// Somente categorias e códigos: nunca imprime mensagens, URLs ou dados do usuário.
const list = await (await fetch('http://localhost:9222/json')).json();
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
const findings = [];
const errors = [];
let next = 0;
const pending = new Map();
ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') {
        if (!['error','warning'].includes(m.params.type)) return;
        const args = m.params.args || [];
        if (m.params.type === 'error') errors.push(...args.filter(a=>a.objectId).map(a=>a.objectId));
        const source = args.map(a=>String(a.description || a.value || '')).join(' ');
        const patterns = source.match(/NG\d{4,5}|[A-Za-z]+Error\b|\b[A-Za-z]+Service\b|cordova_not_available|deviceready|Cannot access|before initialization|Circular dependency|NullInjector/g) || [];
        const keywords = source.match(/SQLite|WebSQL|indexedDB|database|cordova|platform|version|configuration|language|not available|not supported|not found|initialization|secure context|storage|undefined|unavailable|disabled|QuotaExceeded/gi) || [];
        findings.push({type:m.params.type,categories:[...new Set(patterns)],keywords:[...new Set(keywords)],frames:(m.params.stackTrace?.callFrames || []).slice(0,12).map(f=>({fn:f.functionName,file:f.url.split('/').pop()?.split('?')[0],line:f.lineNumber+1}))});
    }
    if (m.method === 'Runtime.exceptionThrown') findings.push({type:'uncaught',class:m.params.exceptionDetails.exception?.className || 'unknown'});
};
await new Promise(r=>ws.onopen=r);
const send = (method,params={})=>new Promise(r=>{const id=++next;pending.set(id,r);ws.send(JSON.stringify({id,method,params}));});
await send('Runtime.enable');
await new Promise(r=>setTimeout(r,1000));
for (const objectId of errors) {
    const response = await send('Runtime.getProperties',{objectId,ownProperties:true});
    const props = response.result?.result || [];
    const message = props.find(p=>p.name==='message')?.value?.value || '';
    const stack = props.find(p=>p.name==='stack')?.value?.value || '';
    const url = props.find(p=>p.name==='url')?.value?.value;
    if (url) {
        const filename = new URL(url,'http://localhost').pathname.split('/').pop();
        findings.push({type:'http',status:props.find(p=>p.name==='status')?.value?.value,file:/^[a-zA-Z_-]+\.json$/.test(filename) ? filename : '[omitido]'});
    }
    findings.push({type:'error-detail',fields:props.map(p=>p.name),keywords:message.match(/SQLite|Web\s?SQL|indexedDB|database|cordova|platform|version|configuration|language|not available|not supported|not found|initialization|secure context|storage|undefined|unavailable|disabled|QuotaExceeded|must|support|browser|development|translation|config|load|JSON|fetch|network/gi) || [],locations:stack.match(/(?:main|vendor|polyfills)\.js:\d+:\d+/g)?.slice(0,8) || []});
}
console.log(JSON.stringify(findings));
ws.close();
