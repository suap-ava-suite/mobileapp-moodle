const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const styles = fs.readFileSync('src/MoodleIFRN/moodle-course/moodle-course.scss', 'utf8');

test('course details modal uses IFRN tokens and keeps the styles scoped to its overlay', () => {
    const start = styles.indexOf('/* Modal lateral de detalhes do curso');
    const end = styles.indexOf('/* =================================================', start);
    const modalStyles = styles.slice(start, end);

    assert.match(modalStyles, /ion-modal\.core-modal-lateral:has\(page-core-course-summary\)/);
    assert.match(modalStyles, /page-core-course-summary \{[\s\S]*?--ion-color-primary: var\(--ifrn-primary\)/);
    assert.match(modalStyles, /page-core-course-summary core-course-image\.page-top[\s\S]*?linear-gradient\(135deg, var\(--ifrn-primary\), var\(--ifrn-active\)\)/);
    assert.match(modalStyles, /core-course-image\.page-top::after[\s\S]*?rgba\(var\(--ifrn-primary-rgb\), 0\.56\)/);
    assert.match(modalStyles, /page-core-course-summary \.core-course-progress core-progress-bar[\s\S]*?--progressbar-color: var\(--ifrn-primary\)/);
    assert.match(modalStyles, /page-core-course-summary \.core-course-dates[\s\S]*?background: var\(--ifrn-ava-soft\)/);
    assert.doesNotMatch(modalStyles, /!important/);
});
