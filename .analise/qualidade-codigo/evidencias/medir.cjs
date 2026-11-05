// Auditoria somente leitura dos fontes; grava apenas métricas nesta pasta.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const root=process.cwd(),base='src/MoodleIFRN',out=__dirname;
const slash=p=>p.replaceAll('\\','/');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[slash(path.join(dir,e.name))]);}
const category=p=>p.includes('/static/vendor/')?'vendor':p.includes('/scss/dsgov/')?'dsgov-copiado':
 (p.includes('/docs/')||p.includes('/theme/dsgov-auditoria/'))?'documentacao-e-diagnosticos':p.includes('/tests/')?'testes':
 /mobilemoodle\.(js|css)$/.test(p)?'bundle-gerado':/\.(ts|[cm]?js|html|scss|css)$/.test(p)?'fonte-autoral':'recurso-ou-outro';
const rows=walk(base).map(p=>{const bytes=fs.statSync(p).size,kind=category(p),code=/\.(ts|[cm]?js|html|scss|css)$/.test(p);
 const text=code?fs.readFileSync(p,'utf8'):'';
 return {file:p,category:kind,bytes,lines:code?(text.match(/\n/g)||[]).length+(text.endsWith('\n')?0:1):null,
 nonblank:code?text.split(/\r?\n/).filter(l=>l.trim()).length:null};});
const aggregate=key=>Object.values(rows.reduce((r,f)=>{const k=key(f);const v=r[k]??={name:k,files:0,bytes:0,codeFiles:0,lines:0,nonblank:0};v.files++;v.bytes+=f.bytes;if(f.lines!==null){v.codeFiles++;v.lines+=f.lines;v.nonblank+=f.nonblank;}return r;},{}));
const sources=rows.filter(r=>r.category==='fonte-autoral');const functions=[],modules=[],tokens=[];
const fun=n=>ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n);
const decision=n=>ts.isIfStatement(n)||ts.isForStatement(n)||ts.isForOfStatement(n)||ts.isForInStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n)||ts.isCaseClause(n)||ts.isCatchClause(n)||ts.isConditionalExpression(n)||(ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind));
const control=n=>ts.isIfStatement(n)||ts.isForStatement(n)||ts.isForOfStatement(n)||ts.isForInStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n)||ts.isSwitchStatement(n)||ts.isTryStatement(n)||ts.isConditionalExpression(n);
for(const row of sources.filter(r=>/\.(ts|[cm]?js)$/.test(r.file))){
 const text=fs.readFileSync(row.file,'utf8'),sf=ts.createSourceFile(row.file,text,ts.ScriptTarget.Latest,true,/\.ts$/.test(row.file)?ts.ScriptKind.TS:ts.ScriptKind.JS);
 const imports=[];let logs=0;
 function visit(n){
  if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier))imports.push({module:n.moduleSpecifier.text,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,dynamic:false});
  if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))imports.push({module:n.arguments[0].text,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,dynamic:true});
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.expression.getText(sf)==='console')logs++;
  if(fun(n)&&n.body){const start=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,end=sf.getLineAndCharacterOfPosition(n.end).line+1;
   let cc=1,depth=0;
   function count(c,d){if(c!==n&&fun(c))return;if(decision(c))cc++;const next=d+(control(c)?1:0);depth=Math.max(depth,next);ts.forEachChild(c,x=>count(x,next));}
   count(n.body,0);let name=n.name?.getText(sf)||n.parent?.name?.getText?.(sf)||`<callback@${start}>`;
   functions.push({file:row.file,name,line:start,end,lines:end-start+1,ccApprox:cc,maxControlNesting:depth});
  }ts.forEachChild(n,visit);
 }visit(sf);modules.push({file:row.file,imports,uniqueDependencies:new Set(imports.map(i=>i.module)).size,consoleCalls:logs});
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,/\.ts$/.test(row.file)?ts.LanguageVariant.Standard:ts.LanguageVariant.Standard,text);
 const a=[];let k;while((k=scanner.scan())!==ts.SyntaxKind.EndOfFileToken){a.push({text:scanner.getTokenText(),line:sf.getLineAndCharacterOfPosition(scanner.getTokenPos()).line+1});}
 tokens.push({file:row.file,tokens:a});
}
// Estimativa conservadora: sequências exatas de 80 tokens, janela a cada token.
const windows=new Map();for(let fi=0;fi<tokens.length;fi++){const a=tokens[fi].tokens;for(let i=0;i+80<=a.length;i++){const h=crypto.createHash('sha256').update(a.slice(i,i+80).map(t=>t.text).join('\x00')).digest('hex');const arr=windows.get(h)||[];arr.push({fi,i});windows.set(h,arr);}}
const covered=new Map(),pairs=new Map();
for(const locations of windows.values()){
 if(new Set(locations.map(p=>p.fi)).size<2)continue;
 for(const l of locations){const s=covered.get(l.fi)||new Set();for(let j=l.i;j<l.i+80;j++)s.add(j);covered.set(l.fi,s);}
 for(let x=0;x<locations.length;x++)for(let y=x+1;y<locations.length;y++){let a=locations[x],b=locations[y];if(a.fi===b.fi)continue;if(a.fi>b.fi)[a,b]=[b,a];const key=`${a.fi}:${b.fi}:${a.i-b.i}`;const ranges=pairs.get(key)||[];ranges.push({a:a.i,b:b.i,end:a.i+80});pairs.set(key,ranges);}
}
const clones=[];for(const [key,ranges]of pairs){const[af,bf]=key.split(':').map(Number);ranges.sort((a,b)=>a.a-b.a);let curr;
 function push(){if(!curr)return;const a=tokens[af],b=tokens[bf],length=curr.end-curr.a;
  clones.push({fileA:a.file,lineA:a.tokens[curr.a].line,endLineA:a.tokens[curr.end-1].line,fileB:b.file,lineB:b.tokens[curr.b].line,endLineB:b.tokens[curr.b+length-1].line,tokens:length});}
 for(const r of ranges){if(curr&&r.a<=curr.end)curr.end=Math.max(curr.end,r.end);else{push();curr={...r};}}push();}
const styles=[];for(const row of sources.filter(r=>/\.(scss|css)$/.test(r.file))){const text=fs.readFileSync(row.file,'utf8');
 const selectors=[];const re=/([^{};]+)\{/g;let m;while((m=re.exec(text))){const selector=m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim().replace(/\s+/g,' ');if(selector&&!selector.startsWith('@'))selectors.push({selector,line:text.slice(0,m.index).split('\n').length});}
 const by=new Map();for(const s of selectors){const a=by.get(s.selector)||[];a.push(s.line);by.set(s.selector,a);}
 styles.push({file:row.file,important:(text.match(/!important\b/g)||[]).length,selectorHeaders:selectors.length,repeatedHeaders:[...by].filter(([,v])=>v.length>1).map(([selector,lines])=>({selector,lines}))});
}
const metrics={methodology:{lines:'Linhas físicas, incluindo comentários e espaços; nonblank elimina linhas vazias. Contagens de código restritas às extensões listadas; binários não têm LOC.',cyclomatic:'Aproximação AST por função, sem funções aninhadas: 1 + if/loops/case/catch/ternário/&&/||/??. Não equivale a métrica certificada de ferramenta comercial.',nesting:'Máximo de nós de controle aninhados, incluindo try e ternários; não é complexidade cognitiva Sonar.',clones:'Exatamente 80 tokens TS/JS sem trivia, passo 1, somente entre arquivos autorais; une janelas sobrepostas por deslocamento. Subestima cópia com renomeação; exclui vendor/testes/docs/gerados.',styles:'Cabeçalhos SCSS por regex; repetição em contextos diferentes não prova conflito nem ausência de uso.'},categories:aggregate(r=>r.category),directories:aggregate(r=>r.file.split('/').slice(0,3).join('/')),files:rows,functions:functions.sort((a,b)=>b.ccApprox-a.ccApprox),modules:modules.sort((a,b)=>b.uniqueDependencies-a.uniqueDependencies),styles:styles.sort((a,b)=>b.important-a.important),duplication:{tokensAnalyzed:tokens.reduce((n,f)=>n+f.tokens.length,0),tokensInRepeatedWindows:[...covered.values()].reduce((n,s)=>n+s.size,0),blocks:clones.sort((a,b)=>b.tokens-a.tokens)}};
fs.writeFileSync(path.join(out,'metricas.json'),JSON.stringify(metrics,null,2));
console.log(JSON.stringify({categories:metrics.categories,largestSources:sources.sort((a,b)=>b.lines-a.lines).slice(0,14),topFunctions:metrics.functions.slice(0,16),dependencies:metrics.modules.slice(0,8).map(({imports,...v})=>v),styles:metrics.styles.map(({repeatedHeaders,...s})=>({...s,repeatedSelectorHeaders:repeatedHeaders.length})).slice(0,12),duplication:{...metrics.duplication,blocks:metrics.duplication.blocks.slice(0,12)}},null,2));
