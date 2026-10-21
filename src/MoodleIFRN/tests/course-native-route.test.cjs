const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function setup(tab = null, success = true) {
    const navigation = [];
    const fetched = [];
    const helper = [];
    const course = { id: 4022, format: 'topics' };
    const mocks = {
        '@features/course/services/course-helper': { CoreCourseHelper: {
            getCourse: async (...args) => { fetched.push(args); return { course }; },
            getAndOpenCourse: async (...args) => { helper.push(args); },
        } },
        '@features/mainmenu/constants': { MAIN_MENU_HOME_PAGE_NAME: 'home' },
        '@services/navigator': { CoreNavigator: {
            getCurrentMainMenuTab: () => tab,
            navigate: async (...args) => { navigation.push(args); return success; },
        } },
    };
    const context = { exports: {}, require: id => mocks[id] };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/navigation/open-native-course.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    return { open: context.exports.openNativeCourse, navigation, fetched, helper, course };
}
test('from the IFRN panel or OAuth bridge, enters the course without opening the standalone main landing', async () => {
    const s = setup();
    await s.open(4022, 'academic-site');
    assert.deepEqual(s.fetched[0], [4022, 'academic-site']);
    assert.equal(s.navigation.length, 1);
    assert.equal(s.navigation[0][0], '/main/home/course/4022');
    assert.equal(s.navigation[0][1].reset, true);
    assert.equal(s.navigation[0][1].params.course, s.course);
    assert.equal(s.helper.length, 0);
});
test('existing native tab retains the standard course handler', async () => {
    const s = setup('home');
    await s.open(2836, 'presencial-site');
    assert.equal(s.helper[0][0], 2836);
    assert.equal(s.helper[0][2], 'presencial-site');
    assert.equal(s.navigation.length, 0);
});
test('rejected native route is reported instead of being treated as an opened course', async () => {
    const s = setup(null, false);
    await assert.rejects(() => s.open(4022, 'academic-site'), /Não foi possível navegar/);
});
