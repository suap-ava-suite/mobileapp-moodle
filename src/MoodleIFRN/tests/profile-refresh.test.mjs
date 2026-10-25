import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import vm from 'node:vm';

const code = buildSync({entryPoints:['src/MoodleIFRN/mobilemoodle/core_mobile/profile-refresh.ts'], bundle:true,
    write:false, platform:'node', format:'cjs'}).outputFiles[0].text;
const origin = 'https://ava.ifrn.edu.br';
const key = 'ifrn_suap_oauth_profile_v1';
function setup(profileOrigin = origin) {
    const storage = () => {
        const map = new Map();
        return {getItem:k=>map.get(k) ?? null, setItem:(k,v)=>map.set(k,v), removeItem:k=>map.delete(k)};
    };
    const sessionStorage=storage(), localStorage=storage();
    const old={profile:{identificacao:'123',nome_usual:'Nome antigo',nome_exibicao:'Nome antigo',
        foto:'https://suap.ifrn.edu.br/photo',campus:{sigla:'CNAT'},_profile_origin:profileOrigin},
    identity:'123',expiresAt:Date.now()+60000};
    for (const s of [sessionStorage,localStorage]) {
        s.setItem(key,JSON.stringify(old)); s.setItem('ifrn_username','123');
        s.setItem('ifrn_painel_dashboard',JSON.stringify({diarios:[{id:99}]}));
    }
    const context={module:{exports:{}},URL,sessionStorage,localStorage};
    vm.runInNewContext(code,context);
    return {update:context.module.exports.refreshSavedProfileNames,sessionStorage,localStorage,old};
}
test('resposta válida atualiza ambos os snapshots, preservando foto, perfil, listas e prazo',()=>{
    const {update,sessionStorage,localStorage,old}=setup();
    assert.equal(update({id:7,matricula:'123',nome_usual:'Nome correto'},origin+'/api/v2/usuario/info/',origin),true);
    for (const s of [sessionStorage,localStorage]) {
        const p=JSON.parse(s.getItem(key));
        assert.equal(p.profile.nome_usual,'Nome correto');
        assert.equal(p.profile.nome_exibicao,undefined);
        assert.equal(p.profile.foto,old.profile.foto);
        assert.deepEqual(p.profile.campus,old.profile.campus);
        assert.equal(p.expiresAt,old.expiresAt);
        assert.equal(JSON.parse(s.getItem('ifrn_painel_profile')).nome_usual,'Nome correto');
        assert.deepEqual(JSON.parse(s.getItem('ifrn_painel_dashboard')),{diarios:[{id:99}]});
    }
});
test('não mistura contas, identidades conflitantes, respostas anônimas ou domínios',()=>{
    const {update,localStorage}=setup();
    const before=localStorage.getItem(key);
    for (const p of [{id:7,matricula:'456',nome_usual:'Outra conta'},
        {id:7,matricula:'123',identificacao:'456',nome_usual:'Conflito'},
        {id:0,matricula:'123',nome_usual:'Anônimo'}]) {
        assert.equal(update(p,origin+'/api/v2/usuario/info/',origin),false);
    }
    assert.equal(update({id:7,matricula:'123',nome_usual:'Outro ambiente'},
        'https://painel.ead.ifrn.edu.br/api/v2/usuario/info/',origin),false);
    assert.equal(localStorage.getItem(key),before);
    const other=setup('https://painel.ead.ifrn.edu.br');
    assert.equal(other.update({id:7,matricula:'123',nome_usual:'Nome'},origin+'/api/v2/usuario/info/',origin,true),false);
});
test('migração de snapshot legado exige autorização explícita da origem e mantém expiração',()=>{
    const {update,localStorage,sessionStorage,old}=setup(null);
    const p={id:7,matricula:'123',nome_usual:'Nome atualizado'};
    assert.equal(update(p,origin+'/api/v2/usuario/info/',origin),false);
    assert.equal(update(p,origin+'/api/v2/usuario/info/',origin,true),true);
    assert.equal(JSON.parse(localStorage.getItem(key)).expiresAt,old.expiresAt);
    const expired={...old,expiresAt:Date.now()-1};
    localStorage.setItem(key,JSON.stringify(expired));
    sessionStorage.setItem(key,JSON.stringify(expired));
    assert.equal(update(p,origin+'/api/v2/usuario/info/',origin,true),false);
});
