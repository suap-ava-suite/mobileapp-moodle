const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const dir=__dirname;const source=p=>fs.readFileSync(p,'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
const storage=()=>{const map=new Map();let writes=0;return{getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes++;map.set(k,v);},removeItem:k=>map.delete(k),get writes(){return writes;}};};
const ss=storage(),ls=storage();const mod={exports:{}};
vm.runInNewContext(compile(source('src/MoodleIFRN/mobilemoodle/core_mobile/oauth-profile.ts')),{exports:mod.exports,sessionStorage:ss,localStorage:ls});
const oauth=mod.exports;oauth.saveOAuthProfile({identificacao:'conta-sintetica',nome_usual:'Nome sintético',_profile_origin:'https://ava.ifrn.edu.br'},600);
const refresh={exports:{}};vm.runInNewContext(compile(source('src/MoodleIFRN/mobilemoodle/core_mobile/profile-refresh.ts')),{exports:refresh.exports,require:()=>oauth,sessionStorage:ss,localStorage:ls,URL});
const payload={id:1,matricula:'conta-sintetica',nome_usual:'Nome sintético'};
refresh.exports.refreshSavedProfileNames(payload,'https://ava.ifrn.edu.br/api/v2/usuario/info/','https://ava.ifrn.edu.br');
const writes=ss.writes+ls.writes;let requestedReloads=0;
for(let i=0;i<20;i++)if(refresh.exports.refreshSavedProfileNames(payload,'https://ava.ifrn.edu.br/api/v2/usuario/info/','https://ava.ifrn.edu.br'))requestedReloads++;
const profile={repeatedResponses:20,storageWrites:ss.writes+ls.writes-writes,requestedReloads};

// Executa o corpo real de logout sem injetar clientes HTTP/DI nem acessar o aparelho.
const file='src/MoodleIFRN/services_mobile/auth.service.ts',sf=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true);
let logout;ts.forEachChild(sf,n=>{if(ts.isClassDeclaration(n)&&n.name?.text==='AuthService')logout=n.members.find(m=>m.name?.getText(sf)==='logout');});
const logoutContext={sessionStorage:ss,localStorage:ls,OAUTH_PROFILE_KEY:oauth.OAUTH_PROFILE_KEY,TOKEN_KEY:'ifrn_access_token',REFRESH_KEY:'ifrn_refresh_token',USERNAME_KEY:'ifrn_username'};
vm.runInNewContext(compile(`class Audit {${logout.getText(sf)}};globalThis.run=()=>new Audit().logout();`),logoutContext);
ss.setItem('ifrn_moodle_oauth_pending','1');ss.setItem('ifrn_moodle_resume_oauth','sintético');
logoutContext.run();const afterLogout={oauthPendingRemains:ss.getItem('ifrn_moodle_oauth_pending')!==null,resumePendingRemains:ss.getItem('ifrn_moodle_resume_oauth')!==null};
const siteSource=ts.createSourceFile('site.ts',source('src/MoodleIFRN/services_mobile/moodle-site.service.ts'),ts.ScriptTarget.Latest,true);
const sanitizer=siteSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='sanitizeUrlForLog');
const sanitizerContext={URL};vm.runInNewContext(compile(sanitizer.getText(siteSource)+';globalThis.sanitize=sanitizeUrlForLog;'),sanitizerContext);
const safeLog={
 nativeCallbackRedacted:!JSON.stringify(sanitizerContext.sanitize('moodlemobile://token=VALOR_SINTETICO')).includes('VALOR_SINTETICO'),
 wrappedHttpCallbackRedacted:!JSON.stringify(sanitizerContext.sanitize('http://moodlemobile//token=VALOR_SINTETICO')).includes('VALOR_SINTETICO'),
 scope:'Somente valor sintético; não comprova emissão real de credenciais em logs.'
};

(async()=>{
 const exports={};vm.runInNewContext(compile(source('src/MoodleIFRN/services_mobile/course-sso-browser.ts')),{exports,URL,setTimeout,clearTimeout});
 const listeners=new Map();let closed=false;
 const browser={on:event=>({subscribe:cb=>{listeners.set(event,cb);return{unsubscribe:()=>listeners.delete(event)};}}),close:()=>closed=true,executeScript:async()=>[],_loadAfterBeforeload(){}};
 const flow=exports.startCourseSsoBrowser({siteUrl:'https://presencial.ava.ifrn.edu.br',loginUrl:'https://presencial.ava.ifrn.edu.br/auth/suap/login.php',open:()=>browser,isToken:u=>u==='moodlemobile://token=sintetico',acceptToken:()=>new Promise(()=>{}),timeoutMs:5});
 let settled=false;flow.completion.then(()=>settled=true,()=>settled=true);
 listeners.get('beforeload')({url:'moodlemobile://token=sintetico'});
 await new Promise(r=>setTimeout(r,30));flow.cancel();await new Promise(r=>setTimeout(r,10));
 const callback={timeoutMs:5,observedAfterMs:40,browserClosed:closed,completionSettledAfterTimeoutAndCancel:settled};
 const result={scope:'Provas isoladas com dados sintéticos; sem tráfego HTTP ou sessão real.',profile,afterLogout,callback,safeLog};
 fs.writeFileSync(dir+'/provas-isoladas.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})();
