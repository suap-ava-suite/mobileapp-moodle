const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
const file='src/MoodleIFRN/moodle-open-course/moodle-open-course.ts';const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const cls=source.statements.find(s=>ts.isClassDeclaration(s));const methods=['ionViewWillEnter','tryOpenOrPromptConnect','cancelOpening'].map(name=>cls.members.find(m=>m.name?.getText(source)===name).getText(source)).join('\n');
let params={courseId:1,siteUrl:'https://academico.ava.ifrn.edu.br'};
const moduleObject={exports:{}};const code=ts.transpileModule(`class Harness {entryVersion=0;loading=false;${methods}};module.exports=Harness;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:moduleObject,CorePlatform:{ready:async()=>{}},CoreNavigator:{getRouteNumberParam:()=>params.courseId,getRouteParam:key=>params[key],getRouteBooleanParam:()=>false,navigate:async()=>{}},resolveMoodleSiteUrl:x=>x,console:{log(){},error(){}}});
function service(){return {ensureLoginObserver(){},showNativeCourseHandoff(){},hideNativeCourseHandoff(){},getPendingOpenCourse:()=>params,hasPresencialSession:()=>true,hasMatchingPresencialSession:()=>true,isIdentityMismatchPending:()=>false,shouldResumeOAuthAfterSiteSwitch:()=>false,resumePendingOAuthCourse:async()=>false,dismissCourseRecovery(){},setIdentityMismatchPending(){},lastError:''};}
(async()=>{
 const c=new moduleObject.exports();c.moodleSite=service();const seen=[];c.tryOpenOrPromptConnect=async()=>seen.push(c.moodleSiteUrl);
 await c.ionViewWillEnter();params={courseId:2,siteUrl:'https://presencial.ava.ifrn.edu.br'};await c.ionViewWillEnter();c.cancelOpening();params={courseId:1,siteUrl:'https://academico.ava.ifrn.edu.br'};await c.ionViewWillEnter();
 assert.deepEqual(seen,['https://academico.ava.ifrn.edu.br','https://presencial.ava.ifrn.edu.br','https://academico.ava.ifrn.edu.br']);
 const pending=new moduleObject.exports();pending.moodleSite=service();pending.courseId=1;let complete,oauth=0;pending.moodleSite.ensureSessionAndOpenCourse=()=>new Promise(r=>complete=r);pending.startOAuthFlow=async()=>oauth++;
 const old=pending.tryOpenOrPromptConnect();pending.cancelOpening();complete('need-connect');await old;assert.equal(oauth,0);assert.equal(pending.loading,false);
 console.log('PASS local: ponte em cache relê Acadêmico → Presencial → Acadêmico; resultado cancelado não inicia outro OAuth. Não substitui o teste de reentrada no aparelho.');
})().catch(e=>{console.error(e);process.exitCode=1;});
