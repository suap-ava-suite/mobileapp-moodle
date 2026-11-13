const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function setup() {
    const frames = new Map();
    let sequence = 0;
    let observer;
    let observing;
    let disconnects = 0;
    const tracked = new Set();
    const animation = new EventTarget();
    animation.playState = 'running';
    const add = animation.addEventListener.bind(animation);
    const remove = animation.removeEventListener.bind(animation);
    animation.addEventListener = (type, handler, options) => {
        tracked.add(type);
        add(type, handler, options);
    };
    animation.removeEventListener = (type, handler, options) => {
        remove(type, handler, options);
        tracked.delete(type);
    };
    const unrelated = new EventTarget();
    unrelated.playState = 'running';
    unrelated.addEventListener = () => assert.fail('Another course animation must not be observed');
    const events = new EventTarget();
    const document = {
        documentElement: {},
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        querySelectorAll: () => [
            { getAttribute: () => '99', getAnimations: () => [unrelated] },
            { getAttribute: () => '42', getAnimations: () => [unrelated], closest: () => ({}), getClientRects: () => [] },
            { getAttribute: () => '42', getAnimations: () => [animation], closest: () => null, getClientRects: () => [{}] },
        ],
    };
    const mocks = {
        '@angular/core': { Injectable: () => owner => owner },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console,
        document,
        requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        MutationObserver: class {
            constructor(callback) { observer = callback; }
            observe(_element, options) { observing = options; }
            disconnect() { disconnects++; }
        },
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    const service = Object.create(context.exports.MoodleSiteService.prototype);
    const controller = new AbortController();
    const attempt = { signal: controller.signal, assertActive() {
        if (controller.signal.aborted) throw new Error('synthetic cancellation');
    } };
    return { service, attempt, animation, tracked, frames, controller,
        mutate: () => observer(), get observing() { return observing; }, get disconnects() { return disconnects; },
        frame() {
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback());
        },
    };
}

test('Web Animations finish wakes readiness without waiting for an unrelated DOM mutation', async () => {
    const s = setup();
    let settled = false;
    const pending = s.service.waitForNativeCourseReadiness(42, s.attempt,
        () => s.animation.playState !== 'running').then(() => settled = true);
    s.frame();
    assert.equal(settled, false);
    s.animation.playState = 'finished';
    s.animation.dispatchEvent(new Event('finish'));
    assert.equal(s.frames.size, 1, 'Web Animations does not emit CSS animationend; finish must schedule a check');
    s.frame();
    assert.equal(settled, false, 'The painted-frame confirmation is still required');
    s.frame();
    await pending;
    assert.equal(settled, true);
    assert.equal(s.tracked.size, 0);
    assert.equal(s.disconnects, 1);
});

test('animation cancellation rechecks readiness but never accepts content that is still loading', async () => {
    const s = setup();
    let contentReady = false;
    let settled = false;
    const pending = s.service.waitForNativeCourseReadiness(42, s.attempt,
        () => contentReady && s.animation.playState !== 'running').then(() => settled = true);
    s.frame();
    s.animation.playState = 'idle';
    s.animation.dispatchEvent(new Event('cancel'));
    assert.equal(s.frames.size, 1);
    s.frame();
    await Promise.resolve();
    assert.equal(settled, false);
    contentReady = true;
    s.mutate();
    s.frame();
    s.frame();
    await pending;
    assert.equal(s.tracked.size, 0);
});

test('Angular text-node updates are observed as well as element insertion and loading attributes', async () => {
    const s = setup();
    let titleReady = false;
    const pending = s.service.waitForNativeCourseReadiness(42, s.attempt, () => titleReady);
    assert.equal(s.observing.characterData, true, 'Angular can update nodeValue without changing childList');
    assert.equal(s.observing.childList, true);
    assert.equal(s.observing.subtree, true);
    s.frame();
    titleReady = true;
    s.mutate();
    s.frame();
    s.frame();
    await pending;
});

test('leaving cancels animation listeners and pending frames, and late completion cannot revive the wait', async () => {
    const s = setup();
    const pending = s.service.waitForNativeCourseReadiness(42, s.attempt, () => false);
    s.frame();
    s.controller.abort();
    await assert.rejects(pending, /synthetic cancellation/);
    assert.equal(s.tracked.size, 0);
    assert.equal(s.frames.size, 0);
    s.animation.dispatchEvent(new Event('finish'));
    s.mutate();
    s.controller.abort();
    assert.equal(s.frames.size, 0);
    assert.equal(s.disconnects, 1);
});
