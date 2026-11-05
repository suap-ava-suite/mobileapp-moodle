const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const dir=__dirname,m=JSON.parse(fs.readFileSync(path.join(dir,'metricas.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const code=m.files.filter(f=>f.lines!==null&&!['vendor','bundle-gerado'].includes(f.category));
const groups=new Map();for(const f of code){const h=hash(fs.readFileSync(f.file));const a=groups.get(h)||[];a.push({file:f.file,bytes:f.bytes,lines:f.lines,category:f.category});groups.set(h,a);}
const exactFiles=[...groups.values()].filter(a=>a.length>1);
const panel='src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss';
const postcss=require('postcss'),ast=postcss.parse(fs.readFileSync(panel,'utf8'),{from:panel});
const ruleGroups=new Map();ast.walkRules(rule=>{
 const declarations=rule.nodes?.filter(n=>n.type==='decl').map(d=>`${d.prop}:${d.value}${d.important?'!important':''}`)||[];
 if(!declarations.length)return;
 let contexts=[];for(let p=rule.parent;p&&p.type!=='root';p=p.parent)if(p.type==='atrule')contexts.unshift('@'+p.name+' '+p.params);
 const k=JSON.stringify([contexts,rule.selector,declarations]);const a=ruleGroups.get(k)||[];
 a.push({selector:rule.selector,line:rule.source.start.line,end:rule.source.end.line,contexts,bytes:Buffer.byteLength(rule.toString()),declarations:declarations.length});ruleGroups.set(k,a);
});
const exactRules=[...ruleGroups.values()].filter(a=>a.length>1);
const arts=['src/MoodleIFRN/mobilemoodle/mobilemoodle.js','src/MoodleIFRN/mobilemoodle/mobilemoodle.css','platforms/android/app/build/outputs/apk/debug/app-debug.apk'];
const artifacts=arts.filter(f=>fs.existsSync(f)).map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:hash(b),mtime:fs.statSync(file).mtime.toISOString(),gzipBytes:/\.(js|css)$/.test(file)?zlib.gzipSync(b).length:null};});
function walk(p){return fs.existsSync(p)?fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]):[];}
const web=walk('www').map(f=>({file:f.replaceAll('\\','/'),bytes:fs.statSync(f).size}));
const webSummary={files:web.length,bytes:web.reduce((n,f)=>n+f.bytes,0),jsBytes:web.filter(f=>f.file.endsWith('.js')).reduce((n,f)=>n+f.bytes,0),cssBytes:web.filter(f=>f.file.endsWith('.css')).reduce((n,f)=>n+f.bytes,0),sourceMapBytes:web.filter(f=>f.file.endsWith('.map')).reduce((n,f)=>n+f.bytes,0),largest:web.sort((a,b)=>b.bytes-a.bytes).slice(0,12)};
const importsByFile=m.modules;const coupling={};for(const f of importsByFile)for(const imp of f.imports){
 let dep=imp.module.replace(/^@\/MoodleIFRN\//,'src/MoodleIFRN/');if(dep.startsWith('.'))dep=path.posix.normalize(path.posix.join(path.posix.dirname(f.file),dep));
 if(!dep.startsWith('src/MoodleIFRN/'))continue;const a=coupling[dep]||new Set();a.add(f.file);coupling[dep]=a;
}
const result={exactFiles,exactRules,exactRuleDuplicateBytes:exactRules.reduce((n,a)=>n+a.slice(1).reduce((s,r)=>s+r.bytes,0),0),artifacts,webSummary,incomingCoupling:Object.entries(coupling).map(([module,refs])=>({module,count:refs.size,referencedBy:[...refs]})).sort((a,b)=>b.count-a.count)};
fs.writeFileSync(path.join(dir,'artefatos-estilos.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,incomingCoupling:result.incomingCoupling.slice(0,10)},null,2));
