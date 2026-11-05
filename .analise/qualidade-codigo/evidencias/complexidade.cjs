const fs=require('node:fs'),{ESLint}=require('eslint'),parser=require('@typescript-eslint/parser');
(async()=>{
 const metrics=JSON.parse(fs.readFileSync(__dirname+'/metricas.json','utf8'));
 const files=metrics.files.filter(f=>f.category==='fonte-autoral'&&f.file.endsWith('.ts')&&!f.file.endsWith('.d.ts')).map(f=>f.file);
 const eslint=new ESLint({overrideConfigFile:true,fix:false,overrideConfig:[{files:['**/*.ts'],languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module'}},rules:{complexity:['warn',{max:10}]}}]});
 const result=await eslint.lintFiles(files);
 const rows=result.flatMap(f=>f.messages.filter(m=>m.ruleId==='complexity').map(m=>({file:f.filePath.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/',''),line:m.line,complexity:Number(m.message.match(/complexity of (\d+)/)?.[1]),message:m.message}))).sort((a,b)=>b.complexity-a.complexity);
 fs.writeFileSync(__dirname+'/complexidade-eslint.json',JSON.stringify({method:'ESLint complexity classic, max:10; parser TypeScript; 45 arquivos, sem fix',rows},null,2));
 console.log(JSON.stringify({files:files.length,above10:rows.length,atLeast20:rows.filter(r=>r.complexity>=20).length}));
})().catch(e=>{console.log(e.message);process.exitCode=1;});
