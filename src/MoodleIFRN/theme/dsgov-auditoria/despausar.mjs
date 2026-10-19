// Diagnóstico CDP complementar: o cdp.mjs existente só oferece eval/watch.
const list = await (await fetch('http://localhost:9222/json')).json();
const target = list.find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let id = 0, paused = false;
const timeout = setTimeout(() => { console.log('Timeout na consulta do depurador.'); ws.close(); }, 10000);
ws.onmessage = e => {
    const message = JSON.parse(e.data);
    if (message.method === 'Debugger.paused') paused = true;
    if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
    }
};
await new Promise(r => ws.onopen = r);
const send = (method,params={}) => new Promise(resolve => {
    const next = ++id;
    pending.set(next,resolve);
    ws.send(JSON.stringify({id:next,method,params}));
});
await send('Debugger.enable');
await send('Debugger.setBreakpointsActive',{active:false});
await send('Debugger.setPauseOnExceptions',{state:'none'});
await send('Debugger.setSkipAllPauses',{skip:true});
const resume = await send('Debugger.resume');
console.log(JSON.stringify({pausedEvent:paused,resumeSucceeded:!resume.error}));
await send('Debugger.disable');
clearTimeout(timeout);
ws.close();
