const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const git = (...args) => cp.execFileSync('git', args, {encoding: 'utf8'}).trim();
const read = name => JSON.parse(fs.readFileSync(`${__dirname}/${name}`, 'utf8'));
const sha = content => crypto.createHash('sha256').update(content).digest('hex');
const sources = [
    'src/MoodleIFRN/tests/fixtures/session-persistence-adapter.cjs',
    'src/MoodleIFRN/tests/fixtures/session-sqlite-worker.cjs',
    'src/MoodleIFRN/tests/session-persistence-adapter.test.cjs',
    'src/MoodleIFRN/tests/fixtures/core-session-attempt.cjs',
    'src/MoodleIFRN/tests/session-attempt-contract.test.cjs',
    'src/core/classes/sqlitedb.ts', 'src/core/features/emulator/classes/wa-sqlite-object.ts',
    'node_modules/cordova-sqlite-storage/www/SQLitePlugin.js',
    'cordova-plugin-moodleapp/src/android/SecureStorage.java',
    'cordova-plugin-moodleapp/src/ts/plugins/SecureStorage.ts',
    'src/core/services/sites.ts', 'src/core/services/config.ts', 'src/core/services/db.ts',
    'src/core/services/database/sites.ts', 'src/core/classes/database/eager-database-table.ts',
    'src/core/classes/database/inmemory-database-table.ts',
    '.analise/correcoes-p0/13-prototipo-contrato-sessao.md',
    '.analise/correcoes-p0/14-adaptador-persistencia.md',
    '.analise/correcoes-p0/p07-evidencias.cjs',
];
const files = sources.filter(file => fs.existsSync(file)).map(file => {
    const data = fs.readFileSync(file);
    return {file, bytes: data.length, lines: data.toString('utf8').split('\n').length, sha256: sha(data)};
});
const p06 = read('p06-fontes.json');
const previous = file => p06.files.find(row => row.file === file)?.sha256;
const tap = fs.readFileSync(`${__dirname}/p07-acceptance-tests.tap`, 'utf8');
const db = new DatabaseSync(':memory:');
const sqlite = db.prepare('SELECT sqlite_version() AS version').get().version;
db.close();
const evidence = {
    branch: git('branch', '--show-current'), head: git('rev-parse', 'HEAD'),
    release: git('rev-parse', 'release/2.0.1'), trackedDiff: git('diff', '--name-only', 'HEAD'),
    protectedDiff: git('diff', '--name-only', 'HEAD', '--', 'src/core', 'src/addons'),
    platform: process.platform, node: process.version, sqlite,
    actualDesktopSQLite: true, actualCordovaSQLiteDriver: false, actualAndroidKeystore: false,
    realCoreMethodsExecuted: ['SQLiteDB.execute', 'SQLiteDB.executeBatch', 'WaSQLiteObject.sqlBatch',
        'CoreEagerDatabaseTable.getOneByPrimaryKey'],
    tests: {before: read('p07-before-tests.json').totals, after: read('p07-acceptance-tests.json').totals,
        p06Cases: (tap.match(/^# Subtest: contract:/gm) || []).length,
        adapterCases: (tap.match(/^# Subtest: persistence:/gm) || []).length,
        failed: tap.split('\n').filter(line => /^not ok /.test(line))},
    p06FilesUnchanged: files.filter(row => previous(row.file)).every(row => row.sha256 === previous(row.file)),
    lintUnchanged: JSON.stringify(read('p06-final-lint.json')) === JSON.stringify(read('p07-final-lint.json')),
    productionMetricsUnchanged: JSON.stringify(read('p06-final-metrics.json')) === JSON.stringify(read('p07-final-metrics.json')),
    typescriptErrors: read('p07-final-typescript.json').length,
    officialReferences: ['https://developer.android.com/reference/android/content/SharedPreferences.Editor',
        'https://www.sqlite.org/atomiccommit.html'], files,
};
fs.writeFileSync(`${__dirname}/p07-fontes.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({branch: evidence.branch, head: evidence.head, sqlite, tests: evidence.tests,
    p06FilesUnchanged: evidence.p06FilesUnchanged, lintUnchanged: evidence.lintUnchanged,
    productionMetricsUnchanged: evidence.productionMetricsUnchanged}));
