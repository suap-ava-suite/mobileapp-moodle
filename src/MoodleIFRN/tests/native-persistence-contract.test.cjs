const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');

test('native-contract: JVM executes the experimental commit contract with explicit mocks', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-p08-jvm-'));
    const source = 'src/MoodleIFRN/tests/fixtures/p08-native';
    const evidence = {runtime: 'JVM-with-mocks', android: false, commands: []};
    try {
        for (const args of [
            ['javac', '--release', '8', '-d', temp, `${source}/DurableVersions.java`, `${source}/DurableVersionsJvmTest.java`],
            ['java', '-cp', temp, 'br.edu.ifrn.experimental.p08.DurableVersionsJvmTest'],
        ]) {
            const result = cp.spawnSync(args[0], args.slice(1), {encoding: 'utf8', timeout: 30000});
            evidence.commands.push({args, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message});
            assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
        }
        const output = evidence.commands.at(-1).stdout;
        assert.equal((output.match(/^PASS /gm) || []).length, 12);
        assert(output.includes('"failed":0'));
    } finally {
        fs.writeFileSync(`.analise/correcoes-p0/p08-jvm-${process.pid}.json`, JSON.stringify(evidence, null, 2));
        assert.equal(path.dirname(fs.realpathSync(temp)).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
        assert(path.basename(temp).startsWith('ifrn-p08-jvm-'));
        fs.rmSync(temp, {recursive: true}); // Verified isolated temporary compiler output only.
    }
});
