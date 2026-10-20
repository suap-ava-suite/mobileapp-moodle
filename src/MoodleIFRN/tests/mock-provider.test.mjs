import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
const bundle = (entry, mock = true) => buildSync({ entryPoints: [entry], bundle: true, write: false, format: 'iife', globalName: 'subject',
    }).outputFiles[0].text.replace("provider: \"official\"", `provider: "${mock ? 'mock' : 'official'}"`);
function context(code, extra = {}) {
    const values = new Map();
    const storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
    const c = vm.createContext({ URL, console: { info() {} }, AbortController, setTimeout, clearTimeout, sessionStorage: storage, ...extra });
    vm.runInContext(code,c);
    return c;
}
test('mock requests only port 8000, rotates once and clears session at logout', async () => {
    const calls=[];
    let n=0;
    const c=context(bundle('src/MoodleIFRN/services_mobile/mock-api.ts'), { fetch: async (url, options) => {
        calls.push([String(url), options]);
        const path=url.pathname;
        if(path==='/auth/login' || path==='/auth/refresh') return new Response(JSON.stringify({access_token:'test-'+(++n),refresh_token:'refresh-'+n,token_type:'bearer'}), {headers:{'content-type':'application/json'}});
        if(path==='/auth/logout') return new Response(null,{status:204});
        if(n===1) return new Response(null,{status:401});
        return new Response('{}',{headers:{'content-type':'application/json'}});
    }});
    const api=new c.subject.MockApi();
    await api.login('demo','test');
    await Promise.all([api.get('/api/v1/me'),api.get('/api/v1/dashboard')]);
    assert.equal(calls.filter(([url])=>url.endsWith('/auth/refresh')).length,1);
    await assert.rejects(api.get('https://ead.ava.ifrn.edu.br/api'), /Destino/);
    await api.logout();
    assert.equal(api.authenticated,false);
    assert.ok(calls.every(([url,options])=>new URL(url).origin==='http://127.0.0.1:8000' && options.credentials==='omit'));
    assert.notEqual(c.subject.courseKey('mock','a',1),c.subject.courseKey('mock','b',1));
});
test('official build cannot issue mock requests; JSON login HTML rejected', async () => {
    const official=context(bundle('src/MoodleIFRN/services_mobile/mock-api.ts',false), {fetch:()=>{throw Error('must not call');}});
    await assert.rejects(new official.subject.MockApi().login('demo','test'),/desativada/);
    const mock=context(bundle('src/MoodleIFRN/services_mobile/mock-api.ts'), {fetch:async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}})});
    await assert.rejects(new mock.subject.MockApi().login('demo','test'),/JSON/);
});
test('native resolver requires explicit official URL; equal IDs keep origins', () => {
    const c=context(bundle('src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts'));
    assert.equal(c.subject.resolveCourseSite({moodle:'Presencial'}),undefined);
    assert.equal(c.subject.resolveCourseSite({viewurl:'http://localhost:8000/course/1'}),undefined);
    const a=c.subject.resolveCourseSite({viewurl:'https://academico.ava.ifrn.edu.br/course/view.php?id=1'});
    const b=c.subject.resolveCourseSite({viewurl:'https://ead.ava.ifrn.edu.br/course/view.php?id=1'});
    assert.notEqual(a,b);
});

test('iframe adapts mock without official identity, host or network', async () => {
    const courses=[{id:1,name:'Curso demo',source:'mock',environment:'demo'}];
    const c=context(bundle('src/MoodleIFRN/mobilemoodle/core_mobile/mock-provider.ts'), {
        window:{parent:{MoodleIfrnBridge:{mockDashboard:async()=>({source:'mock',user:{username:'demo',nome:'Demo'},
            courses,diarios:courses,coordenacoes:[],praticas:[],reutilizaveis:[],autoinscricoes:[]})}}},
        fetch:()=>{throw Error('iframe must not request upstream');},
    });
    const data=await c.subject.mockDashboard();
    assert.equal(data.source,'mock');
    assert.equal(data.foto_url,undefined);
    assert.equal(data.courses[0].moodle_course_id,undefined);
    assert.equal(data.courses[0].moodle_site_url,undefined);
    assert.equal(data.courses[0].launch.kind,'mock');
});
