const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
test('Android Back returns the IFRN course index to panel while delegating activities and overlays', () => {
    const mocks = {
        '@angular/core': { Injectable: () => c => c, inject: () => ({}) },
        '@static/logger': { CoreLogger: { getInstance: () => ({}) } },
        '@/core/constants': { BackButtonPriority: { CORE_TABS: 40 } },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    const service = new context.exports.MoodleSiteService();
    let atCourseIndex = true;
    let panelReturns = 0;
    let delegated = 0;
    service.returnToPainelOnCourseExit = () => {
        if (!atCourseIndex) return false;
        panelReturns++;
        return true;
    };
    let handler;
    service.onIfrnCourseBackButton({ detail: { register: (priority, callback) => {
        assert.equal(priority, 39);
        handler = callback;
    } } });
    // Registering alone cannot navigate while an overlay of higher priority handles Back.
    assert.equal(panelReturns, 0);
    handler(() => delegated++);
    assert.equal(panelReturns, 1);
    assert.equal(delegated, 0);
    atCourseIndex = false;
    handler(() => delegated++);
    assert.equal(panelReturns, 1);
    assert.equal(delegated, 1);
});
