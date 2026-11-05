const fs=require('node:fs');const out=__dirname+'/android-ui.json';
const action=process.argv[2]||'state';
const safePath=String.raw`location.pathname.replace(/\/course\/\d+/g,'/course/:id').replace(/\/\d+/g,'/:id')`;
(async()=>{
 const pages=await(await fetch('http://localhost:9482/json')).json();const page=pages.find(p=>p.url.startsWith('http://localhost/'));
 if(!page)throw new Error('WebView local indisponível');
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 const expressions={
 state:`(()=>{const frame=document.querySelector('page-painel iframe');return {path:${safePath},panelCards:frame?.contentDocument?.querySelectorAll('.painel-card-link').length||0,
  nativeContents:!!document.querySelector('page-core-course-contents'),nativeModules:document.querySelectorAll('core-course-module').length,
  webviewsVisible:document.querySelectorAll('iframe').length,deviceTestOnly:true};})()`,
 open:`(async()=>{if(location.pathname!='/login/painel')return {requested:false,reason:'fora-do-painel'};
 const frame=document.querySelector('page-painel iframe');const data=frame?.contentWindow?.MobileMoodle?.App?.dashboardCache;
 const course=data?.courses?.find(c=>c.is_enrolled&&c.moodle_course_id&&c.moodle_site_url?.includes(${JSON.stringify(process.argv[3]||'academico')}));
 if(!course||!window.MoodleIfrnBridge)return {requested:false,reason:'curso-ou-bridge-indisponível'};
 const start=performance.now();await window.MoodleIfrnBridge.openCourse(course.moodle_course_id,course.name,course.moodle_site_url);
 return {requested:true,bridgeReturnedMs:Math.round(performance.now()-start),path:${safePath}};})()`,
 };
 const timer=setTimeout(()=>{ws.close();process.exitCode=1;},30000);
 try{
 const result=await new Promise(resolve=>{ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1)resolve(m.result);};ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:expressions[action],awaitPromise:true,returnByValue:true}}));});
 const value=result.result?.value||{failed:true,reason:'Runtime sem resultado'};
 const prior=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):[];prior.push({at:new Date().toISOString(),action,environment:process.argv[3]||null,...value});fs.writeFileSync(out,JSON.stringify(prior,null,2));console.log(JSON.stringify(value));
 }finally{clearTimeout(timer);ws.close();}
})().catch(e=>{console.log(JSON.stringify({failed:true,reason:e.message}));process.exitCode=1;});
