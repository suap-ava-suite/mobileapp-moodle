// Diagnóstico somente leitura. Cookies ficam no IAB; dados pessoais não saem dele.
(async () => {
    if (!window.cordova?.InAppBrowser) return { available: false };
    const profile = JSON.parse(sessionStorage.getItem('ifrn_painel_profile') || 'null');
    const expected = String(profile?.matricula || profile?.username || profile?.identificacao
        || sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();
    const browser = cordova.InAppBrowser.open('https://ava.ifrn.edu.br/api/v1/diarios/', '_blank',
        'hidden=yes,location=no,clearcache=no,clearsessioncache=no');
    return new Promise(resolve => {
        let done = false;
        const finish = result => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            browser.close();
            resolve(result);
        };
        const timer = setTimeout(() => finish({ available: false, reason: 'timeout' }), 25000);
        browser.addEventListener('loaderror', () => finish({ available: false, reason: 'load-error' }));
        browser.addEventListener('loadstop', event => {
            if (done) return;
            if (new URL(event.url).origin !== 'https://ava.ifrn.edu.br') {
                finish({ available: false, reason: 'panel-session-needs-login' });
                return;
            }
            const code = `(${async function(expected) {
                const results = [];
                for (const path of ['/api/v1/diarios/?situacao=inprogress&page_size=100', '/api/v1/openapi.json', '/api/v2/usuario/info/', '/api/v2/openapi.json', '/api/v2/sala/tipo/diario/academico/', '/api/v2/sala/tipo/diario/presencial/']) {
                    try {
                        const response = await fetch(path, { credentials: 'same-origin', redirect: 'error',
                            headers: { Accept: 'application/json' } });
                        const isJson = (response.headers.get('content-type') || '').includes('json');
                        const data = isJson ? await response.json() : null;
                        const result = { path, status: response.status, isJson };
                        if (path.includes('/sala/tipo/')) result.roomCount = Array.isArray(data) ? data.length : null;
                        if (path.endsWith('openapi.json')) {
                            result.paths = Object.keys(data?.paths || {});
                            result.verification = data?.paths?.['/api/v1/verify/'] || undefined;
                        }
                        if (path.includes('usuario/info') && data) {
                            const identity = String(data.matricula || data.identificacao || data.username || '').trim().toLowerCase();
                            result.identityPresent = !!identity;
                            result.matchesSavedPanel = !!expected && identity === expected;
                            result.testIdentity = identity === 'testuser';
                        }
                        if (path.includes('diarios') && data) {
                            const courses = Array.isArray(data) ? data : data.diarios || data.results || [];
                            result.courseCount = courses.length;
                            result.topKeys = Object.keys(data);
                            result.categoryCounts = Object.fromEntries(['diarios', 'coordenacoes', 'praticas', 'autoinscricoes', 'reutilizaveis']
                                .map(key => [key, Array.isArray(data[key]) ? data[key].length : null]));
                            const targets = Object.values(data).filter(Array.isArray).flat().filter(course =>
                                course && [4022, 2836].includes(Number(course.id)) && course.viewurl);
                            result.testCourses = targets.map(course => {
                                const url = new URL(course.viewurl);
                                return { courseId: Number(course.id), origin: url.origin, hasEnvironment: !!course.ambiente };
                            });
                            result.hasPagination = !!data.next;
                        }
                        results.push(result);
                    } catch { results.push({ path, failed: true }); }
                }
                window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({ type: 'ifrn-readonly-probe', results }));
            }.toString()})(${JSON.stringify(expected)})`;
            browser.executeScript({ code });
        });
        browser.addEventListener('message', event => {
            if (event.data?.type === 'ifrn-readonly-probe') finish({ available: true, results: event.data.results });
        });
    });
})()
