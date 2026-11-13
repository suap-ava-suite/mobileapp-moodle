const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function setup(tab = null, success = true, currentSite = 'academic-site') {
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
        '@services/sites': { CoreSites: { getCurrentSiteId: () => currentSite } },
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
    assert.equal(s.fetched.length, 0);
    assert.equal(s.navigation.length, 1);
    assert.equal(s.navigation[0][0], '/main/home/course/4022');
    assert.equal(s.navigation[0][1].reset, true);
    assert.equal(s.navigation[0][1].params, undefined);
    assert.equal(s.helper.length, 0);
});
test('confirmed enrolment passes a primitive guest flag without a consumable course object', async () => {
    const s = setup();
    const enrolledCourse = { id: 4022, fullname: 'Synthetic enrolled course', format: 'topics' };
    await s.open(4022, 'academic-site', enrolledCourse);
    assert.equal(s.fetched.length, 0);
    assert.equal(s.navigation[0][1].params.isGuest, false);
    assert.equal('course' in s.navigation[0][1].params, false);
});
test('does not reuse an enrolled course object for a different course id', async () => {
    const s = setup();
    await s.open(4022, 'academic-site', { id: 2836, fullname: 'Different synthetic course' });
    assert.equal(s.fetched.length, 0);
    assert.equal(s.navigation[0][1].params, undefined);
});
test('opening another course from an existing native tab replaces the old course stack', async () => {
    const s = setup('home', true, 'presencial-site');
    await s.open(2836, 'presencial-site');
    assert.equal(s.fetched.length, 0);
    assert.equal(s.navigation[0][0], '/main/home/course/2836');
    assert.equal(s.navigation[0][1].reset, true);
    assert.equal(s.navigation[0][1].params, undefined);
    assert.equal(s.helper.length, 0);
});
test('rejected native route is reported instead of being treated as an opened course', async () => {
    const s = setup(null, false);
    await assert.rejects(() => s.open(4022, 'academic-site'), /Não foi possível navegar/);
});

test('a changed Moodle environment cannot navigate using a stale site id', async () => {
    const s = setup(null, true, 'another-site');
    await assert.rejects(() => s.open(4022, 'academic-site'), /ambiente Moodle mudou/);
    assert.equal(s.navigation.length, 0);
});

test('invalid course ids are rejected before native navigation', async () => {
    const s = setup();
    for (const id of [0, -1, NaN, Infinity, 1.5]) {
        await assert.rejects(() => s.open(id, 'academic-site'), /Identificador de curso Moodle inválido/);
    }
    assert.equal(s.navigation.length, 0);
});
