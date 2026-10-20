// CDP: evaluates a local diagnostic expression; never dumps storage or console logs.
const fs = require('node:fs');
(async () => {
    const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
    const page = pages.find(p => p.url.startsWith('http://localhost/'));
    if (!page) throw new Error('App WebView unavailable');
    const expression = fs.readFileSync(process.argv[2], 'utf8');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const timer = setTimeout(() => { socket.close(); process.exitCode = 1; }, 45000);
    socket.onopen = () => socket.send(JSON.stringify({id:1, method:'Runtime.evaluate',
        params:{expression, returnByValue:true, awaitPromise:true}}));
    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.result?.exceptionDetails) console.error('Diagnostic expression failed');
        else console.log(JSON.stringify(message.result?.result?.value, null, 2));
        socket.close();
    };
})().catch(e => { console.error(e.message); process.exitCode = 1; });
