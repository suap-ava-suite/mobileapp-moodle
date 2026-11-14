const fs = require('node:fs');
const path = require('node:path');

/** Rejects a missing/empty platform bridge before Angular can bundle a broken native app. */
function assertCordovaRuntime(root, platform) {
    if (!['android', 'ios'].includes(platform)) throw new Error('Plataforma Cordova inválida.');
    const file = path.join(root, 'platforms', platform, 'platform_www', 'cordova.js');
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (Buffer.byteLength(content) < 4096 || !content.includes('cordova/platform') || !content.includes('cordova/channel')) {
        throw new Error('cordova.js da plataforma está ausente ou incompleto. Prepare a plataforma com a versão fixada no projeto antes do build web; não use um arquivo vazio para contornar a falha.');
    }
    return file;
}
module.exports = { assertCordovaRuntime };
