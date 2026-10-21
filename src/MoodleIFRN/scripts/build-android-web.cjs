// Build the web payload for Android, including Cordova bootstrap and the local pt-br table.
// Run from the repository root. Then run cordova prepare android and Gradle assembleDebug.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const logPath = path.join(root, 'src/MoodleIFRN/docs/auditoria-fluxo-2026-10-19/course-opening-cordova-build.log');
fs.mkdirSync(path.dirname(logPath), {recursive:true});
const log = fs.openSync(logPath, 'w');
// ng run does not execute ionic:build:before. Regenerate the configuration so
// trusted sites (and other config changes) really reach the packaged app.
const buildEnvironment = { ...process.env, NODE_ENV: 'development' };
const envResult = spawnSync(process.execPath, ['node_modules/gulp/bin/gulp.js', 'env'], {
    cwd: root, env: buildEnvironment, stdio: ['ignore', log, log],
});
if (envResult.error || envResult.status !== 0) {
    fs.closeSync(log);
    console.error('Android environment generation failed; inspect ' + logPath);
    process.exit(envResult.status || 1);
}
const result = spawnSync(process.execPath, ['--max-old-space-size=8192',
    'node_modules/@angular/cli/bin/ng.js', 'run', 'app:ionic-cordova-build',
    '--platform=android', '--browser-target=app:build:development'], {
    cwd:root, env: buildEnvironment, stdio:['ignore',log,log],
});
fs.closeSync(log);
if(result.error || result.status !== 0) {
    console.error('Cordova web build failed; inspect '+logPath);
    process.exit(result.status || 1);
}
const file = path.join(root, 'src/MoodleIFRN/services_mobile/ifrn-language.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true);
let table;
for(const statement of source.statements) {
    if(!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find(d=>d.name.getText(source)==='IFRN_PT_BR');
    if(declaration?.initializer) table = JSON.parse(declaration.initializer.getText(source));
}
if(!table || Object.keys(table).length<100) throw new Error('Missing local pt-br translation table');
const www = path.join(root,'www');
const index = fs.readFileSync(path.join(www,'index.html'),'utf8');
if(!/<script[^>]+src=["']cordova\.js["']/.test(index) || !fs.existsSync(path.join(www,'cordova.js'))) {
    throw new Error('Android payload is missing the Cordova bootstrap');
}
fs.mkdirSync(path.join(www,'assets/lang'),{recursive:true});
fs.writeFileSync(path.join(www,'assets/lang/pt-br.json'),JSON.stringify(table));
console.log('Android web payload ready: Cordova bootstrap and '+Object.keys(table).length+' pt-br strings verified.');
