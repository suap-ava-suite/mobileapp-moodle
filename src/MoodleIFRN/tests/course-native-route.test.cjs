const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
function setup(success = true, { sameRoute = false, fullscreen = false } = {}) {
    const navigation = [];
    let fullscreenExits = 0;
    const mocks = {
        '@features/mainmenu/constants': { MAIN_MENU_HOME_PAGE_NAME: 'home' },
        '@services/navigator': { CoreNavigator: { isCurrent: () => sameRoute } },
        '@singletons': { NavController: {
            navigateRoot: async (...args) => { navigation.push(args); return success; },
        } },
    };
    const context = {
        exports: {},
        require: id => mocks[id],
        document: {
            fullscreenElement: fullscreen ? {} : null,
            exitFullscreen() {
                fullscreenExits++;
                return new Promise(() => {});
            },
        },
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/navigation/open-native-course.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context, { filename: 'src/MoodleIFRN/navigation/open-native-course.ts' });
    return { open: context.exports.openNativeCourse, navigation, get fullscreenExits() { return fullscreenExits; } };
}
test('opens the native course using its stable route ID without transient object parameters', async () => {
    const s = setup();

    await s.open(4022);

    assert.equal(s.navigation.length, 1);
    assert.equal(s.navigation[0][0][0], '/main/home/course/4022');
    assert.equal(s.navigation[0][1].animated, false);
    assert.equal(s.navigation[0][1].queryParams, undefined);
});
test('opening another course from an existing native tab replaces the old course stack', async () => {
    const s = setup();

    await s.open(2836);

    assert.equal(s.navigation.length, 1);
    assert.equal(s.navigation[0][0][0], '/main/home/course/2836');
    assert.equal(s.navigation[0][1].animated, false);
    assert.equal(s.navigation[0][1].queryParams, undefined);
});

test('the route can complete while WebView fullscreen cleanup is still pending', async () => {
    const s = setup(true, { fullscreen: true });
    await s.open(4022);
    assert.equal(s.fullscreenExits, 1);
});

test('Ionic skipping the already current course route remains a successful navigation', async () => {
    const s = setup(false, { sameRoute: true });
    await s.open(4022);
    assert.equal(s.navigation.length, 1);
});
test('rejected native route is reported instead of being treated as an opened course', async () => {
    const s = setup(false);

    await assert.rejects(() => s.open(4022), /Não foi possível navegar/);
});
