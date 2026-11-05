const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dir=__dirname,mode=process.argv[2];
if(mode==='tests'){
 const files=fs.readdirSync('src/MoodleIFRN/tests').filter(f=>/\.test\.(cjs|mjs)$/.test(f)).map(f=>'src/MoodleIFRN/tests/'+f);
 const args=['--test','--test-concurrency=2',...files];
 const start=Date.now();const r=cp.spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(dir,'testes.tap'),(r.stdout||'')+(r.stderr||''));
 const summary={command:'node '+args.join(' '),files:files.length,status:r.status,error:r.error?.message,elapsedMs:Date.now()-start,
  totals:(r.stdout||'').split('\n').filter(l=>/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) /.test(l))};
 fs.writeFileSync(path.join(dir,'testes.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}else if(mode==='typescript'){
 const ts=require('typescript');const config=ts.readConfigFile('tsconfig.app.json',ts.sys.readFile);
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
 const program=ts.createProgram(parsed.fileNames,{...parsed.options,noEmit:true,noUnusedLocals:true,noUnusedParameters:true});
 const unusedCodes=new Set([6133,6138,6192,6196,6198,6199]);
 const rows=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/',''),
 line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,
 code:d.code,unused:unusedCodes.has(d.code),message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
 const result={command:'TypeScript API: tsconfig.app.json + noEmit + noUnusedLocals + noUnusedParameters',total:rows.length,
  baselineErrors:rows.filter(d=>!d.unused),ifrnUnused:rows.filter(d=>d.unused&&d.file?.startsWith('src/MoodleIFRN/')),
  otherUnusedCount:rows.filter(d=>d.unused&&!d.file?.startsWith('src/MoodleIFRN/')).length};
 fs.writeFileSync(path.join(dir,'typescript.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}else if(mode==='lint'){
 (async()=>{const {ESLint}=require('eslint');const m=JSON.parse(fs.readFileSync(path.join(dir,'metricas.json'),'utf8'));
 const files=m.files.filter(f=>f.category==='fonte-autoral'&&f.file.endsWith('.ts')&&!f.file.endsWith('.d.ts')).map(f=>f.file);
 const eslint=new ESLint({fix:false});const result=await eslint.lintFiles(files);
 // Mensagens/locais somente; sem copiar arquivos inteiros para o relatório.
 const clean=result.map(({filePath,messages,errorCount,warningCount})=>({file:filePath.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/',''),messages,errorCount,warningCount}));
 fs.writeFileSync(path.join(dir,'eslint.json'),JSON.stringify(clean,null,2));
 const rules={};for(const f of clean)for(const m of f.messages)rules[m.ruleId||'parser']=(rules[m.ruleId||'parser']||0)+1;
 console.log(JSON.stringify({files:files.length,errors:clean.reduce((n,f)=>n+f.errorCount,0),warnings:clean.reduce((n,f)=>n+f.warningCount,0),rules}));
 })().catch(e=>{fs.writeFileSync(path.join(dir,'eslint-falha.txt'),e.stack);console.log(e.message);process.exitCode=1;});
}
