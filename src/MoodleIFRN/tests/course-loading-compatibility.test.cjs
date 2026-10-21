const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { loadingWithoutViewAnimations } = require('../moodle-course/patch-loading-animation.cjs');
test('loading compatibility patch preserves placeholders and content while omitting destroyed-view animation hooks', () => {
    const template = fs.readFileSync('src/core/components/loading/core-loading.html', 'utf8');
    const unpatched = template.replace('role="status"',
        'role="status" animate.enter="show-animation" animate.leave="hide-animation"');
    const result = loadingWithoutViewAnimations(unpatched);
    assert.doesNotMatch(result, /animate\.(enter|leave)=/);
    assert.match(result, /<ng-content/);
    assert.match(result, /ion-spinner/);
    assert.match(result, /ion-skeleton-text/);
    assert.equal(loadingWithoutViewAnimations(result), result);
});
