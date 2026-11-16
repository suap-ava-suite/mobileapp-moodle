'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { experimentEnvironment, assertWorktree } = require('../scripts/android-experiment.cjs');

test('experimental Cordova environment replaces stale PWD and inherited module/cache paths', () => {
    const root = path.resolve('isolated-worktree');
    const cache = path.resolve('isolated-cache');
    const inherited = { PWD: path.resolve('other-project'), INIT_CWD: path.resolve('other-project'), NODE_PATH: '/shared/modules', npm_config_cache: '/shared/npm', GRADLE_USER_HOME: '/shared/gradle', PATH: process.env.PATH };
    const env = experimentEnvironment(root, cache, inherited);
    assert.equal(env.PWD, root);
    assert.equal(env.INIT_CWD, root);
    assert.equal(env.NPM_CONFIG_CACHE, path.join(cache, 'npm'));
    assert.equal(env.GRADLE_USER_HOME, path.join(cache, 'gradle'));
    assert.equal(env.ANDROID_USER_HOME, path.join(cache, 'android-user'));
    assert.equal(env.TEMP, path.join(cache, 'tmp'));
    assert.equal(env.PATH, inherited.PATH);
    assert.equal(env.NODE_PATH, undefined);
    assert.equal(env.npm_config_cache, undefined);
    assert.equal(inherited.PWD, path.resolve('other-project'));
});

test('experiment rejects the primary checkout layout', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-primary-shape-'));
    fs.mkdirSync(path.join(directory, '.git'));
    assert.throws(() => assertWorktree(directory), /checkout principal/);
});

test('real Cordova project detection stays in the worktree with a foreign PWD', () => {
    const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-foreign-project-'));
    fs.mkdirSync(path.join(foreign, 'www'));
    fs.writeFileSync(path.join(foreign, 'config.xml'), '<widget id="invalid.test" version="1.0.0" xmlns="http://www.w3.org/ns/widgets"><name>Fixture</name></widget>');
    const script = path.resolve(__dirname, '../scripts/android-experiment.cjs');
    const expected = fs.realpathSync(path.resolve(__dirname, '../../..'));
    const result = cp.spawnSync(process.execPath, [script, '--check'], {
        cwd: foreign,
        env: { ...process.env, PWD: foreign, INIT_CWD: foreign, IFRN_ANDROID_EXPERIMENT_CACHE: path.join(foreign, 'cache') },
        encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.root, expected);
    assert.equal(fs.realpathSync(report.projectRoot), expected);
    assert.equal(fs.existsSync(path.join(foreign, 'platforms')), false);
});
