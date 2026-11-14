/* Read-only CDP diagnostics. Never reads response bodies, headers, storage or credentials. */
const fs = require('node:fs');
const ts = require('typescript');

/** Allowlists fields before a WebView event can reach the terminal or report. */
function safeNativeTimingEvent(value, operationId) {
    if (!value || !/^[a-z0-9-]{1,48}$/.test(value.stage) || !Number.isFinite(value.at) || value.at < 0) return null;
    return { operationId, stage: value.stage, at: value.at,
        ...(typeof value.inAngularZone === 'boolean' ? { inAngularZone: value.inAngularZone } : {}),
        ...(typeof value.reason === 'string' && /^[a-z-]{1,32}$/.test(value.reason) ? { reason: value.reason } : {}) };
}

async function connect() {
    const pages = await (await fetch('http://127.0.0.1:9483/json')).json();
    const page = pages.find(p => { try { return new URL(p.url).origin === 'http://localhost'; } catch { return false; } });
    if (!page) throw new Error('Main local WebView unavailable');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const pending = new Map();
    const listeners = new Map();
    let sequence = 0;
    ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.id) {
            const p = pending.get(m.id);
            if (!p) return;
            pending.delete(m.id);
            clearTimeout(p.timer);
            m.error ? p.reject(new Error('CDP command failed: ' + p.method)) : p.resolve(m.result);
        } else for (const listener of listeners.get(m.method) || []) listener(m.params);
    };
    return {
        on(method, fn) { listeners.set(method, [...listeners.get(method) || [], fn]); },
        rpc(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = ++sequence;
                const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
                pending.set(id, { resolve, reject, timer, method });
                ws.send(JSON.stringify({ id, method, params }));
            });
        },
        close() { ws.close(); },
    };
}

async function discover(cdp) {
    const scripts = new Map();
    cdp.on('Debugger.scriptParsed', s => {
        if (/^http:\/\/localhost\/(?:main|\d+)[^/]*\.js$/.test(s.url)) scripts.set(s.scriptId, s);
    });
    await cdp.rpc('Debugger.enable');
    const matches = [];
    for (const s of scripts.values()) {
        const { scriptSource } = await cdp.rpc('Debugger.getScriptSource', { scriptId: s.scriptId });
        if (!/courseUsesGuestAccessInfo|loadBasinInfo|getSections\(|handleOpenCourse/.test(scriptSource)) continue;
        const tree = ts.createSourceFile('bundle.js', scriptSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const methods = [];
        function visit(n) {
            if (ts.isMethodDeclaration(n) && n.body) {
                const name = n.name.getText(tree);
                const labels = { courseUsesGuestAccessInfo: 'access-check', loadBasinInfo: 'header-data',
                    loadCourseHandlers: 'course-tabs', getUserCourses: 'enrolments', getUserCourse: 'enrolled-course',
                    getSections: 'sections', getCourse: 'course-data', getHandlersToDisplayInternal: 'handlers-data',
                    loadCourseOptions: 'course-options', getCoursesAdminAndNavOptions: 'course-admin-nav',
                    sendHTTPRequest: 'http-request', getFromCache: 'cache-read', handleOpenCourse: 'panel-open' };
                const label = name === 'ngOnInit' && n.getText(tree).includes('courseUsesGuestAccessInfo')
                    ? 'component-init' : Object.hasOwn(labels, name) ? labels[name] : undefined;
                if (label) {
                    const generator = n.body.statements.flatMap(stmt => {
                        const candidates = [];
                        function find(x) { if (ts.isFunctionExpression(x) && x.asteriskToken) candidates.push(x); else ts.forEachChild(x, find); }
                        find(stmt); return candidates;
                    })[0];
                    const body = generator?.body || n.body;
                    const points = [{ stage: label + '-start', position: body.statements[0]?.getStart(tree) }];
                    function returns(x) {
                        if (ts.isFunctionLike(x)) return;
                        if (ts.isReturnStatement(x) && x.expression) {
                            let value = x.expression;
                            while (ts.isParenthesizedExpression(value)) value = value.expression;
                            while (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.CommaToken) value = value.right;
                            if (!/\byield\b|\bawait\b/.test(value.getText(tree))) points.push({ stage: label + '-end', position: value.getStart(tree) });
                        }
                        ts.forEachChild(x, returns);
                    }
                    ts.forEachChild(body, returns);
                    const last = body.statements.at(-1);
                    if (last && ts.isExpressionStatement(last)) {
                        let value = last.expression;
                        while (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.CommaToken) value = value.right;
                        if (!/\byield\b|\bawait\b/.test(value.getText(tree))) points.push({ stage: label + '-settled', position: value.getStart(tree) });
                    }
                    if (label === 'component-init') {
                        const start = n.getStart(tree);
                        const source = n.getText(tree);
                        for (const [stage, pattern] of [['access-returned', /\w+\.modNavOptions=/], ['main-render-start', /\w+\.tabs\.push\(/]]) {
                            const m = source.match(pattern); if (m) points.push({ stage, position: start + m.index });
                        }
                    }
                    methods.push({ name, label, source: n.getText(tree), points: points.filter(p => p.position !== undefined).map(p => ({
                        stage: p.stage, ...tree.getLineAndCharacterOfPosition(p.position),
                    })) });
                }
            }
            ts.forEachChild(n, visit);
        }
        visit(tree);
        matches.push({ scriptId: s.scriptId, file: s.url.split('/').pop(), methods });
    }
    return matches;
}

async function main() {
    const cdp = await connect();
    let debugging = false;
    let recording = false;
    try {
        if (process.argv[2] === 'state') {
            const result = await cdp.rpc('Runtime.evaluate', { expression: `(()=>({
                atPanel:location.pathname==='/login/painel', atCourse:/\\/course\\/\\d+/.test(location.pathname),
                bridgeAvailable:typeof window.MoodleIfrnBridge?.openCourse==='function',
                componentInspectable:!!window.ng?.getComponent?.(document.querySelector('page-painel')),
                screenLocked:document.visibilityState!=='visible',
                pages:[...document.querySelectorAll('page-core-course-index')].map(p=>({visible:p.getBoundingClientRect().width>0,hasId:p.hasAttribute('data-course-id'),hasBack:!!p.querySelector('.ifrn-course-back ion-back-button')}))
            }))()`, returnByValue: true });
            console.log(JSON.stringify(result.result.value)); return;
        }
        await cdp.rpc('Runtime.enable');
        debugging = true;
        const matches = await discover(cdp);
        if (process.argv[2] !== 'record') { console.log(JSON.stringify(matches.map(m => ({ file: m.file, methods: m.methods.map(f => ({ name: f.name, points: f.points })) })), null, 2)); return; }
        const events = [];
        let operationId = 'unassigned';
        const emit = value => { events.push(value); console.log(JSON.stringify(value)); };
        cdp.on('Runtime.consoleAPICalled', event => {
            const args = event.args || [];
            if (args[0]?.value === '[IFRN-NATIVE-TIMING]' && typeof args[1]?.value === 'string') {
                try {
                    const v = JSON.parse(args[1].value);
                    const safe = safeNativeTimingEvent(v, operationId);
                    if (safe) emit(safe);
                } catch { /* Only structured, non-sensitive diagnostic fields are accepted. */ }
                return;
            }
            if (args[0]?.value !== '[IFRN-COURSE-OPEN]' || typeof args[1]?.value !== 'string') return;
            try {
                const v = JSON.parse(args[1].value);
                if (!/^course-open-[a-z0-9-]+$/.test(v.operationId) || !/^[a-z0-9-]{1,48}$/.test(v.stage)) return;
                operationId = v.operationId;
                if (!['start', 'ok', 'error', 'cancelled', 'timeout'].includes(v.outcome)) return;
                emit({ operationId, stage: v.stage, outcome: v.outcome, ...(Number.isFinite(v.ms) ? { ms: v.ms } : {}) });
            } catch { /* Ignore non-contract logs. */ }
        });
        recording = true;
        let points = 0;
        await cdp.rpc('Debugger.setBreakpointsActive', { active: true });
        await cdp.rpc('Debugger.setPauseOnExceptions', { state: 'none' });
        for (const match of matches) for (const method of match.methods) for (const p of method.points) {
            const result = await cdp.rpc('Debugger.setBreakpoint', {
                location: { scriptId: match.scriptId, lineNumber: p.line, columnNumber: p.character },
                condition: `console.info('[IFRN-NATIVE-TIMING]',JSON.stringify({stage:${JSON.stringify(p.stage)},at:Math.round(performance.now()),inAngularZone:!!globalThis.Zone?.current?.get('isAngularZone')})),false`,
            });
            // A relocated breakpoint outside the method is discarded to avoid false timings.
            if (result.actualLocation.lineNumber !== p.line || Math.abs(result.actualLocation.columnNumber - p.character) > 100) {
                await cdp.rpc('Debugger.removeBreakpoint', { breakpointId: result.breakpointId });
            } else points++;
        }
        await cdp.rpc('Performance.enable');
        await cdp.rpc('Runtime.evaluate', { expression: `(()=>{
            window.__ifrnCourseProfileCleanup?.();
            let previous='';
            const inspect=()=>{
                const id=location.pathname.match(/\\/course\\/(\\d+)/)?.[1];
                const page=[...document.querySelectorAll('page-core-course-index')].find(p=>p.getAttribute('data-course-id')===id);
                const header=page?.querySelector('.core-course-header');const title=header?.querySelector('h1');
                const reason=!id?'outside-course':!page?'page-missing':page.closest('.ion-page-hidden,.ion-page-invisible,[hidden]')?'page-hidden':
                    !getComputedStyle(page).getPropertyValue('--ifrn-ava').trim()?'theme-missing':page.getAnimations().some(a=>a.playState==='running')?'animation-running':
                    !header?'header-missing':!title?.textContent?.trim()?'title-missing':'shell-ready';
                if(previous!==reason){previous=reason;console.info('[IFRN-NATIVE-TIMING]',JSON.stringify({stage:'dom-readiness',reason,at:Math.round(performance.now())}));}
            };
            const observer=new MutationObserver(inspect);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-course-id','hidden']});
            document.addEventListener('animationend',inspect,true);document.addEventListener('transitionend',inspect,true);
            window.__ifrnCourseProfileCleanup=()=>{observer.disconnect();document.removeEventListener('animationend',inspect,true);document.removeEventListener('transitionend',inspect,true);delete window.__ifrnCourseProfileCleanup;};inspect();
        })()` });
        const before = await cdp.rpc('Performance.getMetrics');
        let networkRequests = 0;
        cdp.on('Network.requestWillBeSent', () => { networkRequests++; });
        await cdp.rpc('Network.enable');
        emit({ ready: true, points, note: 'Native HTTP/SQLite not inferred from WebView network events.' });
        const seconds = Number(process.argv[3] || 180);
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600) throw new Error('Duration must be 1..600 seconds');
        await new Promise(resolve => { const timer = setTimeout(resolve, seconds * 1000); process.once('SIGINT', () => { clearTimeout(timer); resolve(); }); });
        const after = await cdp.rpc('Performance.getMetrics');
        const summary = { networkRequests, metrics: Object.fromEntries(after.metrics.filter(m => ['ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration'].includes(m.name))
            .map(m => [m.name, +(m.value - (before.metrics.find(b => b.name === m.name)?.value || 0)).toFixed(4)])) };
        emit({ summary });
        if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify({ events, summary }, null, 2));
    } finally {
        if (recording) {
            await cdp.rpc('Runtime.evaluate', { expression: 'window.__ifrnCourseProfileCleanup?.()' }).catch(() => {});
        }
        if (debugging) await cdp.rpc('Debugger.disable').catch(() => {});
        cdp.close();
    }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { connect, discover, safeNativeTimingEvent };
