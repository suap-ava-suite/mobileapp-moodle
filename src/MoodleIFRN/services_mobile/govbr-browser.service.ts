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

import { Injectable } from '@angular/core';

export type GovBrBrowserMode = 'custom-tab' | 'external-browser';

interface IfrnCustomTabsBridge {
    open(url: string, success: (mode: string) => void, error: (message: string) => void): void;
}

declare global {
    interface Window {
        ifrnCustomTabs?: IfrnCustomTabsBridge;
    }
}

/**
 * Valida o destino sem normalizar a URL original que será entregue ao browser.
 *
 * @param candidate URL original recebida pelo redirecionamento SUAP.
 * @returns Se o destino pertence ao endpoint oficial de autorização Gov.br.
 */
export function isGovBrAuthorizationUrl(candidate: string): boolean {
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 8192
            || candidate !== candidate.trim()) {
        return false;
    }
    for (let index = 0; index < candidate.length; index++) {
        const code = candidate.charCodeAt(index);
        if (code <= 0x1f || code === 0x7f) {
            return false;
        }
    }

    try {
        const url = new URL(candidate);

        return url.protocol === 'https:'
            && url.hostname.toLowerCase() === 'sso.acesso.gov.br'
            && !url.username
            && !url.password
            && (!url.port || url.port === '443');
    } catch {
        return false;
    }
}

/** Ponte Angular para Custom Tabs Android, com fallback seguro para navegador externo. */
@Injectable({ providedIn: 'root' })
export class GovBrBrowserService {

    private opening = false;

    async open(url: string): Promise<GovBrBrowserMode> {
        if (!isGovBrAuthorizationUrl(url)) {
            throw new Error('O destino oficial de autenticação é inválido.');
        }
        if (this.opening) {
            throw new Error('Já existe uma janela de autenticação aberta.');
        }

        this.opening = true;
        try {
            const bridge = window.cordova ? window.ifrnCustomTabs : undefined;
            if (!bridge) {
                window.open(url, '_system');

                return 'external-browser';
            }

            const mode = await new Promise<string>((resolve, reject) => {
                bridge.open(url, resolve, () => reject(new Error('Não foi possível abrir o navegador seguro.')));
            });
            if (mode !== 'custom-tab' && mode !== 'external-browser') {
                throw new Error('O navegador não confirmou a abertura da autenticação.');
            }

            return mode;
        } catch (error) {
            this.opening = false;
            throw error;
        }
    }

    /** Libera a tentativa quando o usuário retorna; isso não significa autenticação. */
    onBrowserReturned(): void {

        this.opening = false;

    }

}
