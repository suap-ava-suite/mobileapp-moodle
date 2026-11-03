'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('standalone Painel bundle does not include Angular or Angular-linked app services', () => {
    const router = fs.readFileSync('src/MoodleIFRN/mobilemoodle/core_mobile/app-router.ts', 'utf8');
    const timing = fs.readFileSync('src/MoodleIFRN/mobilemoodle/core_mobile/suap-timing.ts', 'utf8');
    const bundle = fs.readFileSync('src/MoodleIFRN/mobilemoodle/mobilemoodle.js', 'utf8');

    assert.match(router, /from '\.\/suap-timing'/);
    assert.doesNotMatch(router, /services_mobile\/suap-login-telemetry/);
    assert.doesNotMatch(timing, /@angular|@services|@static|@core/);
    assert.doesNotMatch(bundle, /node_modules\/@angular\/(?:common|core|router)\/fesm2022/);
    assert.doesNotMatch(bundle, /ɵɵngDeclare(?:Injectable|Component|NgModule)/);
});
