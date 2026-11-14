const assert = require('node:assert/strict');
const test = require('node:test');
const { safeNativeTimingEvent } = require('../scripts/course-shell-profile.cjs');

test('profiling drops credentials, URLs and arbitrary properties from runtime events', () => {
    const value = safeNativeTimingEvent({ stage: 'component-init-start', at: 125, inAngularZone: false,
        token: 'SYNTHETIC_SECRET', username: 'SYNTHETIC_A', url: 'https://invalid.example/oauth?code=SYNTHETIC',
        reason: 'https://invalid.example/private' }, 'course-open-test-1');
    assert.deepEqual(value, { operationId: 'course-open-test-1', stage: 'component-init-start', at: 125, inAngularZone: false });
    for (const bad of [null, {}, { stage: 'profile/SYNTHETIC_A', at: 1 }, { stage: 'sections-start', at: Infinity }]) {
        assert.equal(safeNativeTimingEvent(bad, 'course-open-test-1'), null);
    }
});
