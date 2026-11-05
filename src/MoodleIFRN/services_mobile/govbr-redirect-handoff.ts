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

import { isGovBrAuthenticationUrl } from './painel-ava.config';

const GOVBR_REDIRECT_TTL_MS = 60_000;

/** Mantém em memória, por pouco tempo e uma única vez, o redirect oficial do SUAP. */
export class GovBrRedirectHandoff {

    private pending?: { url: string; expiresAt: number };

    /**
     * Guarda apenas URLs HTTPS do domínio gov.br, sem persistir nem registrar o valor.
     *
     * @param url Redirect recebido do navegador SUAP.
     * @param now Horário usado para teste determinístico.
     * @returns Se o redirect foi aceito.
     */
    capture(url: string, now = Date.now()): boolean {
        this.clear();
        if (!isGovBrAuthenticationUrl(url)) {
            return false;
        }

        this.pending = { url, expiresAt: now + GOVBR_REDIRECT_TTL_MS };

        return true;
    }

    /**
     * Entrega o redirect uma única vez e rejeita links expirados.
     *
     * @param now Horário usado para teste determinístico.
     * @returns O redirect válido ou null.
     */
    consume(now = Date.now()): string | null {
        const pending = this.pending;
        this.clear();
        if (!pending || now >= pending.expiresAt || !isGovBrAuthenticationUrl(pending.url)) {
            return null;
        }

        return pending.url;
    }

    clear(): void {

        this.pending = undefined;

    }

}
