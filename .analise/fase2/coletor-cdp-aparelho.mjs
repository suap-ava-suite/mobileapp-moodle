#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const APP_PACKAGE = 'com.moodle.moodlemobile';
const CDP_PORT = 9222;
const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const CALIBRATION_PATH = join(OUTPUT_DIR, 'calibracao.json');
const AUTO_BLOCKED_ROUTE_TERMS = ['enrol', 'inscri', 'assign', 'quiz', 'submit', 'enviar', 'edit', 'delete', 'perfil', 'profile/edit'];
const SAFE_METRICS = new Set([
    'JSHeapUsedSize',
    'Nodes',
    'LayoutCount',
    'RecalcStyleCount',
    'ScriptDuration',
    'LayoutDuration',
    'TaskDuration',
]);

function adb(args, timeout = 10000) {
    try {
        return execFileSync('adb', args, {
            encoding: 'utf8',
            timeout,
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    } catch (error) {
        if (error?.code === 'ENOENT') {
            throw new Error('adb não foi encontrado. Instale Android Platform Tools ou adicione adb ao PATH.');
        }
        const stderr = String(error?.stderr ?? '').toLowerCase();
        if (stderr.includes('unauthorized')) {
            throw new Error('Aparelho não autorizado. Desbloqueie o celular e aceite a autorização de depuração USB.');
        }
        if (stderr.includes('offline')) {
            throw new Error('Aparelho está offline no ADB. Reconecte o USB e confirme a depuração USB.');
        }
        if (stderr.includes('no devices') || stderr.includes('device not found')) {
            throw new Error('Nenhum aparelho ADB autorizado. Conecte o celular por USB e aceite a depuração USB.');
        }
        if (args[0] === 'shell' && args[1] === 'pidof') {
            throw new Error(`Não consegui consultar o app ${APP_PACKAGE}. Confira se o aparelho está autorizado e abra o app.`);
        }
        throw new Error(`adb ${args[0] ?? ''} falhou; verifique conexão e autorização USB.`);
    }
}

async function countListenersForTarget(cdp, contextId, expression) {
    let objectId;
    try {
        const evaluated = await cdp.call('Runtime.evaluate', {
            expression,
            contextId,
            returnByValue: false,
            awaitPromise: false,
        });
        objectId = evaluated.result?.objectId;
        if (!objectId) return null;
        const result = await cdp.call('DOMDebugger.getEventListeners', { objectId, depth: 1, pierce: true });
        const listeners = Array.isArray(result.listeners) ? result.listeners : [];
        const byType = {};
        for (const listener of listeners) {
            const type = typeof listener.type === 'string' ? listener.type : 'unknown';
            byType[type] = (byType[type] ?? 0) + 1;
        }
        return { count: listeners.length, byType };
    } catch {
        return null;
    } finally {
        if (objectId) {
            try { await cdp.call('Runtime.releaseObject', { objectId }); } catch { /* contexto pode ter sido destruído */ }
        }
    }
}

async function getDomDebuggerListenerCounts(cdp, contextIds) {
    let windowCount = 0;
    let documentCount = 0;
    let complete = contextIds.length > 0;
    const windowByType = {};
    const documentByType = {};
    for (const contextId of contextIds) {
        const [windowListeners, documentListeners] = await Promise.all([
            countListenersForTarget(cdp, contextId, 'window'),
            countListenersForTarget(cdp, contextId, 'document'),
        ]);
        if (!windowListeners || !documentListeners) {
            complete = false;
            continue;
        }
        windowCount += windowListeners.count;
        documentCount += documentListeners.count;
        for (const [type, count] of Object.entries(windowListeners.byType)) {
            windowByType[type] = (windowByType[type] ?? 0) + count;
        }
        for (const [type, count] of Object.entries(documentListeners.byType)) {
            documentByType[type] = (documentByType[type] ?? 0) + count;
        }
    }
    return {
        listenersWindow: complete ? windowCount : null,
        listenersDocument: complete ? documentCount : null,
        listenersWindowByType: windowByType,
        listenersDocumentByType: documentByType,
        complete,
    };
}

function safePathname(pathname) {
    const parts = pathname.split('/');
    const dynamicParents = /^(user|users|profile|profiles|participant|participants|course|courses|student|students)$/i;
    const safeSegments = new Set([
        'login', 'painel', 'marketplace-ifrn', 'mobilemoodle', 'index.html', 'course', 'courses', 'view.php', 'mod',
        'assign', 'quiz', 'forum', 'resource', 'page', 'lesson', 'book', 'folder', 'url', 'scorm',
        'workshop', 'chat', 'feedback', 'choice', 'survey', 'glossary', 'wiki', 'data', 'attendance',
        'user', 'users', 'profile', 'profiles', 'participant', 'participants', 'student', 'students',
        'my', 'dashboard', 'mainmenu', 'home', 'notifications', 'message', 'messages', 'auth',
        'suap', 'oauth2', 'callback', 'service', 'services', 'api', 'v1', 'v2', 'usuario', 'info',
        'diarios', 'progresso', 'webservice', 'rest', 'server.php', 'pluginfile.php', 'theme',
        'ifrn', 'settings', 'calendar', 'grade', 'grades', 'activity', 'section', 'course',
        'enrol', 'inscri', 'assign', 'quiz', 'submit', 'enviar', 'edit', 'delete', 'perfil',
    ]);

    return parts.map((part, index) => {
        if (!part) return part;
        if (part === '[segment]' || part === '[redacted]') return part;
        const previous = parts[index - 1] ?? '';
        const looksLikeIdentifier =
            /^\d+$/.test(part) ||
            /^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(part) ||
            part.length > 40 ||
            part.includes('@') ||
            /^[A-Za-z0-9_-]{24,}$/.test(part);
        if (looksLikeIdentifier) return '[redacted]';
        if (safeSegments.has(part.toLowerCase())) return part.replace(/[\r\n]/g, '');
        if (dynamicParents.test(previous)) return '[redacted]';
        return '[segment]';
    }).join('/');
}

function safeUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'about:' && parsed.pathname === 'blank') return 'about:blank';
        if (parsed.origin === 'null') return `${parsed.protocol}${safePathname(parsed.pathname)}`;
        return `${parsed.origin}${safePathname(parsed.pathname)}`;
    } catch {
        return '[url-indisponivel]';
    }
}

function safeHashRoute(rawUrl) {
    try {
        const hash = new URL(rawUrl).hash.slice(1).split('?')[0];
        if (!hash) return '';
        const path = hash.startsWith('/') ? hash : `/${hash}`;
        return safePathname(path);
    } catch {
        return '';
    }
}

function hostOf(rawUrl) {
    try {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        return hostname || 'host-indisponivel';
    } catch {
        return 'host-indisponivel';
    }
}

function withinDocumentTransition(params) {
    if (!params || typeof params.url !== 'string') return null;
    return {
        kind: 'rota',
        url: safeUrl(params.url),
        route: safeHashRoute(params.url),
        frameId: typeof params.frameId === 'string' ? params.frameId : '',
        source: 'Page.navigatedWithinDocument',
    };
}

function isTrackablePageTarget(target) {
    if (!target || target.type !== 'page' || typeof target.url !== 'string' || typeof target.webSocketDebuggerUrl !== 'string') return false;
    if (/^devtools:/i.test(target.url) || /^about:blank(?:$|[?#])/i.test(target.url)) return false;
    return true;
}

function isRecognizedAppTarget(target) {
    if (!isTrackablePageTarget(target)) return false;
    try {
        const pathname = new URL(target.url).pathname;
        return /\/login\/(?:painel|marketplace-ifrn)(?:\/|$)/i.test(pathname) ||
            /\/home\/course(?:\/|$)/i.test(pathname) ||
            /\/mobilemoodle\/index\.html$/i.test(pathname);
    } catch {
        return false;
    }
}

function selectInitialTarget(targets) {
    const pages = targets.filter(isTrackablePageTarget);
    const recognized = pages.find(isRecognizedAppTarget);
    if (recognized) return recognized;
    if (pages.length === 1) return pages[0];
    if (pages.length > 1) {
        const urls = pages.map((target) => safeUrl(target.url)).join(', ');
        throw new Error(`Não reconheci o alvo principal. Alvos disponíveis: ${urls}`);
    }
    throw new Error('Nenhum alvo page utilizável; deixe uma tela do app aberta e tente novamente.');
}

function classifyLongTask(entry, startedAtEpochMs, target, targetUrl) {
    const startEpochMs = Number(entry.timeOrigin) + Number(entry.startTime);
    const durationMs = Number(entry.durationMs);
    if (!Number.isFinite(startEpochMs) || !Number.isFinite(durationMs) || durationMs < 0) return null;
    const tagged = { target, targetUrl, durationMs: Number(durationMs.toFixed(2)) };
    if (startEpochMs < startedAtEpochMs) return { phase: 'preGravacao', entry: tagged };
    return {
        phase: 'gravacao',
        entry: { ...tagged, elapsedMs: Number((startEpochMs - startedAtEpochMs).toFixed(2)) },
    };
}

function shouldDeduplicateTransition(previous, candidate, atMs) {
    if (!previous || previous.target !== candidate.target || previous.frameKey !== candidate.frameKey) return false;
    const routeKinds = new Set(['rota', 'route', 'hash']);
    const sameKind = previous.kind === candidate.kind || (routeKinds.has(previous.kind) && routeKinds.has(candidate.kind));
    return sameKind && previous.url === candidate.url && previous.route === candidate.route && atMs - previous.elapsedMs < 250;
}

function validateCalibration(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('calibracao.json inválido.');
    const expected = ['entradaPainel', 'cartaoCurso', 'ida', 'tela'];
    if (Object.keys(value).length !== expected.length || expected.some((key) => !(key in value))) throw new Error('calibracao.json deve conter somente entradaPainel, cartaoCurso, ida e tela.');
    const { largura, altura } = value.tela ?? {};
    if (!Number.isInteger(largura) || largura <= 0 || !Number.isInteger(altura) || altura <= 0) throw new Error('largura/altura da tela devem ser inteiros positivos.');
    const points = expected.filter((key) => key !== 'tela');
    if (points.length > 4) throw new Error('No máximo quatro pontos de toque são aceitos.');
    for (const name of points) {
        const point = value[name];
        if (!point || typeof point !== 'object' || Object.keys(point).length !== 2 || !('x' in point) || !('y' in point)) throw new Error(`Ponto ${name} inválido.`);
        if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x > largura || point.y > altura) throw new Error(`Ponto ${name} nulo ou fora da tela.`);
    }
    return value;
}

function hasBlockedAutoRoute(route) {
    const normalized = String(route ?? '').toLowerCase();
    return AUTO_BLOCKED_ROUTE_TERMS.some((term) => normalized.includes(term));
}

function isAutoConfirmationAccepted(answer) { return answer === 'SIM'; }

function evaluateReadiness(samples) {
    if (samples.length < 2) return false;
    const first = samples[0];
    const last = samples.at(-1);
    if (last.atMs - first.atMs < 1000 || samples.some((sample) => sample.inFlight !== 0)) return false;
    const nodes = samples.map((sample) => sample.nodes);
    if (nodes.some((value) => !Number.isFinite(value) || value < 0)) return false;
    const minimum = Math.min(...nodes);
    const maximum = Math.max(...nodes);
    return minimum === 0 ? maximum === 0 : ((maximum - minimum) / minimum) <= 0.02;
}

function parseAutoOptions(argv) {
    const autoArg = argv.find((arg) => arg.startsWith('--auto='));
    if (!autoArg) return null;
    const mode = autoArg.slice('--auto='.length);
    if (!['rodadas', 'vazamento'].includes(mode)) throw new Error('Use --auto=rodadas ou --auto=vazamento.');
    const roundsArg = argv.find((arg) => arg.startsWith('--rodadas='));
    const rounds = roundsArg ? Number(roundsArg.slice('--rodadas='.length)) : 6;
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error('--rodadas deve ser inteiro de 1 a 20.');
    return { mode, rounds };
}

function timestampAt(elapsedMs, startedAtEpochMs) {
    return new Date(startedAtEpochMs + Math.max(0, elapsedMs)).toISOString();
}

function installPageInstrumentation() {
    if (window.__IFRN_PHASE2_COLLECTOR__) return;

    const bindingRoute = window.__ifrnPhase2Route;
    const bindingLongTask = window.__ifrnPhase2LongTask;
    const listenerIds = new WeakMap();
    let nextListenerId = 0;
    const listenerMaps = new Map();
    const listenerInstrumentation = new Map();

    function eventListenerId(listener) {
        if ((typeof listener !== 'function' && (typeof listener !== 'object' || listener === null))) return null;
        if (!listenerIds.has(listener)) listenerIds.set(listener, ++nextListenerId);
        return listenerIds.get(listener);
    }

    function instrumentTarget(target, label) {
        const registrations = new Map();
        listenerMaps.set(label, registrations);
        const nativeAdd = target.addEventListener;
        const nativeRemove = target.removeEventListener;
        let applied = true;

        try {
            Object.defineProperty(target, 'addEventListener', {
                configurable: true,
                writable: true,
                value: function (type, listener, options) {
                    const result = Reflect.apply(nativeAdd, this, [type, listener, options]);
                    const listenerId = eventListenerId(listener);
                    if (listenerId !== null) {
                        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
                        const key = `${String(type)}|${capture ? 1 : 0}|${listenerId}`;
                        registrations.set(key, String(type));
                    }
                    return result;
                },
            });
            Object.defineProperty(target, 'removeEventListener', {
                configurable: true,
                writable: true,
                value: function (type, listener, options) {
                    const result = Reflect.apply(nativeRemove, this, [type, listener, options]);
                    const listenerId = eventListenerId(listener);
                    if (listenerId !== null) {
                        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
                        registrations.delete(`${String(type)}|${capture ? 1 : 0}|${listenerId}`);
                    }
                    return result;
                },
            });
        } catch {
            // Alguns WebViews podem não permitir sobrescrever os métodos do wrapper.
            applied = false;
        }
        listenerInstrumentation.set(label, applied);
        return nativeAdd;
    }

    const nativeWindowAdd = instrumentTarget(window, 'window');
    instrumentTarget(document, 'document');

    const state = {
        listenerMaps,
        longTaskCount: 0,
        longTaskTotalMs: 0,
        longTaskMaxMs: 0,
        snapshot() {
            const count = (label) => listenerMaps.get(label)?.size ?? 0;
            return {
                windowListeners: count('window'),
                documentListeners: count('document'),
                windowInstrumentation: listenerInstrumentation.get('window') ?? false,
                documentInstrumentation: listenerInstrumentation.get('document') ?? false,
                longTaskCount: state.longTaskCount,
                longTaskTotalMs: state.longTaskTotalMs,
                longTaskMaxMs: state.longTaskMaxMs,
                domNodes: document.getElementsByTagName('*').length,
            };
        },
    };
    Object.defineProperty(window, '__IFRN_PHASE2_COLLECTOR__', { value: state, configurable: false });

    const report = (kind) => {
        try {
            bindingRoute?.(JSON.stringify({
                kind,
                href: location.href,
                route: safeHashRouteForPage(),
                timeOrigin: performance.timeOrigin,
                now: performance.now(),
            }));
        } catch {
            // A instrumentação não deve interferir na navegação do app.
        }
    };
    const safeHashRouteForPage = () => {
        const hash = location.hash.slice(1).split('?')[0];
        return hash ? (hash.startsWith('/') ? hash : `/${hash}`) : '';
    };

    Reflect.apply(nativeWindowAdd, window, ['hashchange', () => report('hash'), { passive: true }]);
    Reflect.apply(nativeWindowAdd, window, ['popstate', () => report('route'), { passive: true }]);

    for (const method of ['pushState', 'replaceState']) {
        try {
            const original = history[method];
            history[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                report('route');
                return result;
            };
        } catch {
            // Mantém o método original se a WebView não permitir o wrapper.
        }
    }

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const durationMs = Number(entry.duration) || 0;
                state.longTaskCount += 1;
                state.longTaskTotalMs += durationMs;
                state.longTaskMaxMs = Math.max(state.longTaskMaxMs, durationMs);
                try {
                    bindingLongTask?.(JSON.stringify({
                        startTime: Number(entry.startTime) || 0,
                        durationMs,
                        timeOrigin: performance.timeOrigin,
                    }));
                } catch {
                    // Somente métricas numéricas são enviadas ao processo Node.
                }
            }
        });
        observer.observe({ type: 'longtask', buffered: true });
    } catch {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const durationMs = Number(entry.duration) || 0;
                    state.longTaskCount += 1;
                    state.longTaskTotalMs += durationMs;
                    state.longTaskMaxMs = Math.max(state.longTaskMaxMs, durationMs);
                    try {
                        bindingLongTask?.(JSON.stringify({
                            startTime: Number(entry.startTime) || 0,
                            durationMs,
                            timeOrigin: performance.timeOrigin,
                        }));
                    } catch {
                        // Somente métricas numéricas são enviados ao processo Node.
                    }
                }
            });
            observer.observe({ entryTypes: ['longtask'] });
        } catch {
            // Long Task API não está disponível nesta WebView.
        }
    }

    report('init');
}

const PAGE_INSTRUMENTATION_SOURCE = `(${installPageInstrumentation.toString()})();`;

function nextOutputNumber() {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    for (let number = 1; number < 1000; number += 1) {
        const suffix = String(number).padStart(2, '0');
        const jsonPath = join(OUTPUT_DIR, `medicao-${suffix}.json`);
        const markdownPath = join(OUTPUT_DIR, `medicao-${suffix}.md`);
        if (!existsSync(jsonPath) && !existsSync(markdownPath)) return { suffix, jsonPath, markdownPath };
    }
    throw new Error('Não há nome medicao-NN livre em .analise/fase2/.');
}

function makeCdpClient(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 0;
    const eventHandlers = new Map();

    socket.addEventListener('message', (event) => {
        let message;
        try {
            message = JSON.parse(String(event.data));
        } catch {
            return;
        }
        if (message.id && pending.has(message.id)) {
            const item = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) item.reject(new Error(`CDP ${item.method} falhou (${message.error.code ?? 'erro'}).`));
            else item.resolve(message.result ?? {});
            return;
        }
        if (message.method) {
            for (const handler of eventHandlers.get(message.method) ?? []) {
                try { handler(message.params ?? {}); } catch { /* isolado por evento */ }
            }
        }
    });

    socket.addEventListener('error', () => {
        for (const item of pending.values()) item.reject(new Error('Conexão CDP interrompida.'));
        pending.clear();
    });

    const opened = new Promise((resolveOpen, rejectOpen) => {
        socket.addEventListener('open', resolveOpen, { once: true });
        socket.addEventListener('error', () => rejectOpen(new Error('Não foi possível conectar ao alvo CDP.')), { once: true });
    });

    return {
        socket,
        opened,
        on(method, handler) {
            const handlers = eventHandlers.get(method) ?? new Set();
            handlers.add(handler);
            eventHandlers.set(method, handlers);
        },
        call(method, params = {}) {
            if (socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('WebSocket CDP não está aberto.'));
            const id = ++nextId;
            return new Promise((resolveCall, rejectCall) => {
                const timeout = setTimeout(() => {
                    pending.delete(id);
                    rejectCall(new Error(`Timeout em CDP ${method}.`));
                }, 15000);
                pending.set(id, {
                    method,
                    resolve: (value) => { clearTimeout(timeout); resolveCall(value); },
                    reject: (error) => { clearTimeout(timeout); rejectCall(error); },
                });
                socket.send(JSON.stringify({ id, method, params }));
            });
        },
    };
}

function formatMetrics(result) {
    const metrics = {};
    for (const item of result.metrics ?? []) {
        if (SAFE_METRICS.has(item.name) && Number.isFinite(item.value)) metrics[item.name] = item.value;
    }
    return metrics;
}

function summarizeDuration(values) {
    if (!values.length) return { count: 0, totalMs: 0, maxMs: 0 };
    return {
        count: values.length,
        totalMs: Number(values.reduce((sum, item) => sum + item.durationMs, 0).toFixed(2)),
        maxMs: Number(Math.max(...values.map((item) => item.durationMs)).toFixed(2)),
    };
}

function buildLeakAnalysis(cycles) {
    const first = cycles[0] ?? null;
    const last = cycles.at(-1) ?? null;
    const metrics = ['JSHeapUsedSize', 'Nodes', 'listenersWindow', 'listenersDocument'];
    const comparison = first && last
        ? Object.fromEntries(metrics.map((metric) => {
            const firstValue = Number.isFinite(first[metric]) ? first[metric] : null;
            const lastValue = Number.isFinite(last[metric]) ? last[metric] : null;
            const signed = firstValue === null || lastValue === null ? null : lastValue - firstValue;
            return [metric, {
                first: firstValue,
                last: lastValue,
                deltaAbsolute: signed === null ? null : Math.abs(signed),
                deltaSigned: signed,
                deltaPercent: signed === null || firstValue === 0 ? null : (signed / Math.abs(firstValue)) * 100,
            }];
        }))
        : null;
    const minimumMet = cycles.length >= 21;
    return {
        cycleCount: cycles.length,
        minimumSamples: 21,
        minimumMet,
        conclusion: minimumMet
            ? 'variação dentro do ruído? NÃO CONCLUÍDO sem baseline repetido'
            : 'amostra insuficiente (<20 ciclos)',
        comparison,
    };
}

function escapeMarkdown(value) {
    return String(value).replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
}

function buildMarkdown(data) {
    const transitionRows = data.transitions.map((transition, index) => {
        const source = transition.from?.url ? `${transition.from.url}${transition.from.route ? ` (${transition.from.route})` : ''}` : 'início';
        const destination = `${transition.url}${transition.route ? ` (${transition.route})` : ''}`;
        const ready = transition.contentUsableMs == null ? 'NÃO MARCADO' : `${transition.contentUsableMs.toFixed(0)} ms (${transition.contentUsableMethod === 'heuristica-automatica' ? 'heurística automática' : 'marcação manual'})${transition.contentUsableTimedOut ? ' — timeout de pronta' : ''}`;
        const snapshot = transition.usableSnapshot ?? transition.performance ?? {};
        return `| ${index + 1} | ${escapeMarkdown(transition.target ?? 'principal')} | ${escapeMarkdown(transition.kind)} | ${escapeMarkdown(source)} → ${escapeMarkdown(destination)} | ${ready} | ${transition.requests.count} | ${transition.requests.encodedBytes} | ${transition.longTasks.count} | ${snapshot.JSHeapUsedSize ?? '—'} | ${snapshot.Nodes ?? '—'} |`;
    }).join('\n');

    const hostRows = data.hosts.length
        ? data.hosts.map((host) => `| ${escapeMarkdown(host.host)} | ${host.requests} | ${host.encodedBytes} |`).join('\n')
        : '| nenhum host observado | 0 | 0 |';
    const jsdelivr = data.cdn.jsDelivr.requestCount > 0 ? 'CONFIRMADO nesta captura' : 'não observado nesta captura';
    const vlibras = data.cdn.vlibras.requestCount > 0 ? 'CONFIRMADO nesta captura' : 'não observado nesta captura';
    const traceDetails = data.tracing.started
        ? `Trace: scripting ${data.trace.scriptMs} ms; recálculo de estilo ${data.trace.styleMs} ms; layout ${data.trace.layoutMs} ms; pintura ${data.trace.paintMs} ms.`
        : 'trace indisponível nesta WebView';
    const leakRows = (data.leakCycles ?? []).map((cycle) =>
        `| ${cycle.n} | ${cycle.JSHeapUsedSize ?? '—'} | ${cycle.Nodes ?? '—'} | ${cycle.listenersWindow ?? '—'} | ${cycle.listenersDocument ?? '—'} |`,
    ).join('\n');
    const leakComparisonRows = data.leakAnalysis?.comparison
        ? Object.entries(data.leakAnalysis.comparison).map(([metric, delta]) =>
            `| ${escapeMarkdown(metric)} | ${delta.first ?? '—'} | ${delta.last ?? '—'} | ${delta.deltaAbsolute ?? '—'} | ${delta.deltaPercent == null ? '—' : `${delta.deltaPercent.toFixed(2)}%`} |`,
        ).join('\n')
        : '| sem ciclos comparáveis | — | — | — | — |';

    return `# Medição CDP no aparelho — ${data.measurementId}

**Início:** ${data.startedAt}  
**Duração:** ${data.durationMs.toFixed(0)} ms  
**App:** \`${APP_PACKAGE}\`  
**Alvo CDP:** ${escapeMarkdown(data.target.url)}  
**Observação:** a primeira rodada é indicada como fria pelo operador; não houve limpeza de dados/cache. ${data.automation ? 'O tempo até conteúdo utilizável usa a heurística automática, que não equivale à marcação manual u.' : 'O tempo até conteúdo utilizável vem da marcação manual u e inclui o tempo de reação do operador.'} Requests/hosts cobrem somente o intervalo gravado.

${data.automation ? `## Automação\n\n- Modo: ${escapeMarkdown(data.automation.mode)}; etapas concluídas: ${data.automation.completedSteps}.\n- Resultado: ${escapeMarkdown(data.automation.abortReason ?? 'concluído')}.\n- Pronta: heurística automática — requests zerados e DOM estável por 1000 ms; limite de 20 s. Essa heurística não equivale à marcação manual u.\n` : ''}

## Transições

| # | Alvo | Tipo | De → para | Tempo até conteúdo utilizável | Requests | Bytes codificados | Long tasks | Heap JS (bytes) | Nós DOM |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|
${transitionRows || '| — | — | nenhuma transição observada | — | NÃO MEDIDO | 0 | 0 | 0 | — | — |'}

## Rede por host

| Host | Requests | Bytes codificados |
|---|---:|---:|
${hostRows}

## CDN

- jsDelivr: **${jsdelivr}** (${data.cdn.jsDelivr.requestCount} requests).
- VLibras (vlibras.gov.br e subdomínios): **${vlibras}** (${data.cdn.vlibras.requestCount} requests).
- Ausência significa apenas que não houve request ao host durante esta captura; o carregamento anterior ao início da gravação não é contado.

## Performance e listeners

- Long tasks via PerformanceObserver: ${data.longTasks.count}; duração acumulada ${data.longTasks.totalMs} ms; maior ${data.longTasks.maxMs} ms.
- Long tasks anteriores à gravação: ${data.longTasks.preGravacao?.count ?? 0}; duração acumulada ${data.longTasks.preGravacao?.totalMs ?? 0} ms; maior ${data.longTasks.preGravacao?.maxMs ?? 0} ms (fora das transições).
- Tasks de trace acima de 50 ms: ${data.trace.runTaskOver50ms}; 50 ms é referência geral.
- ${traceDetails}
- Contagem instrumentada: window ${data.listenersInstrumentados?.window ?? 0}; document ${data.listenersInstrumentados?.document ?? 0}.
- a contagem instrumentada não reflete remoção por AbortSignal nem listeners once; prefira a contagem por DOMDebugger.
- Performance.getMetrics foi amostrado em cada evento de navegação/rota; ver os campos por transição no JSON.

## Ciclos de memória e listeners

${data.leakAnalysis
        ? `Amostras \`c\`: ${data.leakAnalysis.cycleCount}. Conclusão: **${data.leakAnalysis.conclusion}**.\n\n| Ciclo | JSHeapUsedSize | Nodes | listeners window | listeners document |\n|---:|---:|---:|---:|---:|\n${leakRows || '| — | — | — | — | — |'}\n\nComparação ciclo 1 vs último:\n\n| Métrica | Ciclo 1 | Último | Delta absoluto | Delta % |\n|---|---:|---:|---:|---:|\n${leakComparisonRows}\n\nvariação dentro do ruído? NÃO CONCLUÍDO sem baseline repetido`
        : 'Modo LEAK não executado nesta gravação.'}

## Limitações

- O operador precisa digitar \`u\` e Enter quando cada tela estiver visualmente utilizável; Enter sem texto encerra a gravação.
- A instrumentação dos listeners intercepta add/remove após a injeção e não inclui os handlers anteriores. Ela não reflete remoção por AbortSignal nem listeners once; prefira a contagem por DOMDebugger.
- O coletor procura alvos CDP novos a cada segundo; falhas de conexão a alvos extras não encerram a coleta.
- O arquivo contém hosts e caminhos de navegação sanitizados; não contém query, fragmento, headers, cookies, corpo de resposta, texto da tela ou identificadores numéricos.
`;
}

function runSelfTest() {
    const cases = [
        ['query token e rota hash com ID', () => {
            const raw = 'https://example.test/course/view.php?token=abc123#/user/12345/profile';
            const output = `${safeUrl(raw)} ${safeHashRoute(raw)}`;
            return !output.includes('token=abc123') && !output.includes('#/user/12345/profile') && !output.includes('12345') && !output.includes('?') && !output.includes('#');
        }],
        ['segmento UUID', () => {
            const uuid = '123e4567-e89b-12d3-a456-426614174000';
            return !safePathname(`/course/${uuid}`).includes(uuid);
        }],
        ['segmento numérico', () => !safePathname('/activity/987654321').includes('987654321')],
        ['e-mail no caminho', () => !safeUrl('https://example.test/user/aluno.teste@example.test/profile').includes('aluno.teste@example.test')],
        ['segmento maior que 40 caracteres', () => {
            const longSegment = 'x'.repeat(48);
            return !safePathname(`/route/${longSegment}`).includes(longSegment);
        }],
        ['rota hash com query', () => {
            const route = safeHashRoute('https://example.test/mobilemoodle/index.html#/course/view.php?id=314159&token=secrettoken');
            return !route.includes('314159') && !route.includes('token=') && !route.includes('secrettoken') && !route.includes('?') && !route.includes('#');
        }],
        ['Page.navigatedWithinDocument gera rota sem query', () => {
            const transition = withinDocumentTransition({
                frameId: 'frame-test',
                url: 'https://example.test/course/view.php?token=abc#/user/12345/profile',
            });
            return transition?.kind === 'rota' &&
                transition.url.startsWith('https://example.test/') &&
                !transition.url.includes('?') && !transition.url.includes('#') && !transition.url.includes('token=abc') &&
                !transition.route.includes('12345') && !transition.route.includes('#');
        }],
        ['safeUrl é idempotente', () => {
            const url = 'https://example.test/home/course/12345/view?token=abc';
            const sanitized = safeUrl(url);
            return safeUrl(sanitized) === sanitized;
        }],
        ['marcador redacted sobrevive withinDocumentTransition e safeUrl', () => {
            const transition = withinDocumentTransition({
                frameId: 'frame-test',
                url: 'https://example.test/course/[redacted]',
            });
            return transition?.url.includes('/course/[redacted]') === true &&
                safeUrl(transition.url).includes('/course/[redacted]');
        }],
        ['safeUrl preserva about:blank', () => safeUrl('about:blank') === 'about:blank'],
        ['decisão de alvo aceita localhost e rejeita devtools/about:blank', () =>
            isTrackablePageTarget({ type: 'page', url: 'http://localhost/course', webSocketDebuggerUrl: 'ws://localhost/devtools/page/1' }) &&
            !isTrackablePageTarget({ type: 'page', url: 'devtools://devtools/bundled/inspector.html', webSocketDebuggerUrl: 'ws://localhost/devtools/page/2' }) &&
            !isTrackablePageTarget({ type: 'page', url: 'about:blank', webSocketDebuggerUrl: 'ws://localhost/devtools/page/3' })],
        ['alvos desconhecidos exibem somente URLs sanitizadas', () => {
            try {
                selectInitialTarget([
                    { type: 'page', url: 'https://example.test/private/12345?token=secret', webSocketDebuggerUrl: 'ws://localhost/devtools/page/1' },
                    { type: 'page', url: 'https://other.test/person/aluno@example.test', webSocketDebuggerUrl: 'ws://localhost/devtools/page/2' },
                ]);
                return false;
            } catch (error) {
                return error.message.includes('[redacted]') && !error.message.includes('12345') &&
                    !error.message.includes('secret') && !error.message.includes('aluno@example.test');
            }
        }],
        ['long task anterior fica fora da gravação', () => {
            const task = classifyLongTask({ timeOrigin: 1000, startTime: 900, durationMs: 60 }, 2000, 'principal', 'http://localhost/home');
            return task?.phase === 'preGravacao' && task.entry.durationMs === 60 && !('elapsedMs' in task.entry);
        }],
        ['ID em /home/course é redigido uma vez e deduplicado', () => {
            const raw = 'https://example.test/home/course/12345/view';
            const wrappedUrl = safeUrl(raw);
            const navigation = withinDocumentTransition({ frameId: 'frame-test', url: raw });
            const cdpUrl = safeUrl(navigation.url);
            const candidate = {
                target: 'principal', frameKey: 'frame-test', kind: navigation.kind,
                url: cdpUrl, route: navigation.route, elapsedMs: 180,
            };
            const previous = {
                target: 'principal', frameKey: 'frame-test', kind: 'route',
                url: wrappedUrl, route: '', elapsedMs: 100,
            };
            return (wrappedUrl.match(/\[redacted\]/g) ?? []).length === 1 &&
                cdpUrl === wrappedUrl && shouldDeduplicateTransition(previous, candidate, 180);
        }],
        ['buildMarkdown multi-alvo e pré-gravação sem undefined', () => {
            const fakeData = {
                measurementId: 'medicao-teste',
                startedAt: '2026-01-01T00:00:00.000Z',
                durationMs: 1000,
                target: { url: 'http://localhost/login/painel' },
                targets: [
                    { target: 'principal', targetUrl: 'http://localhost/login/painel' },
                    { target: 'extra-1', targetUrl: 'http://localhost/course/[redacted]' },
                ],
                transitions: [
                    {
                        target: 'principal', targetUrl: 'http://localhost/login/painel',
                        kind: 'route', url: 'http://localhost/login/painel', route: '/painel', from: null,
                        contentUsableMs: 1200, contentUsableMethod: 'heuristica-automatica', contentUsableTimedOut: false,
                        requests: { count: 0, encodedBytes: 0, entries: [] }, longTasks: { count: 0 },
                        performance: { JSHeapUsedSize: 100, Nodes: 10 }, usableSnapshot: null,
                    },
                    {
                        target: 'extra-1', targetUrl: 'http://localhost/course/[redacted]',
                        kind: 'Document', url: 'http://localhost/course/[redacted]', route: '', from: null,
                        contentUsableMs: null, requests: { count: 0, encodedBytes: 0, entries: [] }, longTasks: { count: 0 },
                        performance: { JSHeapUsedSize: 110, Nodes: 12 }, usableSnapshot: null,
                    },
                ],
                hosts: [],
                cdn: { jsDelivr: { requestCount: 0 }, vlibras: { requestCount: 0 } },
                longTasks: { count: 0, totalMs: 0, maxMs: 0, preGravacao: { count: 1, totalMs: 55, maxMs: 55 }, entries: [] },
                trace: { runTaskOver50ms: 0, scriptMs: 0, styleMs: 0, layoutMs: 0, paintMs: 0 },
                tracing: { started: false },
                listenersInstrumentados: { window: 0, document: 0 },
                leakCycles: [{ n: 1, JSHeapUsedSize: 100, Nodes: 10, listenersWindow: 2, listenersDocument: 1 }],
                leakAnalysis: buildLeakAnalysis([{ n: 1, JSHeapUsedSize: 100, Nodes: 10, listenersWindow: 2, listenersDocument: 1 }]),
                automation: { mode: 'rodadas', completedSteps: 1, abortReason: 'rota fora da allowlist' },
            };
            const markdown = buildMarkdown(fakeData);
            return markdown.includes('trace indisponível nesta WebView') &&
                markdown.includes('extra-1') && markdown.includes('anteriores à gravação: 1') &&
                markdown.includes('heurística automática') && markdown.includes('rota fora da allowlist') &&
                markdown.includes('amostra insuficiente (<20 ciclos)') &&
                markdown.includes('variação dentro do ruído? NÃO CONCLUÍDO sem baseline repetido') &&
                !markdown.includes('undefined');
        }],
        ['calibração rejeita nulo e ponto fora da tela', () => {
            const base = { entradaPainel: { x: 10, y: 10 }, cartaoCurso: { x: 20, y: 20 }, ida: { x: 30, y: 30 }, tela: { largura: 720, altura: 1600 } };
            let nullRejected = false;
            let boundsRejected = false;
            try { validateCalibration({ ...base, ida: { x: null, y: 1 } }); } catch { nullRejected = true; }
            try { validateCalibration({ ...base, ida: { x: 721, y: 1 } }); } catch { boundsRejected = true; }
            return nullRejected && boundsRejected;
        }],
        ['calibração rejeita mais de quatro pontos', () => {
            const tooMany = { entradaPainel: { x: 1, y: 1 }, cartaoCurso: { x: 2, y: 2 }, ida: { x: 3, y: 3 }, extra: { x: 4, y: 4 }, tela: { largura: 720, altura: 1600 } };
            try { validateCalibration(tooMany); return false; } catch { return true; }
        }],
        ['allowlist bloqueia rotas sensíveis e aceita painel/curso', () => {
            const blocked = AUTO_BLOCKED_ROUTE_TERMS.every((term) => hasBlockedAutoRoute(`/path/${term}`));
            return blocked && !hasBlockedAutoRoute('/login/painel') && !hasBlockedAutoRoute('/home/course/[redacted]');
        }],
        ['pronta exige requests zerados e DOM estável por 1000 ms', () => {
            const ready = evaluateReadiness([{ atMs: 0, inFlight: 0, nodes: 100 }, { atMs: 500, inFlight: 0, nodes: 101 }, { atMs: 1000, inFlight: 0, nodes: 101 }]);
            const busy = evaluateReadiness([{ atMs: 0, inFlight: 0, nodes: 100 }, { atMs: 1000, inFlight: 1, nodes: 100 }]);
            const unstable = evaluateReadiness([{ atMs: 0, inFlight: 0, nodes: 100 }, { atMs: 1000, inFlight: 0, nodes: 104 }]);
            return ready && !busy && !unstable;
        }],
        ['confirmação exige SIM exato', () => ['sim ', '', 's', 'yes'].every((answer) => !isAutoConfirmationAccepted(answer)) && isAutoConfirmationAccepted('SIM')],
        ['parser de automação reconhece rodadas e vazamento', () =>
            parseAutoOptions(['--auto=rodadas', '--rodadas=1']).rounds === 1 && parseAutoOptions(['--auto=vazamento']).mode === 'vazamento'],
    ];
    let failures = 0;
    for (const [name, test] of cases) {
        let passed = false;
        try { passed = test() === true; } catch { passed = false; }
        console.log(`${passed ? 'PASSOU' : 'FALHOU'} — ${name}`);
        if (!passed) failures += 1;
    }
    console.log(`Resultado: ${cases.length - failures}/${cases.length} casos passaram.`);
    return failures === 0 ? 0 : 1;
}

function printPreflightStep(label, action) {
    try {
        const value = action();
        console.log(`OK — ${label}`);
        return { ok: true, value };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'falha sem detalhe';
        console.log(`FALHOU — ${label}: ${message}`);
        return { ok: false, value: null };
    }
}

async function runPreflight() {
    let allOk = true;
    let forwardCreated = false;
    let socketName = '';
    let targetsRead = false;

    const adbAvailable = printPreflightStep('adb disponível', () => adb(['version'])).ok;
    allOk &&= adbAvailable;

    const authorized = adbAvailable
        ? printPreflightStep('aparelho autorizado', () => {
            const state = adb(['get-state']);
            if (state !== 'device') throw new Error('autorize a depuração USB no aparelho');
            return state;
        })
        : (console.log('FALHOU — aparelho autorizado: não verificado porque adb não está disponível.'), { ok: false });
    allOk &&= authorized.ok;

    const processCheck = authorized.ok
        ? printPreflightStep('processo do app ativo', () => {
            const pid = adb(['shell', 'pidof', APP_PACKAGE]).split(/\s+/).filter(Boolean)[0];
            if (!pid) throw new Error('abra o app manualmente; o preflight não inicia o app');
            return true;
        })
        : (console.log('FALHOU — processo do app ativo: não verificado porque o aparelho não está autorizado.'), { ok: false });
    allOk &&= processCheck.ok;

    const socketCheck = processCheck.ok
        ? printPreflightStep('socket WebView existente', () => {
            const pid = adb(['shell', 'pidof', APP_PACKAGE]).split(/\s+/).filter(Boolean)[0];
            const lines = adb(['shell', 'cat', '/proc/net/unix']).split(/\r?\n/);
            socketName = lines.map((line) => line.trim().split(/\s+/).at(-1) ?? '')
                .map((name) => name.replace(/^@/, ''))
                .find((name) => name === `webview_devtools_remote_${pid}`) ?? '';
            if (!socketName) throw new Error('abra uma tela do app com WebView; o preflight não navega');
            return true;
        })
        : (console.log('FALHOU — socket WebView existente: não verificado porque o app não está ativo.'), { ok: false });
    allOk &&= socketCheck.ok;

    const portCheck = socketCheck.ok
        ? printPreflightStep('porta tcp:9222 livre', () => {
            const occupied = adb(['forward', '--list']).split(/\r?\n/).some((line) => /\btcp:9222\b/.test(line));
            if (occupied) throw new Error('porta ocupada; rode: adb forward --remove tcp:9222 e tente de novo');
            return true;
        })
        : (console.log('FALHOU — porta tcp:9222 livre: não verificado porque o socket WebView não existe.'), { ok: false });
    allOk &&= portCheck.ok;

    if (portCheck.ok) {
        const forwardCheck = printPreflightStep('forward temporário criado', () => {
            adb(['forward', '--no-rebind', `tcp:${CDP_PORT}`, `localabstract:${socketName}`]);
            forwardCreated = true;
            return true;
        });
        allOk &&= forwardCheck.ok;
    } else {
        console.log('FALHOU — forward temporário criado: não verificado porque a porta não está livre.');
        allOk = false;
    }

    if (forwardCreated) {
        const targetCheck = await (async () => {
            try {
                const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
                if (!response.ok) throw new Error('endpoint CDP local não respondeu');
                const targets = await response.json();
                if (!Array.isArray(targets)) throw new Error('resposta CDP inválida');
                console.log(`OK — lista CDP lida (${targets.length} alvos).`);
                for (const target of targets) console.log(`${String(target.type ?? 'desconhecido')} | ${safeUrl(String(target.url ?? ''))}`);
                targetsRead = true;
                return true;
            } catch {
                console.log('FALHOU — leitura de /json/list: confirme se o socket WebView aceita depuração CDP.');
                return false;
            }
        })();
        allOk &&= targetCheck;
    } else {
        console.log('FALHOU — leitura de /json/list: não verificada porque o forward não foi criado.');
        allOk = false;
    }

    if (forwardCreated) {
        try {
            adb(['forward', '--remove', `tcp:${CDP_PORT}`]);
            forwardCreated = false;
            console.log('OK — forward temporário removido.');
        } catch {
            console.log('FALHOU — remover forward temporário: rode adb forward --remove tcp:9222.');
            allOk = false;
        }
    } else {
        console.log('FALHOU — remover forward temporário: nenhum forward foi criado.');
        allOk = false;
    }

    const finalForwardCheck = printPreflightStep('adb forward --list sem tcp:9222', () => {
        const remaining = adb(['forward', '--list']).split(/\r?\n/).some((line) => /\btcp:9222\b/.test(line));
        if (remaining) throw new Error('tcp:9222 ainda aparece; remova somente o forward criado por este preflight');
        return true;
    });
    allOk &&= finalForwardCheck.ok && targetsRead;
    console.log(allOk ? 'Pronto para coletar.' : 'Corrija os itens FALHOU antes de coletar.');
    return allOk ? 0 : 1;
}

async function confirmAutomation(autoOptions) {
    console.log('Dirigindo o app no aparelho. Para interromper, segure Ctrl+C: nenhum outro toque será feito.');
    let calibration;
    try { calibration = validateCalibration(JSON.parse(readFileSync(CALIBRATION_PATH, 'utf8'))); }
    catch (error) { throw new Error(`Calibração indisponível ou inválida: ${error instanceof Error ? error.message : 'corrija calibracao.json'}`); }
    const touchNames = autoOptions.mode === 'rodadas'
        ? Array.from({ length: autoOptions.rounds }, () => ['entradaPainel', 'cartaoCurso']).flat()
        : Array.from({ length: 20 }, () => ['ida']).flat();
    console.log(`Toques previstos: ${touchNames.length}.`);
    for (const name of [...new Set(touchNames)]) console.log(`${name}: (${calibration[name].x}, ${calibration[name].y})`);
    const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    const answer = await new Promise((resolveAnswer) => prompt.question('Digite exatamente SIM para começar: ', resolveAnswer));
    prompt.close();
    if (!isAutoConfirmationAccepted(answer)) throw new Error('Automação cancelada; nenhum toque foi enviado.');
    return calibration;
}

async function main(autoOptions = null) {
    const calibration = autoOptions ? await confirmAutomation(autoOptions) : null;
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const output = nextOutputNumber();
    const existingForwards = adb(['forward', '--list']);
    if (existingForwards.split(/\r?\n/).some((line) => /\btcp:9222\b/.test(line))) {
        throw new Error('A porta tcp:9222 já tem um forward; rode: adb forward --remove tcp:9222 e tente de novo.');
    }

    let forwardCreated = false;
    let readline;
    let pollTimer;
    let tracingStarted = false;
    let resolveTraceEnded;
    const traceEnded = new Promise((resolveTrace) => { resolveTraceEnded = resolveTrace; });
    let startedAtEpochMs = 0;
    let startedAtMono = performance.now();
    let recordingStartedAtEpochMs = null;
    let recording = false;
    let stopping = false;
    let traceAvailable = false;
    const gcEnabled = process.env.GC === '1' || autoOptions?.mode === 'vazamento';
    const leakEnabled = process.env.LEAK === '1' || autoOptions?.mode === 'vazamento';
    const transitions = [];
    const leakCycles = [];
    const allRequests = [];
    const requestById = new Map();
    const clientsById = new Map();
    const clientsByName = new Map();
    const lastTransitionByFrame = new Map();
    const pendingSnapshots = new Set();
    const pendingUserActions = new Set();
    const longTaskEntries = [];
    const preRecordingLongTasks = [];
    const pendingLongTasks = [];
    const traceCounters = { runTaskOver50ms: 0, scriptUs: 0, styleUs: 0, layoutUs: 0, paintUs: 0 };
    let primaryClient = null;
    let currentTransition = null;
    let startedAt = null;
    let autoAbortReason = null;
    let autoCompletedSteps = 0;
    let autoRunnerPromise = null;
    const autoMode = Boolean(autoOptions);
    let userActionQueue = Promise.resolve();
    let extraTargetNumber = 0;
    let refreshingTargets = false;
    const attemptedExtraTargets = new Map();

    const elapsedNow = () => Math.max(0, performance.now() - startedAtMono);
    const transitionForRequest = (targetName, atMs) =>
        [...transitions].reverse().find((item) => item.target === targetName && item.elapsedMs <= atMs) ??
        [...transitions].reverse().find((item) => item.elapsedMs <= atMs) ?? transitions[0];
    const requestKey = (client, requestId) => `${client.id}:${requestId}`;
    const clientForTransition = (transition) => clientsByName.get(transition?.target) ?? primaryClient;

    const addTransition = ({ kind, rawUrl, route = '', frameId = '', source = 'Page', atMs = elapsedNow(), client = primaryClient }) => {
        const url = safeUrl(rawUrl);
        const safeRoute = route ? safePathname(route.startsWith('/') ? route : `/${route}`) : '';
        const frameKey = `${client.name}:${frameId || 'main'}`;
        const candidate = { target: client.name, frameKey, kind, url, route: safeRoute, elapsedMs: atMs };
        const previousForFrame = lastTransitionByFrame.get(frameKey);
        if (shouldDeduplicateTransition(previousForFrame, candidate, atMs)) return previousForFrame;

        const previous = transitions.at(-1);
        const transition = {
            sequence: transitions.length + 1,
            target: client.name,
            targetUrl: client.targetUrl,
            elapsedMs: Number(atMs.toFixed(2)),
            timestamp: timestampAt(atMs, startedAtEpochMs),
            frameNavigatedElapsedMs: source === 'Page.frameNavigated' ? Number(atMs.toFixed(2)) : null,
            frameNavigatedTimestamp: source === 'Page.frameNavigated' ? timestampAt(atMs, startedAtEpochMs) : null,
            kind,
            source,
            frame: frameId && client.frameParents.has(frameId) ? 'iframe' : 'main',
            frameKey,
            url,
            route: safeRoute,
            from: previous ? { url: previous.url, route: previous.route } : null,
            contentUsableMs: null,
            requests: { count: 0, encodedBytes: 0, failed: 0, byHost: new Map() },
            longTasks: [],
            performance: null,
            listeners: null,
            trace: { runTaskOver50ms: 0, scriptUs: 0, styleUs: 0, layoutUs: 0, paintUs: 0 },
        };
        transitions.push(transition);
        currentTransition = transition;
        lastTransitionByFrame.set(frameKey, transition);
        client.lastUrlByFrame.set(frameId || 'main', url);
        client.lastRouteByFrame.set(frameId || 'main', safeRoute);
        scheduleSnapshot(transition);
        console.log(`Transição ${transition.sequence}: ${transition.target} ${transition.kind} ${transition.url}`);
        return transition;
    };

    const scheduleSnapshot = (transition) => {
        const client = clientForTransition(transition);
        if (!client || !recording) return;
        const task = (async () => {
            await new Promise((resolve) => setTimeout(resolve, 80));
            try {
                transition.performance = formatMetrics(await client.cdp.call('Performance.getMetrics'));
            } catch {
                transition.performance = transition.performance ?? {};
            }
            const values = [];
            for (const contextId of client.contexts.keys()) {
                try {
                    const result = await client.cdp.call('Runtime.evaluate', {
                        expression: 'window.__IFRN_PHASE2_COLLECTOR__?.snapshot?.() ?? null',
                        contextId,
                        returnByValue: true,
                        awaitPromise: false,
                    });
                    if (result.result?.value) values.push(result.result.value);
                } catch {
                    // O contexto pode ter sido destruído durante a navegação.
                }
            }
            if (values.length) {
                transition.listeners = values.reduce((sum, item) => ({
                    contexts: sum.contexts + 1,
                    window: sum.window + (Number(item.windowListeners) || 0),
                    document: sum.document + (Number(item.documentListeners) || 0),
                    domNodesFromContexts: sum.domNodesFromContexts + (Number(item.domNodes) || 0),
                }), { contexts: 0, window: 0, document: 0, domNodesFromContexts: 0 });
            }
        })().finally(() => pendingSnapshots.delete(task));
        pendingSnapshots.add(task);
    };

    const collectGcSnapshot = async (client) => {
        if (!client.heapProfilerEnableAttempted) {
            client.heapProfilerEnableAttempted = true;
            try {
                await client.cdp.call('HeapProfiler.enable');
                client.heapProfilerEnabled = true;
            } catch {
                client.heapProfilerEnabled = false;
            }
        }
        let gcSucceeded = false;
        try {
            await client.cdp.call('HeapProfiler.collectGarbage');
            gcSucceeded = true;
        } catch {
            // Algumas versões da WebView podem não oferecer HeapProfiler.
        }
        let metrics = {};
        try {
            metrics = formatMetrics(await client.cdp.call('Performance.getMetrics'));
        } catch {
            // Métricas indisponíveis ficam null no snapshot.
        }
        const listeners = await getDomDebuggerListenerCounts(client.cdp, [...client.contexts.keys()]);
        return {
            JSHeapUsedSize: metrics.JSHeapUsedSize ?? null,
            Nodes: metrics.Nodes ?? null,
            listenersWindow: listeners.listenersWindow,
            listenersDocument: listeners.listenersDocument,
            listenersWindowByType: listeners.listenersWindowByType,
            listenersDocumentByType: listeners.listenersDocumentByType,
            listenersComplete: listeners.complete,
            heapProfilerEnabled: client.heapProfilerEnabled ?? false,
            gcSucceeded,
        };
    };

    const addLeakCycle = async () => {
        const transition = transitions.at(-1);
        const client = clientForTransition(transition);
        const snapshot = await collectGcSnapshot(client);
        const cycle = {
            n: leakCycles.length + 1,
            JSHeapUsedSize: snapshot.JSHeapUsedSize,
            Nodes: snapshot.Nodes,
            listenersWindow: snapshot.listenersWindow,
            listenersDocument: snapshot.listenersDocument,
        };
        leakCycles.push(cycle);
        console.log(`Ciclo ${cycle.n} registrado.`);
    };

    const appendRequest = (client, id, rawUrl, type) => {
        const startedAtMs = elapsedNow();
        const transition = transitionForRequest(client.name, startedAtMs);
        const request = {
            target: client.name,
            targetUrl: client.targetUrl,
            host: hostOf(rawUrl),
            resourceType: String(type ?? 'Other'),
            startedAtMs,
            finishedAtMs: null,
            encodedBytes: 0,
            failed: false,
            transitionSequence: transition?.sequence ?? null,
        };
        allRequests.push(request);
        if (transition) {
            const hostEntry = transition.requests.byHost.get(request.host) ?? { requests: 0, encodedBytes: 0, failed: 0 };
            hostEntry.requests += 1;
            transition.requests.byHost.set(request.host, hostEntry);
            transition.requests.count += 1;
        }
        requestById.set(id, request);
        return request;
    };

    const finalizeRequest = (request, bytes = 0, failed = false) => {
        if (!request || request.finishedAtMs !== null) return;
        request.finishedAtMs = elapsedNow();
        request.encodedBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
        request.failed = failed;
        const transition = transitions.find((item) => item.sequence === request.transitionSequence);
        if (transition) {
            const hostEntry = transition.requests.byHost.get(request.host);
            if (hostEntry) {
                hostEntry.encodedBytes += request.encodedBytes;
                if (failed) hostEntry.failed += 1;
            }
            transition.requests.encodedBytes += request.encodedBytes;
            if (failed) transition.requests.failed += 1;
        }
    };

    const handleLongTask = (client, contextId, payload) => {
        let info;
        try { info = JSON.parse(payload); } catch { return; }
        const context = client.contexts.get(contextId);
        const entry = {
            timeOrigin: Number(info.timeOrigin ?? context?.timeOrigin),
            startTime: Number(info.startTime),
            durationMs: Number(info.durationMs),
        };
        if (recordingStartedAtEpochMs === null) {
            pendingLongTasks.push({ client, entry });
            return;
        }
        const classified = classifyLongTask(entry, recordingStartedAtEpochMs, client.name, client.targetUrl);
        if (!classified) return;
        if (classified.phase === 'preGravacao') preRecordingLongTasks.push(classified.entry);
        else longTaskEntries.push(classified.entry);
    };

    const classifyPendingLongTasks = () => {
        for (const item of pendingLongTasks.splice(0)) {
            const classified = classifyLongTask(item.entry, recordingStartedAtEpochMs, item.client.name, item.client.targetUrl);
            if (!classified) continue;
            if (classified.phase === 'preGravacao') preRecordingLongTasks.push(classified.entry);
            else longTaskEntries.push(classified.entry);
        }
    };

    const handleRoutePayload = (client, contextId, payload) => {
        const context = client.contexts.get(contextId);
        if (!context) return;
        let info;
        try { info = JSON.parse(payload); } catch { return; }
        const frameId = context.frameId || '';
        const key = frameId || 'main';
        if (info.kind === 'init') {
            context.timeOrigin = Number(info.timeOrigin) || null;
            const safe = safeUrl(info.href);
            if (!client.lastUrlByFrame.has(key)) client.lastUrlByFrame.set(key, safe);
            if (!client.lastRouteByFrame.has(key)) client.lastRouteByFrame.set(key, safeHashRoute(info.href));
            return;
        }
        if (!recording || typeof info.href !== 'string') return;
        const kind = info.kind === 'hash' ? 'hash' : 'route';
        const route = safeHashRoute(info.href);
        const safe = safeUrl(info.href);
        if (client.lastUrlByFrame.get(key) === safe && client.lastRouteByFrame.get(key) === route && kind !== 'hash') return;
        addTransition({ kind, rawUrl: info.href, route, frameId, source: 'Runtime route binding', client });
    };

    const attachContext = async (client, contextId) => {
        try {
            await client.cdp.call('Runtime.evaluate', {
                expression: PAGE_INSTRUMENTATION_SOURCE,
                contextId,
                returnByValue: true,
                awaitPromise: false,
            });
        } catch {
            // Contextos que já foram destruídos não precisam de nova tentativa.
        }
    };

    const connectTarget = async (target, name, isPrimary) => {
        const clientId = String(target.id ?? target.webSocketDebuggerUrl);
        const cdp = makeCdpClient(target.webSocketDebuggerUrl);
        let instrumentationReady = false;
        const client = {
            id: clientId,
            name,
            targetUrl: safeUrl(target.url),
            cdp,
            contexts: new Map(),
            frameParents: new Map(),
            lastUrlByFrame: new Map(),
            lastRouteByFrame: new Map(),
            pendingDocumentByFrame: new Map(),
            requestKeys: new Set(),
            isPrimary,
            heapProfilerEnableAttempted: false,
            heapProfilerEnabled: false,
        };
        await cdp.opened;
        clientsById.set(clientId, client);
        clientsByName.set(name, client);

        cdp.on('Runtime.executionContextCreated', (params) => {
            const context = params.context;
            if (!context?.auxData?.isDefault) return;
            client.contexts.set(context.id, { frameId: context.auxData.frameId ?? '', timeOrigin: null });
            if (recording && instrumentationReady) void attachContext(client, context.id);
        });
        cdp.on('Runtime.executionContextDestroyed', (params) => client.contexts.delete(params.executionContextId));
        cdp.on('Runtime.executionContextsCleared', () => client.contexts.clear());
        cdp.on('Runtime.bindingCalled', (params) => {
            if (params.name === '__ifrnPhase2Route') handleRoutePayload(client, params.executionContextId, params.payload);
            if (params.name === '__ifrnPhase2LongTask') handleLongTask(client, params.executionContextId, params.payload);
        });
        cdp.on('Network.requestWillBeSent', (params) => {
            if (!recording) return;
            if (autoMode && params.request?.method === 'POST' && !autoAbortReason) {
                autoAbortReason = 'requisição POST detectada';
                console.log(`ABORTADO: ${autoAbortReason}`);
            }
            const key = requestKey(client, params.requestId);
            if (params.redirectResponse && requestById.has(key)) {
                finalizeRequest(requestById.get(key), Number(params.redirectResponse.encodedDataLength) || 0, false);
            }
            if (params.type === 'Document' && params.frameId) {
                const pending = client.pendingDocumentByFrame.get(params.frameId);
                if (!pending || pending.url !== safeUrl(params.request.url) || elapsedNow() - pending.atMs > 10000) {
                    const transition = addTransition({ kind: 'Document', rawUrl: params.request.url, frameId: params.frameId, source: 'Network Document', client });
                    client.pendingDocumentByFrame.set(params.frameId, { transition, url: safeUrl(params.request.url), atMs: elapsedNow() });
                }
            }
            const request = appendRequest(client, key, params.request.url, params.type);
            client.requestKeys.add(key);
        });
        cdp.on('Network.loadingFinished', (params) => {
            if (!recording) return;
            const key = requestKey(client, params.requestId);
            finalizeRequest(requestById.get(key), Number(params.encodedDataLength) || 0, false);
            requestById.delete(key);
            client.requestKeys.delete(key);
        });
        cdp.on('Network.loadingFailed', (params) => {
            if (!recording) return;
            const key = requestKey(client, params.requestId);
            finalizeRequest(requestById.get(key), 0, true);
            requestById.delete(key);
            client.requestKeys.delete(key);
        });
        cdp.on('Page.frameNavigated', (params) => {
            if (!recording || !params.frame?.url) return;
            const frame = params.frame;
            if (frame.parentId) client.frameParents.set(frame.id, frame.parentId);
            else client.frameParents.delete(frame.id);
            const safe = safeUrl(frame.url);
            const pending = client.pendingDocumentByFrame.get(frame.id);
            if (pending && pending.url === safe && elapsedNow() - pending.atMs <= 10000) {
                pending.transition.frame = frame.parentId ? 'iframe' : 'main';
                pending.transition.frameNavigatedElapsedMs = Number(elapsedNow().toFixed(2));
                pending.transition.frameNavigatedTimestamp = timestampAt(elapsedNow(), startedAtEpochMs);
                client.pendingDocumentByFrame.delete(frame.id);
                scheduleSnapshot(pending.transition);
                client.lastUrlByFrame.set(frame.id, safe);
            } else {
                addTransition({ kind: 'Document', rawUrl: frame.url, frameId: frame.id, source: 'Page.frameNavigated', client });
            }
        });
        cdp.on('Page.navigatedWithinDocument', (params) => {
            if (!recording) return;
            const navigation = withinDocumentTransition(params);
            if (!navigation) return;
            addTransition({
                kind: navigation.kind,
                rawUrl: navigation.url,
                route: navigation.route,
                frameId: navigation.frameId,
                source: navigation.source,
                client,
            });
        });
        if (isPrimary) {
            cdp.on('Tracing.dataCollected', (params) => {
                if (!tracingStarted || !recording) return;
                for (const event of params.value ?? []) {
                    if (event.ph !== 'X' || !Number.isFinite(event.dur)) continue;
                    const durationUs = Math.max(0, event.dur);
                    const nameValue = String(event.name ?? '');
                    const transition = currentTransition?.target === client.name ? currentTransition : null;
                    if (nameValue === 'RunTask' && durationUs >= 50000) {
                        traceCounters.runTaskOver50ms += 1;
                        if (transition) transition.trace.runTaskOver50ms += 1;
                    }
                    if (/^(FunctionCall|EvaluateScript|CompileScript|V8.Execute)$/.test(nameValue)) {
                        traceCounters.scriptUs += durationUs;
                        if (transition) transition.trace.scriptUs += durationUs;
                    }
                    if (/^(UpdateLayoutTree|RecalculateStyles)$/.test(nameValue)) {
                        traceCounters.styleUs += durationUs;
                        if (transition) transition.trace.styleUs += durationUs;
                    }
                    if (nameValue === 'Layout') {
                        traceCounters.layoutUs += durationUs;
                        if (transition) transition.trace.layoutUs += durationUs;
                    }
                    if (nameValue === 'Paint') {
                        traceCounters.paintUs += durationUs;
                        if (transition) transition.trace.paintUs += durationUs;
                    }
                }
            });
            cdp.on('Tracing.tracingComplete', () => resolveTraceEnded());
        }

        await cdp.call('Runtime.enable');
        await cdp.call('Page.enable');
        await cdp.call('Performance.enable');
        await cdp.call('Runtime.addBinding', { name: '__ifrnPhase2Route' });
        await cdp.call('Runtime.addBinding', { name: '__ifrnPhase2LongTask' });
        await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_INSTRUMENTATION_SOURCE });
        instrumentationReady = true;
        const frameTree = await cdp.call('Page.getFrameTree');
        const walkFrameTree = (node, parentId = '') => {
            if (!node?.frame?.id) return;
            const id = node.frame.id;
            if (parentId) client.frameParents.set(id, parentId);
            client.lastUrlByFrame.set(id, safeUrl(node.frame.url));
            client.lastRouteByFrame.set(id, safeHashRoute(node.frame.url));
            for (const child of node.childFrames ?? []) walkFrameTree(child, id);
        };
        walkFrameTree(frameTree.frameTree);
        await Promise.all([...client.contexts.keys()].map((contextId) => attachContext(client, contextId)));
        if (recording && !isPrimary) {
            addTransition({ kind: 'alvo', rawUrl: target.url, source: 'novo alvo CDP', client, atMs: elapsedNow() });
            console.log(`Novo alvo detectado: ${client.targetUrl}`);
        }
        await cdp.call('Network.enable');
        return { client, frameTree };
    };

    const stop = () => {
        if (stopping) return;
        stopping = true;
        readline?.close();
    };

    const enqueueUserAction = (action) => {
        const task = userActionQueue.then(action);
        userActionQueue = task.catch(() => {});
        pendingUserActions.add(task);
        task.then(() => pendingUserActions.delete(task), () => pendingUserActions.delete(task));
    };

    const refreshTargets = async () => {
        if (!recording || stopping || refreshingTargets) return;
        refreshingTargets = true;
        try {
            const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
            if (!response.ok) return;
            const targets = await response.json();
            if (!Array.isArray(targets)) return;
            const liveIds = new Set();
            for (const target of targets.filter(isTrackablePageTarget)) {
                const id = String(target.id ?? target.webSocketDebuggerUrl);
                liveIds.add(id);
                if (clientsById.has(id)) continue;
                const lastAttempt = attemptedExtraTargets.get(id) ?? 0;
                if (Date.now() - lastAttempt < 5000) continue;
                attemptedExtraTargets.set(id, Date.now());
                extraTargetNumber += 1;
                const name = `extra-${extraTargetNumber}`;
                try {
                    await connectTarget(target, name, false);
                } catch {
                    const failedClient = clientsById.get(id);
                    if (failedClient) {
                        if (failedClient.cdp.socket.readyState === WebSocket.OPEN) failedClient.cdp.socket.close();
                        clientsById.delete(id);
                        clientsByName.delete(failedClient.name);
                        console.log(`Alvo encerrado: ${failedClient.targetUrl}`);
                    }
                    console.log(`Falha ao conectar a alvo extra: ${safeUrl(target.url)}`);
                }
            }
            for (const [id, client] of clientsById) {
                if (liveIds.has(id) && client.cdp.socket.readyState === WebSocket.OPEN) continue;
                for (const key of client.requestKeys) {
                    finalizeRequest(requestById.get(key), 0, false);
                    requestById.delete(key);
                }
                client.requestKeys.clear();
                if (client.cdp.socket.readyState === WebSocket.OPEN) client.cdp.socket.close();
                clientsById.delete(id);
                clientsByName.delete(client.name);
                console.log(`Alvo encerrado: ${client.targetUrl}`);
            }
        } catch {
            // A lista pode ficar indisponível durante uma troca de WebView.
        } finally {
            refreshingTargets = false;
        }
    };

    const snapshotRoutes = async () => {
        const routes = [];
        for (const client of clientsByName.values()) {
            try {
                const tree = await client.cdp.call('Page.getFrameTree');
                const frame = tree.frameTree?.frame;
                if (!frame?.url) continue;
                const route = safeUrl(frame.url);
                client.targetUrl = route;
                client.frameId = frame.id ?? client.frameId ?? '';
                routes.push({ target: client.name, url: route, route: safePathname(new URL(route).pathname) });
            } catch {
                routes.push({ target: client.name, url: client.targetUrl, route: safePathname(new URL(client.targetUrl).pathname) });
            }
        }
        return routes;
    };

    const checkAutoRoutes = (routes) => {
        if (routes.some((item) => hasBlockedAutoRoute(`${item.url} ${item.route}`))) {
            autoAbortReason ??= 'rota fora da allowlist';
            console.log(`ABORTADO: ${autoAbortReason}`);
            return false;
        }
        return true;
    };

    const waitUntilReady = async (label) => {
        const started = performance.now();
        const samples = [];
        let ready = false;
        while (!stopping && !autoAbortReason && performance.now() - started < 20000) {
            const routes = await snapshotRoutes();
            if (!checkAutoRoutes(routes)) break;
            let nodes = 0;
            let metricsAvailable = false;
            for (const client of clientsByName.values()) {
                try {
                    const metrics = formatMetrics(await client.cdp.call('Performance.getMetrics'));
                    if (Number.isFinite(metrics.Nodes)) { nodes += metrics.Nodes; metricsAvailable = true; }
                } catch { /* timeout de pronta será registrado sem métricas */ }
            }
            samples.push({ atMs: performance.now() - started, inFlight: requestById.size, nodes: metricsAvailable ? nodes : -1 });
            if (evaluateReadiness(samples)) { ready = true; break; }
            await new Promise((resolveWait) => setTimeout(resolveWait, 200));
        }
        const transition = transitions.at(-1);
        if (transition) {
            transition.contentUsableMs = Number(Math.max(0, elapsedNow() - transition.elapsedMs).toFixed(2));
            transition.contentUsableTimestamp = timestampAt(elapsedNow(), startedAtEpochMs);
            transition.contentUsableMethod = 'heuristica-automatica';
            transition.contentUsableTimedOut = !ready;
        }
        if (!ready && !autoAbortReason && !stopping) console.log(`Timeout de pronta: ${label}; seguindo para a próxima etapa.`);
        return ready;
    };

    const performTap = async (pointName) => {
        if (!['entradaPainel', 'cartaoCurso', 'ida'].includes(pointName)) throw new Error('Ponto de toque não permitido.');
        if (stopping || autoAbortReason) return false;
        await refreshTargets();
        const before = await snapshotRoutes();
        if (!checkAutoRoutes(before)) return false;
        const { x, y } = calibration[pointName];
        adb(['shell', 'input', 'tap', String(x), String(y)], 3000);
        autoCompletedSteps += 1;
        await new Promise((resolveWait) => setTimeout(resolveWait, 300));
        await refreshTargets();
        const after = await snapshotRoutes();
        return checkAutoRoutes(after) && !stopping && !autoAbortReason;
    };

    const performBack = async () => {
        if (stopping || autoAbortReason) return false;
        await refreshTargets();
        const before = await snapshotRoutes();
        if (!checkAutoRoutes(before)) return false;
        adb(['shell', 'input', 'keyevent', '4'], 3000);
        autoCompletedSteps += 1;
        await new Promise((resolveWait) => setTimeout(resolveWait, 300));
        await refreshTargets();
        return checkAutoRoutes(await snapshotRoutes());
    };

    const runAutomation = async () => {
        try {
            if (autoOptions.mode === 'rodadas') {
                const initialRoutes = await snapshotRoutes();
                if (!initialRoutes.some((item) => /marketplace-ifrn/i.test(item.url))) {
                    autoAbortReason = 'abra o Marketplace antes de iniciar';
                    console.log(`ABORTADO: ${autoAbortReason}`);
                    return;
                }
                await waitUntilReady('Marketplace inicial');
                for (let round = 1; round <= autoOptions.rounds && !stopping && !autoAbortReason; round += 1) {
                    if (!await performTap('entradaPainel')) break;
                    await waitUntilReady(`Painel rodada ${round}`);
                    if (autoAbortReason || stopping) break;
                    if (!await performTap('cartaoCurso')) break;
                    await waitUntilReady(`curso rodada ${round}`);
                    if (autoAbortReason || stopping) break;
                    if (!await performBack()) break;
                    await waitUntilReady(`retorno ao Painel rodada ${round}`);
                    let routes = await snapshotRoutes();
                    for (let back = 0; back < 2 && !routes.some((item) => /marketplace-ifrn/i.test(item.url)) && !autoAbortReason && !stopping; back += 1) {
                        if (!await performBack()) break;
                        routes = await snapshotRoutes();
                    }
                    if (!routes.some((item) => /marketplace-ifrn/i.test(item.url))) {
                        autoAbortReason = 'Marketplace não retornou em até duas voltas';
                        console.log(`ABORTADO: ${autoAbortReason}`);
                        break;
                    }
                    await waitUntilReady(`Marketplace rodada ${round}`);
                    if (round < autoOptions.rounds && !autoAbortReason && !stopping) await new Promise((resolveWait) => setTimeout(resolveWait, 3000));
                }
            } else {
                await addLeakCycle();
                for (let cycle = 0; cycle < 20 && !stopping && !autoAbortReason; cycle += 1) {
                    if (!await performTap('ida')) break;
                    await waitUntilReady(`ida vazamento ${cycle + 1}`);
                    if (autoAbortReason || stopping || !await performBack()) break;
                    await waitUntilReady(`volta vazamento ${cycle + 1}`);
                    if (autoAbortReason || stopping) break;
                    await addLeakCycle();
                }
            }
        } catch {
            autoAbortReason ??= 'falha em etapa automatizada';
            console.log(`ABORTADO: ${autoAbortReason}`);
        }
    };

    try {
        const pids = adb(['shell', 'pidof', APP_PACKAGE]).split(/\s+/).filter(Boolean);
        const pid = pids[0];
        if (!pid) throw new Error(`Não encontrei processo ativo para ${APP_PACKAGE}; abra o app manualmente e tente novamente.`);
        const socketLines = adb(['shell', 'cat', '/proc/net/unix']).split(/\r?\n/);
        const socketName = socketLines.map((line) => line.trim().split(/\s+/).at(-1) ?? '')
            .map((name) => name.replace(/^@/, ''))
            .find((name) => name === `webview_devtools_remote_${pid}`);
        if (!socketName) throw new Error('Socket de depuração WebView não encontrado; deixe uma tela do app aberta e tente novamente.');
        adb(['forward', '--no-rebind', `tcp:${CDP_PORT}`, `localabstract:${socketName}`]);
        forwardCreated = true;

        const targetListResponse = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (!targetListResponse.ok) throw new Error('Endpoint local de alvos CDP indisponível.');
        const targetList = await targetListResponse.json();
        if (!Array.isArray(targetList)) throw new Error('A lista de alvos CDP é inválida.');
        const target = selectInitialTarget(targetList);
        const connected = await connectTarget(target, 'principal', true);
        primaryClient = connected.client;
        try {
            await primaryClient.cdp.call('Tracing.start', {
                categories: 'devtools.timeline,blink.user_timing,v8',
                transferMode: 'ReportEvents',
            });
            tracingStarted = true;
            traceAvailable = true;
        } catch {
            tracingStarted = false;
            traceAvailable = false;
        }

        startedAtEpochMs = Date.now();
        startedAtMono = performance.now();
        startedAt = new Date(startedAtEpochMs).toISOString();
        recordingStartedAtEpochMs = startedAtEpochMs;
        recording = true;
        const rootFrame = connected.frameTree.frameTree?.frame;
        addTransition({ kind: 'início', rawUrl: rootFrame?.url ?? target.url, frameId: rootFrame?.id ?? '', source: 'CDP snapshot', client: primaryClient, atMs: 0 });
        classifyPendingLongTasks();
        scheduleSnapshot(transitions[0]);
        await refreshTargets();
        pollTimer = setInterval(() => { void refreshTargets(); }, 1000);

        console.log(`Gravando a página do app (${primaryClient.targetUrl}).`);
        console.log('Marque cada tela pronta com u + Enter. Em LEAK=1, marque o fim de cada ciclo com c + Enter. Enter vazio encerra e salva.');
        readline = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
        readline.on('line', (line) => {
            if (line.trim() === '') {
                stop();
                return;
            }
            if (line.trim().toLowerCase() === 'u') {
                const transition = transitions.at(-1);
                if (!transition) return;
                transition.contentUsableMs = Number(Math.max(0, elapsedNow() - transition.elapsedMs).toFixed(2));
                transition.contentUsableTimestamp = timestampAt(elapsedNow(), startedAtEpochMs);
                enqueueUserAction(async () => {
                    if (gcEnabled) transition.usableSnapshot = await collectGcSnapshot(clientForTransition(transition));
                    console.log(`Transição ${transition.sequence} (${transition.target}) marcada como utilizável em ${transition.contentUsableMs.toFixed(0)} ms.`);
                });
                return;
            }
            if (line.trim().toLowerCase() === 'c' && leakEnabled) {
                enqueueUserAction(addLeakCycle);
                return;
            }
            console.log(leakEnabled
                ? 'Comando não reconhecido. Use u + Enter (tela pronta), c + Enter (fim de ciclo), ou Enter vazio (encerrar).'
                : 'Comando não reconhecido. Use u + Enter (tela pronta), ou Enter vazio (encerrar).');
        });
        readline.on('close', () => { stopping = true; });
        process.once('SIGINT', () => {
            if (autoMode && !autoAbortReason) {
                autoAbortReason = 'interrompido por Ctrl+C';
                console.log('ABORTADO: interrompido por Ctrl+C');
            }
            stop();
        });
        process.once('SIGTERM', stop);
        if (autoMode) {
            autoRunnerPromise = runAutomation();
            await autoRunnerPromise;
            stop();
        } else {
            await new Promise((resolveStop) => readline.once('close', resolveStop));
        }
        await Promise.allSettled([...pendingUserActions]);
        console.log('Encerrando a coleta; aguardo até 2 s para concluir requests em andamento.');
        await new Promise((resolveDrain) => setTimeout(resolveDrain, 2000));
        recording = false;
        clearInterval(pollTimer);

        for (const request of requestById.values()) finalizeRequest(request, 0, false);
        requestById.clear();
        if (tracingStarted) {
            try {
                await primaryClient.cdp.call('Tracing.end');
                await Promise.race([traceEnded, new Promise((resolve) => setTimeout(resolve, 3000))]);
            } catch {
                traceAvailable = false;
            } finally {
                tracingStarted = false;
            }
        }
        await Promise.allSettled([...pendingSnapshots]);

        const durationMs = elapsedNow();
        const hostTotals = new Map();
        for (const request of allRequests) {
            const entry = hostTotals.get(request.host) ?? { requests: 0, encodedBytes: 0, failed: 0 };
            entry.requests += 1;
            entry.encodedBytes += request.encodedBytes;
            if (request.failed) entry.failed += 1;
            hostTotals.set(request.host, entry);
        }
        const preGravacao = summarizeDuration(preRecordingLongTasks);
        const tasksPerTransition = transitions.map((transition, index) => {
            const end = transitions[index + 1]?.elapsedMs ?? durationMs;
            return longTaskEntries.filter((task) => task.target === transition.target && task.elapsedMs >= transition.elapsedMs && task.elapsedMs < end);
        });
        const transitionsJson = transitions.map((transition, index) => {
            const observedTasks = tasksPerTransition[index];
            const byHost = [...transition.requests.byHost.entries()].map(([host, values]) => ({ host, ...values }));
            const requestEntries = allRequests.filter((request) => request.transitionSequence === transition.sequence).map((request) => ({
                target: request.target,
                targetUrl: request.targetUrl,
                host: request.host,
                resourceType: request.resourceType,
                startedAtMs: Number(request.startedAtMs.toFixed(2)),
                finishedAtMs: request.finishedAtMs === null ? null : Number(request.finishedAtMs.toFixed(2)),
                encodedBytes: request.encodedBytes,
                failed: request.failed,
            }));
            return {
                sequence: transition.sequence,
                target: transition.target,
                targetUrl: transition.targetUrl,
                timestamp: transition.timestamp,
                elapsedMs: transition.elapsedMs,
                frameNavigatedTimestamp: transition.frameNavigatedTimestamp,
                frameNavigatedElapsedMs: transition.frameNavigatedElapsedMs,
                kind: transition.kind,
                source: transition.source,
                frame: transition.frame,
                from: transition.from,
                url: transition.url,
                route: transition.route,
                contentUsableMs: transition.contentUsableMs,
                contentUsableMethod: transition.contentUsableMethod ?? null,
                contentUsableTimedOut: transition.contentUsableTimedOut ?? false,
                contentUsableTimestamp: transition.contentUsableTimestamp ?? null,
                requests: {
                    count: transition.requests.count,
                    encodedBytes: transition.requests.encodedBytes,
                    failed: transition.requests.failed,
                    byHost,
                    entries: requestEntries,
                },
                longTasks: { ...summarizeDuration(observedTasks), entries: observedTasks },
                performance: transition.performance,
                listenersInstrumentados: transition.listeners,
                usableSnapshot: transition.usableSnapshot ?? null,
                trace: {
                    runTaskOver50ms: transition.trace.runTaskOver50ms,
                    scriptMs: Number((transition.trace.scriptUs / 1000).toFixed(2)),
                    styleMs: Number((transition.trace.styleUs / 1000).toFixed(2)),
                    layoutMs: Number((transition.trace.layoutUs / 1000).toFixed(2)),
                    paintMs: Number((transition.trace.paintUs / 1000).toFixed(2)),
                },
            };
        });
        const longTaskSummary = summarizeDuration(longTaskEntries);
        const data = {
            schemaVersion: 2,
            measurementId: `medicao-${output.suffix}`,
            startedAt,
            durationMs: Number(durationMs.toFixed(2)),
            firstMeasurementDesignatedCold: true,
            coldMeasurementNote: 'Primeira rodada indicada como fria pelo operador; dados/cache não são limpos pelo coletor.',
            appPackage: APP_PACKAGE,
            target: { name: primaryClient.name, type: target.type, url: primaryClient.targetUrl },
            targets: [...clientsByName.values()].map((client) => ({ target: client.name, targetUrl: client.targetUrl })),
            tracing: { started: traceAvailable },
            transitions: transitionsJson,
            hosts: [...hostTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([host, values]) => ({ host, ...values })),
            cdn: {
                jsDelivr: { requestCount: [...hostTotals].filter(([host]) => /jsdelivr\.net$/i.test(host)).reduce((sum, [, item]) => sum + item.requests, 0) },
                vlibras: { requestCount: [...hostTotals].filter(([host]) => /(^|\.)vlibras\.gov\.br$/i.test(host)).reduce((sum, [, item]) => sum + item.requests, 0) },
            },
            longTasks: { ...longTaskSummary, preGravacao, entries: longTaskEntries, preGravacaoEntries: preRecordingLongTasks },
            trace: {
                available: traceAvailable,
                runTaskOver50ms: traceCounters.runTaskOver50ms,
                scriptMs: Number((traceCounters.scriptUs / 1000).toFixed(2)),
                styleMs: Number((traceCounters.styleUs / 1000).toFixed(2)),
                layoutMs: Number((traceCounters.layoutUs / 1000).toFixed(2)),
                paintMs: Number((traceCounters.paintUs / 1000).toFixed(2)),
            },
            listenersInstrumentados: transitionsJson.reduce((latest, item) => item.listenersInstrumentados ?? latest, { window: 0, document: 0 }),
            ...(leakEnabled ? { leakCycles, leakAnalysis: buildLeakAnalysis(leakCycles) } : {}),
            ...(autoMode ? { automation: { mode: autoOptions.mode, completedSteps: autoCompletedSteps, abortReason: autoAbortReason } } : {}),
            privacy: {
                queryStringsSaved: false,
                rawFragmentsSaved: false,
                sanitizedRouteFromHashSaved: true,
                headersSaved: false,
                responseBodiesSaved: false,
                cookiesSaved: false,
                pageTextSaved: false,
                numericPathIdentifiersRedacted: true,
            },
        };
        const markdown = buildMarkdown(data);
        const jsonFd = openSync(output.jsonPath, 'wx', 0o600);
        try { writeFileSync(jsonFd, `${JSON.stringify(data, null, 2)}\n`, 'utf8'); } finally { closeSync(jsonFd); }
        const markdownFd = openSync(output.markdownPath, 'wx', 0o600);
        try { writeFileSync(markdownFd, markdown, 'utf8'); } finally { closeSync(markdownFd); }
        console.log(`Arquivos sanitizados gravados: ${output.jsonPath} e ${output.markdownPath}`);
        console.log(`Transições: ${transitions.length}; alvos: ${clientsByName.size}; hosts: ${hostTotals.size}; requests: ${allRequests.length}.`);
    } finally {
        recording = false;
        clearInterval(pollTimer);
        try { readline?.close(); } catch { /* fechamento já realizado */ }
        if (tracingStarted && primaryClient?.cdp.socket.readyState === WebSocket.OPEN) {
            try { await primaryClient.cdp.call('Tracing.end'); } catch { /* trace encerra ao fechar o alvo */ }
            tracingStarted = false;
        }
        for (const client of clientsByName.values()) {
            if (client.cdp.socket.readyState === WebSocket.OPEN) {
                try { client.cdp.socket.close(); } catch { /* socket encerrado */ }
            }
        }
        if (forwardCreated) {
            try { adb(['forward', '--remove', `tcp:${CDP_PORT}`]); } catch {
                console.error('Não consegui remover o forward criado; rode: adb forward --remove tcp:9222.');
            }
        }
    }
}
if (process.argv.includes('--self-test')) {
    process.exitCode = runSelfTest();
} else if (process.argv.includes('--preflight')) {
    runPreflight().then((code) => { process.exitCode = code; }).catch(() => {
        console.log('FALHOU — preflight: erro inesperado; confira ADB e a conexão USB.');
        console.log('Corrija os itens FALHOU antes de coletar.');
        process.exitCode = 1;
    });
} else {
    let autoOptions = null;
    try { autoOptions = parseAutoOptions(process.argv.slice(2)); }
    catch (error) {
        console.error(error instanceof Error ? error.message : 'Opções de automação inválidas.');
        process.exitCode = 1;
    }
    if (process.exitCode !== 1) main(autoOptions).catch((error) => {
        console.error(error instanceof Error ? error.message : 'Falha ao iniciar a coleta CDP.');
        process.exitCode = 1;
    });
}
