/* eslint-disable header/header */

import { createComponent, type ApplicationRef, type ComponentRef, type EnvironmentInjector } from '@angular/core';
import { IfrnCourseLoadingComponent } from '../moodle-course/ifrn-course-loading.component';

// IFRN course transition rendered by the already bootstrapped Angular app.

const HANDOFF_PENDING_KEY = 'ifrn_course_handoff_pending';
const HANDOFF_ID = 'ifrn-handoff-loading';
const HANDOFF_LOGO_PATH = 'mobilemoodle/static/theme/ifrn/img/splash-logo.png';

interface HandoffOptions {
    courseName?: string;
    onCancel: () => void;
}

let handoffComponent: ComponentRef<IfrnCourseLoadingComponent> | undefined;
let handoffApplication: ApplicationRef | undefined;

/**
 * Handoff overlay is intentionally not restored on app boot.
 *
 * @returns Whether a pending course handoff should be restored on boot.
 */
export function shouldShowCourseHandoffOnBoot(): boolean {
    return false;
}

/**
 * Mount one Angular overlay in the existing application; repeated requests update it.
 *
 * @param applicationRef Existing Angular application reference.
 * @param environmentInjector Injector belonging to the existing Angular application.
 * @param options Course label and safe cancellation callback.
 */
export function showHandoffLoading(
    applicationRef: ApplicationRef,
    environmentInjector: EnvironmentInjector,
    options: HandoffOptions,
): void {
    document.documentElement.classList.add('ifrn-native-handoff');

    if (handoffComponent) {
        handoffComponent.setInput('courseName', options.courseName || '');
        handoffComponent.setInput('logoUrl', getHandoffLogoUrl());
        handoffComponent.setInput('onCancel', options.onCancel);
        handoffComponent.changeDetectorRef.detectChanges();

        return;
    }

    const host = document.createElement('ifrn-course-loading');
    host.id = HANDOFF_ID;

    let component: ComponentRef<IfrnCourseLoadingComponent> | undefined;
    try {
        component = createComponent(IfrnCourseLoadingComponent, {
            environmentInjector,
            hostElement: host,
        });
        component.setInput('courseName', options.courseName || '');
        component.setInput('logoUrl', getHandoffLogoUrl());
        component.setInput('onCancel', options.onCancel);
        component.setInput('timingStartedAt', performance.now());
        applicationRef.attachView(component.hostView);
        (document.body || document.documentElement).appendChild(host);
        component.changeDetectorRef.detectChanges();
        handoffComponent = component;
        handoffApplication = applicationRef;
    } catch {
        if (component) {
            try {
                applicationRef.detachView(component.hostView);
            } catch {
                // The view might not have been attached if creation failed early.
            }
            try {
                component.destroy();
            } catch {
                // Do not prevent native course navigation if Angular teardown fails.
            }
        }
        host.remove?.();
        document.documentElement.classList.remove('ifrn-native-handoff');
        // Keep this visual enhancement fail-open: it must never block the course itself.
        // eslint-disable-next-line no-console
        console.warn('[IFRN-COURSE-LOADING] Angular cover unavailable; continuing course navigation.');
    }
}

/**
 * Resolve the existing IFRN splash mark relative to the active Cordova document.
 *
 * @returns Resolved logo URL, or its relative path if the base URI is unavailable.
 */
function getHandoffLogoUrl(): string {
    try {
        return new URL(HANDOFF_LOGO_PATH, document.baseURI).toString();
    } catch {
        return HANDOFF_LOGO_PATH;
    }
}

/** Destroy the Angular view and release its host when the course is ready or the attempt ends. */
export function hideHandoffLoading(): void {
    const component = handoffComponent;
    const application = handoffApplication;
    handoffComponent = undefined;
    handoffApplication = undefined;

    if (component) {
        try {
            application?.detachView(component.hostView);
        } catch {
            // The view may have been detached by Angular during application shutdown.
        } finally {
            component.destroy();
        }
    }

    document.documentElement.classList.remove('ifrn-native-handoff');
    try {
        sessionStorage.removeItem(HANDOFF_PENDING_KEY);
    } catch {
        // Storage can be unavailable in restricted WebViews.
    }
}
