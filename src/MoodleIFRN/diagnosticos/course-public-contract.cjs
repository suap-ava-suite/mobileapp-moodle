const fs=require('node:fs');
(async()=>{
 const urls=[
  'https://suap-ava-suite.github.io/djangoapp-painel_ava/index.html',
  'https://suap-ava-suite.github.io/visao_geral.html',
  'https://raw.githubusercontent.com/suap-ava-suite/djangoapp-painel_ava/main/src/painel/v1/services.py',
  'https://raw.githubusercontent.com/suap-ava-suite/moodle-tool_painelava/main/externallib.php'];
 for(const url of urls){
  const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const body=await r.text();
  console.log(JSON.stringify({url,status:r.status,excerpts:body.replace(/<[^>]*>/g,' ').split('\n')
   .filter(l=>/ambiente|diarios|courseid|viewurl|OAuth|autentica|API|moodle\/|href=.*(api|arquitet)/i.test(l)).map(l=>l.trim()).filter(Boolean).slice(0,55)}));
 }
 for(const host of ['academico.ava.ifrn.edu.br','presencial.ava.ifrn.edu.br','aberto.ava.ifrn.edu.br']){
  const r=await fetch('https://'+host+'/lib/ajax/service.php?info=tool_mobile_get_public_config',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{index:0,methodname:'tool_mobile_get_public_config',args:{}}]),signal:AbortSignal.timeout(15000)});
  const p=await r.json();const d=p[0]?.data;
  console.log(JSON.stringify({host,status:r.status,error:p[0]?.error,config:d&&{wwwroot:d.wwwroot,typeoflogin:d.typeoflogin,enablemobilewebservice:d.enablemobilewebservice,launchurl:d.launchurl,identityproviders:d.identityproviders?.map(p=>({name:p.name,id:new URL(p.url).searchParams.get('id')}))}}));
 }
})().catch(e=>{console.error(e.name);process.exitCode=1});
