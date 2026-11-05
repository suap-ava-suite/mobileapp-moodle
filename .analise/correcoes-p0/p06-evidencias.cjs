// Read-only inventory of source/Git; writes only the P0.6 evidence JSON next to this script.
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('typescript');
const git = (...args) => cp.execFileSync('git', args, {encoding: 'utf8'}).trim();
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const files = [
    ...['09-isolamento-nativo.md', '10-proposta-integracao-core.md', '11-android-usb-baseline.md',
        '12-fluxo-autenticacao-suap-moodle.md'].map(file => `.analise/correcoes-p0/${file}`),
    'src/MoodleIFRN/tests/fixtures/core-session-attempt.cjs',
    'src/MoodleIFRN/tests/session-attempt-contract.test.cjs',
    '.analise/correcoes-p0/13-prototipo-contrato-sessao.md',
    '.analise/correcoes-p0/p06-evidencias.cjs',
    'src/core/services/urlschemes.ts', 'src/core/services/sites.ts',
    'src/core/features/login/services/login-helper.ts', 'src/core/services/navigator.ts',
    'src/core/static/sso.ts', 'src/core/initializers/initialize-urlscheme.ts',
    'src/core/initializers/prepare-inapp-browser.ts', 'src/MoodleIFRN/patch-moodle-ifrn.js',
];
const methodNames = new Set(['handleCustomURL', 'createSiteIfNeeded', 'getCustomURLTokenData',
    'newSite', 'addSite', 'login', 'loadSite', 'storeTokensInSecureStorage', 'loadSiteTokens',
    'prepareForSSOLogin', 'validateBrowserSSOLogin', 'navigate', 'navigateToSiteHome', 'navigateToSitePath']);
const rows = files.filter(file => fs.existsSync(file)).map(file => {
    const bytes = fs.readFileSync(file), content = bytes.toString('utf8');
    const row = {file, bytes: bytes.length, lines: content.split('\n').length, sha256: digest(bytes)};
    if (!file.startsWith('src/core/') || !file.endsWith('.ts')) return row;
    const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    row.methods = [];
    function visit(node) {
        if (ts.isMethodDeclaration(node) && methodNames.has(node.name.getText(ast))) {
            row.methods.push({name: node.name.getText(ast),
                line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
                parameters: node.parameters.map(p => p.getText(ast)), sha256: digest(node.getText(ast))});
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    return row;
});
const summary = {
    branch: git('branch', '--show-current'), head: git('rev-parse', 'HEAD'),
    release: git('rev-parse', 'release/2.0.1'),
    trackedChanges: git('diff', '--name-only', 'HEAD'),
    protectedChanges: git('diff', '--name-only', 'HEAD', '--', 'src/core', 'src/addons'),
    prototype: {testCases: 53, writeSchedules: 80, cancellationCommitSchedules: 12,
        realDatabase: false, realSecureStorage: false, realRouter: false, realPassportMethod: true},
    files: rows,
};
const readEvidence = file => JSON.parse(fs.readFileSync(`${__dirname}/${file}`, 'utf8'));
const tap = fs.readFileSync(`${__dirname}/p06-acceptance-tests.tap`, 'utf8');
summary.tests = {
    before: readEvidence('p06-before-authorized-tests.json').totals,
    after: readEvidence('p06-acceptance-tests.json').totals,
    prototypeCases: (tap.match(/^# Subtest: contract:/gm) || []).length,
    failedCases: tap.split('\n').filter(line => /^not ok /.test(line)),
};
const previousLint = readEvidence('p04-lint.json');
const currentLint = readEvidence('p06-final-lint.json');
summary.lintIdenticalToPreviousP0 = JSON.stringify(previousLint) === JSON.stringify(currentLint);
summary.productionMetricsIdenticalToPreviousP0 = JSON.stringify(readEvidence('final-metrics.json'))
    === JSON.stringify(readEvidence('p06-final-metrics.json'));
summary.typescriptErrors = readEvidence('p06-final-typescript.json').length;
fs.writeFileSync(`${__dirname}/p06-fontes.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({branch: summary.branch, head: summary.head,
    protectedChanges: summary.protectedChanges, files: rows.length}));
