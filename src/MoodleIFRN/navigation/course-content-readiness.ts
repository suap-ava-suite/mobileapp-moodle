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
 * True only after the requested native course page and its contents component are visible,
 * the IFRN theme is active, and Moodle's course-format loading indicator has released real content.
 * The DOM is observed read-only; no Moodle page content or authentication state is modified.
 *
 * @param documentRef Active app document to inspect.
 * @param courseId Exact Moodle course requested by the user.
 * @returns Whether the requested course content is visibly ready.
 */
export function isNativeCourseContentReady(documentRef: Document, courseId: number): boolean {
    if (!Number.isSafeInteger(courseId) || courseId <= 0 || !documentRef.defaultView) {
        return false;
    }

    const page = Array.from(documentRef.querySelectorAll<HTMLElement>('page-core-course-index'))
        .find((candidate) => candidate.getAttribute('data-course-id') === String(courseId) && isVisible(candidate));
    if (!page) {
        return false;
    }

    const theme = documentRef.defaultView.getComputedStyle(page).getPropertyValue('--ifrn-ava').trim();
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
    // still render a real section/empty state below before the IFRN cover is removed.
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
