const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** Rejects a missing/empty platform bridge before Angular can bundle a broken native app. */
function assertCordovaRuntime(root, platform) {
    if (!['android', 'ios'].includes(platform)) throw new Error('Plataforma Cordova inválida.');
    const file = path.join(root, 'platforms', platform, 'platform_www', 'cordova.js');
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (Buffer.byteLength(content) < 4096 || !content.includes('cordova/platform') || !content.includes('cordova/channel')) {
        throw new Error('cordova.js da plataforma está ausente ou incompleto. Prepare a plataforma com a versão fixada no projeto antes do build web; não use um arquivo vazio para contornar a falha.');
    }
    const pluginFile = path.join(root, 'platforms', platform, 'platform_www', 'plugins/cordova-plugin-moodleapp/www/index.js');
    const plugin = fs.existsSync(pluginFile) ? fs.readFileSync(pluginFile, 'utf8') : '';
    if (!/cordova\.define\(["']cordova-plugin-moodleapp\.moodleapp["'],\s*function\s*\(\s*require\s*,\s*exports\s*,\s*module\s*\)/.test(plugin)) {
        throw new Error('O plugin Moodle não está empacotado como módulo Cordova. Prepare os plugins pela plataforma; não copie www/index.js sem o wrapper cordova.define.');
    }
    return file;
}

/** Read-only build guard: never silently reapplies or overwrites a user's core modifications. */
function assertStandardSessionCore(root, targets) {
    targets ??= JSON.parse(fs.readFileSync(path.join(root, 'src/MoodleIFRN/patches/p0.4-session-isolation.manifest.json'), 'utf8')).targets;
    const hash = content => crypto.createHash('sha256').update(content.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
    for (const target of targets) {
        const file = path.resolve(root, target.path);
        if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || hash(fs.readFileSync(file)) !== target.baseSha256) {
            throw new Error('A preparação ainda contém P0.4 ou outra alteração no baseline de sessão: ' + target.path + '. Use um worktree isolado com o núcleo oficial; não sobrescreva alterações locais.');
        }
    }
    const localTs = targets.find(target => target.path === 'cordova-plugin-moodleapp/src/ts/plugins/SecureStorage.ts');
    const importedTs = path.join(root, 'node_modules/cordova-plugin-moodleapp/src/ts/plugins/SecureStorage.ts');
    if (localTs && fs.existsSync(importedTs) && hash(fs.readFileSync(importedTs)) !== localTs.baseSha256) {
        throw new Error('O plugin Moodle importado aponta para outro checkout com P0.4. Isole as dependências do build.');
    }
    return targets.length;
}
module.exports = { assertCordovaRuntime, assertStandardSessionCore };
