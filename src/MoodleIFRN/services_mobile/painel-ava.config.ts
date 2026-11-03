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

/**
 * Configuração do Painel AVA oficial observado em produção.
 *
 * O navegador usa GET /api/v1/diarios/ com sessão web.
 * Identidade: tenta /api/v2/usuario/info/ (200 em ava.ifrn.edu.br no teste de
 * 20/10/2026; 404 em painel.ead.ifrn.edu.br) e, se ausente, consulta /api/rh/eu/ no SUAP com a
 * mesma sessão do InAppBrowser (same-origin após navegação).
 */
export const PAINEL_AVA_CONFIG = {
    /** Base URL do Painel AVA (sem barra final). */
    baseUrl: 'https://ava.ifrn.edu.br',

    /** Destino HTTPS confirmado por HTTP 302 no host oficial em 2026-10-19. */
    browserOrigins: ['https://ava.ifrn.edu.br', 'https://painel.ead.ifrn.edu.br'],

    /** Autenticação v1 do Painel (credenciais IFRN → data + token próprio do Painel). */
    authenticatePath: '/api/v1/authenticate/',

    /** Lista de diários em todos os AVAs; cada item traz id Moodle e viewurl. */
    diariosPath: '/api/v1/diarios/',

    /** Identidade preferida no Painel (sessão web). Em produção pode ainda retornar 404. */
    usuarioInfoPath: '/api/v2/usuario/info/',

    /** Fallback de identidade no SUAP, com cookies do OAuth do painel no IAB. */
    suapEuPath: '/api/rh/eu/',

    /** Query usada pelo painel mobile (diários em andamento). */
    diariosQuery: 'q=&situacao=inprogress&semestre=&disciplina=&curso=&ambiente=',
} as const;

/** Mensagem estável que permite à tela oferecer os caminhos de recuperação do Gov.br. */
export const GOVBR_MOBILE_UNAVAILABLE_MESSAGE =
    'O acesso pelo Gov.br continuará no navegador e não criará uma sessão no aplicativo. '
    + 'Para usar o AVA Mobile, volte e escolha o login tradicional do SUAP.';

/** Compara origens exatas; não aceita prefixos, subdomínios ou HTTP. */
export function isPainelAvaBrowserUrl(candidate: string): boolean {
    try {
        return PAINEL_AVA_CONFIG.browserOrigins.some(origin => new URL(candidate).origin === origin);
    } catch {
        return false;
    }
}

/**
 * Detecta páginas oficiais Gov.br sem aceitar domínios com sufixo enganoso.
 *
 * @param candidate Navegação que será analisada sem ser registrada em log.
 * @returns Se a origem HTTPS pertence ao domínio gov.br.
 */
export function isGovBrAuthenticationUrl(candidate: string): boolean {
    try {
        const url = new URL(candidate);
        const hostname = url.hostname.toLowerCase();

        return url.protocol === 'https:' && (hostname === 'gov.br' || hostname.endsWith('.gov.br'));
    } catch {
        return false;
    }
}
