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
import { CoreWS } from '@services/ws';
import { Observable, catchError, from, map, switchMap, timeout, throwError } from 'rxjs';

import { PAINEL_AVA_CONFIG } from './painel-ava.config';

/* eslint-disable @typescript-eslint/naming-convention */
/** Resposta de POST /api/v1/authenticate/ (Painel AVA). */
export interface PainelAvaAuthResponse {
    token: string;
    data?: Record<string, unknown>;
}

/**
 * Item bruto de GET /api/v1/diarios/.
 * Campos tipados só como referência do que o cliente já observava;
 * o PoC registra as chaves realmente presentes na resposta.
 */
export type PainelAvaDiarioRaw = Record<string, unknown>;

/** Envelope observado / esperado de GET /api/v1/diarios/. */
export interface PainelAvaDiariosResponse {
    diarios?: PainelAvaDiarioRaw[];
    autoinscricoes?: PainelAvaDiarioRaw[];
    coordenacoes?: PainelAvaDiarioRaw[];
    praticas?: PainelAvaDiarioRaw[];
    [key: string]: unknown;
}

/** Resultado do PoC API v1 (UI + console) — sem tokens. */
export interface PainelAvaV1PocResult {
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

    const candidates = [
        profile['matricula'],
        profile['username'],
        profile['identificacao'],
        profile['nome_usual'],
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return fallback;
}

/**
 * Cliente do Painel AVA — API v1 (produção).
 *
 * POST /api/v1/authenticate/ → JWT do Painel (+ data de perfil)
 * GET  /api/v1/diarios/       → diários agregados (tool_painelava)
 *
 * O JWT do Painel NÃO é wstoken Moodle nem o SimpleJWT do SUAP.
 */
@Injectable({
    providedIn: 'root',
})
export class PainelAvaService {

    /**
     * Troca IFRN-id/senha por JWT do Painel (valida no SUAP no servidor).
     * Endpoint: POST /api/v1/authenticate/
     */
    authenticate(credentials: {
        username: string;
        password: string;
    }): Observable<PainelAvaAuthResponse> {
        const url = `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.authenticatePath}`;

        // Diagnóstico temporário para APK production. Não imprime senha, token ou Authorization.
        // eslint-disable-next-line no-console
        console.log('[IFRN-TEST] Iniciando autenticação Painel AVA v1');

        return from(CoreWS.sendHTTPRequest<PainelAvaAuthResponse>(url, {
            method: 'post',
            data: {
                username: credentials.username.trim(),
                password: credentials.password,
            },
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            serializer: 'json',
            responseType: 'json',
            timeout: REQUEST_TIMEOUT_MS / 1000,
        })).pipe(
            map((httpResponse) => {
                const response = httpResponse.body;

                if (!response?.token || !isValidPainelToken(response.token)) {
                    throw new Error('Painel AVA v1 não retornou token válido.');
                }

                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] Painel AVA autenticado com sucesso');

                return response;
            }),
            catchError((error) => {
                const diagnostic = getSafeHttpErrorDiagnostic(error);
                const safeError = describeHttpError(error, 'Falha em POST /api/v1/authenticate/');

                // Diagnóstico temporário: status e corpo retornado pelo servidor, sem credenciais/tokens.
                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] POST authenticate status:', diagnostic.status);
                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] POST authenticate resposta:', diagnostic.body);
                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] Falha na autenticação Painel AVA:', safeError.message);

                return throwError(() => safeError);
            }),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    /**
     * Lista diários do usuário autenticado no Painel.
     * Endpoint: GET /api/v1/diarios/?situacao=inprogress
     */
    getDiarios(accessToken?: string): Observable<{
        raw: unknown;
        topKeys: string[];
        diarios: PainelAvaDiarioRaw[];
    }> {
        const access = accessToken || this.getToken();

        if (!access) {
            return throwError(() => new Error('Token do Painel AVA ausente.'));
        }

        const query = PAINEL_AVA_CONFIG.diariosQuery
            ? `?${PAINEL_AVA_CONFIG.diariosQuery}`
            : '';
        const url = `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.diariosPath}${query}`;

        // eslint-disable-next-line no-console
        console.log('[IFRN-TEST] Consultando /api/v1/diarios/');

        return from(CoreWS.sendHTTPRequest<unknown>(url, {
            method: 'get',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${access}`,
            },
            responseType: 'json',
            timeout: REQUEST_TIMEOUT_MS / 1000,
        })).pipe(
            map((httpResponse) => {
                const raw = httpResponse.body;
                const extracted = extractDiariosList(raw);

                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] Quantidade de diários:', extracted.diarios.length);
                extracted.diarios.forEach((diario, index) => {
                    // Somente campos úteis para mapear diário -> curso Moodle.
                    // eslint-disable-next-line no-console
                    console.log(`[IFRN-TEST] Diário ${index}:`, pickExistingInterest(diario));
                });

                return {
                    raw,
                    topKeys: extracted.topKeys,
                    diarios: extracted.diarios,
                };
            }),
            catchError((error) => {
                const safeError = describeHttpError(error, 'Falha em GET /api/v1/diarios/');
                // eslint-disable-next-line no-console
                console.log('[IFRN-TEST] Falha ao consultar diários:', safeError.message);

                return throwError(() => safeError);
            }),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    /**
     * Inspeciona os diários usando a sessão Painel AVA já autenticada.
     * Não faz novo login e nunca registra o JWT no console.
     */
    inspectDiarios(accessToken?: string): Observable<PainelAvaV1PocResult> {
        const profile = this.getProfile();

        return this.getDiarios(accessToken).pipe(
            map((payload) => {
                const propertyUnion = new Set<string>();

                for (const diario of payload.diarios) {
                    Object.keys(diario).forEach((key) => propertyUnion.add(key));
                }

                const diariosResumo = payload.diarios.map((diario, index) => ({
                    _index: index,
                    _keys: Object.keys(diario),
                    ...pickExistingInterest(diario),
                }));

                const result: PainelAvaV1PocResult = {
                    baseUrl: PAINEL_AVA_CONFIG.baseUrl,
                    authenticatePath: PAINEL_AVA_CONFIG.authenticatePath,
                    diariosUrl:
                        `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.diariosPath}`
                        + (PAINEL_AVA_CONFIG.diariosQuery
                            ? `?${PAINEL_AVA_CONFIG.diariosQuery}`
                            : ''),
                    usernameHint: profileUsernameHint(profile, '(sessão existente)'),
                    tokenStored: this.hasValidToken(),
                    profileKeys: profile ? Object.keys(profile) : [],
                    responseTopKeys: payload.topKeys,
                    diariosCount: payload.diarios.length,
                    diarioPropertyUnion: Array.from(propertyUnion).sort(),
                    diarios: payload.diarios,
                    diariosResumo,
                };

                this.logDiariosToConsole(result, payload.raw);

                return result;
            }),
        );
    }

    /**
     * PoC: authenticate → grava token (sem logar JWT) → GET diarios → logs seguros.
     */
    runApiV1Poc(credentials: {
        username: string;
        password: string;
    }): Observable<PainelAvaV1PocResult> {
        return this.authenticate(credentials).pipe(
            switchMap((auth) => {
                this.saveToken(auth.token);
                this.saveProfile(auth.data);

                return this.getDiarios(auth.token).pipe(
                    map((payload) => {
                        const propertyUnion = new Set<string>();

                        for (const diario of payload.diarios) {
                            Object.keys(diario).forEach((key) => propertyUnion.add(key));
                        }

                        const diariosResumo = payload.diarios.map((diario, index) => ({
                            _index: index,
                            _keys: Object.keys(diario),
                            ...pickExistingInterest(diario),
                        }));

                        const result: PainelAvaV1PocResult = {
                            baseUrl: PAINEL_AVA_CONFIG.baseUrl,
                            authenticatePath: PAINEL_AVA_CONFIG.authenticatePath,
                            diariosUrl:
                                `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.diariosPath}`
                                + (PAINEL_AVA_CONFIG.diariosQuery
                                    ? `?${PAINEL_AVA_CONFIG.diariosQuery}`
                                    : ''),
                            usernameHint: profileUsernameHint(
                                auth.data || null,
                                credentials.username.trim(),
                            ),
                            tokenStored: true,
                            profileKeys: auth.data ? Object.keys(auth.data) : [],
                            responseTopKeys: payload.topKeys,
                            diariosCount: payload.diarios.length,
                            diarioPropertyUnion: Array.from(propertyUnion).sort(),
                            diarios: payload.diarios,
                            diariosResumo,
                        };

                        this.logDiariosToConsole(result, payload.raw);

                        return result;
                    }),
                );
            }),
        );
    }

    saveToken(token: string): void {
        if (!isValidPainelToken(token)) {
            this.clearSession();

            return;
        }

        sessionStorage.setItem(PAINEL_TOKEN_KEY, token);
    }

    getToken(): string | null {
        const stored = sessionStorage.getItem(PAINEL_TOKEN_KEY);

        if (stored && isValidPainelToken(stored)) {
            return stored;
        }

        if (stored) {
            sessionStorage.removeItem(PAINEL_TOKEN_KEY);
        }

        return null;
    }

    hasValidToken(): boolean {
        return this.getToken() !== null;
    }

    /**
     * Perfil retornado por /authenticate/ (nome, foto, etc.) para o painel mobile.
     */
    saveProfile(data: Record<string, unknown> | undefined | null): void {
        if (!data || typeof data !== 'object') {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);

            return;
        }

        try {
            sessionStorage.setItem(PAINEL_PROFILE_KEY, JSON.stringify(data));
        } catch {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);
        }
    }

    getProfile(): Record<string, unknown> | null {
        const raw = sessionStorage.getItem(PAINEL_PROFILE_KEY);

        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;

            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    clearSession(): void {
        sessionStorage.removeItem(PAINEL_TOKEN_KEY);
        sessionStorage.removeItem(PAINEL_PROFILE_KEY);
    }

    /**
     * Logs seguros: chaves reais + valores de interesse.
     * Nunca imprime JWT, senha ou Authorization.
     */
    logDiariosToConsole(result: PainelAvaV1PocResult, rawResponse?: unknown): void {
        // eslint-disable-next-line no-console
        console.group('[Painel AVA API v1 PoC] /api/v1/diarios/');
        // eslint-disable-next-line no-console
        console.log('baseUrl', result.baseUrl);
        // eslint-disable-next-line no-console
        console.log('authenticate', result.authenticatePath, '(token NÃO logado)');
        // eslint-disable-next-line no-console
        console.log('diariosUrl', result.diariosUrl);
        // eslint-disable-next-line no-console
        console.log('usernameHint', result.usernameHint);
        // eslint-disable-next-line no-console
        console.log('profileKeys (authenticate.data)', result.profileKeys);
        // eslint-disable-next-line no-console
        console.log('responseTopKeys', result.responseTopKeys);
        // eslint-disable-next-line no-console
        console.log('diarioPropertyUnion (todas as props vistas)', result.diarioPropertyUnion);
        // eslint-disable-next-line no-console
        console.log(`diariosCount=${result.diariosCount}`);

        if (rawResponse !== undefined) {
            // Estrutura completa sem o token (a resposta de diarios não traz token).
            // eslint-disable-next-line no-console
            console.log('rawResponse (estrutura)', rawResponse);
        }

        result.diariosResumo.forEach((resumo, index) => {
            // eslint-disable-next-line no-console
            console.group(`diário[${index}] keys=${JSON.stringify(resumo['_keys'])}`);
            // eslint-disable-next-line no-console
            console.log(resumo);
            // eslint-disable-next-line no-console
            console.groupEnd();
        });

        // eslint-disable-next-line no-console
        console.table(result.diariosResumo.map((item) => ({
            index: item['_index'],
            id: item['id'] ?? '(ausente)',
            courseid: item['courseid'] ?? '(ausente)',
            fullname: item['fullname'] ?? '(ausente)',
            shortname: item['shortname'] ?? '(ausente)',
            viewurl: item['viewurl'] ?? '(ausente)',
            idnumber: item['idnumber'] ?? '(ausente)',
            diario_id: item['diario_id'] ?? '(ausente)',
            ambiente: item['ambiente'] ?? '(ausente)',
            keys: Array.isArray(item['_keys']) ? (item['_keys'] as string[]).join(',') : '',
        })));

        // eslint-disable-next-line no-console
        console.groupEnd();
    }

    /** Chaves usadas também pelo bundle mobilemoodle (mesma origem). */
    static readonly TOKEN_KEY = PAINEL_TOKEN_KEY;
    static readonly PROFILE_KEY = PAINEL_PROFILE_KEY;

}
