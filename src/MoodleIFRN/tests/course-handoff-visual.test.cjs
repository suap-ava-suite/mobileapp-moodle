const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadHandoffModule() {
    const filename = path.join(__dirname, '..', 'navigation', 'handoff-loading.ts');
    const componentFilename = path.join(__dirname, '..', 'moodle-course', 'ifrn-course-loading.component.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const elements = new Map();
    const stats = { created: 0, attached: 0, detached: 0, destroyed: 0, detected: 0, removedStorage: 0, failCreation: false, mountWarnings: 0 };

    function createElement(tagName) {
        return {
            tagName,
            id: '',
            children: [],
            classList: { add() {}, remove() {} },
            appendChild(child) {
                this.children.push(child);
                elements.set(child.id, child);
                child.remove = () => {
                    this.children = this.children.filter(item => item !== child);
                    elements.delete(child.id);
                };
                return child;
            },
        };
    }

    const document = {
        documentElement: {
            classList: {
                values: new Set(),
                add(value) { this.values.add(value); },
                remove(value) { this.values.delete(value); },
            },
        },
        body: createElement('body'),
        createElement,
        getElementById: id => elements.get(id) || null,
    };

    class TestComponent {}
    const applicationRef = {
        attachView() { stats.attached++; },
        detachView() { stats.detached++; },
    };
    const environmentInjector = {};
    const module = { exports: {} };
    const requireMock = id => {
        if (id === '@angular/core') {
            return {
                createComponent: (componentClass, options) => {
                    assert.equal(componentClass, TestComponent);
                    assert.equal(options.environmentInjector, environmentInjector);
                    assert.equal(options.hostElement.id, 'ifrn-handoff-loading');
                    stats.created++;
                    if (stats.failCreation) {
                        throw new Error('synthetic creation failure');
                    }
                    const instance = {};
                    return {
                        hostView: {},
                        instance,
                        setInput(name, value) { instance[name] = value; },
                        changeDetectorRef: { detectChanges() { stats.detected++; } },
                        destroy() {
                            stats.destroyed++;
                            options.hostElement.remove?.();
                        },
                    };
                },
            };
        }
        if (id === '../moodle-course/ifrn-course-loading.component') {
            return { IfrnCourseLoadingComponent: TestComponent };
        }

        throw new Error(`Unexpected import: ${id}`);
    };

    vm.runInNewContext(javascript, {
        module,
        exports: module.exports,
        require: requireMock,
        document,
        performance: { now: () => 12 },
        sessionStorage: { removeItem() { stats.removedStorage++; } },
        console: { warn() { stats.mountWarnings++; } },
    });

    return { api: module.exports, applicationRef, environmentInjector, document, elements, stats, componentFilename };
}

test('course handoff mounts one Angular component and reuses it for duplicate show calls', () => {
    const { api, applicationRef, environmentInjector, elements, stats } = loadHandoffModule();
    const firstCancel = () => {};
    const secondCancel = () => {};

    api.showHandoffLoading(applicationRef, environmentInjector, { courseName: 'Curso sintético', onCancel: firstCancel });
    api.showHandoffLoading(applicationRef, environmentInjector, { courseName: 'Curso atualizado', onCancel: secondCancel });

    assert.equal(elements.get('ifrn-handoff-loading').tagName, 'ifrn-course-loading');
    assert.equal(stats.created, 1);
    assert.equal(stats.attached, 1);
    assert.equal(stats.detected, 2);
});

test('course handoff destroys the Angular view and clears only its transient flag', () => {
    const { api, applicationRef, environmentInjector, document, elements, stats } = loadHandoffModule();

    api.showHandoffLoading(applicationRef, environmentInjector, { courseName: '', onCancel() {} });
    api.hideHandoffLoading();

    assert.equal(elements.has('ifrn-handoff-loading'), false);
    assert.equal(stats.detached, 1);
    assert.equal(stats.destroyed, 1);
    assert.equal(stats.removedStorage, 1);
    assert.equal(document.documentElement.classList.values.has('ifrn-native-handoff'), false);
});

test('course handoff failure does not block navigation or leave an overlay behind', () => {
    const { api, applicationRef, environmentInjector, document, elements, stats } = loadHandoffModule();
    stats.failCreation = true;

    assert.doesNotThrow(() => api.showHandoffLoading(applicationRef, environmentInjector, { courseName: '', onCancel() {} }));
    assert.equal(elements.has('ifrn-handoff-loading'), false);
    assert.equal(document.documentElement.classList.values.has('ifrn-native-handoff'), false);
    assert.equal(stats.mountWarnings, 1);
});

test('Angular course skeleton has IFRN header, staged sections, cancellation and reduced-motion support', () => {
    const { componentFilename } = loadHandoffModule();
    const template = fs.readFileSync(path.join(path.dirname(componentFilename), 'ifrn-course-loading.component.html'), 'utf8');
    const styles = fs.readFileSync(path.join(path.dirname(componentFilename), 'ifrn-course-loading.component.scss'), 'utf8');
    const component = fs.readFileSync(componentFilename, 'utf8');

    assert.match(template, /Moodle IFRN/);
    assert.match(template, /Abrindo disciplina/);
    assert.match(template, /\(click\)="requestCancel\(\)"/);
    assert.equal((template.match(/course-loading__section course-loading__reveal/g) || []).length, 2);
    assert.match(template, /@if \(courseName\)/);
    assert.match(styles, /--ifrn-canvas/);
    assert.match(styles, /animation-delay: 55ms/);
    assert.match(styles, /animation-delay: 110ms/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
    assert.doesNotMatch(template, /%/);
    assert.match(component, /ChangeDetectionStrategy\.OnPush/);
    assert.match(component, /signal\(false\)/);
});

test('Angular course loader invokes cancellation at most once', () => {
    const { componentFilename } = loadHandoffModule();
    const javascript = ts.transpileModule(fs.readFileSync(componentFilename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const angular = {
        ChangeDetectionStrategy: { OnPush: 1 },
        Component: () => target => target,
        Input: () => () => {},
        signal: initial => {
            let value = initial;
            const read = () => value;
            read.set = next => value = next;
            return read;
        },
    };
    const exports = {};
    vm.runInNewContext(javascript, {
        exports,
        require: id => id === '@angular/core' ? angular : {},
        performance: { now: () => 8 },
        requestAnimationFrame: () => 0,
        cancelAnimationFrame() {},
        console,
    });
    const component = new exports.IfrnCourseLoadingComponent();
    let cancellations = 0;
    component.onCancel = () => cancellations++;

    component.requestCancel();
    component.requestCancel();

    assert.equal(cancellations, 1);
    assert.equal(component.cancellationStarted(), true);
});

test('course handoff cancellation is guarded and returns to the IFRN panel', () => {
    const filename = path.join(__dirname, '..', 'services_mobile', 'moodle-site.service.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const start = source.indexOf('private cancelNativeCourseHandoff(): void {');
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, 'expected the handoff cancellation handler');
    const handler = source.slice(start, end);
    assert.match(handler, /cancelCourseOpeningForPanelExit\(\)/);
    assert.match(handler, /dismissCourseRecovery\(\)/);
    assert.match(handler, /redirectToPainelAva\(\)/);
});

test('course navigation keeps the Angular cover until the themed native route has painted', () => {
    const filename = path.join(__dirname, '..', 'services_mobile', 'moodle-site.service.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const navigationMarker = source.indexOf('A rota pode chegar antes dos dados');
    const navigationBranchStart = source.indexOf('{', navigationMarker);
    const navigationBranchEnd = source.indexOf('\n            }', navigationBranchStart);
    assert.ok(navigationMarker >= 0 && navigationBranchStart >= 0 && navigationBranchEnd > navigationBranchStart,
        'expected the course NavigationEnd branch');
    assert.doesNotMatch(source.slice(navigationBranchStart, navigationBranchEnd), /hideNativeCourseHandoff/);

    const openStart = source.indexOf('openCourseById(courseId, attempt =');
    const readiness = source.indexOf("attempt.stage('course-first-paint'");
    const performPromise = source.indexOf('this.performOpenCourseById(courseId, attempt)', openStart);
    const finalRelease = source.indexOf('this.hideNativeCourseHandoff();', performPromise);
    assert.ok(readiness >= 0, 'course opening must wait for route, visible component and IFRN theme tokens');
    assert.ok(performPromise > openStart && finalRelease > performPromise,
        'the cover must be released after the asynchronous course-ready check');
});
