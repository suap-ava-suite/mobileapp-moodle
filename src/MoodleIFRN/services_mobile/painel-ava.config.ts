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
 * Configuração do Painel AVA oficial (djangoapp-painel_ava) — API v1 (produção).
 *
 * Produção IFRN: https://painel.ead.ifrn.edu.br
 * Fonte: helm/values.yaml do repositório suap-ava-suite/djangoapp-painel_ava
 *
 * A API v2 ainda não está disponível em produção — não usar neste host.
 */
export const PAINEL_AVA_CONFIG = {
    /** Base URL do Painel AVA (sem barra final). */
    baseUrl: 'https://painel.ead.ifrn.edu.br',

    /** Autenticação mobile do Painel (credenciais SUAP → JWT do Painel). */
    authenticatePath: '/api/v1/authenticate/',

    /** Lista de diários/cursos agregados pelo tool_painelava. */
    diariosPath: '/api/v1/diarios/',

    /** Query usada pelo painel mobile (diários em andamento). */
    diariosQuery: 'situacao=inprogress',
} as const;
