const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const path = require('node:path');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const git = (...args) => cp.execFileSync('git', args, {encoding: 'utf8'}).trim();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const previous = read('p07-fontes.json');
const files = [...new Set([
    ...previous.files.map(row => row.file),
    ...['09-isolamento-nativo.md','10-proposta-integracao-core.md','11-android-usb-baseline.md',
        '12-fluxo-autenticacao-suap-moodle.md','15-contratos-nativos.md','16-validacao-android-nativo.md','p08-build-harness.py','p08-android.cjs',
        'p08-evidencias.cjs'].map(file => `.analise/correcoes-p0/${file}`),
    ...fs.readdirSync('src/MoodleIFRN/tests/fixtures/p08-native').map(file => `src/MoodleIFRN/tests/fixtures/p08-native/${file}`),
    'src/MoodleIFRN/tests/fixtures/cordova-sqlite-js-port.cjs',
    'src/MoodleIFRN/tests/cordova-storage-contract.test.cjs','src/MoodleIFRN/tests/native-persistence-contract.test.cjs',
    'node_modules/@moodlehq/phonegap-plugin-push/src/android/com/adobe/phonegap/push/EncryptionHandler.kt',
    'node_modules/cordova-sqlite-storage/src/android/io/sqlc/SQLitePlugin.java',
    'node_modules/cordova-sqlite-storage/src/android/io/sqlc/SQLiteConnectorDatabase.java',
    'node_modules/cordova-sqlite-storage/src/android/io/sqlc/SQLiteAndroidDatabase.java',
])].filter(file => fs.existsSync(file)).map(file => {
    const bytes = fs.readFileSync(file);
    return {file, bytes: bytes.length, sha256: sha(bytes)};
});
const tap = fs.readFileSync(`${__dirname}/p08-final-tests.tap`, 'utf8');
const jvm = fs.readdirSync(__dirname).filter(file => /^p08-jvm-\d+\.json$/.test(file));
const androidResult = fs.existsSync(`${__dirname}/p08-android-result.json`) ? read('p08-android-result.json') : null;
const artifact = read('p08-harness-build.json');
const evidence = {branch: git('branch','--show-current'),head: git('rev-parse','HEAD'),release: git('rev-parse','release/2.0.1'),
    trackedDiff: git('diff','--name-only','HEAD'),protectedDiff: git('diff','--name-only','HEAD','--','src/core','src/addons'),
    p07FilesUnchanged: previous.files.every(row => files.find(f => f.file === row.file)?.sha256 === row.sha256),
    tests: {before: read('p08-before-tests.json').totals,after: read('p08-final-tests.json').totals,
        cordovaJsCases: (tap.match(/^# Subtest: cordova-contract:/gm)||[]).length,
        jvmWrapperCases: (tap.match(/^# Subtest: native-contract:/gm)||[]).length,
        failed: tap.split('\n').filter(line => /^not ok /.test(line)),jvmEvidence: jvm,
        jvmScenarios: jvm.map(file => ({file,passed: (read(file).commands.at(-1).stdout.match(/^PASS /gm)||[]).length}))},
    typescriptErrors: read('p08-final-typescript.json').length,
    lintUnchanged: JSON.stringify(read('p07-final-lint.json')) === JSON.stringify(read('p08-final-lint.json')),
    productionMetricsUnchanged: JSON.stringify(read('p07-final-metrics.json')) === JSON.stringify(read('p08-final-metrics.json')),
    versions: Object.fromEntries(['cordova-sqlite-storage','cordova-sqlite-storage-dependencies','cordova-android',
        '@awesome-cordova-plugins/sqlite','@moodlehq/phonegap-plugin-push','wa-sqlite'].map(name => [name,JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`)).version])),
    artifact,apkHashMatches: sha(fs.readFileSync(artifact.apk))===artifact.sha256,
    javacCleanVerification: read('p08-javac-verified.json'),
    androidInspection: read('p08-device.json'),androidExecution: androidResult,
    androidStorageTestsExecuted: Boolean(androidResult?.commands.length),
    distinction: 'JVM preferences/cipher are mocks; Cordova JS bridge uses desktop SQLite. The approved isolated harness ran seed/recover on moto g(20); this is not Moodle authentication or the full Cordova bridge.',
    files};
fs.writeFileSync(`${__dirname}/p08-fontes.json`,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({branch:evidence.branch,head:evidence.head,p07FilesUnchanged:evidence.p07FilesUnchanged,
    tests:evidence.tests,androidStorageTestsExecuted:evidence.androidStorageTestsExecuted,
    apkHashMatches:evidence.apkHashMatches,lintUnchanged:evidence.lintUnchanged}));
