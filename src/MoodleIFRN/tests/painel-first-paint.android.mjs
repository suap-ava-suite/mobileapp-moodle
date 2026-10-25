// Android WebView real via ADB forward tcp:9222 localabstract:webview_devtools_remote_<pid>.
// Simula JS indisponível: o tema deve limitar as logos antes do bundle executar.
import assert from 'node:assert/strict';

const targets = await (await fetch('http://localhost:9222/json')).json();
const target = targets.find(item => item.type === 'page' && item.url.startsWith('http://localhost/'));
assert.ok(target, 'WebView do aplicativo não encontrado');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
try {
    const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout da inspeção')), 20000);
        ws.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.id === 1) {
                clearTimeout(timer);
                resolve(message.result);
            }
        };
        ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{awaitPromise:true,returnByValue:true,
            expression:`(async () => {
                const base = new URL('/mobilemoodle/', location.origin).href;
                const html = await (await fetch(base + 'index.html')).text();
                const results = [];
                for (const styled of [false, true]) {
                    const frame = document.createElement('iframe');
                    frame.sandbox = 'allow-same-origin';
                    frame.style.cssText = 'position:fixed;left:-10000px;width:360px;height:720px';
                    try {
                        const loaded = new Promise((resolve,reject) => {
                            frame.onload = resolve;
                            frame.onerror = reject;
                        });
                        frame.srcdoc = html.replace('<head>', '<head><base href="' + base + '">')
                            .replace(/<link id="ifrn-panel-theme"[^>]*>/, match => styled ? match : '');
                        document.body.appendChild(frame);
                        await loaded;
                        const doc = frame.contentDocument;
                        const logo = doc.querySelector('.ava-header-logo');
                        const splash = doc.querySelector('.ava-splash__logo');
                        results.push({styled,headerHeight:logo.getBoundingClientRect().height,
                            splashWidth:splash.getBoundingClientRect().width,
                            headerNaturalHeight:logo.naturalHeight,headerCssHeight:frame.contentWindow.getComputedStyle(logo).height,
                            bodyDisplay:frame.contentWindow.getComputedStyle(doc.body).display,
                            appDisplay:frame.contentWindow.getComputedStyle(doc.querySelector('ion-app')).display,
                            hasTheme:!!doc.querySelector('#ifrn-panel-theme')?.sheet});
                    } finally { frame.remove(); }
                }
                return results;
            })()`}}));
    });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    const [before, after] = result.result.value;
    assert.equal(before.hasTheme, false);
    assert.ok(before.headerHeight > 64, 'Controle deve reproduzir a logo grande sem tema: ' + JSON.stringify(before));
    assert.equal(after.hasTheme, true);
    assert.ok(after.headerHeight > 0 && after.headerHeight <= 36, JSON.stringify(after));
    assert.ok(after.splashWidth > 0 && after.splashWidth <= 132, JSON.stringify(after));
    console.log(JSON.stringify({before,after}));
    console.log('OK: logos limitadas no WebView mesmo sem executar o JavaScript do painel.');
} finally { ws.close(); }
