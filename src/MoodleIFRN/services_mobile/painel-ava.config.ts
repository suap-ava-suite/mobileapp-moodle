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
 * Identidade: tenta /api/v2/usuario/info/ (404 no host em 2026-10; v2 no código-fonte
 * mas ainda não publicada) e, se ausente, consulta /api/rh/eu/ no SUAP com a
 * mesma sessão do InAppBrowser (same-origin após navegação).
 */
export const PAINEL_AVA_CONFIG = {
    /** Base URL do Painel AVA (sem barra final). */
    baseUrl: 'https://ava.ifrn.edu.br',

    /** Autenticação mobile do Painel (credenciais IFRN → par JWT access/refresh). */
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
