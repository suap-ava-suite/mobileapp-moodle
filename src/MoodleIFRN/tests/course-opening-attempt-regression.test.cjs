const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function loadTypeScript(relativePath) {
    const filename = path.join(__dirname, '..', relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = { exports: {}, performance, AbortController, setTimeout, clearTimeout, Date, console };
    vm.runInNewContext(output, context, { filename });

    return context.exports;
}

const { CourseOpeningAttempt } = loadTypeScript('navigation/course-opening-attempt.ts');
const { isNativeCourseContentReady } = loadTypeScript('navigation/course-content-readiness.ts');

test('only an explicit user action is reported as course-opening cancellation', async () => {
    const attempt = new CourseOpeningAttempt();
    await assert.rejects(
        attempt.stage('test-operation', async () => { throw new Error('synthetic storage failure'); }),
        /synthetic storage failure/,
    );
    assert.equal(attempt.cancelled, false);
    assert.equal(attempt.active, true);

    const userCancelled = new CourseOpeningAttempt();
    userCancelled.cancel();
    assert.equal(userCancelled.cancelled, true);
    assert.equal(userCancelled.active, false);
    assert.throws(() => userCancelled.assertActive(), /abertura foi cancelada/i);
});

test('a first-load timeout is reported as a timeout and invalidates later stages without calling it user cancel', async () => {
    const attempt = new CourseOpeningAttempt();
    await assert.rejects(
        attempt.stage('course-content-ready', () => new Promise(() => {}), 5, true, 'course content timeout'),
        /course content timeout/,
    );
    assert.equal(attempt.cancelled, false);
    assert.equal(attempt.active, false);
    assert.throws(() => attempt.assertActive(), /course content timeout/);
});

test('a non-cancellable route operation holds its attempt until the operation settles', async () => {
    const attempt = new CourseOpeningAttempt();
    let finish;
    let settled = false;
    const gate = new Promise(resolve => finish = resolve);
    const operation = attempt.stageUntilSettled('native-route', () => gate).finally(() => settled = true);

    await Promise.resolve();
    attempt.cancel();
    await Promise.resolve();
    assert.equal(settled, false);

    finish('late route result');
    await assert.rejects(operation, /abertura foi cancelada/i);
    assert.equal(settled, true);
});

class FakeElement {
    constructor({ attrs = {}, selectors = {}, visible = true, classes = [], animations = [] } = {}) {
        this.attrs = attrs;
        this.selectors = selectors;
        this.visible = visible;
        this.animations = animations;
        this.classList = { contains: value => classes.includes(value) };
    }

    getAttribute(name) { return this.attrs[name] ?? null; }
    querySelectorAll(selector) { return this.selectors[selector] || []; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest() { return this.visible ? null : {}; }
    getClientRects() { return this.visible ? [{}] : []; }
    getAnimations() { return this.animations; }
}

function readyDocument({ courseId = 4022, contentCourseId = courseId, theme = '#1351b4', busy = 'false',
    loaded = true, rendered = true, pageVisible = true, transitioning = false } = {}) {
    const renderedContent = rendered ? new FakeElement() : null;
    const loading = new FakeElement({
        attrs: { 'aria-busy': busy },
        classes: loaded ? ['core-loading-loaded'] : [],
    });
    const format = new FakeElement({
        selectors: {
            'core-loading': [loading],
            'ion-accordion-group, core-empty-box, core-course-section, [data-course-content-ready="true"]':
                renderedContent ? [renderedContent] : [],
        },
    });
    const contentPage = new FakeElement({
        attrs: { 'data-course-id': String(contentCourseId) },
        selectors: { 'core-course-format': [format] },
    });
    const page = new FakeElement({
        attrs: { 'data-course-id': String(courseId) },
        selectors: { 'page-core-course-contents': [contentPage] },
        visible: pageVisible,
        animations: transitioning ? [{ playState: 'running' }] : [],
    });
    const documentRef = {
        defaultView: { getComputedStyle: () => ({ getPropertyValue: () => theme }) },
        querySelectorAll: selector => selector === 'page-core-course-index' ? [page] : [],
    };

    return documentRef;
}

test('course readiness does not release on the Moodle header alone', () => {
    assert.equal(isNativeCourseContentReady(readyDocument({ rendered: false }), 4022), false);
    assert.equal(isNativeCourseContentReady(readyDocument({ busy: 'true', loaded: false }), 4022), false);
    assert.equal(isNativeCourseContentReady(readyDocument({ contentCourseId: 111 }), 4022), false);
    assert.equal(isNativeCourseContentReady(readyDocument({ theme: '' }), 4022), false);
    assert.equal(isNativeCourseContentReady(readyDocument({ pageVisible: false }), 4022), false);
    assert.equal(isNativeCourseContentReady(readyDocument({ transitioning: true }), 4022), false);
});

test('course readiness releases only for the selected course after the Moodle format is loaded', () => {
    assert.equal(isNativeCourseContentReady(readyDocument(), 4022), true);
    assert.equal(isNativeCourseContentReady(readyDocument(), 2836), false);
});

test('native open failures are not turned into user cancellation and the handoff waits for course content', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services_mobile', 'moodle-site.service.ts'), 'utf8');
    const openStart = source.indexOf('    openCourseById(courseId: number, attempt =');
    const performStart = source.indexOf('private async performOpenCourseById', openStart);
    const openBlock = source.slice(openStart, performStart);

    assert.doesNotMatch(openBlock, /attempt\.cancel\(\)/);
    assert.match(openBlock, /attempt\.cancelled \? 'cancelled' : 'error'/);
    assert.match(source, /stageUntilSettled\('native-helper-and-navigation'/);
    assert.match(source, /'course-content-ready'/);
    assert.doesNotMatch(source, /attempt\.stage\('course-first-paint'[\s\S]{0,900}?\),\s*5000\)/);
});
