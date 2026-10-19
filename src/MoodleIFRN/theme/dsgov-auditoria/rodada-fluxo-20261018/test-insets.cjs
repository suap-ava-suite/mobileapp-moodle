const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
const filename='src/MoodleIFRN/mobilemoodle/core_mobile/app-keyboard.ts';
function run(source,top){
 const values={};const parent={document:{documentElement:{}},getComputedStyle:()=>({getPropertyValue:key=>key.endsWith('top')?`${top}px`:'0px'})};
 const window={parent,cordova:undefined};const document={documentElement:{style:{setProperty:(k,v)=>values[k]=v}}};
 const module={exports:{}};const js=ts.transpileModule(source+'\nexport {resolveFallbackInsets,setSafeAreaVars};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{window,document,module,exports:module.exports,navigator:{userAgent:'Android'},console,setTimeout,clearTimeout});
 const insets=module.exports.resolveFallbackInsets();module.exports.setSafeAreaVars(insets);return {insets,values};
}
const original=execFileSync('git',['show','HEAD:'+filename],{encoding:'utf8'});
const current=fs.readFileSync(filename,'utf8');
assert.equal(run(original,28.57).insets.top,0);
assert.equal(run(current,28.57).insets.top,28.57);
assert.equal(run(current,28.57).values['--ion-safe-area-top'],'28.57px');
assert.equal(run(current,0).insets.top,0);
console.log('PASS local: antes o iframe sobrescrevia 28,57px com zero; depois mantém inset do host, precisão e zero legítimo em paisagem. Não é reprodução visual no aparelho.');
