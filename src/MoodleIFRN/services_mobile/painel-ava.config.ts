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
 * O navegador usa GET /api/v1/diarios/ com sessão web. Para o APK,
 * mantemos o endpoint legado de autenticação v1 como tentativa de ponte mobile
 * no host atual. O runtime/logcat confirmará se ele está publicado nesse host.
 */
export const PAINEL_AVA_CONFIG = {
    /** Base URL do Painel AVA (sem barra final). */
    baseUrl: 'https://ava.ifrn.edu.br',

    /** Autenticação mobile do Painel (credenciais IFRN → par JWT access/refresh). */
    authenticatePath: '/api/v1/authenticate/',

    /** Lista de diários em todos os AVAs; cada item traz id Moodle e viewurl. */
    diariosPath: '/api/v1/diarios/',

    /** Query usada pelo painel mobile (diários em andamento). */
    diariosQuery: 'q=&situacao=inprogress&semestre=&disciplina=&curso=&ambiente=',
} as const;
