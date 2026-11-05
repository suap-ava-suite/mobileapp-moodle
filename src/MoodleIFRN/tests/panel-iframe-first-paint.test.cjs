const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');

const source = fs.readFileSync('src/MoodleIFRN/painel/painel.ts', 'utf8');
const file = ts.createSourceFile('painel.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function findMethod(name) {
    let result;
    const visit = node => {
        if (ts.isMethodDeclaration(node) && node.name?.getText(file) === name) {
            result = node;
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    assert.ok(result, `Método ${name} não encontrado`);

    return result;
}

function contains(node, predicate) {
    if (predicate(node)) {
        return true;
    }

    return ts.forEachChild(node, child => contains(child, predicate)) || false;
}

test('iframe do Painel começa antes da espera pelos plugins Cordova', () => {
    const init = findMethod('ngOnInit');
    const statements = [...init.body.statements];
    const urlIndex = statements.findIndex(statement => contains(statement, node =>
        ts.isBinaryExpression(node) && node.left.getText(file) === 'this.safePainelUrl'));
    const refreshIndex = statements.findIndex(statement => contains(statement, node =>
        ts.isCallExpression(node) && node.expression.getText(file) === 'this.refreshProfileWhenPlatformIsReady'));

    assert.ok(urlIndex >= 0, 'ngOnInit precisa atribuir a URL local do iframe');
    assert.ok(refreshIndex > urlIndex, 'a URL do iframe deve ser atribuída antes do trabalho dependente da plataforma');
    assert.equal(contains(init, ts.isAwaitExpression), false, 'ngOnInit não deve bloquear a primeira renderização');
});

test('operações Cordova continuam esperando a plataforma antes da revalidação de perfil', () => {
    const refresh = findMethod('refreshProfileWhenPlatformIsReady');
    const awaitedCalls = [];
    contains(refresh, node => {
        if (ts.isAwaitExpression(node)) {
            awaitedCalls.push(node.expression.getText(file));
        }

        return false;
    });

    assert.deepEqual(awaitedCalls, ['CorePlatform.ready()', 'this.painelAva.refreshSavedProfile()']);
});
