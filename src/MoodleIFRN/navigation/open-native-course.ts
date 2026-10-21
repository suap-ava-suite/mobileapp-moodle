import { CoreCourseHelper } from '@features/course/services/course-helper';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { CoreNavigator } from '@services/navigator';

/** Entra na rota nativa do curso sem depender da seleção automática do Dashboard. */
export async function openNativeCourse(courseId: number, siteId: string): Promise<void> {
    if (CoreNavigator.getCurrentMainMenuTab()) {
        await CoreCourseHelper.getAndOpenCourse(courseId, {}, siteId);

        return;
    }

    // A shell IFRN vive fora de /main. O handler padrão primeiro abre /main
    // e espera a seleção de uma aba, que pode não ocorrer após o retorno OAuth.
    // Usa a mesma página/curso do núcleo, com a aba home já definida na URL.
    const { course } = await CoreCourseHelper.getCourse(courseId, siteId);
    const navigated = await CoreNavigator.navigate(`/main/${MAIN_MENU_HOME_PAGE_NAME}/course/${courseId}`, {
        animated: false,
        reset: true,
        params: { course },
    });
    if (!navigated) {
        throw new Error('Não foi possível navegar para o curso. Tente novamente pelo Painel.');
    }
}
