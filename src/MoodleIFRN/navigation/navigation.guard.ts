import { inject, provideAppInitializer } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { MoodleSiteService } from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { isNativeMoodleLanding } from './navigation-policy';

/** Executado antes de ativar a landing: não depende de o usuário ter aberto um curso. */
export const ifrnMainMenuGuard: CanActivateFn & CanActivateChildFn = (_route, state) => {
    const service = inject(MoodleSiteService);

    if (!isNativeMoodleLanding(state.url)) {
        return true;
    }

    const recovery = service.getCourseRecoveryTarget();
    if (service.isIdentityMismatchPending() && recovery) {
        service.hideNativeCourseHandoff();
        return inject(Router).createUrlTree(['/login/moodle-open-course'], {
            queryParams: { courseId: recovery.courseId, courseName: recovery.courseName, identityOnly: true },
        });
    }

    if (service.isNativeCourseHandoffActive()) {
        // O núcleo precisa passar pela landing para tratar course/{id}/OAuth.
        // Ela fica invisível e sem interação durante essa passagem interna.
        service.showNativeCourseHandoff();

        return true;
    }

    return inject(Router).createUrlTree(['/login/marketplace-ifrn'], {
        queryParams: { ifrnEntry: true },
    });
};

/** Registro global, inclusive antes de uma sessão Moodle ser restaurada ao iniciar. */
export function provideIfrnNavigationShell(): ReturnType<typeof provideAppInitializer> {
    return provideAppInitializer(() => inject(MoodleSiteService).initializeIfrnNavigationShell());
}

/** Sessão expirada em um curso IFRN usa a ponte existente, sem a tela Reconnect. */
export const ifrnReconnectGuard: CanActivateFn = () => {
    const service = inject(MoodleSiteService);
    const recovery = service.getCourseRecoveryTarget();
    if (!recovery) {
        return service.isCurrentSiteIfrn()
            ? inject(Router).createUrlTree(['/login/marketplace-ifrn'], { queryParams: { ifrnEntry: true } })
            : true;
    }
    service.setPendingOpenCourse(recovery);
    service.hideNativeCourseHandoff();
    return inject(Router).createUrlTree(['/login/moodle-open-course'], {
        queryParams: {
            courseId: recovery.courseId,
            courseName: recovery.courseName,
            identityOnly: service.isIdentityMismatchPending(),
        },
    });
};
