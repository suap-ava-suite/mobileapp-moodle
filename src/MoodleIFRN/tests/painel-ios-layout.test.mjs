import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';

// DOM simulado: não equivale a executar WebKit ou medir um iPhone.
const bundle = buildSync({
    entryPoints: ['src/MoodleIFRN/mobilemoodle/core_mobile/app-keyboard.ts'],
    bundle: true, write: false, format: 'iife', globalName: 'keyboard',
}).outputFiles[0].text;

function setup({ embedded = true, crossOrigin = false, android = false } = {}) {
    const properties = new Map();
    const classes = new Set();
    const events = new Map();
    const observers = [];
    const metrics = { top: 47, right: 0, bottom: 34, left: 0, keyboard: 0 };
    let probes = 0;
    const makeProbe = () => ({ style: {}, remove() { probes--; } });
    const root = {
        style: { setProperty: (key, value) => properties.set(key, value) },
        appendChild() { probes++; },
    };
    const document = {
        documentElement: root,
        body: { classList: { toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key) } },
        createElement: makeProbe,
        addEventListener(name, callback) {
            if (name === 'deviceready') queueMicrotask(callback);
        },
    };
    const hostRoot = { appendChild() { probes++; } };
    const parent = {
        cordova: { platformId: android ? 'android' : 'ios' },
        document: { documentElement: hostRoot, createElement: makeProbe },
        getComputedStyle(element) {
            // Valores da custom property podem conter env()/calc(), não pixels.
            if (element === hostRoot) return { getPropertyValue: () => 'env(safe-area-inset-top)' };
            return {
                paddingTop: `${metrics.top}px`, paddingRight: `${metrics.right}px`,
                paddingBottom: `${metrics.bottom}px`, paddingLeft: `${metrics.left}px`,
                height: `${metrics.keyboard}px`,
            };
        },
    };
    if (crossOrigin) Object.defineProperty(parent, 'document', { get() { throw new Error('SecurityError'); } });
    const window = {
        parent, innerHeight: 800, visualViewport: { height: 800, offsetTop: 0, addEventListener() {} },
        addEventListener: (name, callback) => events.set(name, callback),
        setTimeout() { return 1; },
    };
    if (!embedded) window.parent = window;
    if (android) window.cordova = {};
    const context = vm.createContext({
        window, document, navigator: { userAgent: android ? 'Android' : 'iPhone' },
        getComputedStyle: () => ({ paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px' }),
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
    });
    vm.runInContext(bundle, context);
    context.keyboard.initKeyboardInsets();
    return { properties, classes, metrics, window, observers, events, get probes() { return probes; } };
}

test('iframe resolve margens do host, acompanha rotação e limpa probes/observer', async () => {
    const app = setup();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.properties.get('--ion-safe-area-top'), '47px');
    assert.equal(app.properties.get('--ion-safe-area-bottom'), '34px');
    Object.assign(app.metrics, { top: 0, left: 47, right: 47, bottom: 21 });
    app.observers[0].callback();
    assert.equal(app.properties.get('--ion-safe-area-left'), '47px');
    assert.equal(app.properties.get('--ion-safe-area-right'), '47px');
    assert.equal(app.probes, 0);
    app.events.get('pagehide')();
    assert.equal(app.observers[0].disconnected, true);
});

test('teclado nativo do host não reduz duas vezes o iframe e restaura home indicator', async () => {
    const app = setup();
    await new Promise(resolve => setImmediate(resolve));
    app.metrics.keyboard = 340;
    app.observers[0].callback();
    assert.equal(app.classes.has('keyboard-is-open'), true);
    assert.equal(app.properties.get('--keyboard-height'), '0px');
    assert.equal(app.properties.get('--ion-safe-area-bottom'), '0px');
    app.metrics.keyboard = 0;
    app.observers[0].callback();
    assert.equal(app.classes.has('keyboard-is-open'), false);
    assert.equal(app.properties.get('--ion-safe-area-bottom'), '34px');
});

test('browser independente mantém visualViewport sem margem superior artificial', async () => {
    const app = setup({ embedded: false });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.properties.get('--ion-safe-area-top'), '0px');
    app.window.visualViewport.height = 500;
    app.events.get('resize')();
    assert.equal(app.properties.get('--keyboard-height'), '300px');
    assert.equal(app.classes.has('keyboard-is-open'), true);
});

test('fallback de status bar continua exclusivo do Cordova Android', async () => {
    const app = setup({ embedded: false, android: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.properties.get('--ion-safe-area-top'), '24px');
});

test('iframe Android mantém o cálculo local de teclado pelo visualViewport', async () => {
    const app = setup({ android: true });
    await new Promise(resolve => setImmediate(resolve));
    app.metrics.keyboard = 340;
    app.observers[0].callback();
    assert.equal(app.classes.has('keyboard-is-open'), false);
    app.window.visualViewport.height = 500;
    app.events.get('resize')();
    assert.equal(app.properties.get('--keyboard-height'), '300px');
});

test('pai de outra origem não quebra o fallback local', async () => {
    const app = setup({ crossOrigin: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.properties.get('--ion-safe-area-top'), '0px');
    assert.equal(app.observers.length, 0);
});
