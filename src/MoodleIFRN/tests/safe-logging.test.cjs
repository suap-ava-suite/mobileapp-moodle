const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');

function logging() {
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts', 'utf8');
    const ast = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
    const names = new Set(['sanitizeUrlForLog', 'safeLogPayload', 'logSiteError', 'identityLog']);
    const selected = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.has(n.name?.text))
        .map(n => n.getText(ast)).join('\n');
    const js = ts.transpileModule(selected, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const entries = [];
    const context = {URL, SITE_LOG:'site', IDENTITY_LOG:'identity',
        console:{log:(...args)=>entries.push(args),error:(...args)=>entries.push(args)}};
    vm.runInNewContext(js + '\nthis.api={sanitizeUrlForLog,logSiteError,identityLog};', context);
    return {...context.api,entries};
}
const secret = 'SYNTHETIC_SECRET_XYZ';
const callback = `moodlemobile://token=${secret}`;
for (const raw of [callback, `http://moodlemobile//token=${secret}`, `https://${callback}`,
    `https://suap.ifrn.edu.br/o/authorize/?code=${secret}#access_token=${secret}`,
    `https://${secret}:${secret}@suap.ifrn.edu.br/${secret}`,
    `custom://${secret}`, `https://${secret}.invalid/${secret}`, `%${secret}`]) {
    test(`safe URL diagnostic fixture ${raw.indexOf(secret)} ${raw.slice(0, 18)}`, () => {
        const result = JSON.stringify(logging().sanitizeUrlForLog(raw));
        assert.ok(!result.includes(secret), result);
    });
}
test('error logs omit free text, stack, debug details and unapproved context properties', () => {
    const log = logging();
    log.logSiteError('synthetic-stage', {name:secret,message:`password=${secret}`,critical:true,
        stack:secret,debug:{code:secret,details:callback}}, {
        token:secret,credentials:{password:secret},headers:{Authorization:`Bearer ${secret}`},
        courseId:42,siteUrl:`https://suap.ifrn.edu.br/${secret}?token=${secret}`,
    });
    const output = JSON.stringify(log.entries);
    assert.ok(!output.includes(secret), output);
    assert.match(output,/synthetic-stage/);
    assert.match(output,/critical/);
    assert.match(output,/42/);
});
test('identity diagnostics whitelist field names and types rather than trusting nested objects', () => {
    const log = logging();
    log.identityLog('synthetic identity check',{hasExpected:true,candidateCount:2,
        token:secret,matchedVia:{token:secret},siteUrl:`https://suap.ifrn.edu.br/?password=${secret}`});
    const output = JSON.stringify(log.entries);
    assert.ok(!output.includes(secret),output);
    assert.match(output,/hasExpected/); assert.match(output,/candidateCount/);
});
test('service diagnostic objects all pass through the explicit whitelist', () => {
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/moodle-site.service.ts','utf8');
    const ast = ts.createSourceFile('service.ts',source,ts.ScriptTarget.Latest,true);
    const unsafe = [];
    function visit(n) {
        if (ts.isCallExpression(n) && /^console\.(log|warn|error)$/.test(n.expression.getText(ast))) {
            for (const arg of n.arguments) {
                if (ts.isCallExpression(arg) && arg.expression.getText(ast)==='JSON.stringify') unsafe.push(arg.getText(ast));
            }
        }
        ts.forEachChild(n,visit);
    }
    visit(ast);assert.deepEqual(unsafe,[]);
});
