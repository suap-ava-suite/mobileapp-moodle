'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function experimentEnvironment(root, cacheRoot, inherited = process.env) {
    if (!path.isAbsolute(root) || !path.isAbsolute(cacheRoot)) {
        throw new Error('O worktree e o cache experimental devem usar caminhos absolutos.');
    }
    const environment = { ...inherited };
    for (const key of Object.keys(environment)) {
        if (['pwd', 'init_cwd', 'node_path', 'npm_config_cache', 'gradle_user_home', 'android_user_home', 'tmp', 'temp'].includes(key.toLowerCase())) {
            delete environment[key];
        }
    }
    return {
        ...environment,
        PWD: root,
        INIT_CWD: root,
        NPM_CONFIG_CACHE: path.join(cacheRoot, 'npm'),
        NPM_CONFIG_AUDIT: 'false',
        NPM_CONFIG_FUND: 'false',
        GRADLE_USER_HOME: path.join(cacheRoot, 'gradle'),
        ANDROID_USER_HOME: path.join(cacheRoot, 'android-user'),
        TMP: path.join(cacheRoot, 'tmp'),
        TEMP: path.join(cacheRoot, 'tmp'),
    };
}

function assertWorktree(root) {
    const gitFile = path.join(root, '.git');
    if (!fs.existsSync(gitFile) || !fs.statSync(gitFile).isFile()) {
        throw new Error('Este executor exige um worktree separado; o checkout principal não é permitido.');
    }
    for (const relative of ['node_modules', 'node_modules/cordova-android', 'node_modules/cordova-plugin-moodleapp']) {
        const resolved = fs.realpathSync(path.join(root, relative));
        const inside = path.relative(root, resolved);
        if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
            throw new Error(`Dependência fora do worktree experimental: ${relative}`);
        }
    }
}

function main(args) {
    const root = fs.realpathSync(path.resolve(__dirname, '../../..'));
    const cacheRoot = process.env.IFRN_ANDROID_EXPERIMENT_CACHE;
    if (!cacheRoot) {
        throw new Error('Defina IFRN_ANDROID_EXPERIMENT_CACHE para um diretório exclusivo do experimento.');
    }
    assertWorktree(root);
    const environment = experimentEnvironment(root, path.resolve(cacheRoot));
    const utilFile = require.resolve('cordova-lib/src/cordova/util', { paths: [root] });
    const probe = cp.spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(utilFile)}).getProjectRoot());`], {
        cwd: root,
        env: environment,
        encoding: 'utf8',
    });
    if (probe.status !== 0 || fs.realpathSync(probe.stdout.trim()) !== root) {
        throw new Error('A CLI Cordova não identificou o worktree experimental. Execução bloqueada.');
    }
    const requested = require(path.join(root, 'package.json')).dependencies['cordova-android'];
    const installed = require(path.join(root, 'node_modules/cordova-android/package.json')).version;
    if (requested !== installed) {
        throw new Error('A plataforma instalada difere da versão exata declarada no experimento.');
    }
    if (args.length === 1 && args[0] === '--check') {
        process.stdout.write(JSON.stringify({ root, projectRoot: probe.stdout.trim(), cacheRoot: path.resolve(cacheRoot), cordovaAndroid: installed }, null, 2) + '\n');
        return;
    }
    if (!['platform', 'prepare', 'build', 'requirements'].includes(args[0])) {
        throw new Error('Use --check, platform, prepare, requirements ou build. Este executor não instala nem executa aplicativos.');
    }
    for (const directory of ['npm', 'gradle', 'android-user', 'tmp']) {
        fs.mkdirSync(path.join(cacheRoot, directory), { recursive: true });
    }
    const result = cp.spawnSync(process.execPath, [path.join(root, 'node_modules/cordova/bin/cordova'), ...args], {
        cwd: root,
        env: environment,
        stdio: 'inherit',
    });
    if (result.error) {
        throw result.error;
    }
    process.exitCode = result.status === null ? 1 : result.status;
}

module.exports = { experimentEnvironment, assertWorktree };
if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
