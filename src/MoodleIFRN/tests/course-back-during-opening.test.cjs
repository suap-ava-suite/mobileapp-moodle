const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

class FakeCourseOpeningAttempt {
    cancelled = false;

    cancel() {
        this.cancelled = true;
    }
}

class FakeHTMLElement {
    constructor(tagName) {
        this.tagName = tagName;
    }

    closest(selector) {
        return selector === '.ifrn-course-back' ? this : null;
    }
}

function createService() {
    const storage = new Map([
        ['ifrn_course_origin', 'painel'],
        ['ifrn_course_id', '4022'],
        ['ifrn_moodle_pending_open_course', '{"courseId":4022}'],
    ]);
    const document = {
        documentElement: { classList: { add() {}, remove() {} } },
        getElementById: () => null,
    };
    const mocks = {
        '@angular/core': { Injectable: () => target => target, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({ debug() {} }) } },
        '../navigation/course-opening-attempt': { CourseOpeningAttempt: FakeCourseOpeningAttempt },
        '../navigation/handoff-loading': { hideHandoffLoading() {}, showHandoffLoading() {}, shouldShowCourseHandoffOnBoot: () => false },
    };
    const context = {
        exports: {},
        require: id => mocks[id] || {},
        console,
        document,
        HTMLElement: FakeHTMLElement,
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        window: { setTimeout, clearTimeout },
        setTimeout,
        clearTimeout,
        URL,
    };
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);

    return { service: new context.exports.MoodleSiteService(), storage };
}

test('course back during native opening cancels the attempt and returns to the IFRN panel', async () => {
    const { service, storage } = createService();
    let rejectOpening;
    let hidden = 0;
    let redirected = 0;
    service.hideNativeCourseHandoff = () => hidden++;
    service.redirectToPainelAva = () => redirected++;
    service.performEnsureSessionAndOpenCourse = () => new Promise((_resolve, reject) => rejectOpening = reject);

    const opening = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br');
    let prevented = false;
    let propagationStopped = false;
    const event = {
        composedPath: () => [new FakeHTMLElement('ION-BACK-BUTTON')],
        preventDefault: () => prevented = true,
        stopImmediatePropagation: () => propagationStopped = true,
    };

    service.onIfrnCourseBackClick(event);
    rejectOpening(new Error('synthetic cancellation'));

    assert.equal(await opening, 'cancelled');
    assert.equal(service.openingAttempt.cancelled, true);
    assert.equal(prevented, true);
    assert.equal(propagationStopped, true);
    assert.equal(redirected, 1);
    assert.equal(hidden, 1);
    assert.equal(storage.has('ifrn_moodle_pending_open_course'), false);
    assert.equal(storage.has('ifrn_course_origin'), false);
});
