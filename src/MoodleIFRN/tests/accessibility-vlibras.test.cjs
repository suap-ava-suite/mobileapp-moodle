const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

class FakeClassList {
    values = new Set();
    add(...values) { values.forEach((value) => this.values.add(value)); }
    remove(...values) { values.forEach((value) => this.values.delete(value)); }
    contains(value) { return this.values.has(value); }
}

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.dataset = {};
        this.attributes = {};
        this.listeners = {};
        this.classList = new FakeClassList();
        this.style = { display: 'none', removeProperty(name) { if (name === 'display') this.display = ''; } };
        this.parentElement = null;
        this.id = '';
        this.src = '';
        this.async = false;
        this.className = '';
        this.innerHTML = '';
    }

    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); }
    emit(name) { (this.listeners[name] || []).forEach((callback) => callback()); }
    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
            this.parentElement = null;
        }
    }
    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }
    querySelector(selector) {
        const marker = selector === '[vw-access-button]' ? 'vw-access-button' : 'vw-plugin-wrapper';
        if (!this.innerHTML.includes(marker)) {
            return null;
        }
        this.markers ??= {};
        return this.markers[marker] ??= new FakeElement(marker);
    }
}

function loadWidgetModule() {
    const filename = path.join(__dirname, '..', 'mobilemoodle', 'core_mobile', 'vlibras-widget.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const body = new FakeElement('body');
    const document = {
        body,
        querySelector(selector) {
            return selector === 'div[vw]' ? body.children.find((child) => child.attributes.vw !== undefined) || null : null;
        },
        getElementById(id) { return body.children.find((child) => child.id === id) || null; },
        createElement(tagName) { return new FakeElement(tagName); },
    };
    const window = {};
    const context = { exports: {}, window, document, Promise, Error };
    vm.runInNewContext(output, context, { filename });

    return { loadVlibrasWidget: context.exports.loadVlibrasWidget, document, window, body };
}

test('the official VLibras script is deduplicated and a hidden wrapper is restored on re-enable', async () => {
    const env = loadWidgetModule();
    const first = env.loadVlibrasWidget();
    env.window.VLibras = { Widget: class {} };
    const second = env.loadVlibrasWidget();
    const scripts = env.body.children.filter((child) => child.id === 'vlibras-script');
    const root = env.document.querySelector('div[vw]');

    assert.equal(scripts.length, 1);
    assert.equal(second, env.window.__ifrnVlibrasLoader.promise, 'calls during script load share the pending initialization');
    assert.ok(root.classList.contains('enabled'));
    const wrapper = root.querySelector('[vw-plugin-wrapper]');
    assert.equal(wrapper.style.display, '');

    let constructorCalls = 0;
    env.window.VLibras = { Widget: class { constructor() { constructorCalls++; } } };
    scripts[0].emit('load');
    await Promise.all([first, second]);
    assert.equal(constructorCalls, 0, 'the official script auto-initializes; the app must not instantiate it twice');

    wrapper.style.display = 'none';
    await env.loadVlibrasWidget();
    assert.equal(wrapper.style.display, '', 're-enabling removes the inline display left by hide');
    assert.equal(env.body.children.filter((child) => child.id === 'vlibras-script').length, 1);
});

test('a failed VLibras request removes its stale script and allows a later retry', async () => {
    const env = loadWidgetModule();
    const firstAttempt = env.loadVlibrasWidget();
    const firstScript = env.document.getElementById('vlibras-script');
    firstScript.emit('error');
    await assert.rejects(firstAttempt, /Não foi possível carregar/);
    assert.equal(env.document.getElementById('vlibras-script'), null);

    const retry = env.loadVlibrasWidget();
    const retryScript = env.document.getElementById('vlibras-script');
    assert.ok(retryScript);
    assert.notEqual(retryScript, firstScript);
    env.window.VLibras = { Widget: class {} };
    retryScript.emit('load');
    await retry;
});

test('the mobile accessibility menus no longer expose the desktop mouse cursor option', () => {
    const root = path.join(__dirname, '..');
    const paths = [
        'mobilemoodle/index.html',
        'mobilemoodle/core_mobile/app-accessibility.ts',
        'mobilemoodle/core_mobile/global.d.ts',
        'mobilemoodle/static/theme/ifrn/scss/_accessibility.scss',
        'mobilemoodle/static/theme/ifrn/scss/painel.scss',
        'docs/TEMA-VISUAL.md',
        'moodle-course/course-menu.ts',
        'moodle-course/moodle-course.scss',
    ];
    for (const relative of paths) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, relative), 'utf8'), /big_cursor|Cursor do mouse grande/iu, relative);
    }
});

test('VLibras CSP includes the official widget font redirect host', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'mobilemoodle', 'index.html'), 'utf8');
    const csp = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u)?.[1];
    const fontPolicy = csp?.split(';').find((directive) => directive.trim().startsWith('font-src'));
    assert.ok(fontPolicy?.includes('https://vlibras.gov.br'));
    assert.ok(fontPolicy?.includes('https://cdn.jsdelivr.net'));
});
