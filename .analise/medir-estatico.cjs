const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve('src/MoodleIFRN');
const inventory = path.resolve('.analise/inventario-arquivos.tsv');
const files = [];
const rows = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            rows.push([path.relative(process.cwd(), file), 'diretório', '', '']);
            walk(file);
            continue;
        }
        const data = fs.readFileSync(file);
        const text = data.toString('utf8');
        const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
        rows.push([path.relative(process.cwd(), file), 'arquivo', lines, data.length]);
        if (file.endsWith('.ts') && !file.endsWith('.d.ts')
                && !file.includes(`${path.sep}static${path.sep}vendor${path.sep}`)
                && !file.includes(`${path.sep}theme${path.sep}dsgov-auditoria${path.sep}`)) files.push(file);
    }
}

walk(root);
rows.sort((a, b) => a[0].localeCompare(b[0]));
fs.writeFileSync(inventory, `caminho\ttipo\tlinhas\tbytes\n${rows.map(row => row.join('\t')).join('\n')}\n`);

const functions = [];
let anyTokens = 0;
let suppressions = 0;
let todos = 0;
let emptyCatches = 0;
let consoleCalls = 0;

for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    anyTokens += (text.match(/\bany\b/g) || []).length;
    suppressions += (text.match(/@ts-(?:ignore|expect-error)/g) || []).length;
    todos += (text.match(/\b(?:TODO|FIXME)\b/g) || []).length;
    consoleCalls += (text.match(/console\.(?:log|debug|info|warn|error)/g) || []).length;

    function visit(node) {
        if (ts.isCatchClause(node) && node.block.statements.length === 0) emptyCatches++;
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
                || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
            const end = source.getLineAndCharacterOfPosition(node.end).line + 1;
            let complexity = 1;
            let nesting = 0;
            function measure(child, depth = 0) {
                let branch = Number(ts.isIfStatement(child) || ts.isConditionalExpression(child)
                    || ts.isForStatement(child) || ts.isForInStatement(child) || ts.isForOfStatement(child)
                    || ts.isWhileStatement(child) || ts.isDoStatement(child) || ts.isCatchClause(child)
                    || ts.isCaseClause(child));
                branch += Number(child.kind === ts.SyntaxKind.AmpersandAmpersandToken
                    || child.kind === ts.SyntaxKind.BarBarToken || child.kind === ts.SyntaxKind.QuestionQuestionToken);
                complexity += branch;
                const nextDepth = depth + Number(branch > 0);
                nesting = Math.max(nesting, nextDepth);
                ts.forEachChild(child, nested => measure(nested, nextDepth));
            }
            ts.forEachChild(node, child => measure(child));
            functions.push({
                file: path.relative(process.cwd(), file),
                name: node.name?.getText(source) || (ts.isConstructorDeclaration(node) ? 'constructor' : '<arrow>'),
                start,
                lines: end - start + 1,
                params: node.parameters?.length || 0,
                complexity,
                nesting,
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}

const top = key => functions.toSorted((a, b) => b[key] - a[key]).slice(0, 10);
const filesOnly = rows.filter(row => row[1] === 'arquivo');
console.log(JSON.stringify({
    fileEntries: filesOnly.length,
    totalBytes: filesOnly.reduce((sum, row) => sum + Number(row[3]), 0),
    sourceTsFiles: files.length,
    anyTokens,
    tsSuppressionDirectives: suppressions,
    todoFixme: todos,
    emptyCatches,
    consoleCalls,
    top10Lines: top('lines'),
    top10CyclomaticApprox: top('complexity'),
    top10Parameters: top('params'),
}, null, 2));
