const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file){const module={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,AbortController,performance,console:{info(){}},setTimeout,clearTimeout,URL});return module.exports;}
const {resolveCourseSite}=load('src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts');
const {CourseOpeningAttempt}=load('src/MoodleIFRN/navigation/course-opening-attempt.ts');
(async()=>{
 const presencial='https://presencial.ava.ifrn.edu.br',academico='https://academico.ava.ifrn.edu.br';
 assert.equal(resolveCourseSite({environment:'Presencial'}),presencial);
 assert.equal(resolveCourseSite({ambiente:{titulo:'Acadêmico'}}),academico);
 assert.equal(resolveCourseSite({viewurl:presencial+'/course/view.php?id=1',environment:'Presencial'}),presencial);
 assert.equal(resolveCourseSite({moodle_site_url:academico,environment:'Presencial'}),undefined);
 assert.equal(resolveCourseSite({viewurl:'http://127.0.0.1/course/view.php?id=1',environment:'Presencial'}),undefined);
 assert.equal(resolveCourseSite({viewurl:'https://externo.invalid/course/view.php?id=1'}),undefined);
 assert.equal(resolveCourseSite({}),undefined);
 const ok=new CourseOpeningAttempt();assert.equal(await ok.stage('test',async()=>42),42);
 const deadline=new CourseOpeningAttempt();await assert.rejects(deadline.stage('test',()=>new Promise(()=>{}),5),/demorou/);assert.throws(()=>deadline.assertActive(),/cancelada/);
 const cancelled=new CourseOpeningAttempt();let resolve;const stage=cancelled.stage('test',()=>new Promise(r=>resolve=r));await Promise.resolve();cancelled.cancel();await assert.rejects(stage,/cancelada/);resolve(42);
 let called=false;await assert.rejects(cancelled.stage('test',async()=>{called=true;}),/cancelada/);assert.equal(called,false);
 const optional=new CourseOpeningAttempt();await assert.rejects(optional.stage('test',()=>new Promise(()=>{}),5,false),/demorou/);optional.assertActive();
 console.log('PASS: ambientes, conflito de origem, URL inválida, deadline, cancelamento, resultado tardio e etapa opcional. Testes locais, não testes no aparelho.');
})().catch(e=>{console.error(e);process.exitCode=1;});
