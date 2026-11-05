const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const files=['src/MoodleIFRN/patch-moodle-ifrn.js','src/core/services/urlschemes.ts','src/core/services/sites.ts',
    'src/core/services/navigator.ts','src/core/static/sso.ts','src/core/features/login/services/login-helper.ts',
    'src/core/initializers/initialize-urlscheme.ts'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const report={at:new Date().toISOString(),branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
    head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    sourceChanges:cp.execFileSync('git',['diff','--name-only','5f88fd805','--','src'],{encoding:'utf8'}).trim(),
    files:files.map(file=>{const data=fs.readFileSync(file);return {file,sha256:hash(data),sha256Lf:hash(data.toString('utf8').replaceAll('\r\n','\n'))};})};
fs.writeFileSync(path.join(__dirname,'p05-fontes.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({branch:report.branch,head:report.head,sourceChanges:report.sourceChanges,files:report.files.length}));
