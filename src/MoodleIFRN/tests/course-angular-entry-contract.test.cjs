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
        const member = owner.members.find(node => (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))
            && node.name.getText(source) === name);
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

function navigatorFixture(mobile = true) {
    class ActivatedRouteSnapshot {}
    const source = ts.createSourceFile('navigator.ts', fs.readFileSync('src/core/services/navigator.ts', 'utf8'),
        ts.ScriptTarget.Latest, true);
    const owner = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'CoreNavigatorService');
    const fields = owner.members.filter(node => ts.isPropertyDeclaration(node)
        && ['storedParams', 'lastParamId', 'STORED_PARAM_PREFIX', 'resolvedRouteParams'].includes(node.name.getText(source)))
        .map(node => node.getText(source)).join('\n');
    const browserStorage = new Map();
    const body = methods('src/core/services/navigator.ts', 'CoreNavigatorService', [
        'replaceObjectParams', 'getNewParamId', 'getRouteProperty', 'getStoredParam', 'getRouteQueryParams',
        'getRouteSnapshotParam', 'getRouteParam', 'getRouteNumberParam', 'getRouteBooleanParam',
        'getRequiredRouteNumberParam', 'getRequiredRouteParam',
    ]);
    const { CoreNavigatorService } = evaluate(`export class CoreNavigatorService {
        ${fields}
        getCurrentRoute() { return this.route; }
        ${body}
    }`, {
        ActivatedRouteSnapshot, BehaviorSubject, CorePlatform: { isMobile: () => mobile }, CoreError: Error,
        localStorage: { getItem: key => browserStorage.get(key) ?? null, setItem: (key, value) => browserStorage.set(key, value) },
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

test('the same route object remains available to every Angular reader after its first resolution', () => {
    const navigator = navigatorFixture();
    const course = { id: 42 };
    navigator.installRoute(course.id, { course });
    assert.equal(navigator.getRouteQueryParams(navigator.route).course, course);
    assert.equal(navigator.getRouteParam('course'), course);
    assert.equal(navigator.getRouteQueryParams(navigator.route.snapshot).course, course);
    assert.equal(navigator.getRouteQueryParams(navigator.route).course, course);
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

test('the native contents tab receives a course object after another Angular reader inspected its query params', async () => {
    const { page, navigator } = await nativePageForEntry();
    const course = { ...page.contentsTab.pageParams.course, courseformatoptions: [] };
    navigator.installRoute(course.id, { course, isGuest: false });
    navigator.getRouteQueryParams(navigator.route);
    const body = methods('src/core/features/course/pages/contents/contents.ts', 'CoreCourseContentsPage', [
        'ngOnInit', 'loadCourseFormatOptions',
    ]);
    const { NativeContents } = evaluate(`export class NativeContents { ${body} }`, {
        CoreNavigator: navigator,
        CoreUtils: { debounce: callback => callback },
        CoreCourseCompletion: { isCompletionEnabledInCourse: () => true },
        CoreObject: { toKeyValueMap: () => ({}) },
        CoreAlerts: { showError: error => { throw error; } },
    });
    const contents = Object.assign(new NativeContents(), {
        initListeners() {}, loadData: async function () { await this.loadCourseFormatOptions(); },
    });

    await contents.ngOnInit();

    assert.equal(contents.course, course);
    assert.equal(contents.course.id, 42);
    assert.equal(contents.dataLoaded, true);
    assert.doesNotThrow(() => 'courseformatoptions' in contents.course);
});

test('frozen Angular query params and their observable are never mutated to cache resolved objects', () => {
    const navigator = navigatorFixture();
    const course = { id: 42 };
    navigator.installRoute(course.id, { course });
    const snapshot = navigator.route.snapshot;
    const queryParams = Object.freeze(snapshot.queryParams);
    const observable = navigator.route.queryParams;
    const keys = Object.keys(observable);

    assert.equal(navigator.getRouteQueryParams(snapshot).course, course);
    assert.equal(navigator.getRouteParam('course'), course);
    assert.equal(snapshot.queryParams, queryParams);
    assert.match(queryParams.course, /^param-\d+$/);
    assert.deepEqual(Object.keys(observable), keys);
});

test('equal course IDs from different account or environment routes keep their own object', () => {
    const navigator = navigatorFixture();
    const first = { id: 42, account: 'synthetic-a', environment: 'synthetic-one' };
    const second = { id: 42, account: 'synthetic-b', environment: 'synthetic-two' };
    navigator.installRoute(first.id, { course: first });
    const firstRoute = navigator.route;
    assert.equal(navigator.getRouteQueryParams(firstRoute).course, first);
    navigator.installRoute(second.id, { course: second });
    assert.equal(navigator.getRouteParam('course'), second);
    assert.equal(navigator.getRouteParam('course'), second);
    assert.equal(navigator.getRouteQueryParams(firstRoute).course, first);
});

test('an unresolved course reference stops before the native page with a useful Portuguese message', () => {
    const navigator = navigatorFixture();
    navigator.installRoute(42, { course: 'param-4' });
    assert.throws(() => navigator.getRequiredRouteParam('course'), error => {
        assert.equal(error.message, 'Não foi possível recuperar os dados de navegação desta disciplina. '
            + 'Volte ao Painel e abra o curso novamente.');
        assert.doesNotMatch(error.message, /param-4|courseformatoptions/);
        return true;
    });
});

test('reusing an ActivatedRoute with a new snapshot cannot revive a consumed course reference', () => {
    const navigator = navigatorFixture();
    navigator.installRoute(42, { course: { id: 42, account: 'synthetic-a' } });
    const route = navigator.route;
    const reference = route.snapshot.queryParams.course;
    navigator.getRouteQueryParams(route);
    navigator.installRoute(42, { course: reference });
    route.snapshot = navigator.route.snapshot;
    route.queryParams.next(route.snapshot.queryParams);
    navigator.route = route;
    assert.throws(() => navigator.getRequiredRouteParam('course'), /dados de navegação/);
});

test('primitive params and unresolved non-course strings keep the native contract', () => {
    const navigator = navigatorFixture();
    navigator.installRoute(42, { isGuest: false, sectionNumber: 0, selectedTab: 'participants', other: 'param-999' });
    assert.equal(navigator.getRouteBooleanParam('isGuest'), false);
    assert.equal(navigator.getRouteNumberParam('sectionNumber'), 0);
    assert.equal(navigator.getRouteParam('selectedTab'), 'participants');
    assert.equal(navigator.getRouteParam('other'), 'param-999');
});

test('browser storage fallback remains available without changing the route snapshot', () => {
    const navigator = navigatorFixture(false);
    const course = { id: 42 };
    navigator.installRoute(42, { course });
    navigator.storedParams = {};
    Object.freeze(navigator.route.snapshot.queryParams);
    const first = navigator.getRouteQueryParams(navigator.route.snapshot).course;
    assert.equal(first.id, 42);
    assert.equal(navigator.getRouteParam('course'), first);
});
