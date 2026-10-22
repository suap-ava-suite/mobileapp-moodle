const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');

function loadCourseMenu(siteUrl) {
    const source = fs.readFileSync(path.join(root, 'src/MoodleIFRN/moodle-course/course-menu.ts'), 'utf8');
    const mocks = {
        '@angular/core': {
            Component: () => component => component,
            Input: () => () => {},
        },
        '@ionic/core': { createAnimation: () => ({}) },
        '@/core/shared.module': { CoreSharedModule: class {} },
        '@/core/constants': { ContextLevel: {} },
        '@services/sites': {
            CoreSites: {
                getCurrentSite: () => siteUrl ? {
                    getURL: () => siteUrl,
                    isLoggedOut: () => false,
                } : undefined,
            },
        },
        '@services/navigator': { CoreNavigator: {} },
        '@services/overlays/modals': { CoreModals: {} },
        '@services/overlays/alerts': { CoreAlerts: {} },
        '@addons/messages/services/messages': { AddonMessages: {} },
        '@addons/messages/constants': { ADDON_MESSAGES_PAGE_NAME: 'messages', ADDONS_MESSAGES_MENU_FEATURE_NAME: 'messages' },
        '@addons/notifications/constants': {
            ADDONS_NOTIFICATIONS_MAIN_PAGE_NAME: 'notifications',
            ADDONS_NOTIFICATIONS_MENU_FEATURE_NAME: 'notifications',
        },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, URL, window: { matchMedia: () => ({ matches: false }) } };
    const javascript = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
    }).outputText;
    vm.runInNewContext(javascript, context);

    return new context.exports.IfrnCourseMenuComponent({ isEnabled: () => false });
}

test('o tema IFRN é global e os templates nativos incluem o menu customizado', () => {
    const angular = JSON.parse(fs.readFileSync(path.join(root, 'angular.json'), 'utf8'));
    const styles = angular.projects.app.architect.build.options.styles.map(style =>
        typeof style === 'string' ? style : style.input);
    const courseTs = fs.readFileSync(path.join(root, 'src/core/features/course/pages/contents/contents.ts'), 'utf8');
    const courseHtml = fs.readFileSync(path.join(root, 'src/core/features/course/pages/contents/contents.html'), 'utf8');
    const theme = fs.readFileSync(path.join(root, 'src/MoodleIFRN/moodle-course/moodle-course.scss'), 'utf8');

    assert.ok(styles.includes('src/MoodleIFRN/moodle-course/moodle-course.scss'));
    assert.match(courseTs, /IfrnCourseMenuComponent/);
    assert.match(courseHtml, /<ifrn-course-menu/);
    assert.match(theme, /page-core-course-index/);
    assert.match(theme, /page-core-course-contents/);
});

test('o cartão do painel entrega a abertura ao curso nativo Moodle Mobile', () => {
    const views = fs.readFileSync(path.join(root, 'src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts'), 'utf8');
    const opener = fs.readFileSync(path.join(root, 'src/MoodleIFRN/navigation/open-native-course.ts'), 'utf8');

    assert.match(views, /Toque no card → SEMPRE handoff Moodle Mobile nativo/);
    assert.match(views, /App\.openMoodleCourse\(/);
    assert.match(opener, /CoreCourseHelper\.getAndOpenCourse\(courseId, \{\}, siteId\)/);
    assert.match(opener, /`\/main\/\$\{MAIN_MENU_HOME_PAGE_NAME\}\/course\/\$\{courseId\}`/);
});

test('menu IFRN aparece nos hosts oficiais permitidos e permanece oculto em host externo', () => {
    const menuAva = loadCourseMenu('https://academico.ava.ifrn.edu.br');
    const menuAberto = loadCourseMenu('https://aberto.ava.ifrn.edu.br');
    const menuEad = loadCourseMenu('https://moodle.ead.ifrn.edu.br');
    const menuExternal = loadCourseMenu('https://moodle.example.org');

    for (const menu of [menuAva, menuAberto, menuEad, menuExternal]) {
        menu.courseId = 123;
    }

    assert.equal(menuAva.visible, true);
    assert.equal(menuAberto.visible, true);
    assert.equal(menuEad.visible, true);
    assert.equal(menuExternal.visible, false);
});
