const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const { BehaviorSubject } = require('rxjs');

function methods(file, className, names) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const owner = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
    assert.ok(owner, className);
    return names.map(name => {
        const member = owner.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
        assert.ok(member, `${className}.${name}`);
        return member.getText(source);
    }).join('\n');
}

function evaluate(source, globals) {
    const context = { exports: {}, ...globals };
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    return context.exports;
}

function navigatorFixture() {
    class ActivatedRouteSnapshot {}
    const body = methods('src/core/services/navigator.ts', 'CoreNavigatorService', [
        'replaceObjectParams', 'getNewParamId', 'getRouteProperty', 'getStoredParam', 'getRouteQueryParams',
        'getRouteSnapshotParam', 'getRouteParam', 'getRouteNumberParam', 'getRouteBooleanParam',
        'getRequiredRouteNumberParam',
    ]);
    const { CoreNavigatorService } = evaluate(`export class CoreNavigatorService {
        static STORED_PARAM_PREFIX = 'param-'; storedParams = {}; lastParamId = 0;
        getCurrentRoute() { return this.route; }
        ${body}
    }`, {
        ActivatedRouteSnapshot, BehaviorSubject, CorePlatform: { isMobile: () => true }, CoreError: Error,
        CoreText: { parseJSON: JSON.parse },
        CoreUtils: {
            isTrueOrOne: value => [true, 1, 'true', '1'].includes(value),
            isFalseOrZero: value => [false, 0, 'false', '0'].includes(value),
        },
    });
    const navigator = new CoreNavigatorService();
    navigator.installRoute = (courseId, params) => {
        const queryParams = { ...params };
        navigator.replaceObjectParams(queryParams);
        const snapshot = Object.assign(new ActivatedRouteSnapshot(), {
            queryParams, params: { courseId: String(courseId) },
        });
        navigator.route = { snapshot, queryParams: new BehaviorSubject(queryParams), parent: null };
    };
    return navigator;
}

async function nativePageForEntry(confirmed = true) {
    const navigator = navigatorFixture();
    const course = { id: 42, fullname: 'Synthetic course', format: 'topics' };
    const lookups = { course: 0, guest: 0 };
    const helper = {
        getCourse: async id => { lookups.course++; assert.equal(id, course.id); return { enrolled: true, course }; },
        courseUsesGuestAccessInfo: async () => { lookups.guest++; return { guestAccess: false }; },
    };
    navigator.navigate = async (path, options) => {
        assert.equal(path, '/main/home/course/42');
        navigator.installRoute(course.id, options.params || {});
        return true;
    };
    navigator.getRouteFullPath = () => '/main/home/course/42';
    navigator.increaseRouteDepth = () => undefined;
    const mocks = {
        '@features/course/services/course-helper': { CoreCourseHelper: helper },
        '@features/mainmenu/constants': { MAIN_MENU_HOME_PAGE_NAME: 'home' },
        '@services/navigator': { CoreNavigator: navigator },
        '@services/sites': { CoreSites: { getCurrentSiteId: () => 'synthetic-site' } },
    };
    const adapter = evaluate(fs.readFileSync('src/MoodleIFRN/navigation/open-native-course.ts', 'utf8'), {
        require: name => mocks[name] || {},
    });
    await adapter.openNativeCourse(course.id, 'synthetic-site', confirmed ? course : undefined);

    // An earlier Angular consumer reads the ActivatedRoute before the native page initializes.
    navigator.getRouteQueryParams(navigator.route);
    const pageBody = methods('src/core/features/course/pages/index/index.ts', 'CoreCourseIndexPage', ['ngOnInit']);
    const { NativeCoursePage } = evaluate(`export class NativeCoursePage { ${pageBody} }`, {
        CoreNavigator: navigator, CoreCourseHelper: helper, CorePlatform: { isMobile: () => true },
        CoreAlerts: { showError: error => { throw error; } },
        CorePath: { concatenatePaths: (left, right) => `${left}/${right}` },
    });
    const page = Object.assign(new NativeCoursePage(), {
        route: navigator.route, contentsTab: { page: 'contents', pageParams: {} }, tabs: [],
        loadCourseHandlers: async () => undefined, loadBasinInfo: async () => undefined,
    });
    await page.ngOnInit();
    return { page, lookups, navigator };
}

test('characterizes the actual navigator consuming an object without updating the ActivatedRoute snapshot', () => {
    const navigator = navigatorFixture();
    const course = { id: 42 };
    navigator.installRoute(course.id, { course });
    assert.equal(navigator.getRouteQueryParams(navigator.route).course, course);
    assert.match(navigator.getRouteParam('course'), /^param-\d+$/);
});

test('native Angular course initialization receives an object after an earlier read of IFRN entry parameters', async () => {
    const { page, lookups } = await nativePageForEntry();
    const course = page.contentsTab.pageParams.course;
    assert.equal(typeof course, 'object', 'a consumed param reference must not reach the course component');
    assert.equal(course.id, 42);
    assert.doesNotThrow(() => 'courseformatoptions' in course);
    assert.equal(page.loaded, true);
    assert.equal(lookups.guest, 0, 'an already confirmed enrolment does not require another guest lookup');
});

test('entry without a confirmed enrolment retains native guest-access resolution', async () => {
    const { page, lookups } = await nativePageForEntry(false);
    assert.equal(page.contentsTab.pageParams.course.id, 42);
    assert.equal(lookups.guest, 1);
});
