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
    const session = new Map([['ifrn_moodle_oauth_pending', '1']]);
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
        '@features/login/services/login-helper': { CoreLoginHelper: {
            prepareForSSOLogin: async (...args) => {
                assert.equal(args[0], 'https://academico.ava.ifrn.edu.br');
                assert.equal(args[4], undefined);
                await overrides.prepare?.();
                return 'https://academico.ava.ifrn.edu.br/admin/tool/mobile/launch.php';
            },
            openBrowserForOAuthLogin: async () => { externalFallbackCalls++; return true; },
        } },
        '@services/config': { CoreConfig: { delete: async () => {} } },
        '@services/urlschemes': { CoreCustomURLSchemes: {
            isCustomURLToken: url => url.startsWith('moodlemobile://token='),
            handleCustomURL: async url => { callbackUrl = url; await overrides.acceptToken?.(url); },
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
        sessionStorage: { getItem: key => session.get(key) || null, removeItem: key => session.delete(key) },
        window: { handleOpenURL: url => callbackUrl = url } };
    vm.runInNewContext(output, context);

    return {
        MoodleSiteService: context.exports.MoodleSiteService,
        state: () => ({ subscriptions, browserOptions, browserUrl, browserClosed, browserShown, browserHidden,
            callbackUrl, session, externalFallbackCalls, lastTriggeredEvent,
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
    const navigation = panel.match(/await this\.router\.navigate\(\['\/login\/moodle-open-course'\],[\s\S]*?\n\s*\}\s*\}\);/);

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
test('P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B',async()=>{
    const gate=deferred();
    const native=nativeHandler(gate);
    const {MoodleSiteService,state}=loadService({acceptToken:native.accept});
    const service=Object.create(MoodleSiteService.prototype);
    service.courseOAuthBrowserSubscriptions=[];
    const flow=service.openCourseOAuthInApp({siteUrl:'https://academico.ava.ifrn.edu.br',config:{}});
    const outcome=flow.catch(e=>e.message);
    await new Promise(r=>setImmediate(r));
    state().subscriptions.get('beforeload')({url:'moodlemobile://token=synthetic-a'});
    await new Promise(r=>setImmediate(r));
    service.cancelCourseOAuthBrowser();
    state().session.set('ifrn_username','synthetic-B');
    native.sites.currentSite={id:'synthetic-site-b',getToken:()=> 'SYNTHETIC_B',isLoggedOut:()=>false};
    gate.resolve({siteurl:'https://academico.ava.ifrn.edu.br',username:'synthetic-A'});
    await outcome;await new Promise(r=>setImmediate(r));
    assert.equal(native.state.unexpectedError,undefined,'Native contract fixture must reach its side effects');
    assert.deepEqual({current:native.sites.currentSite.id,...native.state},
        {current:'synthetic-site-b',persisted:0,logins:0,navigations:0});
});

test('native contract fixture accepts a valid synthetic token and creates one session without cancellation',async()=>{
    const gate=deferred(),native=nativeHandler(gate);
    const accepted=native.accept('moodlemobile://token=synthetic-a');
    gate.resolve({siteurl:'https://academico.ava.ifrn.edu.br',username:'synthetic-A'});
    await accepted;
    assert.deepEqual({current:native.sites.currentSite.id,...native.state},
        {current:'synthetic-site-a',persisted:1,logins:1,navigations:1});
});
