const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadHandoffModule() {
    const filename = path.join(__dirname, '..', 'navigation', 'handoff-loading.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const elements = new Map();

    function createElement(tagName) {
        const element = {
            tagName,
            id: '',
            style: {},
            attributes: {},
            children: [],
            classList: { add() {}, remove() {} },
            setAttribute(name, value) { this.attributes[name] = value; },
            appendChild(child) {
                this.children.push(child);
                if (child.id) elements.set(child.id, child);
                return child;
            },
            append(...children) { children.forEach(child => this.appendChild(child)); },
            remove() { if (this.id) elements.delete(this.id); },
        };
        return element;
    }

    const document = {
        baseURI: 'file:///android_asset/www/',
        documentElement: createElement('html'),
        head: createElement('head'),
        body: createElement('body'),
        createElement,
        getElementById: id => elements.get(id) || null,
    };
    const module = { exports: {} };
    vm.runInNewContext(javascript, {
        module,
        exports: module.exports,
        document,
        window: { setTimeout },
        sessionStorage: { removeItem() {} },
        URL,
    });

    return { api: module.exports, document, elements };
}

test('course handoff renders one accessible IFRN cover for repeated show calls', () => {
    const { api, document, elements } = loadHandoffModule();

    api.showHandoffLoading();
    api.showHandoffLoading();

    const cover = elements.get('ifrn-handoff-loading');
    assert.ok(cover);
    assert.equal(cover.attributes.role, 'status');
    assert.equal(cover.attributes['aria-live'], 'polite');
    assert.equal(cover.children.length, 1);
    assert.equal(document.head.children[0].id, 'ifrn-handoff-style');
});

test('course handoff uses the packaged IFRN logo and branded loading message', () => {
    const { api, elements } = loadHandoffModule();

    api.showHandoffLoading();

    const [content] = elements.get('ifrn-handoff-loading').children;
    const [brand, message] = content.children;
    const [logo, spinner] = brand.children;
    assert.match(logo.src, /mobilemoodle\/static\/theme\/ifrn\/img\/splash-logo\.png$/);
    assert.equal(logo.alt, 'Moodle IFRN');
    assert.equal(brand.style.width, 'min(132px, 34vw)');
    assert.equal(logo.style.borderRadius, '50%');
    assert.equal(logo.style.objectFit, 'cover');
    assert.equal(spinner.style.position, 'absolute');
    assert.equal(spinner.style.width, '100%');
    assert.equal(spinner.attributes['aria-hidden'], 'true');
    assert.equal(message.textContent, 'Abrindo sua disciplina...');
});

test('course navigation does not release the cover before first-paint readiness', () => {
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
    assert.ok(readiness >= 0, 'course opening must wait for the native themed first paint');
    assert.ok(performPromise > openStart && finalRelease > performPromise,
        'the cover must be released only when the async course opening operation settles');

    const courseNavStart = source.indexOf('private handleCourseNavEnd(url: string): void {');
    const courseNavEnd = source.indexOf('\n    /** Mesmo destino do goBack()', courseNavStart);
    assert.ok(courseNavStart >= 0 && courseNavEnd > courseNavStart, 'expected the course navigation observer');
    const courseNavigation = source.slice(courseNavStart, courseNavEnd);
    const courseIndexStart = courseNavigation.indexOf('if (isCourseIndexPath(path, courseId))');
    const courseIndexEnd = courseNavigation.indexOf('// Ainda não vimos o course index', courseIndexStart);
    assert.ok(courseIndexStart >= 0 && courseIndexEnd > courseIndexStart, 'expected the course index branch');
    assert.doesNotMatch(
        courseNavigation.slice(courseIndexStart, courseIndexEnd),
        /hideNativeCourseHandoff/,
        'NavigationEnd must not expose the Moodle back button before the themed first paint is ready',
    );
});
