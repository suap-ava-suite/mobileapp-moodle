// Teste de interface via CDP: não exporta cookies, tokens nem perfil.
const action = process.argv[2] || 'state';
const keyword = process.argv[3] || '';
function inspect(action, keyword) {
    const visible = element => !element.closest('.ion-page-hidden, .ion-page-invisible')
        && element.getClientRects().length > 0;
    const frame = document.querySelector('page-painel:not(.ion-page-hidden) iframe')?.contentDocument;
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let clicked = false;
    if (action === 'open') {
        const link = [...frame?.querySelectorAll('a.painel-card-link') || []]
            .find(element => normalize(element.textContent).includes(normalize(keyword)));
        if (link) { link.click(); clicked = true; }
    }
    if (action === 'back-panel') {
        const page = [...document.querySelectorAll('page-moodle-open-course')].find(visible);
        const button = [...page?.querySelectorAll('ion-button') || []]
            .find(element => /Voltar ao Painel/i.test(element.textContent));
        if (button) { button.click(); clicked = true; }
    }
    if (action === 'connect' || action === 'retry') {
        const page = [...document.querySelectorAll('page-moodle-open-course')].find(visible);
        const button = [...page?.querySelectorAll('ion-button') || []]
            .find(element => (action === 'connect' ? /Conectar este ambiente/i : /Tentar novamente/i).test(element.textContent));
        if (button && !button.disabled) { button.click(); clicked = true; }
    }
    const course = [...document.querySelectorAll('page-core-course-index')].find(visible);
    const bridge = [...document.querySelectorAll('page-moodle-open-course')].find(visible);
    const error = bridge?.querySelector('.moodle-open-course__error')?.textContent.trim();
    const pending = JSON.parse(sessionStorage.getItem('ifrn_moodle_pending_open_course') || 'null');
    return {
        action, clicked, path: location.pathname, courseVisible: !!course,
        courseHeadings: course ? [...course.querySelectorAll('h1,h2')].filter(visible)
            .slice(0, 3).map(element => element.textContent.trim().slice(0, 180)) : [],
        sectionCount: course?.querySelectorAll('core-course-format, core-course-module, ion-accordion').length || 0,
        bridgeVisible: !!bridge,
        bridgeButtons: bridge ? [...bridge.querySelectorAll('ion-button')].filter(visible)
            .map(element => ({ text: element.textContent.trim(), disabled: element.disabled })) : [],
        error: error?.replace(/\d{5,}/g, '[redacted]'),
        pending: pending ? { courseId: pending.courseId, siteUrl: pending.siteUrl } : null,
        panelVisible: !!frame,
        cards: action === 'list' && frame ? [...frame.querySelectorAll('a.painel-card-link')]
            .map(element => element.querySelector('.painel-card-title')?.textContent.trim()
                || element.textContent.trim().slice(0, 180)) : undefined,
    };
}
(async () => {
    const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
    const page = pages.find(item => item.url.startsWith('http://localhost/'));
    if (!page) throw new Error('App WebView unavailable');
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const timer = setTimeout(() => { socket.close(); process.exitCode = 1; }, 15000);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: `(${inspect.toString()})(${JSON.stringify(action)}, ${JSON.stringify(keyword)})`,
        returnByValue: true, awaitPromise: true,
    } }));
    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.result?.exceptionDetails) { console.error('UI inspection failed'); process.exitCode = 1; }
        else console.log(JSON.stringify(message.result?.result?.value, null, 2));
        socket.close();
    };
    socket.onerror = () => { clearTimeout(timer); console.error('CDP unavailable'); process.exitCode = 1; };
})().catch(error => { console.error(error.message); process.exitCode = 1; });
