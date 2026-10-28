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

import { CoreCourseHelper } from '@features/course/services/course-helper';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { CoreNavigator } from '@services/navigator';

/**
 * Entra na rota nativa do curso sem depender da seleção automática do Dashboard.
 *
 * @param courseId ID do curso.
 * @param siteId ID do site Moodle autenticado.
 */
export async function openNativeCourse(courseId: number, siteId: string): Promise<void> {
    // O painel IFRN vive fora de /main e cada retorno a ele pode deixar uma
    // página de curso antiga na pilha Ionic da aba. Sempre abrir a rota nativa
    // como raiz evita que Voltar reabra o curso anterior.
    let course: { id: number } | Awaited<ReturnType<typeof CoreCourseHelper.getCourse>>['course'];
    try {
        ({ course } = await CoreCourseHelper.getCourse(courseId, siteId));
    } catch {
        // Igual ao helper getAndOpenCourse: um erro ao buscar detalhes não
        // impede a página nativa de tentar carregar o curso pelo ID.
        course = { id: courseId };
    }

    const navigated = await CoreNavigator.navigate(`/main/${MAIN_MENU_HOME_PAGE_NAME}/course/${courseId}`, {
        animated: false,
        reset: true,
        params: { course },
    });
    if (!navigated) {
        throw new Error('Não foi possível navegar para o curso. Tente novamente pelo Painel.');
    }
}
