const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('the mobile accessibility menus do not expose the desktop mouse cursor option', () => {
    const root = path.join(__dirname, '..');
    const paths = [
        'mobilemoodle/index.html',
        'mobilemoodle/core_mobile/app-accessibility.ts',
        'mobilemoodle/core_mobile/global.d.ts',
        'mobilemoodle/static/theme/ifrn/scss/_accessibility.scss',
        'mobilemoodle/static/theme/ifrn/scss/painel.scss',
        'painel/painel-native.ts',
        'moodle-course/course-menu.ts',
        'moodle-course/moodle-course.scss',
    ];
    for (const relative of paths) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, relative), 'utf8'), /big_cursor|Cursor do mouse grande/iu, relative);
    }
});
