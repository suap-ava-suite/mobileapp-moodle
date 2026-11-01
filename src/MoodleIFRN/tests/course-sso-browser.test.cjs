const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const js = ts.transpileModule(fs.readFileSync('src/MoodleIFRN/services_mobile/course-sso-browser.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(js, { exports: mod.exports, URL, setTimeout, clearTimeout });
const { startCourseSsoBrowser } = mod.exports;
function setup(overrides = {}) {
    const events = new Map(); const resumed = []; const accepted = [];
    let closed = 0; let inspected = {}; let scripts = 0;
    const browser = {
        on: name => ({subscribe: callback => {
            events.set(name, callback);
            return {unsubscribe: () => events.delete(name)};
        }}),
        close: () => closed++, _loadAfterBeforeload: url => resumed.push(url),
        executeScript: async () => { scripts++; return [JSON.stringify(inspected)]; },
    };
    const flow = startCourseSsoBrowser({
        siteUrl: 'https://presencial.ava.ifrn.edu.br',
        loginUrl: 'https://presencial.ava.ifrn.edu.br/admin/tool/mobile/launch.php?passport=42&oauthsso=1',
        open: () => browser, isToken: url => url.startsWith('moodlemobile://token='),
        acceptToken: async url => accepted.push(url), ...overrides,
    });
    return {...flow, accepted, resumed, get closed() {return closed;}, get scripts() {return scripts;},
        state: value => inspected = value, emit: (name, url) => events.get(name)?.({url}),
        get subscriptions() {return events.size;}};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('retoma launch do curso ao receber retorno para raiz oficial do Painel, uma única vez', async () => {
    const s=setup();
    s.emit('beforeload','https://ava.ifrn.edu.br/');
    assert.equal(s.resumed.length,1);
    assert.match(s.resumed[0], /^https:\/\/presencial\.ava\.ifrn\.edu\.br\/admin\/tool\/mobile\/launch\.php/);
    s.emit('beforeload','https://ava.ifrn.edu.br/');
    await assert.rejects(s.completion,/não autorizado/);
    assert.equal(s.resumed.length,1);
});

test('não navega por páginas arbitrárias do Painel como fallback do curso', async () => {
    for (const url of ['https://ava.ifrn.edu.br/qualquer','http://ava.ifrn.edu.br/',
        'https://ava.ifrn.edu.br/?next=outro']) {
        const s=setup();s.emit('beforeload',url);
        await assert.rejects(s.completion,/não autorizado/);
        assert.equal(s.resumed.length,0);
    }
});

test('interrompe ciclo mesmo com novos parâmetros OAuth sem limpar sessões', async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) {
        s.emit('beforeload', 'https://suap.ifrn.edu.br/o/authorize/?state=' + i);
    }
    await assert.rejects(s.completion, /ciclo de autenticação/);
    assert.equal(s.resumed.length, 4);
    assert.equal(s.closed, 1);
    assert.equal(s.subscriptions, 0);
});
test('segue redirects HTTPS preservando parâmetros; callback oficial é consumido uma vez', async () => {
    const s = setup();
    const authorize = 'https://suap.ifrn.edu.br/o/authorize/?client_id=ava&state=original';
    s.emit('beforeload', authorize); assert.deepEqual(s.resumed,[authorize]);
    s.emit('beforeload','moodlemobile://token=callback');
    s.emit('loaderror','moodlemobile://token=callback');
    await s.completion;
    assert.deepEqual(s.accepted,['moodlemobile://token=callback']);
    assert.equal(s.closed,1); assert.equal(s.subscriptions,0);
});
test('página iOS pode retornar o link launchapp sem abrir outro aplicativo', async () => {
    const s=setup(); s.state({callback:'moodlemobile://token=ios'});
    s.emit('loadstop','https://presencial.ava.ifrn.edu.br/admin/tool/mobile/launch.php');
    await s.completion; assert.deepEqual(s.accepted,['moodlemobile://token=ios']);
});
test('normaliza callback envolvido em HTTP sem fazer requisição com o token', async () => {
    for (const url of ['http://moodlemobile//token=wrapped','https://moodlemobile://token=wrapped']) {
        const s=setup(); s.emit('beforeload',url); await s.completion;
        assert.deepEqual(s.accepted,['moodlemobile://token=wrapped']);
        assert.equal(s.resumed.length,0);
    }
});
test('formulário de senha exige renovar o login principal, sem mostrar segunda autenticação', async () => {
    const s=setup(); s.state({login:true});
    s.emit('loadstop','https://suap.ifrn.edu.br/accounts/login/');
    await assert.rejects(s.completion,/login principal/);
    assert.equal(s.closed,1); assert.equal(s.accepted.length,0);
});
test('consentimento pendente não é aceito automaticamente', async () => {
    const s=setup(); s.state({consent:true}); s.emit('loadstop','https://suap.ifrn.edu.br/o/authorize/');
    await assert.rejects(s.completion,/liberação institucional/);
});
test('esquemas externos, HTTP e domínios com prefixo parecido são recusados', async () => {
    for(const url of ['intent://login','https://suap.ifrn.edu.br.evil.invalid/',
        'http://suap.ifrn.edu.br/','https://outro.ava.ifrn.edu.br/']) {
        const s=setup(); s.emit('beforeload',url);
        await assert.rejects(s.completion,/não autorizado/);
        assert.equal(s.resumed.length,0); assert.equal(s.accepted.length,0);
    }
});
test('cancelamento, timeout e rede fecham a janela e liberam listeners', async () => {
    let s=setup(); s.cancel(); await assert.rejects(s.completion,/cancelada/); assert.equal(s.subscriptions,0);
    s=setup({timeoutMs:5}); await assert.rejects(s.completion,/demorou/); assert.equal(s.closed,1);
    s=setup(); s.emit('loaderror','https://suap.ifrn.edu.br/');
    await assert.rejects(s.completion,/conexão/); assert.equal(s.subscriptions,0);
});
test('retoma launch perdido na página inicial uma vez; nunca fica em loop', async () => {
    const s=setup(); s.state({loggedIn:true});
    s.emit('loadstop','https://presencial.ava.ifrn.edu.br/'); await tick();
    assert.equal(s.scripts,2);
    s.emit('loadstop','https://presencial.ava.ifrn.edu.br/'); await tick();
    assert.equal(s.scripts,3);
    s.cancel(); await assert.rejects(s.completion,/cancelada/);
});
test('callback rejeitado pelo núcleo não cria conexão válida', async () => {
    const s=setup({acceptToken:async () => {throw new Error('invalid passport');}});
    s.emit('customscheme','moodlemobile://token=bad');
    await assert.rejects(s.completion,/validar/); assert.equal(s.closed,1);
});

test('timeout also bounds a callback validation that never finishes', async () => {
    const s=setup({timeoutMs:10,acceptToken:()=>new Promise(()=>{})});
    const outcome=s.completion.then(()=> 'resolved',e=>e.message);
    s.emit('customscheme','moodlemobile://token=synthetic');
    const result=await Promise.race([outcome,new Promise(r=>setTimeout(()=>r('still-pending'),60))]);
    s.cancel();
    assert.match(result,/demorou/);assert.equal(s.closed,1);assert.equal(s.subscriptions,0);
});
test('cancel during validation wins over a late resolve or reject and closes exactly once', async () => {
    for(const rejectLate of [false,true]) {
        let resolve,reject,guard;
        const accepted=new Promise((ok,no)=>{resolve=ok;reject=no;});
        const s=setup({timeoutMs:100,acceptToken:(_url,attempt)=>{guard=attempt;return accepted;}});
        const outcome=s.completion.then(()=> 'resolved',e=>e.message);
        s.emit('customscheme','moodlemobile://token=synthetic');
        await tick();
        s.cancel();s.cancel();
        if(rejectLate) reject(new Error('synthetic'));else resolve();
        assert.match(await outcome,/cancelada/);
        assert.throws(()=>guard.assertActive(),/cancelada|expirou/);
        assert.equal(s.closed,1);assert.equal(s.subscriptions,0);
    }
});
test('validation guard allows success but refuses mutations after a deadline', async () => {
    let guard,finish;
    const s=setup({timeoutMs:10,acceptToken:(_url,attempt)=>{guard=attempt;return new Promise(r=>finish=r);}});
    const outcome=s.completion.catch(e=>e.message);
    s.emit('customscheme','moodlemobile://token=synthetic');
    const result=await Promise.race([outcome,new Promise(r=>setTimeout(()=>r('still-pending'),60))]);
    finish();await tick();
    assert.match(result,/demorou/);assert.throws(()=>guard.assertActive());assert.equal(s.closed,1);
});
test('synchronous callback exceptions become a rejected completion and release resources', async () => {
    const s=setup({timeoutMs:20,acceptToken:()=>{throw new Error('synthetic');}});
    const result=s.completion.catch(e=>e.message);
    assert.doesNotThrow(()=>s.emit('customscheme','moodlemobile://token=synthetic'));
    assert.match(await result,/validar/);assert.equal(s.closed,1);
});
