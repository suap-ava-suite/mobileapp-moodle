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
 * True after the selected Moodle course shell, its real title, and the IFRN theme are visible.
 * The IFRN cover can then yield to Moodle's own compact content loader.
 *
 * @param documentRef Active app document to inspect.
 * @param courseId Exact Moodle course requested by the user.
 * @returns Whether the themed native course header is ready.
 */
export function isNativeCourseShellReady(documentRef: Document, courseId: number): boolean {
    return nativeCourseShellWaitReason(documentRef, courseId) === 'ready';
}

/** Returns only a static DOM readiness reason, never a title, account or course payload. */
export function nativeCourseShellWaitReason(documentRef: Document, courseId: number): string {
    const page = findVisibleCoursePage(documentRef, courseId);
    const view = documentRef.defaultView;
    if (!page || !view) {
        return 'page-not-visible';
    }

    const theme = view.getComputedStyle(page).getPropertyValue('--ifrn-ava').trim();
    if (!theme) return 'theme-missing';
    if (page.getAnimations?.().some(animation => animation.playState === 'running')) return 'animation-running';

    const header = page.querySelector<HTMLElement>('.core-course-header');
    const title = header?.querySelector<HTMLElement>('h1');

    if (!header || !isVisible(header)) return 'header-not-visible';
    if (!title?.textContent?.trim()) return 'title-missing';

    return 'ready';
}

/**
 * True only after Moodle's course-format loader has released real content for the requested course.
 * The DOM is observed read-only; no Moodle page content or authentication state is modified.
 *
 * @param documentRef Active app document to inspect.
 * @param courseId Exact Moodle course requested by the user.
 * @returns Whether the requested course content is visibly ready.
 */
export function isNativeCourseContentReady(documentRef: Document, courseId: number): boolean {
    const page = findVisibleCoursePage(documentRef, courseId);
    const view = documentRef.defaultView;
    if (!page || !view) {
        return false;
    }

    const theme = view.getComputedStyle(page).getPropertyValue('--ifrn-ava').trim();
    if (!theme || page.getAnimations?.().some(animation => animation.playState === 'running')) {
        return false;
    }

    const contents = Array.from(page.querySelectorAll<HTMLElement>('page-core-course-contents'))
        .find((candidate) => candidate.getAttribute('data-course-id') === String(courseId) && isVisible(candidate));
    const format = contents?.querySelector<HTMLElement>('core-course-format');
    if (!format || !isVisible(format)) {
        return false;
    }

    // The default Moodle course-format renderer exposes this host state only after its sections
    // and selected section have been prepared. If a custom format owns loading itself, it must
    // still render a real section/empty state below before course content is reported ready.
    const formatLoading = format.querySelector<HTMLElement>('core-loading');
    if (formatLoading && (
        formatLoading.getAttribute('aria-busy') !== 'false'
        || !formatLoading.classList.contains('core-loading-loaded')
    )) {
        return false;
    }

    const renderedContent = format.querySelector<HTMLElement>(
        'ion-accordion-group, core-empty-box, core-course-section, [data-course-content-ready="true"]',
    );

    return !!renderedContent && isVisible(renderedContent);
}

const progressiveSelector = 'core-course-section, core-course-module';
const revealedNativeCourseElements = new WeakSet<HTMLElement>();

/**
 * Adds a one-time reveal state to real Moodle sections/modules when they enter the viewport.
 * Existing content is reused by Moodle's keyed section renderer; updates do not restart animations.
 *
 * @param documentRef Active app document.
 * @param courseId Exact Moodle course being opened.
 * @returns Cleanup function for route exit or a failed/cancelled course opening.
 */
export function observeNativeCourseProgression(documentRef: Document, courseId: number): () => void {
    const view = documentRef.defaultView;
    const MutationObserverConstructor = view?.MutationObserver;
    const IntersectionObserverConstructor = view?.IntersectionObserver;
    if (!view || !MutationObserverConstructor || !IntersectionObserverConstructor
        || !Number.isSafeInteger(courseId) || courseId <= 0
        || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return () => undefined;
    }

    let active = true;
    let page: HTMLElement | undefined;
    let courseObserver: MutationObserver | undefined;
    const pendingElements = new Set<HTMLElement>();

    const intersectionObserver = new IntersectionObserverConstructor((entries) => {
        if (!active || !page || !isVisible(page)) {
            return;
        }

        for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
                continue;
            }

            const element = entry.target as HTMLElement;
            element.classList.remove('ifrn-course-progressive-pending');
            element.classList.add('ifrn-course-progressive-ready');
            revealedNativeCourseElements.add(element);
            pendingElements.delete(element);
            intersectionObserver.unobserve(element);
        }
    }, { root: null, rootMargin: '0px 0px 24px 0px', threshold: 0.01 });

    const observeElement = (element: HTMLElement): void => {
        if (revealedNativeCourseElements.has(element)
            || element.classList.contains('ifrn-course-progressive-ready')
            || element.classList.contains('ifrn-course-progressive-pending')) {
            return;
        }

        element.classList.add('ifrn-course-progressive-pending');
        pendingElements.add(element);
        intersectionObserver.observe(element);
    };

    const processNode = (node: Node): void => {
        if (node.nodeType !== 1) {
            return;
        }

        const element = node as HTMLElement;
        if (element.matches(progressiveSelector)) {
            observeElement(element);
        }
        element.querySelectorAll<HTMLElement>(progressiveSelector).forEach(observeElement);
    };

    const attachToCourse = (): boolean => {
        if (!active || page?.isConnected) {
            return !!page;
        }

        const matchingPages = Array.from(documentRef.querySelectorAll<HTMLElement>('page-core-course-index'))
            .filter((candidate) => candidate.getAttribute('data-course-id') === String(courseId));
        page = matchingPages.find(isVisible) || matchingPages[0];
        if (!page) {
            return false;
        }

        page.classList.add('ifrn-course-progressive');
        processNode(page);
        courseObserver = new MutationObserverConstructor((records) => {
            for (const record of records) {
                record.addedNodes.forEach(processNode);
            }
        });
        courseObserver.observe(page, { childList: true, subtree: true });

        return true;
    };

    const pageDiscoveryObserver = new MutationObserverConstructor(() => {
        if (attachToCourse()) {
            pageDiscoveryObserver.disconnect();
        }
    });
    pageDiscoveryObserver.observe(documentRef.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-course-id', 'class', 'hidden'],
    });
    if (attachToCourse()) {
        pageDiscoveryObserver.disconnect();
    }

    return () => {
        if (!active) {
            return;
        }
        active = false;
        pageDiscoveryObserver.disconnect();
        courseObserver?.disconnect();
        intersectionObserver.disconnect();
        pendingElements.forEach((element) => element.classList.remove('ifrn-course-progressive-pending'));
        pendingElements.clear();
    };
}

/**
 * Find the visible page for one exact Moodle course ID.
 *
 * @param documentRef Active app document.
 * @param courseId Exact Moodle course ID.
 * @returns Visible matching page, if present.
 */
function findVisibleCoursePage(documentRef: Document, courseId: number): HTMLElement | undefined {
    if (!Number.isSafeInteger(courseId) || courseId <= 0 || !documentRef.defaultView) {
        return undefined;
    }

    return Array.from(documentRef.querySelectorAll<HTMLElement>('page-core-course-index'))
        .find((candidate) => candidate.getAttribute('data-course-id') === String(courseId) && isVisible(candidate));
}

/**
 * Checks that an element belongs to the visible Ionic page.
 *
 * @param element Element to inspect.
 * @returns Whether the element occupies visible layout space.
 */
function isVisible(element: HTMLElement): boolean {
    if (element.closest('.ion-page-hidden, .ion-page-invisible, [hidden]')) {
        return false;
    }

    return element.getClientRects().length > 0;
}
