const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

const code = ts.transpileModule(fs.readFileSync('src/MoodleIFRN/mobilemoodle/core_mobile/oauth-profile.ts','utf8'), {
    compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 },
}).outputText;
function setup() {
    const storage = () => {
        const map = new Map(); let writes=0;
        return {getItem:key=>map.get(key) ?? null,setItem:(key,value)=>{writes++;map.set(key,value);},
            removeItem:key=>map.delete(key),get writes(){return writes;}};
    };
    const session=storage(),local=storage(),mod={exports:{}};
    let now=1000;
    vm.runInNewContext(code,{exports:mod.exports,sessionStorage:session,localStorage:local,
        Date:{now:()=>now}});
    const api=mod.exports;
    api.saveOAuthProfile({identificacao:'conta-a',nome:'Estudante'},60);
    local.setItem('ifrn_painel_dashboard',JSON.stringify({diarios:Array.from({length:1000},(_,i)=>({id:i+1}))}));
    local.setItem('ifrn_painel_owner','conta-a');
    return {api,session,local,expire:()=>now+=61000};
}

test('restaura lista persistida uma vez; leituras seguintes não regravam listas e perfil',()=>{
    const {api,session,local}=setup();
    assert.equal(api.readOAuthDashboard().diarios.length,1000);
    assert.equal(session.getItem('ifrn_painel_dashboard'),local.getItem('ifrn_painel_dashboard'));
    const writes=session.writes + local.writes;
    for(let i=0;i<100;i++) {
        assert.equal(api.readOAuthDashboard().diarios.length,1000);
        assert.equal(api.readOAuthProfile().identity,'conta-a');
    }
    assert.equal(session.writes + local.writes,writes);
});

test('otimização não dispensa checagens de expiração ou troca de conta em cada leitura',()=>{
    let s=setup(); s.api.readOAuthDashboard(); s.expire();
    assert.equal(s.api.readOAuthProfile(),null);
    assert.equal(s.api.readOAuthDashboard(),null);
    s=setup();s.api.readOAuthDashboard();s.session.setItem('ifrn_username','conta-b');
    assert.equal(s.api.readOAuthProfile(),null);
    assert.equal(s.api.readOAuthDashboard(),null);
});

test('alteração posterior no perfil ainda atualiza o snapshot usado pelo Painel',()=>{
    const {api,session}=setup();api.readOAuthDashboard();
    api.saveOAuthProfile({identificacao:'conta-a',nome:'Nome atualizado'},60);
    api.readOAuthDashboard();
    assert.equal(JSON.parse(session.getItem('ifrn_painel_profile')).nome,'Nome atualizado');
    session.setItem('ifrn_painel_owner','conta-b');
    assert.equal(api.readOAuthDashboard(),null);
});
