const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

test('course route does not render a second loader during native opening', () => {
    const filename = path.join(__dirname, '..', 'moodle-open-course', 'moodle-open-course.html');
    const template = fs.readFileSync(filename, 'utf8');
    const loadingBranch = template.match(/@if \(phase === 'loading'\)([\s\S]*?)\} @else if \(phase === 'waiting-browser'\)/);

    assert.ok(loadingBranch, 'expected a dedicated native-opening template branch');
    assert.doesNotMatch(loadingBranch[1], /moodle-open-course__silent|ion-spinner|Carregando curso/);
    assert.match(template, /@else if \(phase === 'waiting-browser'\)[\s\S]*?moodle-open-course__silent/,
        'browser handoff keeps its own status while waiting for SUAP');
});

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
    const [logo, gauge] = brand.children;
    assert.match(logo.src, /mobilemoodle\/static\/theme\/ifrn\/img\/splash-logo\.png$/);
    assert.equal(logo.alt, 'Moodle IFRN');
    assert.equal(brand.style.width, 'min(132px, 34vw)');
    assert.equal(logo.style.width, '68%');
    assert.equal(logo.style.borderRadius, '50%');
    assert.equal(logo.style.objectFit, 'cover');
    assert.equal(gauge.style.position, 'absolute');
    assert.equal(gauge.style.animation, 'ifrn-handoff-spin 0.95s linear infinite');
    assert.equal(gauge.attributes['aria-hidden'], 'true');
    assert.match(gauge.innerHTML, /stroke-dasharray="68 271"/);
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
    assert.match(source.slice(readiness, source.indexOf('} catch (error)', readiness)),
        /host\.shadowRoot && hasVisibleLoading\(host\.shadowRoot\)/,
        'handoff should cover loaders inside Ionic tab outlet shadow roots');
    assert.match(source.slice(readiness, source.indexOf('} catch (error)', readiness)), /now - readySince >= 300/,
        'handoff should wait briefly for late-created Moodle placeholders before releasing');
    assert.ok(performPromise > openStart && finalRelease > performPromise,
        'the cover must be released only when the async course opening operation settles');
});
