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
export interface ActivityCompletion {
    cmid: number;
    tracking: number;
    state: number;
    hascompletion?: boolean;
    istrackeduser?: boolean;
    uservisible?: boolean;
    isoverallcomplete?: boolean;
    offline?: boolean;
    details?: { rulename: string; rulevalue: { status: number; description: string } }[];
}

export const CALENDAR_READ_TIMEOUT = 15_000;

export class CalendarReadTimeout extends Error {}

/**
 * Dá um prazo à leitura da UI. O WS nativo não expõe AbortSignal; descarte
 * o resultado ao invalidar a tela e remova o timer, mesmo com rede pendente.
 */
export function calendarRead<T>(
    start: () => Promise<T>,
    signal: AbortSignal,
    timeoutMs = CALENDAR_READ_TIMEOUT,
): Promise<T> {
    if (signal.aborted) {
        return Promise.reject(new Error('Leitura encerrada'));
    }

    return new Promise<T>((resolve, reject) => {
        const cleanup = (): void => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
        };
        const abort = (): void => {
            cleanup();
            reject(new Error('Leitura encerrada'));
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new CalendarReadTimeout());
        }, timeoutMs);
        signal.addEventListener('abort', abort, { once: true });

        void Promise.resolve().then(() => {
            if (signal.aborted) {
                throw new Error('Leitura encerrada');
            }

            return start();
        }).then(resolve, reject).finally(cleanup);
    });
}

/** Compartilha apenas leituras ainda pendentes desta instância. */
export class CalendarPendingReads<T> {

    private readonly pending = new Map<string, Promise<T>>();

    get(key: string, start: () => Promise<T>): Promise<T> {
        const existing = this.pending.get(key);
        if (existing) {
            return existing;
        }
        const read = start().finally(() => this.pending.delete(key));
        this.pending.set(key, read);

        return read;
    }

}

export function calendarAccessDenied(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const details = error as { errorcode?: string; status?: number };

    return details.status === 401 || details.status === 403
        || ['invalidtoken', 'requireloginerror', 'accessexception', 'nopermissions'].includes(details.errorcode ?? '');
}
