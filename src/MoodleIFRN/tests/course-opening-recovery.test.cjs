const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const courseId = 4022;
const otherCourseId = 2836;
const siteUrl = 'https://academico.ava.ifrn.edu.br';
const painel = '/login/painel';
const bridge = '/login/moodle-open-course';
const epochKey = 'ifrn_moodle_session_epoch';

function compile(file) {
    return ts.transpileModule(fs.readFileSync(`src/MoodleIFRN/${file}.ts`, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
}

const scripts = Object.fromEntries([
    'navigation/course-opening-attempt',
    'navigation/native-course-login-queue',
    'navigation/open-native-course',
    'services_mobile/moodle-site.service',
    'moodle-open-course/moodle-open-course',
    'mobilemoodle/core_mobile/course-target',
    'painel/painel',
].map(file => [file, compile(file)]));

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });

    return { promise, resolve, reject };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

/** Track a pending result without hanging the test when a regression leaves it unresolved. */
function observe(promise) {
    const result = {};
    void promise.then(value => { result.value = value; }, error => { result.error = error; });

    return result;
}

function setup({ saved = true, navigationShell = false } = {}) {
    const values = new Map([['ifrn_painel_owner', 'student-a'], ['ifrn_username', 'student-a'], [epochKey, '1']]);
    const timers = new Map();
    const routeListeners = new Set();
    const routes = [];
    const loads = [];
    const overlay = { visible: false, messages: [] };
    const classes = new Set();
    let now = 0;
    let nextNavigationId = 0;
    let courseNavigation;
    let path = painel;
    let epoch = 1;

    const setTimeout = (fn, delay) => {
        const id = Symbol('timer');
        timers.set(id, { fn, time: now + delay });

        return id;
    };
    const clearTimeout = id => timers.delete(id);
    class RouterEvent {
        constructor(id, url) { this.id = id; this.url = url; }
    }
    class NavigationStart extends RouterEvent {}
    class NavigationEnd extends RouterEvent {
        constructor(id, url) { super(id, url); this.urlAfterRedirects = url; }
    }
    class NavigationError extends RouterEvent {
        constructor(id, url, error) { super(id, url); this.error = error; }
    }
    class NavigationCancel extends RouterEvent {}
    class NavigationSkipped extends RouterEvent {}

    const emit = event => [...routeListeners].forEach(listener => listener(event));
    const router = {
        events: {
            subscribe(callback) {
                routeListeners.add(callback);
                return { unsubscribe: () => routeListeners.delete(callback) };
            },
        },
        currentNavigation: () => courseNavigation ?? null,
        navigate: ([url]) => navigator.navigate(url),
    };
    const beginRoute = (url, extras, gate) => {
        const navigation = {
            id: ++nextNavigationId,
            extras,
            abort() {
                if (courseNavigation === navigation) {
                    emit(new NavigationCancel(navigation.id, url));
                    courseNavigation = undefined;
                    gate.resolve(false);
                }
            },
            redirect(target) {
                assert.equal(courseNavigation, navigation);
                emit(new NavigationCancel(navigation.id, url));
                // Angular carries its original promise and extras.info over to a redirect.
                return beginRoute(target, extras, gate);
            },
            finish(error, skipped = false) {
                if (courseNavigation !== navigation) {
                    return;
                }
                if (error) {
                    emit(new NavigationError(navigation.id, url, error));
                    gate.reject(error);
                } else if (skipped) {
                    emit(new NavigationSkipped(navigation.id, url));
                    gate.resolve(false);
                } else {
                    path = url;
                    emit(new NavigationEnd(navigation.id, url));
                    gate.resolve(true);
                }
                if (courseNavigation === navigation) {
                    courseNavigation = undefined;
                }
            },
        };
        routes.push(navigation);
        courseNavigation = navigation;
        emit(new NavigationStart(navigation.id, url));

        return navigation;
    };
    const startCourseRoute = (url, extras = {}) => {
        const gate = deferred();
        beginRoute(url, extras, gate);

        return gate.promise;
    };
    const navigator = {
        getCurrentPath: () => path,
        isCurrent: url => path === url,
        async navigate(url) {
            if (/^\/main\/.+\/course\//.test(url)) {
                return startCourseRoute(url);
            }
            courseNavigation?.abort();
            path = url;
            emit(new NavigationEnd(++nextNavigationId, url));
            return true;
        },
    };
    const siteFor = username => ({
        getId: () => username,
        getInfo: () => ({ username }),
        getURL: () => siteUrl,
        isLoggedOut: () => false,
        token: 'synthetic-only',
    });
    const stored = new Map(['student-a', 'student-b'].map(username => [username, siteFor(username)]));
    let current = saved ? stored.get('student-a') : undefined;
    const sites = {
        getCurrentSite: () => current,
        getCurrentSiteId: () => current?.getId(),
        isLoggedIn: () => !!current,
        getSites: async () => [...stored.keys()].map(id => ({ id, siteUrl })),
        createSiteID: (_url, username) => username,
        getSite: async id => stored.get(id),
        async loadSite(id) { loads.push(id); current = stored.get(id); return !!current; },
    };
    const courses = { getUserCourses: async () => [{ id: courseId }, { id: otherCourseId }] };
    const sandbox = {
        URL, Error, AbortController, setTimeout, clearTimeout,
        performance: { now: () => now },
        console: { log() {}, info() {}, warn() {}, error() {} },
        window: { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} },
        document: {
            addEventListener() {},
            removeEventListener() {},
            documentElement: {
                classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
            },
            querySelectorAll: () => [],
        },
        sessionStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key),
        },
    };
    function load(file, mocks = {}) {
        const exports = {};
        vm.runInNewContext(scripts[file], { ...sandbox, exports, require: id => mocks[id] || {} });

        return exports;
    }
    const nativeRoute = load('navigation/open-native-course', {
        '@features/mainmenu/constants': { MAIN_MENU_HOME_PAGE_NAME: 'home' },
        '@services/navigator': { CoreNavigator: navigator },
        '@singletons': { NavController: { navigateRoot: ([url], extras) => startCourseRoute(url, extras) } },
    });
    const module = load('services_mobile/moodle-site.service', {
        '@angular/core': { Injectable: () => type => type },
        '@angular/router': { NavigationStart, NavigationEnd, NavigationError, NavigationCancel, NavigationSkipped },
        '@static/url': { CoreUrl: { sameDomainAndPath: (a, b) => a === b } },
        '@services/sites': { CoreSites: sites },
        '@services/navigator': { CoreNavigator: navigator },
        '@services/config': { CoreConfig: { delete: async () => {} } },
        '@features/courses/services/courses': { CoreCourses: courses },
        '../mobilemoodle/core_mobile/course-session-flags': { COURSE_SESSION_EPOCH_KEY: epochKey },
        '../navigation/course-opening-attempt': load('navigation/course-opening-attempt'),
        '../navigation/native-course-login-queue': load('navigation/native-course-login-queue'),
        '../navigation/open-native-course': nativeRoute,
        '@/MoodleIFRN/navigation/navigation-policy': { isNativeMoodleLanding: () => false },
        './ifrn-language': { useIfrnBrazilianPortuguese: async () => {} },
        '@/MoodleIFRN/navigation/handoff-loading': {
            showHandoffLoading(_ref, _injector, { message }) {
                overlay.visible = true;
                overlay.messages.push(message);
            },
            hideHandoffLoading() { overlay.visible = false; },
            shouldShowCourseHandoffOnBoot: () => false,
        },
    });
    const service = Object.assign(Object.create(module.MoodleSiteService.prototype), {
        nativeCourseLoginQueue: new (load('navigation/native-course-login-queue').NativeCourseLoginQueue)(),
        courseOAuthBrowserSubscriptions: [],
        router,
        getExpectedIdentityCandidates: () => [{ key: 'perfil.matricula', value: values.get('ifrn_painel_owner') }],
        ensureLoginObserver() {},
        markCourseOriginFromPainel() {},
        startNativeCourseProgression() {},
        stopNativeCourseProgression() {},
        waitForNativeCourseShell: async () => {},
        waitForNativeCourseContent: async () => {},
        ensurePainelRouteRegistered() {},
        suapEntry: { cancel() {} },
        authService: { logout: () => values.delete('ifrn_username') },
        painelAva: { clearSession: () => values.delete('ifrn_painel_owner') },
    });
    const { MoodleOpenCoursePage } = load('moodle-open-course/moodle-open-course', {
        '@angular/core': { Component: () => type => type, inject: () => service },
        '@/MoodleIFRN/services_mobile/moodle-site.service': module,
        '@services/navigator': { CoreNavigator: navigator },
    });
    const page = new MoodleOpenCoursePage();
    Object.assign(page, { courseId, moodleSiteUrl: siteUrl });
    const routerToken = Symbol();
    const { PainelPage } = load('painel/painel', {
        '@angular/core': {
            Component: () => type => type,
            ViewChild: () => () => {},
            inject: type => type === module.MoodleSiteService
                ? service
                : (type === routerToken ? router : { stopProfileRefresh() {}, close() {} }),
        },
        '@angular/router': { Router: routerToken },
        '@/MoodleIFRN/services_mobile/moodle-site.service': module,
        '@services/navigator': { CoreNavigator: navigator },
        '../mobilemoodle/core_mobile/course-target': load('mobilemoodle/core_mobile/course-target'),
    });
    const panel = new PainelPage();
    if (navigationShell) {
        delete service.markCourseOriginFromPainel;
        service.initializeIfrnNavigationShell();
    }

    return {
        service, page, panel, sites, courses, values, routes, loads, overlay, classes, routeListeners, timers, navigator,
        open: (id = courseId, environment = siteUrl) => service.ensureSessionAndOpenCourse(id, environment),
        async advance(ms) {
            now += ms;
            for (const [id, timer] of timers) {
                if (timer.time <= now) {
                    timers.delete(id);
                    timer.fn();
                }
            }
            await tick();
        },
        changeAccount(username) {
            values.set('ifrn_painel_owner', username);
            values.set('ifrn_username', username);
            values.set(epochKey, String(++epoch));
        },
    };
}

test('a timed-out session read releases the same course immediately for retry; late reads leave the new attempt intact', async () => {
    const s = setup({ saved: false });
    const stale = deferred();
    const getSites = s.sites.getSites;
    s.sites.getSites = () => stale.promise;
    const first = observe(s.open());
    await tick();
    assert.equal(s.overlay.visible, true);

    await s.advance(45000);
    assert.match(first.error?.message || '', /sessão Moodle.*demorou/i);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.classes.has('ifrn-course-opening'), false);

    s.sites.getSites = getSites;
    const second = observe(s.open());
    await tick();
    assert.equal(s.routes.length, 1);
    stale.resolve([{ id: 'student-a', siteUrl }]);
    await tick();
    assert.equal(s.overlay.visible, true);
    assert.deepEqual(s.loads, ['student-a']);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');
    assert.equal(s.overlay.visible, false);
    assert.equal(s.timers.size, 0);
});

test('hardware back releases a stalled lookup and another discipline can open on return to Painel', async () => {
    const s = setup({ saved: false });
    const stale = deferred();
    const getSites = s.sites.getSites;
    s.sites.getSites = () => stale.promise;
    const first = observe(s.open());
    await tick();

    assert.equal(s.service.cancelCourseOpeningForPanelExit(), true);
    s.sites.getSites = getSites;
    const second = observe(s.open(otherCourseId));
    await tick();
    assert.equal(first.value, 'cancelled');
    assert.equal(s.navigator.getCurrentPath(), painel);
    assert.equal(s.routes.length, 1);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');
    stale.reject(new Error('synthetic stale read error'));
    await tick();
    assert.equal(s.navigator.getCurrentPath(), `/main/home/course/${otherCourseId}`);
    assert.equal(s.routeListeners.size, 0);
});

test('a duplicate for an equivalent site joins, while a different course cannot interrupt an active opening', async () => {
    const s = setup();
    const first = s.open();
    const result = observe(first);
    const duplicate = s.open(courseId, `${siteUrl}/`);
    if (duplicate !== first) observe(duplicate);
    assert.equal(duplicate === first, true);
    await assert.rejects(s.open(otherCourseId), /já está em andamento/);
    await tick();
    assert.equal(s.routes.length, 1);
    s.routes[0].finish();
    await tick();
    assert.equal(result.value, 'opened');
});

test('a navigation that never reaches activation times out and Retry reopens the same course', async () => {
    const s = setup();
    await s.navigator.navigate(bridge);
    const first = observe(s.page.tryOpenOrPromptConnect(false));
    await tick();
    assert.equal(s.routes.length, 1);
    await s.advance(45000);
    assert.ok('value' in first, 'route timeout releases the caller');
    assert.match(s.page.formError, /não confirmou a rota nativa/);
    assert.equal(s.page.loading, false);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.routeListeners.size, 0);

    const retry = observe(s.page.retryConnect());
    await tick();
    assert.equal(s.routes.length, 2);
    s.routes[0].finish();
    assert.equal(s.navigator.getCurrentPath(), bridge);
    s.routes[1].finish();
    await tick();
    assert.ok('value' in retry);
    assert.equal(s.page.formError, '');
    assert.equal(s.navigator.getCurrentPath(), `/main/home/course/${courseId}`);
    assert.equal(s.overlay.visible, false);
});

test('a route rejection shows an inline error and Retry starts a new opening immediately', async () => {
    const s = setup();
    await s.navigator.navigate(bridge);
    const rejected = s.page.tryOpenOrPromptConnect(false);
    await tick();
    s.routes[0].finish(new Error('synthetic route rejected'));
    await rejected;
    assert.equal(s.page.formError, 'synthetic route rejected');

    const retry = s.page.retryConnect();
    await tick();
    assert.equal(s.routes.length, 2);
    s.routes[1].finish();
    await retry;
    assert.equal(s.page.formError, '');
    assert.equal(s.overlay.visible, false);
});

test('Back aborts only the requested course route and Retry opens the right course', async () => {
    const s = setup();
    const first = observe(s.open());
    await tick();
    assert.equal(s.routes.length, 1);

    assert.equal(s.service.cancelCourseOpeningForPanelExit(), true);
    const next = observe(s.open(otherCourseId));
    await tick();
    assert.equal(first.value, 'cancelled');
    assert.equal(s.routes.length, 2);
    s.routes[0].finish();
    assert.equal(s.navigator.getCurrentPath(), painel);

    s.routes[1].finish();
    await tick();
    assert.equal(next.value, 'opened');
    assert.equal(s.navigator.getCurrentPath(), `/main/home/course/${otherCourseId}`);
    assert.equal(s.routeListeners.size, 0);
});

test('a first course with no saved Moodle session offers connection and releases the opening', async () => {
    const s = setup({ saved: false });
    s.sites.getSites = async () => [];

    assert.equal(await s.open(), 'need-connect');
    assert.equal(s.overlay.visible, false);
    assert.equal(s.routes.length, 0);
    assert.equal(await s.open(otherCourseId), 'need-connect');
    assert.equal(s.service.getPendingOpenCourse().courseId, otherCourseId);
});

test('the cover stays through slow content and Back stops it; the previous content cannot finish Retry', async () => {
    const s = setup();
    const stale = deferred();
    s.service.waitForNativeCourseContent = () => stale.promise;
    const first = observe(s.open());
    await tick();
    s.routes[0].finish();
    await tick();
    assert.equal(s.overlay.visible, true);
    assert.equal(s.overlay.messages.at(-1), 'Carregando conteúdo…');
    await assert.rejects(s.open(otherCourseId), /já está em andamento/);

    assert.equal(s.service.cancelCourseOpeningForPanelExit(), true);
    s.service.waitForNativeCourseContent = async () => {};
    const retry = observe(s.open());
    await tick();
    assert.equal(first.value, 'cancelled');
    assert.equal(s.routes.length, 2);
    stale.resolve();
    await tick();
    assert.equal(s.overlay.visible, true);
    assert.equal(s.service.getPendingOpenCourse().courseId, courseId);

    s.routes[1].finish();
    await tick();
    assert.equal(retry.value, 'opened');
    assert.equal(s.overlay.visible, false);
    assert.equal(s.timers.size, 0);
});

test('an already dispatched native session activation is serialized across SUAP reauthentication and B → A', async () => {
    const s = setup({ saved: false });
    const nativeActivation = deferred();
    const loadSite = s.sites.loadSite;
    s.sites.loadSite = async id => {
        await nativeActivation.promise;
        return loadSite(id);
    };
    const first = observe(s.open());
    await tick();
    assert.equal(s.service.isNativeCourseHandoffActive(), true);
    await s.service.returnToIfrnLogin();
    s.changeAccount('student-b');
    const second = observe(s.open());
    await tick();
    assert.equal(first.value, 'cancelled');
    assert.equal(s.routes.length, 0, 'B must await the native work that already started for A');
    assert.equal(s.sites.getCurrentSite(), undefined);

    nativeActivation.resolve();
    await tick();
    assert.deepEqual(s.loads, ['student-a', 'student-b']);
    assert.equal(s.sites.getCurrentSiteId(), 'student-b');
    assert.equal(s.routes.length, 1);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');

    await s.service.switchSuapAccount();
    s.changeAccount('student-a');
    const third = observe(s.open(otherCourseId));
    await tick();
    assert.equal(s.sites.getCurrentSiteId(), 'student-a');
    assert.equal(s.routes.length, 2);
    s.routes[1].finish();
    await tick();
    assert.equal(third.value, 'opened');
    assert.deepEqual(s.loads, ['student-a', 'student-b', 'student-a']);
    assert.equal(s.navigator.getCurrentPath(), `/main/home/course/${otherCourseId}`);
});

test('an account change invalidates a pending read even if both accounts select the same course', async () => {
    const s = setup({ saved: false });
    const stale = deferred();
    const getSites = s.sites.getSites;
    s.sites.getSites = () => stale.promise;
    const first = observe(s.open());
    await tick();

    s.sites.getSites = getSites;
    s.changeAccount('student-b');
    const second = observe(s.open());
    await tick();
    assert.equal(first.value, 'cancelled');
    assert.equal(s.routes.length, 1);
    stale.resolve([{ id: 'student-a', siteUrl }]);
    await tick();
    assert.equal(s.overlay.visible, true);
    assert.deepEqual(s.loads, ['student-b']);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');
    assert.equal(s.sites.getCurrentSiteId(), 'student-b');
});

test('a previous OAuth bridge finishing cannot mark a newer return as idle', async () => {
    const s = setup();
    const first = deferred();
    const second = deferred();
    s.service.afterOAuthLogin = () => first.promise;
    s.service.setPendingOpenCourse({ courseId, siteUrl });
    s.values.set('ifrn_moodle_oauth_pending', '1');
    const staleReturn = s.service.resumePendingOAuthCourse();

    s.service.dismissCourseRecovery();
    s.service.afterOAuthLogin = () => second.promise;
    s.service.setPendingOpenCourse({ courseId: otherCourseId, siteUrl });
    s.values.set('ifrn_moodle_oauth_pending', '1');
    const currentReturn = s.service.resumePendingOAuthCourse();
    first.resolve();
    assert.equal(await staleReturn, true);
    assert.equal(s.service.isNativeCourseHandoffActive(), true);

    second.resolve();
    assert.equal(await currentReturn, true);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
});

test('a timeout cancels the redirected navigation before reauthentication and a new course', async () => {
    const s = setup();
    const first = observe(s.open());
    await tick();
    const redirect = s.routes[0].redirect(bridge);
    await s.advance(45000);
    assert.match(first.error?.message || '', /não confirmou a rota nativa/);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
    assert.equal(s.overlay.visible, false);

    await s.service.returnToIfrnLogin();
    s.changeAccount('student-a');
    const second = observe(s.open(otherCourseId));
    await tick();
    assert.equal(s.routes.length, 3);
    redirect.finish();
    assert.equal(s.overlay.visible, true);
    s.routes[2].finish();
    await tick();
    assert.equal(second.value, 'opened');
});

test('a route that ends at the recovery page reports the failure without waiting for a course timeout', async () => {
    const s = setup();
    const first = observe(s.open());
    await tick();
    s.routes[0].redirect(bridge).finish();
    await tick();
    assert.match(first.error?.message || '', /não chegou à disciplina solicitada/);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.timers.size, 0);
    assert.equal(s.routeListeners.size, 0);
});

test('a confirmed return to the panel retires the previous course even if its content is pending', async () => {
    const s = setup({ navigationShell: true });
    const oldContent = deferred();
    s.service.waitForNativeCourseContent = () => oldContent.promise;
    const first = observe(s.open());
    await tick();
    s.routes[0].finish();
    await tick();
    assert.equal(s.overlay.visible, true);

    // This is a completed Router transition, not the IFRN toolbar handler.
    await s.navigator.navigate(painel);
    s.service.waitForNativeCourseContent = async () => {};
    const second = observe(s.open(otherCourseId));
    await tick();
    assert.equal(first.value, 'cancelled', second.error?.message);
    assert.equal(s.routes.length, 2);
    oldContent.resolve();
    await tick();
    assert.equal(s.overlay.visible, true);
    s.routes[1].finish();
    await tick();
    assert.equal(second.value, 'opened');
    assert.equal(s.overlay.visible, false);
    assert.equal(s.service.lastSummary.openedCourseId, otherCourseId);
});

test('a Router return to the panel cancels session restoration before course navigation starts', async () => {
    const s = setup({ saved: false, navigationShell: true });
    const staleRead = deferred();
    let reads = 0;
    s.sites.getSites = () => ++reads === 1
        ? staleRead.promise
        : Promise.resolve([{ id: 'student-a', siteUrl }]);

    const first = observe(s.open());
    await tick();
    assert.equal(s.overlay.visible, true);

    await s.navigator.navigate(bridge);
    await s.navigator.navigate(painel);
    await tick();

    assert.equal(first.value, 'cancelled');
    assert.equal(s.overlay.visible, false);

    const second = observe(s.open(otherCourseId));
    await tick();
    staleRead.resolve([{ id: 'student-a', siteUrl }]);
    await tick();
    assert.equal(s.routes.length, 1);
    assert.deepEqual(s.loads, ['student-a']);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');
    assert.equal(s.service.lastSummary.openedCourseId, otherCourseId);
});

test('destroying the initiating panel during session lookup cancels before Moodle can activate the old course', async () => {
    const s = setup({ saved: false });
    const read = deferred();
    const getSites = s.sites.getSites;
    s.sites.getSites = () => read.promise;
    const first = observe(s.panel.handleOpenCourse(courseId, 'Synthetic course', siteUrl));
    await tick();
    s.panel.ngOnDestroy();
    await tick();
    assert.ok('value' in first, 'the abandoned panel must not keep the caller pending');
    assert.equal(s.overlay.visible, false);
    assert.equal(s.service.getPendingOpenCourse(), null);
    s.sites.getSites = getSites;
    const second = observe(s.open(otherCourseId));
    await tick();
    read.resolve([{ id: 'student-a', siteUrl }]);
    await tick();
    assert.equal(s.routes.length, 1);
    assert.equal(s.overlay.visible, true);
    s.routes[0].finish();
    await tick();
    assert.equal(second.value, 'opened');
    assert.deepEqual(s.loads, ['student-a']);
});

test('destroying the recovery page during a session read never sends stale native navigation', async () => {
    const s = setup({ saved: false });
    const read = deferred();
    s.sites.getSites = () => read.promise;
    await s.navigator.navigate(bridge);
    const first = observe(s.page.tryOpenOrPromptConnect(false));
    await tick();
    s.page.ngOnDestroy();
    read.resolve([{ id: 'student-a', siteUrl }]);
    await tick();
    assert.equal(s.routes.length, 0);
    assert.ok('value' in first);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
});

test('a completed opening releases its slot for another course and a return to the first', async () => {
    const s = setup({ navigationShell: true });
    const selections = [courseId, otherCourseId, courseId];
    for (const [index, id] of selections.entries()) {
        const opening = s.open(id);
        await tick();
        assert.equal(s.routes.length, index + 1);
        s.routes[index].finish();
        assert.equal(await opening, 'opened');
        assert.equal(s.service.isNativeCourseHandoffActive(), false);
        assert.equal(s.overlay.visible, false);
        await s.navigator.navigate(painel);
    }
});

test('a failed stored session read releases the slot and Retry opens after the read recovers', async () => {
    const s = setup({ saved: false });
    const getSites = s.sites.getSites;
    const failure = new Error('synthetic session read failed');
    s.sites.getSites = async () => { throw failure; };
    await assert.rejects(s.open(), failure);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
    assert.equal(s.overlay.visible, false);

    s.sites.getSites = getSites;
    const retry = s.open();
    await tick();
    assert.equal(s.routes.length, 1);
    s.routes[0].finish();
    assert.equal(await retry, 'opened');
});

test('an unexpected error before native navigation releases the overlay and allows another course', async () => {
    const s = setup();
    const getUserCourses = s.courses.getUserCourses;
    const failure = new Error('synthetic enrollment exception');
    s.courses.getUserCourses = () => { throw failure; };
    await assert.rejects(s.open(), failure);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
    assert.equal(s.routes.length, 0);

    s.courses.getUserCourses = getUserCourses;
    const opening = s.open(otherCourseId);
    await tick();
    s.routes[0].finish();
    assert.equal(await opening, 'opened');
    assert.equal(s.service.lastSummary.openedCourseId, otherCourseId);
    assert.equal(s.overlay.visible, false);
});

test('handing navigation to the Router keeps the cover when the initiating panel is destroyed', async () => {
    const s = setup({ navigationShell: true });
    const first = s.panel.handleOpenCourse(courseId, 'Synthetic course', siteUrl);
    await tick();
    assert.equal(s.routes.length, 1);
    s.panel.ngOnDestroy();
    assert.equal(s.overlay.visible, true);
    s.routes[0].finish();
    await first;
    assert.equal(s.service.lastSummary.openedCourseId, courseId);
    assert.equal(s.overlay.visible, false);
});

test('a content failure after a valid handoff still opens recovery from the cached panel', async () => {
    const s = setup();
    const failure = new Error('synthetic content failure');
    s.service.waitForNativeCourseContent = async () => { throw failure; };
    const opening = s.panel.handleOpenCourse(courseId, 'Synthetic course', siteUrl);
    await tick();
    s.panel.ionViewWillLeave();
    s.routes[0].finish();
    await opening;
    assert.equal(s.navigator.getCurrentPath(), bridge);
    assert.equal(s.service.lastError, failure.message);
    assert.equal(s.overlay.visible, false);
    assert.equal(s.service.isNativeCourseHandoffActive(), false);
});

test('the Router can skip an already active course without a timeout or a duplicate overlay', async () => {
    const s = setup();
    const native = s.navigator.navigate(`/main/home/course/${courseId}`);
    s.routes[0].finish();
    await native;
    const reopening = s.open();
    await tick();
    s.routes[1].finish(undefined, true);
    assert.equal(await reopening, 'opened');
    assert.equal(s.timers.size, 0);
    assert.equal(s.overlay.visible, false);
});
