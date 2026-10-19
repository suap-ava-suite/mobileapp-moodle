const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const file='src/MoodleIFRN/services_mobile/moodle-site.service.ts';
const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const service=source.statements.find(s=>ts.isClassDeclaration(s) && s.name.text==='MoodleSiteService');
const method=service.members.find(m=>m.name?.getText(source)==='startSuapOAuthLogin');
const moduleObject={exports:{}};
const code=ts.transpileModule(`class Harness { ${method.getText(source)} }; module.exports=Harness;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:moduleObject,CourseOpeningAttempt:class {},sessionStorage:{removeItem(){}},OAUTH_PENDING_KEY:'test'});
(async()=>{
 const subject=new moduleObject.exports();let complete,calls=0;
 subject.performStartSuapOAuthLogin=options=>{calls++;return options.resumeAfterSwitch?Promise.resolve('opened'):new Promise(r=>complete=r);};
 const initial=subject.startSuapOAuthLogin();assert.equal(subject.startSuapOAuthLogin(),initial);
 const resumed=subject.startSuapOAuthLogin({resumeAfterSwitch:true});assert.equal(calls,1);
 complete('switched');assert.equal(await initial,'switched');assert.equal(await resumed,'opened');assert.equal(calls,2);
 console.log('PASS local: toque duplicado compartilha preparação; retorno após troca de site executa nova preparação sem perder OAuth. Não é login no aparelho.');
})().catch(e=>{console.error(e);process.exitCode=1;});
