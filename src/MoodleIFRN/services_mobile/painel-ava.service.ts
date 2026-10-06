// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CoreOpener } from '@static/opener';
import { Observable, map, of, throwError, timeout } from 'rxjs';

import { PAINEL_AVA_CONFIG } from './painel-ava.config';

/* eslint-disable @typescript-eslint/naming-convention */
/** Resposta mobile de POST /api/v1/authenticate/. */
export interface PainelAvaAuthResponse {
    username?: string;
    access?: string;
    access_token?: string;
    refresh?: string;
    token: string;
    data?: Record<string, unknown>;
}

/**
 * Item bruto da listagem de diários do Painel AVA.
 * Campos tipados só como referência do que o cliente já observava;
 * o serviço registra as chaves realmente presentes na resposta.
 */
export type PainelAvaDiarioRaw = Record<string, unknown>;

/** Envelope legado aceito por compatibilidade. */
export interface PainelAvaDiariosResponse {
    diarios?: PainelAvaDiarioRaw[];
    autoinscricoes?: PainelAvaDiarioRaw[];
    coordenacoes?: PainelAvaDiarioRaw[];
    praticas?: PainelAvaDiarioRaw[];
    [key: string]: unknown;
}

/** Resultado da API v1 (UI + console) — sem tokens. */
export interface PainelAvaV1Result {
    baseUrl: string;
    authenticatePath: string;
    diariosUrl: string;
    usernameHint: string;
    tokenStored: boolean;
    profileKeys: string[];
    responseTopKeys: string[];
    diariosCount: number;
    /** União das chaves vistas em todos os diários. */
    diarioPropertyUnion: string[];
    diarios: PainelAvaDiarioRaw[];
    /** Resumo só com propriedades que existiam em cada item. */
    diariosResumo: Array<Record<string, unknown>>;
}
/* eslint-enable @typescript-eslint/naming-convention */

const REQUEST_TIMEOUT_MS = 20000;
const PAINEL_TOKEN_KEY = 'ifrn_painel_token';
const PAINEL_PROFILE_KEY = 'ifrn_painel_profile';
const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const MAX_TOKEN_LENGTH = 4096;

/** Campos que o time quer inspecionar — só entram no resumo se existirem. */
const DIARIO_INTEREST_KEYS = [
    'id',
    'courseid',
    'fullname',
    'shortname',
    'viewurl',
    'ambiente',
    'diario_id',
    'idnumber',
    'url',
    'details_url',
    'diario',
    'id_diario',
    'id_diario_clean',
    'visible',
    'progress',
    'hasprogress',
    'isfavourite',
    'favourite',
    'is_enrolled',
    'disciplina',
    'curso',
    'turma',
] as const;

function readJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const part = token.split('.')[1];
        const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

        return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function isValidPainelToken(token: string): boolean {
    if (!JWT_SHAPE.test(token) || token.length >= MAX_TOKEN_LENGTH) {
        return false;
    }

    const payload = readJwtPayload(token);

    if (!payload) {
        return false;
    }

    const exp = payload['exp'];

    if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
        return false;
    }

    return true;
}

function describeHttpError(error: unknown, fallback: string): Error {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
            return new Error('Falha de rede ao falar com o Painel AVA.');
        }

        if (error.status === 401 || error.status === 403 || error.status === 428) {
            const detail = (error.error as { detail?: string } | null)?.detail;

            return new Error(detail || 'Sessão/credenciais inválidas no Painel AVA (v1).');
        }

        const detail = (error.error as { detail?: string; message?: string } | null)?.detail
            || (error.error as { message?: string } | null)?.message;

        return new Error(detail || `${fallback} (HTTP ${error.status}).`);
    }

    // NativeHttp rejeita com um objeto de resposta, não com HttpErrorResponse.
    if (isPlainObject(error) && typeof error['status'] === 'number') {
        const status = error['status'];
        const raw = error['error'];
        let payload: Record<string, unknown> | null = isPlainObject(raw) ? raw : null;

        if (!payload && typeof raw === 'string') {
            try {
                const parsed: unknown = JSON.parse(raw);
                payload = isPlainObject(parsed) ? parsed : null;
            } catch {
                // Corpo não-JSON: usa apenas status/fallback.
            }
        }

        const detail = payload && (
            (typeof payload['detail'] === 'string' && payload['detail'])
            || (typeof payload['message'] === 'string' && payload['message'])
        );

        if (status === 401 || status === 403 || status === 428) {
            return new Error(detail || 'Sessão/credenciais inválidas no Painel AVA (v1).');
        }

        if (status <= 0) {
            return new Error('Falha de rede ao falar com o Painel AVA.');
        }

        return new Error(detail || `${fallback} (HTTP ${status}).`);
    }

    if (error instanceof Error) {
        return error;
    }

    return new Error(fallback);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Gera um diagnóstico seguro do erro HTTP para o log temporário do APK.
 * Remove campos sensíveis e limita o tamanho do corpo retornado pelo servidor.
 */
function getSafeHttpErrorDiagnostic(error: unknown): { status: number | string; body: string } {
    let status: number | string = 'desconhecido';
    let raw: unknown = null;

    if (error instanceof HttpErrorResponse) {
        status = error.status;
        raw = error.error;
    } else if (isPlainObject(error)) {
        status = typeof error['status'] === 'number' ? error['status'] : 'desconhecido';
        raw = error['error'] ?? error['data'] ?? null;
    }

    let body: string;

    try {
        body = typeof raw === 'string' ? raw : JSON.stringify(raw);
    } catch {
        body = '[corpo não serializável]';
    }

    if (!body) {
        body = '[sem corpo de resposta]';
    }

    // Evita que credenciais/tokens eventualmente ecoados pelo backend apareçam no adb logcat.
    body = body
        .replace(/(\"?(?:password|senha|token|access_token|refresh_token|authorization)\"?\s*[:=]\s*\"?)[^\",}\s]+/gi, '$1[REDACTED]')
        .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');

    return {
        status,
        body: body.slice(0, 4000),
    };
}

function collectUrlFields(
    value: unknown,
    prefix = '',
    out: Record<string, string> = {},
): Record<string, string> {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        out[prefix || '(root)'] = value;

        return out;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectUrlFields(item, `${prefix}[${index}]`, out);
        });

        return out;
    }

    if (isPlainObject(value)) {
        for (const [key, nested] of Object.entries(value)) {
            const next = prefix ? `${prefix}.${key}` : key;
            collectUrlFields(nested, next, out);
        }
    }

    return out;
}

function pickExistingInterest(diario: PainelAvaDiarioRaw): Record<string, unknown> {
    const picked: Record<string, unknown> = {};

    for (const key of DIARIO_INTEREST_KEYS) {
        if (Object.prototype.hasOwnProperty.call(diario, key)) {
            picked[key] = diario[key];
        }
    }

    const urls = collectUrlFields(diario);

    if (Object.keys(urls).length > 0) {
        picked['_urls_encontradas'] = urls;
    }

    return picked;
}

function extractDiariosList(raw: unknown): {
    topKeys: string[];
    diarios: PainelAvaDiarioRaw[];
    envelope: PainelAvaDiariosResponse | null;
} {
    if (Array.isArray(raw)) {
        return {
            topKeys: ['(array)'],
            diarios: raw.filter(isPlainObject) as PainelAvaDiarioRaw[],
            envelope: null,
        };
    }

    if (!isPlainObject(raw)) {
        return { topKeys: [], diarios: [], envelope: null };
    }

    const envelope = raw as PainelAvaDiariosResponse;
    const topKeys = Object.keys(envelope);
    let diarios: PainelAvaDiarioRaw[] = [];

    if (Array.isArray(envelope.diarios)) {
        diarios = envelope.diarios.filter(isPlainObject) as PainelAvaDiarioRaw[];
    } else if (Array.isArray(envelope['results'])) {
        diarios = (envelope['results'] as unknown[]).filter(isPlainObject) as PainelAvaDiarioRaw[];
    }

    return { topKeys, diarios, envelope };
}

function profileUsernameHint(profile: Record<string, unknown> | null, fallback: string): string {
    if (!profile) {
        return fallback;
    }

    // Identidade de conta somente. Nome de exibição NÃO pode virar ifrn_username:
    // isso gerava falso mismatch com o username numérico retornado pelo Moodle.
    const candidates = [
        profile['matricula'],
        profile['username'],
        profile['identificacao'],
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return fallback;
}

/**
 * Cliente do Painel AVA — sessão web de produção.
 *
 * OAuth SUAP no InAppBrowser → cookie de sessão do Painel → GET /api/v1/diarios/.
 */
@Injectable({
    providedIn: 'root',
})
export class PainelAvaService {

    /**
     * Abre o Painel AVA no InAppBrowser e deixa o próprio Painel executar o OAuth do SUAP.
     * Depois que a sessão web existir, consulta /api/v1/diarios/ dentro da origem
     * https://ava.ifrn.edu.br, sem copiar cookie, código OAuth ou senha para o app.
     */
    authenticateWithBrowser(options: { reuseSession?: boolean } = {}): Observable<PainelAvaV1Result> {
        return new Observable<PainelAvaV1Result>((subscriber) => {
            const baseUrl = PAINEL_AVA_CONFIG.baseUrl.replace(/\/$/, '');
            const diariosPath = PAINEL_AVA_CONFIG.diariosPath;
            const query = PAINEL_AVA_CONFIG.diariosQuery ? `?${PAINEL_AVA_CONFIG.diariosQuery}` : '';
            const diariosUrl = `${baseUrl}${diariosPath}${query}`;
            let finished = false;
            let probing = false;
            let sawSuap = false;
            let painelHidden = false;

            // Login novo limpa cookies; retomada preserva a sessão web da mesma conta.
            // Sem isso, cookies do SUAP/Painel do usuário anterior fazem o
            // GET /api/v1/diarios/ devolver os cursos da conta errada.
            const browser = CoreOpener.openInApp(`${baseUrl}/`, {
                location: 'yes',
                clearcache: options.reuseSession ? 'no' : 'yes',
                clearsessioncache: options.reuseSession ? 'no' : 'yes',
            });

            // eslint-disable-next-line no-console
            console.log('[IFRN-PANEL] OAuth web iniciado (sessão IAB limpa)');

            const finishWithError = (message: string): void => {
                if (finished) {
                    return;
                }
                finished = true;
                subscriber.error(new Error(message));
            };

            // O navegador precisa ficar visível durante o login no SUAP. Assim que
            // o OAuth retornar ao Painel, escondemos o IAB antes da página web
            // do AVA ser desenhada e continuamos a coleta usando a mesma sessão.
            const loadStartSubscription = browser.on('loadstart').subscribe((event) => {
                const url = event.url || '';

                if (url.startsWith('https://suap.ifrn.edu.br/')) {
                    sawSuap = true;
                    return;
                }

                if (sawSuap && !painelHidden && url.startsWith(baseUrl)) {
                    painelHidden = true;
                    try {
                        browser.hide();
                    } catch {
                        // Se a plataforma não oferecer hide(), o fluxo continua normalmente.
                    }
                }
            });

            const loadStopSubscription = browser.on('loadstop').subscribe((event) => {
                if (finished || probing || !event.url.startsWith(baseUrl)) {
                    return;
                }

                probing = true;

                const script = `
                    (function () {
                        var endpoint = ${JSON.stringify(diariosPath + query)};
                        fetch(endpoint, {
                            method: 'GET',
                            headers: { 'Accept': 'application/json' },
                            credentials: 'same-origin',
                            redirect: 'follow'
                        })
                        .then(function (response) {
                            var contentType = response.headers.get('content-type') || '';
                            if (!response.ok || contentType.indexOf('application/json') === -1) {
                                throw new Error('Painel ainda não autenticado');
                            }
                            return response.json();
                        })
                        .then(function (payload) {
                            // O login já está válido porque /api/v1/diarios/ respondeu JSON.
                            // A captura do nome NÃO pode bloquear a autenticação.
                            // Usamos somente o elemento oficial do perfil renderizado pelo Painel.
                            function cleanName(value) {
                                value = (value || '').replace(/\s+/g, ' ').trim();
                                if (!value || value.length < 2 || value.length > 120) return '';
                                if (/^(usuário|usuario|perfil|avatar|imagem de perfil|minha foto)$/i.test(value)) return '';
                                return value;
                            }

                            function profileFromDocument(doc, source) {
                                if (!doc || !doc.querySelector) return null;

                                // Tema ifrn25: exatamente o <span> filho direto do botão de perfil.
                                var nameEl = doc.querySelector('#btn-toggle-profile > span');
                                // Compatibilidade com tema ifrn23.
                                if (!nameEl) nameEl = doc.querySelector('#header-user .user_name');

                                var name = cleanName(nameEl && nameEl.textContent);
                                var avatar = doc.querySelector('#btn-toggle-profile img.profile-image, #header-user img');
                                var photo = avatar && avatar.getAttribute('src') ? avatar.getAttribute('src') : '';

                                if (!name && !photo) return null;
                                return {
                                    nome: name || undefined,
                                    nome_usual: name || undefined,
                                    foto: photo || undefined,
                                    _name_source: source
                                };
                            }

                            function sendSuccess(profile) {
                                window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                    type: 'ifrn-painel-diarios',
                                    ok: true,
                                    payload: payload,
                                    profile: profile,
                                    profileProbeLog: []
                                }));
                            }

                            // A própria tela de retorno pode ser uma página intermediária. Por isso,
                            // primeiro lemos o perfil que já está renderizado e, depois, buscamos a raiz
                            // autenticada do Painel usando exatamente o mesmo cookie da sessão web.
                            // Não usamos texto genérico da página: somente seletores do bloco oficial
                            // de usuário do Painel.
                            var currentProfile = profileFromDocument(document, 'dom-atual:#btn-toggle-profile > span');

                            function parseRootProfile(html) {
                                if (!html || typeof html !== 'string') return null;
                                try {
                                    var parsed = new DOMParser().parseFromString(html, 'text/html');
                                    return profileFromDocument(parsed, 'GET / -> #btn-toggle-profile > span');
                                } catch (error) {
                                    return null;
                                }
                            }

                            // Depois que /api/v1/diarios/ respondeu JSON, o login JÁ terminou.
                            // Esta coleta é apenas complementar. Timeout curto + fallback garantem que
                            // uma falha ao buscar o nome nunca prenda o Marketplace em "Autenticando".
                            var rootTimeout = new Promise(function (resolve) {
                                setTimeout(function () { resolve(null); }, 800);
                            });

                            var rootRequest = fetch('/', {
                                method: 'GET',
                                credentials: 'same-origin',
                                redirect: 'follow',
                                headers: { 'Accept': 'text/html,application/xhtml+xml' }
                            }).then(function (response) {
                                var contentType = response.headers.get('content-type') || '';
                                if (!response.ok || contentType.indexOf('text/html') === -1) return null;
                                return response.text().then(parseRootProfile);
                            }).catch(function () { return null; });

                            Promise.race([rootRequest, rootTimeout]).then(function (rootProfile) {
                                // A raiz autenticada é a fonte preferida. Se ela não trouxer o bloco
                                // de perfil, reutiliza a página atual. Em qualquer caso o login segue.
                                sendSuccess(rootProfile || currentProfile || null);
                            }).catch(function () {
                                sendSuccess(currentProfile || null);
                            });
                        })
                        .catch(function () {
                            window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                type: 'ifrn-painel-probe',
                                ok: false
                            }));
                        });
                    })();
                `;

                browser.executeScript({ code: script }).then(() => {
                    // Resultado real chega pelo evento message.
                }).catch(() => {
                    probing = false;
                });
            });

            const messageSubscription = browser.on('message').subscribe((event) => {
                if (finished) {
                    return;
                }

                let data: unknown = event.data;
                if (typeof data === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch {
                        return;
                    }
                }

                if (!isPlainObject(data)) {
                    return;
                }

                if (data['type'] === 'ifrn-painel-probe') {
                    probing = false;
                    return;
                }

                if (data['type'] !== 'ifrn-painel-diarios' || data['ok'] !== true) {
                    return;
                }

                const raw = data['payload'];
                const extracted = extractDiariosList(raw);
                const profile = isPlainObject(data['profile']) ? data['profile'] : null;
                const ownerUsername = profileUsernameHint(profile, '');
                const profileKeys = profile ? Object.keys(profile).filter((key) => !key.startsWith('_')) : [];
                const nameSource = typeof profile?.['_name_source'] === 'string'
                    ? profile['_name_source']
                    : '(ausente)';
                const probeLog = Array.isArray(data['profileProbeLog']) ? data['profileProbeLog'] : [];

                this.saveDashboard(raw, ownerUsername || undefined);
                this.saveProfile(profile);

                const propertyUnion = new Set<string>();
                extracted.diarios.forEach((diario) => Object.keys(diario).forEach((key) => propertyUnion.add(key)));
                const diariosResumo = extracted.diarios.map((diario, index) => ({
                    _index: index,
                    _keys: Object.keys(diario),
                    ...pickExistingInterest(diario),
                }));

                const result: PainelAvaV1Result = {
                    baseUrl,
                    authenticatePath: 'OAuth web SUAP → /authenticate/?code=…',
                    diariosUrl,
                    usernameHint: '(sessão web Painel AVA)',
                    tokenStored: false,
                    profileKeys,
                    responseTopKeys: extracted.topKeys,
                    diariosCount: extracted.diarios.length,
                    diarioPropertyUnion: Array.from(propertyUnion).sort(),
                    diarios: extracted.diarios,
                    diariosResumo,
                };

                finished = true;
                // eslint-disable-next-line no-console
                console.log(
                    `[IFRN-PANEL] sessão web válida; ${result.diariosCount} diário(s); `
                    + `nome origem=${nameSource}; profileKeys=${profileKeys.join(',') || '(nenhuma)'}`,
                );
                // Diagnóstico temporário seguro: endpoint/status/content-type/keys (sem valores pessoais).
                if (probeLog.length) {
                    // eslint-disable-next-line no-console
                    console.log('[IFRN-PANEL] profile probes:', JSON.stringify(probeLog));
                }
                subscriber.next(result);
                subscriber.complete();
                CoreOpener.closeInAppBrowser();
            });

            const exitSubscription = browser.on('exit').subscribe(() => {
                if (!finished) {
                    finishWithError('Autenticação do Painel AVA cancelada.');
                }
            });

            return () => {
                if (!finished) {
                    finished = true;
                    CoreOpener.closeInAppBrowser();
                }
                loadStartSubscription.unsubscribe();
                loadStopSubscription.unsubscribe();
                messageSubscription.unsubscribe();
                exitSubscription.unsubscribe();
            };
        }).pipe(timeout(120000));
    }

    /**
     * Realiza a autoinscrição dentro da própria origem do Painel AVA.
     * Cookies e CSRF nunca saem do InAppBrowser; o app recebe somente o JSON
     * funcional (status/courseid/viewurl) e o dashboard atualizado.
     */
    enrolCourse(courseId: number, ambienteId = 2): Observable<Record<string, unknown>> {
        return new Observable<Record<string, unknown>>((subscriber) => {
            if (!Number.isFinite(courseId) || courseId <= 0) {
                subscriber.error(new Error('Identificador Moodle inválido para autoinscrição.'));
                return;
            }

            const baseUrl = PAINEL_AVA_CONFIG.baseUrl.replace(/\/$/, '');
            const query = PAINEL_AVA_CONFIG.diariosQuery ? `?${PAINEL_AVA_CONFIG.diariosQuery}` : '';
            const diariosEndpoint = `${PAINEL_AVA_CONFIG.diariosPath}${query}`;
            const enrolEndpoint = `/curso/${encodeURIComponent(String(ambienteId))}/${encodeURIComponent(String(courseId))}/enrol/`;
            let finished = false;
            let started = false;

            // Não limpa cache/sessão: precisamos reutilizar exatamente a sessão
            // web criada no login do Painel. hidden evita uma tela intermediária.
            const browser = CoreOpener.openInApp(`${baseUrl}/`, {
                location: 'no',
                hidden: 'yes',
            } as Parameters<typeof CoreOpener.openInApp>[1]);

            const fail = (message: string): void => {
                if (finished) {
                    return;
                }
                finished = true;
                CoreOpener.closeInAppBrowser();
                subscriber.error(new Error(message));
            };

            const timeout = window.setTimeout(() => {
                fail('A autoinscrição demorou demais. Entre novamente no Painel AVA e tente de novo.');
            }, REQUEST_TIMEOUT_MS);

            const loadStopSubscription = browser.on('loadstop').subscribe((event) => {
                if (finished || started || !event.url.startsWith(baseUrl)) {
                    return;
                }
                started = true;

                const script = `
                    (function () {
                        function cookie(name) {
                            var parts = document.cookie ? document.cookie.split(';') : [];
                            for (var i = 0; i < parts.length; i++) {
                                var item = parts[i].trim();
                                if (item.indexOf(name + '=') === 0) {
                                    return decodeURIComponent(item.substring(name.length + 1));
                                }
                            }
                            return '';
                        }

                        var csrf = cookie('csrftoken');
                        if (!csrf) {
                            window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                type: 'ifrn-painel-enrol', ok: false, error: 'Sessão do Painel expirada (CSRF ausente).'
                            }));
                            return;
                        }

                        fetch(${JSON.stringify(enrolEndpoint)}, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrf
                            },
                            credentials: 'same-origin',
                            body: '{}'
                        })
                        .then(function (response) {
                            var contentType = response.headers.get('content-type') || '';
                            if (!response.ok || contentType.indexOf('application/json') === -1) {
                                throw new Error('Falha na autoinscrição (HTTP ' + response.status + ').');
                            }
                            return response.json();
                        })
                        .then(function (result) {
                            if (result.status !== 'enrolled' && result.status !== 'reactivated') {
                                throw new Error(result.message || 'O Painel não confirmou a inscrição.');
                            }
                            return fetch(${JSON.stringify(diariosEndpoint)}, {
                                method: 'GET', headers: { 'Accept': 'application/json' },
                                credentials: 'same-origin', redirect: 'follow'
                            }).then(function (response) {
                                if (!response.ok) { throw new Error('Inscrição concluída, mas não foi possível atualizar o Painel.'); }
                                return response.json();
                            }).then(function (dashboard) {
                                window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                    type: 'ifrn-painel-enrol', ok: true, result: result, dashboard: dashboard
                                }));
                            });
                        })
                        .catch(function (error) {
                            window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                                type: 'ifrn-painel-enrol', ok: false, error: error && error.message ? error.message : 'Falha na autoinscrição.'
                            }));
                        });
                    })();
                `;

                browser.executeScript({ code: script }).catch(() => {
                    fail('Não foi possível executar a autoinscrição no Painel AVA.');
                });
            });

            const messageSubscription = browser.on('message').subscribe((event) => {
                if (finished) {
                    return;
                }

                let data: unknown = event.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch { return; }
                }
                if (!isPlainObject(data) || data['type'] !== 'ifrn-painel-enrol') {
                    return;
                }
                if (data['ok'] !== true) {
                    fail(typeof data['error'] === 'string' ? data['error'] : 'Falha na autoinscrição.');
                    return;
                }

                if (data['dashboard'] !== undefined) {
                    this.saveDashboard(data['dashboard']);
                }

                finished = true;
                window.clearTimeout(timeout);
                CoreOpener.closeInAppBrowser();
                subscriber.next(isPlainObject(data['result']) ? data['result'] : {});
                subscriber.complete();
            });

            const exitSubscription = browser.on('exit').subscribe(() => {
                if (!finished) {
                    fail('Autoinscrição cancelada.');
                }
            });

            return () => {
                window.clearTimeout(timeout);
                loadStopSubscription.unsubscribe();
                messageSubscription.unsubscribe();
                exitSubscription.unsubscribe();
            };
        });
    }

    /** Retorna os diários já obtidos pela sessão web do Painel. */
    getDiarios(): Observable<{ raw: unknown; topKeys: string[]; diarios: PainelAvaDiarioRaw[] }> {
        const raw = this.getDashboard();
        if (raw === null) {
            return throwError(() => new Error('Sessão/dados do Painel AVA ausentes.'));
        }
        const extracted = extractDiariosList(raw);
        return of({ raw, topKeys: extracted.topKeys, diarios: extracted.diarios });
    }

    inspectDiarios(): Observable<PainelAvaV1Result> {
        return this.getDiarios().pipe(map((payload) => {
            const propertyUnion = new Set<string>();
            payload.diarios.forEach((diario) => Object.keys(diario).forEach((key) => propertyUnion.add(key)));
            const diariosResumo = payload.diarios.map((diario, index) => ({
                _index: index,
                _keys: Object.keys(diario),
                ...pickExistingInterest(diario),
            }));
            return {
                baseUrl: PAINEL_AVA_CONFIG.baseUrl,
                authenticatePath: 'OAuth web SUAP',
                diariosUrl: `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.diariosPath}`,
                usernameHint: '(sessão web Painel AVA)',
                tokenStored: false,
                profileKeys: [],
                responseTopKeys: payload.topKeys,
                diariosCount: payload.diarios.length,
                diarioPropertyUnion: Array.from(propertyUnion).sort(),
                diarios: payload.diarios,
                diariosResumo,
            };
        }));
    }

    /** Guarda somente os dados de perfil necessários ao Painel/identidade. */
    private saveProfile(profile: Record<string, unknown> | null): void {
        if (!profile) {
            // Evita reutilizar perfil antigo (ex.: scraping anterior com nome de disciplina).
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);

            return;
        }

        try {
            sessionStorage.setItem(PAINEL_PROFILE_KEY, JSON.stringify(profile));

            const username = profileUsernameHint(profile, '').trim();
            if (username) {
                sessionStorage.setItem('ifrn_username', username);
            } else {
                // Limpa somente um valor antigo que tenha sido salvo a partir do nome
                // de exibição do próprio perfil. Não apaga matrícula/CPF válido de
                // outros fluxos de autenticação.
                const current = (sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();
                const displayNames = [
                    profile['nome_usual'],
                    profile['nome_social'],
                    profile['nome_registro'],
                    profile['nome'],
                    profile['display_name'],
                ]
                    .filter((value): value is string => typeof value === 'string' && !!value.trim())
                    .map((value) => value.trim().toLowerCase());

                if (current && displayNames.includes(current)) {
                    sessionStorage.removeItem('ifrn_username');
                }
            }
        } catch {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);
        }
    }

    private saveDashboard(raw: unknown, ownerUsername?: string): void {
        try {
            sessionStorage.setItem(PainelAvaService.DASHBOARD_KEY, JSON.stringify(raw));
            const owner = (ownerUsername || sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();

            if (owner) {
                sessionStorage.setItem(PainelAvaService.OWNER_KEY, owner);
            } else {
                sessionStorage.removeItem(PainelAvaService.OWNER_KEY);
            }
        } catch {
            sessionStorage.removeItem(PainelAvaService.DASHBOARD_KEY);
            sessionStorage.removeItem(PainelAvaService.OWNER_KEY);
        }
    }

    getDashboard(): unknown | null {
        const raw = sessionStorage.getItem(PainelAvaService.DASHBOARD_KEY);
        if (!raw) {
            return null;
        }

        // Descarta dashboard de outro IFRN-id (troca de conta sem logout limpo).
        const owner = (sessionStorage.getItem(PainelAvaService.OWNER_KEY) || '').trim().toLowerCase();
        const current = (sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();

        if (owner && current && owner !== current) {
            this.clearSession();

            return null;
        }

        try {
            return JSON.parse(raw) as unknown;
        } catch {
            sessionStorage.removeItem(PainelAvaService.DASHBOARD_KEY);

            return null;
        }
    }

    hasDashboard(): boolean {
        return this.getDashboard() !== null;
    }

    clearSession(): void {
        sessionStorage.removeItem(PainelAvaService.DASHBOARD_KEY);
        sessionStorage.removeItem(PainelAvaService.OWNER_KEY);
        sessionStorage.removeItem(PAINEL_TOKEN_KEY);
        sessionStorage.removeItem(PAINEL_PROFILE_KEY);
    }

    // Compatibilidade temporária com código antigo do mobilemoodle.
    getToken(): string | null {
        return null;
    }

    hasValidToken(): boolean {
        return false;
    }

    getProfile(): Record<string, unknown> | null {
        const raw = sessionStorage.getItem(PAINEL_PROFILE_KEY);

        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as unknown;

            return isPlainObject(parsed) ? parsed : null;
        } catch {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);

            return null;
        }
    }

    static readonly TOKEN_KEY = PAINEL_TOKEN_KEY;
    static readonly PROFILE_KEY = PAINEL_PROFILE_KEY;
    static readonly DASHBOARD_KEY = 'ifrn_painel_dashboard';
    /** IFRN-id dono do dashboard em sessionStorage (evita reuso entre contas). */
    static readonly OWNER_KEY = 'ifrn_painel_owner';
}
