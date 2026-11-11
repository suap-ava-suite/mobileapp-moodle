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
const {
    isNativeCourseContentReady,
    isNativeCourseShellReady,
    observeNativeCourseProgression,
} = loadTypeScript('navigation/course-content-readiness.ts');

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
    constructor({ attrs = {}, selectors = {}, visible = true, classes = [], animations = [], textContent = '' } = {}) {
        this.attrs = attrs;
        this.selectors = selectors;
        this.visible = visible;
        this.animations = animations;
        this.textContent = textContent;
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
        selectors: {
            '.core-course-header': [new FakeElement({
                selectors: { h1: [new FakeElement({ textContent: 'Curso de teste' })] },
            })],
            'page-core-course-contents': [contentPage],
        },
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

test('the simple handoff can release only for the selected themed course header', () => {
    assert.equal(isNativeCourseShellReady(readyDocument(), 4022), true);
    assert.equal(isNativeCourseShellReady(readyDocument({ theme: '' }), 4022), false);
    assert.equal(isNativeCourseShellReady(readyDocument({ pageVisible: false }), 4022), false);
    assert.equal(isNativeCourseShellReady(readyDocument(), 2836), false);
});

test('progressive reveal waits for real section/module nodes to intersect and cleans pending states', () => {
    class FakeClassList {
        constructor() { this.values = new Set(); }
        add(value) { this.values.add(value); }
        remove(value) { this.values.delete(value); }
        contains(value) { return this.values.has(value); }
    }
    class FakeElement {
        constructor(tagName, attrs = {}, children = []) {
            this.tagName = tagName;
            this.attrs = attrs;
            this.children = children;
            this.nodeType = 1;
            this.isConnected = true;
            this.classList = new FakeClassList();
        }
        getAttribute(name) { return this.attrs[name] ?? null; }
        matches(selector) { return selector.split(', ').includes(this.tagName); }
        querySelectorAll(selector) {
            const result = [];
            for (const child of this.children) {
                if (child.matches(selector)) result.push(child);
                result.push(...child.querySelectorAll(selector));
            }
            return result;
        }
        closest() { return null; }
        getClientRects() { return [{}]; }
        contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    }
    class FakeMutationObserver {
        static instances = [];
        constructor(callback) { this.callback = callback; this.disconnected = false; FakeMutationObserver.instances.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    }
    class FakeIntersectionObserver {
        static instances = [];
        constructor(callback) { this.callback = callback; this.targets = new Set(); FakeIntersectionObserver.instances.push(this); }
        observe(target) { this.targets.add(target); }
        unobserve(target) { this.targets.delete(target); }
        disconnect() { this.targets.clear(); }
        show(target) { this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }]); }
    }

    const firstModule = new FakeElement('core-course-module');
    const firstSection = new FakeElement('core-course-section', {}, [firstModule]);
    const laterSection = new FakeElement('core-course-section');
    const page = new FakeElement('page-core-course-index', { 'data-course-id': '4022' }, [firstSection, laterSection]);
    const root = new FakeElement('html', {}, [page]);
    const documentRef = {
        documentElement: root,
        defaultView: {
            MutationObserver: FakeMutationObserver,
            IntersectionObserver: FakeIntersectionObserver,
            matchMedia: () => ({ matches: false }),
        },
        querySelectorAll: selector => selector === 'page-core-course-index' ? [page] : [],
    };

    const cleanup = observeNativeCourseProgression(documentRef, 4022);
    const intersection = FakeIntersectionObserver.instances.at(-1);
    assert.equal(page.classList.contains('ifrn-course-progressive'), true);
    assert.equal(firstSection.classList.contains('ifrn-course-progressive-pending'), true);
    assert.equal(firstModule.classList.contains('ifrn-course-progressive-pending'), true);
    assert.equal(laterSection.classList.contains('ifrn-course-progressive-pending'), true);

    intersection.show(firstSection);
    assert.equal(firstSection.classList.contains('ifrn-course-progressive-ready'), true);
    assert.equal(firstSection.classList.contains('ifrn-course-progressive-pending'), false);

    const newModule = new FakeElement('core-course-module');
    firstSection.children.push(newModule);
    const contentObserver = FakeMutationObserver.instances.at(-1);
    contentObserver.callback([{ addedNodes: [newModule] }]);
    assert.equal(newModule.classList.contains('ifrn-course-progressive-pending'), true);
    intersection.show(newModule);
    assert.equal(newModule.classList.contains('ifrn-course-progressive-ready'), true);

    cleanup();
    assert.equal(laterSection.classList.contains('ifrn-course-progressive-pending'), false);
    assert.equal(firstSection.classList.contains('ifrn-course-progressive-ready'), true);
    assert.equal(intersection.targets.size, 0);
});

test('the simple handoff yields to the themed course shell while the native content load continues', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'services_mobile', 'moodle-site.service.ts'), 'utf8');
    const openStart = source.indexOf('    openCourseById(courseId: number, attempt =');
    const performStart = source.indexOf('private async performOpenCourseById', openStart);
    const openBlock = source.slice(openStart, performStart);

    assert.doesNotMatch(openBlock, /attempt\.cancel\(\)/);
    assert.match(openBlock, /attempt\.cancelled \? 'cancelled' : 'error'/);
    assert.match(source, /stageUntilSettled\('native-helper-and-navigation'/);
    assert.match(source, /'course-shell-ready'/);
    assert.match(source, /'course-content-ready'/);
    assert.match(source, /startNativeCourseProgression\(courseId\)/);
    assert.match(source, /hideHandoffLoading\(\);[\s\S]{0,400}course-content-ready/);
    assert.doesNotMatch(source, /attempt\.stage\('course-first-paint'[\s\S]{0,900}?\),\s*5000\)/);
});
