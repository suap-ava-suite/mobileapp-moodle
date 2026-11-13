const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const ssoModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/course-sso-browser.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: ssoModule.exports, URL, setTimeout, clearTimeout });

class FakeCourseOpeningAttempt {
    cancel() {}
}

function loadService(overrides = {}) {
    const file = 'src/MoodleIFRN/services_mobile/moodle-site.service.ts';
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const injectable = () => target => target;
    const subscriptions = new Map();
    let browserOptions;
    let browserUrl;
    let browserClosed = false;
    let browserShown = false;
    let browserHidden = false;
    let callbackUrl;
    let browserScriptResult = false;
    let externalFallbackCalls = 0;
    let lastTriggeredEvent;
    const panelAva = overrides.panelAva || {
        acquireCourseSsoBrowserLease: async () => () => {},
    };
    const session = new Map([
        ['ifrn_moodle_oauth_pending', '1'],
        ['ifrn_username', 'synthetic-owner'],
        ['ifrn_painel_owner', 'synthetic-owner'],
        ['ifrn_moodle_session_epoch', 'synthetic-epoch'],
    ]);
    let coreGeneration = 0;
    let activeCoreAttempt;
    const defaultCoreSites = {
        beginSessionAttempt: async (owner, epoch, isOwnerCurrent, validateIdentity) => {
            const attempt = { attemptId: `test-${++coreGeneration}`, generation: coreGeneration, owner, epoch,
                state: 'pending', isOwnerCurrent, validateIdentity };
            activeCoreAttempt = attempt;
            return attempt;
        },
        cancelSessionAttempt: attempt => {
            if (attempt.state === 'committed' || attempt.state === 'unknown') return;
            attempt.state = 'cancelled';
            if (activeCoreAttempt === attempt) activeCoreAttempt = undefined;
        },
        isSessionAttemptCurrent: attempt => activeCoreAttempt === attempt && attempt.generation === coreGeneration
            && attempt.state !== 'cancelled' && attempt.state !== 'unknown' && attempt.isOwnerCurrent(),
    };
    const coreSites = overrides.coreSites || defaultCoreSites;
    const browser = {
        close: () => browserClosed = true,
        show: () => browserShown = true,
        hide: () => browserHidden = true,
        _loadAfterBeforeload() {},
        executeScript: async () => browserScriptResult,
        on: event => ({ subscribe: callback => {
            subscriptions.set(event, callback);
            return { unsubscribe() {} };
        } }),
    };
    const mocks = {
        '../mobilemoodle/core_mobile/course-session-flags': {COURSE_SESSION_EPOCH_KEY:'ifrn_moodle_session_epoch'},
        './course-sso-browser': ssoModule.exports,
        '@singletons': { InAppBrowser: { create: (url, target, options) => {
            assert.equal(target, '_blank'); browserUrl = url; browserOptions = options; return browser;
        } } },
        '@angular/core': { Injectable: injectable, inject: () => ({}) },
        '@angular/router': { NavigationEnd: class {}, NavigationError: class {}, Router: class {} },
        '../navigation/course-opening-attempt': { CourseOpeningAttempt: FakeCourseOpeningAttempt },
        '@/MoodleIFRN/navigation/handoff-loading': {
            hideHandoffLoading() {},
            showHandoffLoading() {},
            shouldShowCourseHandoffOnBoot: () => false,
        },
        '@features/login/services/login-helper': { CoreLoginHelper: {
            prepareForSSOLogin: async (...args) => {
                assert.equal(args[0], 'https://academico.ava.ifrn.edu.br');
                assert.equal(args[4], undefined);
                await overrides.prepare?.();
                return 'https://academico.ava.ifrn.edu.br/admin/tool/mobile/launch.php';
            },
            openBrowserForOAuthLogin: async () => { externalFallbackCalls++; return true; },
        } },
        '@features/login/constants': { NO_SITE_ID: 'NoSite', LOGIN_SSO_LAUNCH_DATA: 'CoreLoginLaunchData' },
        '@services/config': { CoreConfig: { delete: async () => {} } },
        '@services/sites': { CoreSites: coreSites },
        '@services/urlschemes': { CoreCustomURLSchemes: {
            isCustomURLToken: url => url.startsWith('moodlemobile://token='),
            handleCustomURL: async (url, attempt) => {
                callbackUrl = url;
                if (overrides.coreHandler) return overrides.coreHandler(url, attempt);
                await overrides.acceptToken?.(url, attempt);
                if (attempt && !coreSites.isSessionAttemptCurrent(attempt)) {
                    throw new Error('Synthetic session attempt was superseded.');
                }
                if (attempt) attempt.state = 'committed';
            },
            isCustomURL: () => true,
        } },
        '@static/opener': { CoreOpener: { openInApp: (url, options) => {
            browserUrl = url;
            browserOptions = options;
            return browser;
        } } },
        '@static/events': { CoreEvents: { trigger: (event, data) => lastTriggeredEvent = { event, data } } },
    };
    const context = { exports: {}, require: id => mocks[id] || {}, console, URL, setTimeout, clearTimeout,
        document: { documentElement: { classList: { add() {}, remove() {} } } },
        sessionStorage: {
            getItem: key => session.get(key) || null,
            setItem: (key, value) => session.set(key, value),
            removeItem: key => session.delete(key),
        },
        window: { handleOpenURL: url => callbackUrl = url } };
    vm.runInNewContext(output, context);
    context.exports.MoodleSiteService.prototype.getExpectedIdentityCandidates = () => [{
        key: 'perfil.matricula',
        value: session.get('ifrn_painel_owner') || session.get('ifrn_username') || '',
    }];
    context.exports.MoodleSiteService.prototype.painelAva = panelAva;

    return {
        MoodleSiteService: context.exports.MoodleSiteService,
        state: () => ({ subscriptions, browserOptions, browserUrl, browserClosed, browserShown, browserHidden,
            callbackUrl, session, externalFallbackCalls, lastTriggeredEvent,
            panelAva,
            setBrowserScriptResult: value => browserScriptResult = value,
            markExternalFallbackCall: () => externalFallbackCalls++ }),
    };
}

test('course callback retains cancellation while native validation is pending', async () => {
    const validation=deferred();
    const {MoodleSiteService,state}=loadService({acceptToken:()=>validation.promise});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    const pending=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcome=pending.then(()=> 'resolved',e=>e.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await new Promise(r=>setImmediate(r));
    const canCancel=typeof service.cancelSilentCourseSso==='function';
    service.cancelCourseOAuthBrowser();
    validation.resolve();
    const result=await outcome;
    assert.equal(canCancel,true,'Cancellation handle must survive receipt of the callback');
    assert.match(result,/cancelada/);
    assert.equal(service.oauthCallbackReceived,false);
});

test('late failure from attempt A cannot delete launch state or browser of attempt B', async () => {
    let reject;
    const validation=new Promise((_ok,no)=>reject=no);
    const {MoodleSiteService,state}=loadService({acceptToken:()=>validation});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    const pending=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcome=pending.catch(e=>e.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await new Promise(r=>setImmediate(r));
    service.cancelCourseOAuthBrowser();
    await new Promise(r=>setImmediate(r));
    const newerBrowser={close:()=>assert.fail('New browser must remain open')};
    service.courseOAuthBrowser=newerBrowser;
    state().session.set('ifrn_moodle_oauth_pending','1');
    service.oauthCallbackReceived=false;
    reject(new Error('synthetic late failure'));
    await outcome;
    assert.equal(service.courseOAuthBrowser,newerBrowser);
    assert.equal(state().session.get('ifrn_moodle_oauth_pending'),'1');
    assert.equal(service.oauthCallbackReceived,false);
});

test('cancel during launch preparation prevents opening the browser or accepting any callback', async () => {
    const preparation=deferred();
    const {MoodleSiteService,state}=loadService({prepare:()=>preparation.promise});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    const pending=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcome=pending.catch(e=>e.message);
    await new Promise(r=>setImmediate(r));
    service.cancelCourseOAuthBrowser();preparation.resolve();
    assert.match(await outcome,/cancelada/);
    assert.equal(state().browserUrl,undefined);assert.equal(state().callbackUrl,undefined);
});

test('course SSO waits for the profile InAppBrowser lease and releases it after callback', async () => {
    const refresh = deferred();
    let released = 0;
    const panelAva = {
        acquireCourseSsoBrowserLease: async () => {
            await refresh.promise;
            return () => released++;
        },
    };
    const { MoodleSiteService, state } = loadService({ panelAva });
    const service = Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions = [];
    const pending = service.openCourseOAuthInApp({ siteUrl: 'https://academico.ava.ifrn.edu.br', config: {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state().browserUrl, undefined, 'course OAuth must not replace an active profile browser');

    refresh.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(state().browserUrl, /auth\/suap\/login\.php/);
    state().subscriptions.get('customscheme')({ url: 'moodlemobile://token=synthetic-course' });
    await pending;

    assert.equal(released, 1, 'the profile browser lease must be released exactly once');
});

test('course SSO releases the profile browser lease when Moodle rejects the callback', async () => {
    let released = 0;
    const panelAva = { acquireCourseSsoBrowserLease: async () => () => released++ };
    const { MoodleSiteService, state } = loadService({
        panelAva,
        coreHandler: async () => { throw new Error('synthetic Moodle callback failure'); },
    });
    const service = Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions = [];
    const pending = service.openCourseOAuthInApp({ siteUrl: 'https://academico.ava.ifrn.edu.br', config: {} });
    const result = pending.then(() => null, error => error.message);
    await new Promise(resolve => setImmediate(resolve));
    state().subscriptions.get('customscheme')({ url: 'moodlemobile://token=synthetic-course' });

    assert.match(await result, /validar/);
    assert.equal(released, 1, 'an error must not leave profile refresh permanently blocked');
});

test('account change or logout epoch rejects a late validation result', async () => {
    for(const key of ['ifrn_username','ifrn_painel_owner','ifrn_moodle_session_epoch']) {
        const validation=deferred();
        const {MoodleSiteService,state}=loadService({acceptToken:()=>validation.promise});
        const service=Object.create(MoodleSiteService.prototype);
        service.courseOAuthBrowserSubscriptions=[];
        const pending=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
        const outcome=pending.then(()=> 'resolved',e=>e.message);
        await new Promise(r=>setImmediate(r));
        state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
        await new Promise(r=>setImmediate(r));
        state().session.set(key,'synthetic-account-b');validation.resolve();
        assert.match(await outcome,/validar/);
    }
});

module.exports={loadService,deferred};

function deferred() {
    let resolve;
    const promise = new Promise(done => resolve = done);

    return { promise, resolve };
}

test('connecting a changed Panel account switches the native context once and preserves the selected course', async () => {
    const switches = [];
    const { MoodleSiteService, state } = loadService({ coreSites: {
        getCurrentSite: () => ({ isLoggedOut: () => false }),
        isLoggedIn: () => true,
        logout: async options => switches.push(options),
    } });
    const service = Object.create(MoodleSiteService.prototype);
    const pending = { courseId: 42, siteUrl: 'https://academico.ava.ifrn.edu.br' };
    service.ensureLoginObserver = () => {};
    service.logger = { debug() {} };
    service.matchCurrentMoodleIdentity = () => ({ hasExpected: true, matches: false, candidateCount: 1 });
    service.getPendingOpenCourse = () => pending;
    service.openCourseOAuthInApp = async () => assert.fail('OAuth must wait for the native context switch');

    const result = await service.performStartSuapOAuthLogin({}, { stage: async (_stage, operation) => operation() });

    assert.equal(result, 'switched');
    assert.equal(switches.length, 1);
    assert.equal(switches[0].siteId, 'NoSite', 'Leave the active context without deleting the saved account');
    assert.equal(switches[0].redirectPath, '/login/moodle-open-course');
    assert.equal(switches[0].redirectOptions.params.courseId, pending.courseId);
    assert.equal(switches[0].redirectOptions.params.siteUrl, pending.siteUrl);
    assert.equal(switches[0].redirectOptions.params.startOAuth, true);
    assert.equal(state().session.get('ifrn_painel_owner'), 'synthetic-owner');
    assert.equal(service.consumeOAuthResume(pending.courseId, pending.siteUrl), true);
    assert.equal(service.consumeOAuthResume(pending.courseId, pending.siteUrl), false);
    assert.equal(state().browserUrl, undefined);
});

test('same course and Moodle site join one in-progress native opening', async () => {
    const { MoodleSiteService } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    const result = deferred();
    let calls = 0;
    service.performEnsureSessionAndOpenCourse = () => { calls++; return result.promise; };
    service.isNativeCourseHandoffActive = () => true;

    const first = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br', 'Curso');
    const duplicate = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br', 'Curso');

    assert.strictEqual(duplicate, first);
    assert.equal(calls, 1);
    result.resolve('opened');
    assert.equal(await first, 'opened');
});
test('a different course or Moodle site cannot join the active opening', async () => {
    const { MoodleSiteService } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    const result = deferred();
    let calls = 0;
    service.performEnsureSessionAndOpenCourse = () => { calls++; return result.promise; };
    service.isNativeCourseHandoffActive = () => true;

    const first = service.ensureSessionAndOpenCourse(4022, 'https://academico.ava.ifrn.edu.br');

    await assert.rejects(
        service.ensureSessionAndOpenCourse(2836, 'https://presencial.ava.ifrn.edu.br'),
        /Uma abertura de curso já está em andamento/,
    );
    await assert.rejects(
        service.ensureSessionAndOpenCourse(4022, 'https://presencial.ava.ifrn.edu.br'),
        /Uma abertura de curso já está em andamento/,
    );
    assert.equal(calls, 1);

    result.resolve('opened');
    assert.equal(await first, 'opened');
});

test('course tabs use the activated course route, not the previous bridge URL', () => {
    const source = fs.readFileSync('src/core/features/course/pages/index/index.ts', 'utf8');

    assert.match(source, /const path\s*=\s*CoreNavigator\.getRouteFullPath\(this\.route\)/);
    assert.match(source, /this\.currentPagePath\s*=\s*path/);
    assert.doesNotMatch(source, /this\.currentPagePath\s*=\s*CoreNavigator\.getCurrentPath\(\)/);
});

test('course OAuth stays hidden inside the app and resumes the selected course natively', () => {
    const page = fs.readFileSync('src/MoodleIFRN/moodle-open-course/moodle-open-course.ts', 'utf8');
    const service = fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8');

    assert.match(page, /await this\.tryOpenOrPromptConnect\(true\)/);
    assert.match(service, /CoreLoginHelper\.prepareForSSOLogin\(/);
    assert.match(service, /isSitePath:\s*false/);
    assert.match(service, /path:\s*'\/login\/moodle-open-course'/);
    assert.match(service, /openCourseOAuthInApp/);
    assert.doesNotMatch(service, /CoreLoginHelper\.openBrowserForOAuthLogin\(/);
    assert.match(service, /hidden:\s*'yes'/);
});

test('native course SSO preserves cookies, stays hidden and delegates token validation to Moodle', async () => {
    const { MoodleSiteService, state } = loadService();
    const service = Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    const pending = service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state().browserOptions.hidden,'yes');
    assert.equal(state().browserOptions.clearcache,'no');
    assert.equal(state().browserOptions.clearsessioncache,'no');
    assert.equal(state().browserOptions.beforeload,'get');
    assert.equal(state().browserOptions.omitappuseragent,'yes');
    assert.match(state().browserUrl,/auth\/suap\/login\.php\?next=/);
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=official-callback'});
    await pending;
    assert.equal(state().callbackUrl,'moodlemobile://token=official-callback');
    assert.equal(state().externalFallbackCalls,0);
    assert.equal(state().browserShown,false);
    assert.equal(state().browserClosed,true);
    assert.equal(service.oauthCallbackReceived,true);
});

test('course tap resets the Ionic login route before entering the OAuth bridge', () => {
    const panel = fs.readFileSync('src/MoodleIFRN/painel/painel.ts', 'utf8');
    const navigation = panel.match(/this\.router\.navigate\(\['\/login\/moodle-open-course'\],[\s\S]*?\n            \}\);/);

    assert.ok(navigation, 'Panel must navigate directly to the course bridge');
    assert.match(navigation[0], /replaceUrl:\s*true/);
    assert.match(navigation[0], /queryParams:/);
});

function nativeHandler(gate) {
    // Executa corpos reais do núcleo, somente lidos: as dependências externas usam dados sintéticos.
    const extract=(file,names)=>{
        const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
        const methods=[];
        for(const node of ast.statements)if(ts.isClassDeclaration(node))for(const member of node.members)
            if(ts.isMethodDeclaration(member)&&names.includes(member.name.getText(ast)))methods.push(member.getText(ast));
        assert.equal(methods.length,names.length);return methods.join('\n');
    };
    const state={persisted:0,logins:0,navigations:0};
    const siteFactory={
        makeAuthenticatedSite:()=>({fetchSiteInfo:()=>gate.promise}),
        makeSite:(id,url,token,{info})=>({id,token,info,setOAuthId(){},setConfig(){}}),
    };
    const context={URL,console,CoreSitesFactory:siteFactory,CorePromiseUtils:{ignoreErrors:p=>p.catch(()=>undefined)},
        CORE_SITE_CURRENT_SITE_ID_CONFIG:'synthetic-current-id',
        CoreConfig:{set:async()=>{}},CoreEvents:{LOGIN:'login',SITE_ADDED:'added',SITE_UPDATED:'updated',
            trigger:event=>{if(event==='login')state.logins++;}},
        CoreLoginHelper:{isSiteUrlAllowed:async()=>true,getOAuthIdFromParams:()=>undefined},
        CoreUrl:{decodeURIComponent:x=>x},ApplicationInit:{donePromise:Promise.resolve()},
        CoreLoadings:{show:async()=>({dismiss:async()=>{}})},
        CoreNavigator:{navigateToSiteHome:()=>state.navigations++},CoreSSO:{finishSSOAuthentication(){}},
        CoreErrorHelper:{isCanceledError:()=>false,getErrorMessageFromError:e=>e.message},
    };
    const source=`class CoreSitesProvider { static VALID_VERSION=1;
        ${extract('src/core/services/sites.ts',['newSite','login'])}
    }
    class NativeCallback {
        ${extract('src/core/services/urlschemes.ts',['handleCustomURL','createSiteIfNeeded'])}
    }
    this.types={CoreSitesProvider,NativeCallback};`;
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
    const sites=new context.types.CoreSitesProvider();
    Object.assign(sites,{
        sites:{},sitesDB:{migrateSiteSchemas:async()=>{}},isValidMoodleVersion:()=>1,
        createSiteID:()=> 'synthetic-site-a',getSite:async()=>undefined,getSiteConfig:async()=>({}),
        getContentAllowedScriptUrlsFromConfig:()=>[],
        addSite:async()=>state.persisted++,getCurrentSite:()=>sites.currentSite,
    });
    context.CoreSites=sites;
    const handler=new context.types.NativeCallback();
    Object.assign(handler,{lastUrls:{},isCustomURL:()=>true,isCustomURLToken:()=>true,
        removeCustomURLScheme:url=>url.replace('moodlemobile://',''),
        getCustomURLTokenData:async()=>({siteUrl:'https://academico.ava.ifrn.edu.br',token:'SYNTHETIC_A',isSSOToken:true})});
    return {accept:async url=>{
        try { return await handler.handleCustomURL(url); }
        catch(e) { state.unexpectedError=e.message; throw e; }
    },state,sites};
}
function realNativeHandler(gateForToken, options = {}) {
    const extract = (file, names) => {
        const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const methods = [];
        for (const node of ast.statements) if (ts.isClassDeclaration(node)) for (const member of node.members) {
            if (ts.isMethodDeclaration(member) && names.includes(member.name.getText(ast))) methods.push(member.getText(ast));
        }
        assert.equal(methods.length, names.length);
        return methods.join('\n');
    };
    const state = { persisted: 0, logins: 0, navigations: 0, secureWrites: 0, tableWrites: 0,
        secureCollections: new Map(), siteRecords: new Map(), cacheRecords: new Map(), attemptRecord: undefined };
    const matches = (record, attemptId, generation, owner, epoch) => record
        && record.attemptId === attemptId && record.generation === generation
        && record.owner === owner && record.epoch === epoch;
    const db = {
        getAllRecords: async table => table === 'ifrn_session_attempts'
            ? (state.attemptRecord ? [structuredClone(state.attemptRecord)] : [])
            : [...state.siteRecords.values()].map(record => structuredClone(record)),
        getRecord: async (table, conditions) => {
            if (table === 'ifrn_session_attempts' && state.attemptRecord?.id === conditions.id) {
                return structuredClone(state.attemptRecord);
            }
            if (table === 'sites_2' && state.siteRecords.has(conditions.id)) {
                return structuredClone(state.siteRecords.get(conditions.id));
            }
            throw new Error('synthetic record not found');
        },
        executeBatch: async statements => {
            let attempt = state.attemptRecord && structuredClone(state.attemptRecord);
            const siteRecords = new Map([...state.siteRecords].map(([id, record]) => [id, structuredClone(record)]));
            for (const [sql, params] of statements) {
                if (sql.includes('INSERT OR REPLACE INTO ifrn_session_attempts')) {
                    const [id, attemptId, generation, status, previousSiteId, owner, epoch] = params;
                    if (!attempt || attempt.id !== id || attempt.generation <= generation) {
                        attempt = { id, attemptId, generation, state: status, previousSiteId, owner, epoch };
                    }
                } else if (sql.includes('SET state = ?, siteId = NULL, credentialKey = NULL')) {
                    const [status, id] = params;
                    if (params.length === 4) {
                        const [, generation, tombstoneId, maxGeneration] = params;
                        if (attempt?.id === tombstoneId && attempt.generation < maxGeneration) {
                            attempt = { ...attempt, state: status, generation, siteId: null, credentialKey: null };
                        }
                    } else if (params.length === 9) {
                        const [, , attemptId, generation, owner, epoch, expectedState, siteId, credentialKey] = params;
                        if (attempt?.id === id && attempt.state === expectedState && attempt.siteId === siteId
                            && attempt.credentialKey === credentialKey && matches(attempt, attemptId, generation, owner, epoch)) {
                            attempt = { ...attempt, state: status, siteId: null, credentialKey: null };
                        }
                    } else if (attempt?.id === id) {
                        attempt = { ...attempt, state: status, siteId: null, credentialKey: null };
                    }
                } else if (sql.includes('UPDATE sites_2 SET siteUrl')) {
                    const [siteUrl, token, info, privateToken, config, loggedOut, oauthId, credentialKey, id, oldKey] = params;
                    const record = siteRecords.get(id);
                    if (record?.credentialKey === oldKey) {
                        siteRecords.set(id, { id, siteUrl, token, info, privateToken, config, loggedOut, oauthId, credentialKey });
                    }
                } else if (sql.includes('DELETE FROM sites_2 WHERE id = ? AND credentialKey = ?')) {
                    const [id, credentialKey] = params;
                    if (siteRecords.get(id)?.credentialKey === credentialKey) siteRecords.delete(id);
                } else if (sql.includes('UPDATE ifrn_session_attempts SET state = ?, siteId = ?')) {
                    const [status, siteId, credentialKey, id, attemptId, generation, owner, epoch, expectedState] = params;
                    if (attempt?.id === id && attempt.state === expectedState
                        && matches(attempt, attemptId, generation, owner, epoch)) {
                        attempt = { ...attempt, state: status, siteId, credentialKey };
                    }
                } else if (sql.includes('UPDATE ifrn_session_attempts SET state = ?')) {
                    const [status, id, attemptId, generation, owner, epoch, expectedState, secondState] = params;
                    if (attempt?.id === id && [expectedState, secondState].includes(attempt.state)
                        && matches(attempt, attemptId, generation, owner, epoch)) {
                        attempt = { ...attempt, state: status };
                    }
                } else if (sql.includes('INSERT OR REPLACE INTO sites_2')) {
                    const [id, siteUrl, token, info, privateToken, config, loggedOut, oauthId, credentialKey,
                        activeId, attemptId, generation, owner, epoch, expectedState] = params;
                    if (matches(attempt, attemptId, generation, owner, epoch) && attempt.state === expectedState) {
                        siteRecords.set(id, { id, siteUrl, token, info, privateToken, config, loggedOut, oauthId, credentialKey });
                    }
                } else {
                    throw new Error('Unexpected SQL in real core fixture.');
                }
            }
            state.attemptRecord = attempt;
            state.siteRecords = siteRecords;
            state.persisted = siteRecords.size;
            if (statements.some(([sql]) => sql.includes('UPDATE ifrn_session_attempts SET state = ?, siteId = ?'))) {
                await options.afterPublicationCommit?.();
            }
        },
    };
    const siteFactory = {
        makeAuthenticatedSite: (_siteUrl, token) => ({ fetchSiteInfo: () => gateForToken(token).promise }),
        makeSite: (id, url, token, { info, privateToken }) => ({
            id, url, token, privateToken, info,
            getId() { return id; }, getURL() { return url; }, getToken() { return token; }, getInfo() { return info; },
            isLoggedOut() { return false; }, setOAuthId() {}, setConfig() {}, getStoredConfig() { return {}; },
        }),
    };
    const secureStorage = {
        storeDurable: async (data, key) => {
            state.secureWrites++;
            await options.durableGateForToken?.(data.token)?.promise;
            state.secureCollections.set(key, { ...data });
        },
        deleteCollection: async key => state.secureCollections.delete(key),
    };
    class SyntheticCoreError extends Error {}
    class SyntheticURLSchemeError extends Error {}
    const ownerStorage = new Map([['ifrn_painel_owner','synthetic-owner']]);
    const webStorage = {
        getItem: key => ownerStorage.get(key) ?? null,
        setItem: (key, value) => ownerStorage.set(key, String(value)),
        removeItem: key => ownerStorage.delete(key),
    };
    const context = {
        URL, console, Md5: { hashStr: value => `hash:${value}` }, CoreSitesFactory: siteFactory, CorePromiseUtils: {
            ignoreErrors: promise => Promise.resolve(promise).catch(() => undefined),
        },
        CoreAppDB: { getDB: () => db }, CoreNative: { plugin: name => name === 'secureStorage' ? secureStorage : undefined },
        IFRN_SESSION_ATTEMPTS_TABLE_NAME: 'ifrn_session_attempts', SITES_TABLE_NAME: 'sites_2',
        CORE_SITE_CURRENT_SITE_ID_CONFIG: 'current_site_id', CoreError: SyntheticCoreError,
        CoreConfig: { has: async () => true, get: async () => '', set: async () => {}, delete: async () => {} },
        CoreEvents: { LOGIN: 'login', SITE_ADDED: 'added', SITE_UPDATED: 'updated', trigger: event => {
            if (event === 'login') state.logins++;
        } },
        CoreLoginHelper: { isSiteUrlAllowed: async () => true, getOAuthIdFromParams: () => undefined },
        CoreUrl: { decodeURIComponent: value => value }, CoreConstants: { CONFIG: { customurlscheme: 'moodlemobile' } },
        ApplicationInit: { donePromise: Promise.resolve() }, CoreLoadings: { show: async () => ({ dismiss: async () => {} }) },
        CoreNavigator: { navigateToSiteHome: () => { state.navigations++; return Promise.resolve(); } },
        CoreSSO: { finishSSOAuthentication() {} }, CoreContentLinksHelper: { confirmLinkToSite: async () => {} },
        CoreErrorHelper: { isCanceledError: () => false, getErrorMessageFromError: error => error.message },
        CoreCustomURLSchemesHandleError: SyntheticURLSchemeError, sessionStorage: webStorage, localStorage: webStorage,
    };
    const source = `class CoreSitesProvider { static VALID_VERSION = 1;
        ${extract('src/core/services/sites.ts', ['beginSessionAttempt', 'cancelSessionAttempt', 'isSessionAttemptCurrent',
            'assertSessionAttemptCurrent', 'isSessionAttemptIdCurrent', 'newSite', 'newSiteWithSessionAttempt', 'login',
            'rollbackUnactivatedSessionAttempt', 'migrateCurrentSiteLegacyTable', 'getStoredCurrentSiteId',
            'getPersistedSessionOwner', 'removeStoredCurrentSite'])}
    }
    class CoreCustomURLSchemesProvider {
        ${extract('src/core/services/urlschemes.ts', ['handleCustomURL', 'createSiteIfNeeded'])}
    }
    this.types = { CoreSitesProvider, CoreCustomURLSchemesProvider };`;
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const sites = new context.types.CoreSitesProvider();
    Object.assign(sites, {
        sessionAttemptsReady: true, sessionAttemptGeneration: 0, activeSessionAttempt: undefined,
        sites: {}, sitesDB: { migrateSiteSchemas: async () => {} }, isValidMoodleVersion: () => 1,
        createSiteID: (url, username) => `synthetic-${url.includes('presencial') ? 'p' : 'a'}-${username}`,
        getSite: async id => {
            const record = state.siteRecords.get(id);
            return record ? siteFactory.makeSite(id, record.siteUrl, 'STORED', { info: JSON.parse(record.info) }) : undefined;
        },
        getSiteConfig: async () => ({}), sitesTable: {
            getOneByPrimaryKey: async ({ id }) => state.siteRecords.has(id)
                ? structuredClone(state.siteRecords.get(id)) : undefined,
            insert: async () => { state.tableWrites++; },
            update: async () => { state.tableWrites++; },
            syncCacheRecord: record => state.cacheRecords.set(record.id, structuredClone(record)),
        },
        getCurrentSite: () => sites.currentSite, getCurrentSiteId: () => sites.currentSite?.id || '',
    });
    context.CoreSites = sites;
    const handler = new context.types.CoreCustomURLSchemesProvider();
    Object.assign(handler, {
        lastUrls: {}, logger: { debug() {} }, isCustomURL: () => true, isCustomURLToken: () => true,
        isCustomURLLink: () => false, removeCustomURLScheme: value => value.replace('moodlemobile://', ''),
        getCustomURLTokenData: async url => {
            const tokenValue = decodeURIComponent(url.match(/(?:[?&]|\/)token=([^&]+)/)?.[1] || '');
            const token = tokenValue.replace(/^synthetic-([ab])$/i,
                (_match, suffix) => `SYNTHETIC_${suffix.toUpperCase()}`);
            return { siteUrl: 'https://academico.ava.ifrn.edu.br', token,
                privateToken: `PRIVATE_${token}`, isSSOToken: true };
        },
    });

    return {
        accept: async (url, attempt) => {
            try { return await handler.handleCustomURL(url, attempt); }
            catch (error) { state.unexpectedError = error.message; throw error; }
        },
        state, sites, config: context.CoreConfig, CoreError: SyntheticCoreError,
    };
}

test('first native SSO attempt accepts an absent legacy current-site setting after account logout', async () => {
    const native = realNativeHandler(() => deferred());
    native.config.get = async () => { throw new native.CoreError('No records found.'); };

    const attempt = await native.sites.beginSessionAttempt('synthetic-new-owner', 'synthetic-new-epoch', () => true, () => false);

    assert.equal(attempt.state, 'pending');
    assert.equal(attempt.previousSiteId, undefined);
    assert.equal(native.state.attemptRecord.owner, 'synthetic-new-owner');
    assert.equal(native.state.attemptRecord.epoch, 'synthetic-new-epoch');
    assert.equal(native.state.persisted, 0);
    assert.equal(native.state.secureWrites, 0);
    assert.equal(native.sites.currentSite, undefined);
});

test('unexpected legacy config failures still reject the first native SSO attempt without publishing credentials', async () => {
    const native = realNativeHandler(() => deferred());
    const failure = new native.CoreError('synthetic configuration read failed');
    native.config.get = async () => { throw failure; };

    await assert.rejects(
        native.sites.beginSessionAttempt('synthetic-new-owner', 'synthetic-new-epoch', () => true, () => false),
        error => error === failure,
    );
    assert.equal(native.state.attemptRecord, undefined);
    assert.equal(native.state.persisted, 0);
    assert.equal(native.state.secureWrites, 0);
    assert.equal(native.sites.currentSite, undefined);
});

test('P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B',async()=>{
    const gateA=deferred(),gateB=deferred();
    gateB.resolve({siteurl:'https://academico.ava.ifrn.edu.br',username:'synthetic-B'});
    const native=realNativeHandler(token => token === 'SYNTHETIC_A' ? gateA : gateB);
    const {MoodleSiteService,state}=loadService({coreHandler:native.accept,coreSites:native.sites});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    state().session.set('ifrn_username','synthetic-A');
    state().session.set('ifrn_painel_owner','synthetic-A');
    state().session.set('ifrn_moodle_session_epoch','synthetic-epoch-A');
    service.getExpectedIdentityCandidates=()=>[{key:'perfil.matricula',value:state().session.get('ifrn_painel_owner')}];
    const flow=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcome=flow.catch(e=>e.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await new Promise(r=>setImmediate(r));
    service.cancelCourseOAuthBrowser();
    state().session.set('ifrn_username','synthetic-B');
    state().session.set('ifrn_painel_owner','synthetic-B');
    state().session.set('ifrn_moodle_session_epoch','synthetic-epoch-B');
    native.sites.currentSite={id:'synthetic-site-b',info:{username:'synthetic-B'},getId(){return this.id;},getToken:()=> 'SYNTHETIC_B',
        getInfo(){return this.info;},isLoggedOut:()=>false};
    const flowB=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const flowBOutcome=flowB.catch(error=>error.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-b'});
    const flowBResult=await flowBOutcome;
    assert.equal(flowBResult,undefined,String(flowBResult));
    assert.equal(native.state.attemptRecord?.owner,'synthetic-b');
    assert.equal(native.state.attemptRecord?.state,'committed');
    gateA.resolve({siteurl:'https://academico.ava.ifrn.edu.br',username:'synthetic-A'});
    await outcome;await new Promise(r=>setImmediate(r));
    assert.deepEqual({current:native.sites.currentSite.id,persisted:native.state.persisted,
        cache:native.state.cacheRecords.get('synthetic-a-synthetic-B')?.credentialKey,
        tableWrites:native.state.tableWrites,owner:native.state.attemptRecord.owner,
        logins:native.state.logins,navigations:native.state.navigations},
        {current:'synthetic-a-synthetic-B',persisted:1,cache:`ifrn-session-${native.state.attemptRecord.attemptId}`,
            tableWrites:0,owner:'synthetic-b',logins:1,navigations:1});
    service.cancelCourseOAuthBrowser();
    await flowBOutcome;
});

test('a cancelled attempt cannot publish after its secure credential write returns',async()=>{
    const durableA=deferred();
    const gateForToken=token=>({promise:Promise.resolve({
        siteurl:'https://academico.ava.ifrn.edu.br',username:token==='SYNTHETIC_A'?'synthetic-A':'synthetic-B',
    })});
    const native=realNativeHandler(gateForToken,{durableGateForToken:token=>token==='SYNTHETIC_A'?durableA:undefined});
    const {MoodleSiteService,state}=loadService({coreHandler:native.accept,coreSites:native.sites});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    state().session.set('ifrn_username','synthetic-A');
    state().session.set('ifrn_painel_owner','synthetic-A');
    state().session.set('ifrn_moodle_session_epoch','synthetic-epoch-A');
    service.getExpectedIdentityCandidates=()=>[{key:'perfil.matricula',value:state().session.get('ifrn_painel_owner')}];

    const flowA=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcomeA=flowA.catch(error=>error.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    for (let i=0;i<20 && native.state.secureWrites===0;i++) await new Promise(r=>setImmediate(r));
    assert.equal(native.state.secureWrites,1,'A must be suspended inside the durable secure write');

    service.cancelCourseOAuthBrowser();
    state().session.set('ifrn_username','synthetic-B');
    state().session.set('ifrn_painel_owner','synthetic-B');
    state().session.set('ifrn_moodle_session_epoch','synthetic-epoch-B');
    const flowB=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcomeB=flowB.catch(error=>error.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-b'});
    assert.equal(await outcomeB,undefined);

    durableA.resolve();
    await outcomeA;
    assert.equal(native.state.attemptRecord.owner,'synthetic-b');
    assert.equal(native.state.attemptRecord.state,'committed');
    assert.deepEqual([...native.state.secureCollections.keys()], [`ifrn-session-${native.state.attemptRecord.attemptId}`]);
    assert.deepEqual([...native.state.siteRecords.values()].map(record=>JSON.parse(record.info).username),['synthetic-B']);
    assert.equal(native.state.logins,1);
    assert.equal(native.state.navigations,1);
});

test('a cancellation during a committed SQLite write revokes only its candidate before account B completes',async()=>{
    const publicationAck=deferred();
    let publicationReached;
    let holdFirstPublication=true;
    const publicationStarted=new Promise(resolve=>publicationReached=resolve);
    const gateForToken=token=>({promise:Promise.resolve({
        siteurl:'https://academico.ava.ifrn.edu.br',username:token==='SYNTHETIC_A'?'synthetic-owner':'synthetic-owner',
    })});
    const native=realNativeHandler(gateForToken,{afterPublicationCommit:async()=>{
        if (!holdFirstPublication) return;
        holdFirstPublication=false;
        publicationReached();
        await publicationAck.promise;
    }});
    const {MoodleSiteService,state}=loadService({coreHandler:native.accept,coreSites:native.sites});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    service.getExpectedIdentityCandidates=()=>[{key:'perfil.matricula',value:state().session.get('ifrn_painel_owner')}];

    const flowA=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcomeA=flowA.catch(error=>error.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await Promise.race([
        publicationStarted,
        outcomeA.then(error=>{throw new Error(`Attempt A failed before the publication commit: ${error}`);}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timed out waiting for the synthetic publication commit.')),3000)),
    ]);
    assert.equal(native.state.attemptRecord.state,'committed','the synthetic SQLite transaction has committed while its ACK is held');

    service.cancelCourseOAuthBrowser();
    const flowB=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcomeB=flowB.catch(error=>error.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-b'});
    assert.equal(await outcomeB,undefined);
    const attemptB=native.state.attemptRecord.attemptId;

    publicationAck.resolve();
    await outcomeA;
    await new Promise(r=>setImmediate(r));
    assert.equal(native.state.attemptRecord.attemptId,attemptB);
    assert.equal(native.state.attemptRecord.state,'committed');
    assert.deepEqual([...native.state.secureCollections.keys()],[`ifrn-session-${attemptB}`]);
    assert.deepEqual([...native.state.siteRecords.values()].map(record=>JSON.parse(record.info).username),['synthetic-owner']);
    assert.equal(native.state.siteRecords.values().next().value.credentialKey,`ifrn-session-${attemptB}`);
    assert.equal(native.state.logins,1);
    assert.equal(native.state.navigations,1);
});

test('logout tombstone cannot be undone by a delayed cancel and same-account re-entry gets a newer generation',async()=>{
    const native=realNativeHandler(() => deferred());
    const {sites}=native;
    const first=await sites.beginSessionAttempt('synthetic-owner','epoch-1',()=>true,()=>true);
    assert.equal(first.generation,1);

    await sites.removeStoredCurrentSite();
    assert.equal(native.state.attemptRecord.state,'logged-out');
    assert.equal(await sites.getStoredCurrentSiteId(),'');

    sites.cancelSessionAttempt(first);
    await new Promise(r=>setImmediate(r));
    assert.equal(native.state.attemptRecord.state,'logged-out','late cancellation must not clear the durable logout marker');

    const reentry=await sites.beginSessionAttempt('synthetic-owner','epoch-2',()=>true,()=>true);
    assert.ok(reentry.generation>first.generation);
    assert.equal(reentry.previousSiteId,undefined);
    assert.equal(await sites.getStoredCurrentSiteId(),'','an incomplete re-entry cannot restore a prior candidate');
});

test('native contract fixture accepts a valid synthetic token and creates one session without cancellation',async()=>{
    const gate=deferred(),native=realNativeHandler(() => gate);
    const {MoodleSiteService,state}=loadService({coreHandler:native.accept,coreSites:native.sites});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    service.getExpectedIdentityCandidates=()=>[{key:'perfil.matricula',value:state().session.get('ifrn_painel_owner')}];
    const pending=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await new Promise(r=>setImmediate(r));
    gate.resolve({siteurl:'https://academico.ava.ifrn.edu.br',username:'synthetic-owner'});
    await pending;
    assert.deepEqual({current:native.sites.currentSite.id,persisted:native.state.persisted,
        logins:native.state.logins,navigations:native.state.navigations},
        {current:'synthetic-a-synthetic-owner',persisted:1,logins:1,navigations:1});
});
