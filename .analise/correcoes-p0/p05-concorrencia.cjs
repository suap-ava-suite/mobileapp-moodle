// Reutiliza as sondagens P0.4, preservando suas evidências e gravando somente um resultado P0.5 novo.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'p04-fronteiras.cjs'),'utf8');
const target=path.join(__dirname,'p05-concorrencia.json');
const scopedFs={...fs,writeFileSync:(file,data)=>{
    if(path.resolve(file)!==path.resolve(__dirname,'p04-fronteiras.json'))throw new Error('Escrita inesperada.');
    fs.writeFileSync(target,data);
}};
vm.runInNewContext(source,{__dirname,process,setTimeout,clearTimeout,setImmediate,URL,
    require:id=>id==='node:fs'?scopedFs:require(id),console:{
        log:text=>{const report=JSON.parse(text);console.log(JSON.stringify({scenarios:report.scenarios,met:report.met,notMet:report.notMet}));},
        error:()=>{console.error('Falha na sondagem sintética; detalhe omitido.');process.exitCode=1;},
    }});
