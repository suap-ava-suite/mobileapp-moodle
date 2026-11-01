const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const active = ['ifrn_moodle_oauth_pending','ifrn_moodle_resume_oauth'];
const legacy = ['ifrn_moodle_poc_oauth_pending','ifrn_moodle_poc_resume_oauth'];
const otherAttempt = ['ifrn_moodle_pending_open_course','ifrn_moodle_identity_mismatch'];
const preferences = ['app_language','ifrn_favourites_account-b','moodle_native_account-b','another_environment_session'];
function setup(kind) {
    const session = new Map([...active,...legacy,...otherAttempt,...preferences].map(k=>[k,'synthetic']));
    const local = new Map(preferences.map(k=>[k,'synthetic']));
    const storage = map => ({getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k),setItem:(k,v)=>map.set(k,v)});
    const mm = {invalidateCache:()=>{}};
    const context = {exports:{},sessionStorage:storage(session),localStorage:storage(local),window:{},
        require:id=> id==='./namespace' ? {MM:mm} : id==='@angular/core' ? {Injectable:()=>x=>x,inject:()=>({})} :
            id.endsWith('oauth-profile') ? {OAUTH_PROFILE_KEY:'ifrn_oauth_profile'} : {}};
    const file = kind==='service' ? 'services_mobile/auth.service.ts' : 'mobilemoodle/core_mobile/api-auth.ts';
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/MoodleIFRN/${file}`,'utf8'),{
        compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    const auth = kind==='service' ? Object.create(context.exports.AuthService.prototype) : mm;
    return {session,local,logout:()=>kind==='service' ? auth.logout() : mm.clearToken()};
}
for (const kind of ['service','panel']) {
    test(`${kind}: logout removes current and inventoried legacy attempt flags`, () => {
        const s=setup(kind);s.logout();
        for(const key of [...active,...legacy,...otherAttempt]) assert.equal(s.session.has(key),false,key);
    });
    test(`${kind}: repeated logout preserves preferences and native/other-environment sessions`, () => {
        const s=setup(kind);s.logout();s.logout();
        for (const key of preferences) {
            assert.equal(s.session.get(key),'synthetic',key);assert.equal(s.local.get(key),'synthetic',key);
        }
    });
    test(`${kind}: account B starts without inheriting account A attempt flags`, () => {
        const s=setup(kind);s.logout();
        s.session.set('ifrn_username','SYNTHETIC_B');
        assert.equal(s.session.has(active[0]),false);assert.equal(s.session.has(active[1]),false);
        assert.equal(s.session.get('ifrn_username'),'SYNTHETIC_B');
    });
}
