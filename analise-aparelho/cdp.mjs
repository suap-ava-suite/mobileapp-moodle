import fs from 'fs';
const [,, cmd, arg] = process.argv;
const list = await (await fetch('http://localhost:9222/json')).json();
const t = list.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = {}; const t0 = Date.now();
const log = (...a) => console.log(((Date.now()-t0)/1000).toFixed(1)+'s', ...a);
const send = (m,p={}) => new Promise(r => { const i=++id; pend[i]=r; ws.send(JSON.stringify({id:i,method:m,params:p})); });
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && pend[m.id]) { pend[m.id](m.result ?? m.error); delete pend[m.id]; return; }
  if (cmd !== 'watch') return;
  if (m.method==='Network.requestWillBeSent' && (m.params.type==='Document' || /main\.|ionic|jsdelivr/.test(m.params.request.url))) log('REQ', m.params.type, m.params.request.url.slice(0,110));
  if (m.method==='Page.frameNavigated' && !m.params.frame.parentId) log('NAV', m.params.frame.url.slice(0,110));
  if (m.method==='Page.loadEventFired') log('LOAD'); };
await new Promise(r => ws.onopen = r);
if (cmd === 'eval') { const r = await send('Runtime.evaluate',{expression:fs.readFileSync(arg,'utf8'),returnByValue:true,awaitPromise:true}); console.log(r.result?.value ?? JSON.stringify(r)); ws.close(); }
if (cmd === 'watch') { await send('Network.enable'); await send('Page.enable'); await new Promise(r => setTimeout(r,(+arg||90)*1000)); ws.close(); }
