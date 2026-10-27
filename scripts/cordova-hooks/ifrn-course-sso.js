const fs = require('node:fs');
const path = require('node:path');

// Opção por janela: apenas o SSO de cursos omite o identificador acrescentado
// pelo app. O login principal e os demais navegadores mantêm o User-Agent atual.
const original = 'if (appendUserAgent != null) {';
const replacement = 'if (appendUserAgent != null && !"yes".equals(features.get("omitappuseragent"))) {';

function patchSource(source) {
    if (source.includes(replacement)) return source;
    if (!source.includes(original)) throw new Error('InAppBrowser Android incompatível com o ajuste IFRN de SSO.');
    return source.replace(original, replacement);
}

function patchAndroid(root) {
    const locations = [
        'node_modules/@moodlehq/cordova-plugin-inappbrowser/src/android/InAppBrowser.java',
        'plugins/@moodlehq/cordova-plugin-inappbrowser/src/android/InAppBrowser.java',
        'platforms/android/app/src/main/java/org/apache/cordova/inappbrowser/InAppBrowser.java',
    ];
    for (const location of locations) {
        const file = path.join(root, location);
        if (!fs.existsSync(file)) continue;
        const source = fs.readFileSync(file, 'utf8');
        const patched = patchSource(source);
        if (source !== patched) fs.writeFileSync(file, patched);
    }
}

module.exports = context => patchAndroid(context.opts.projectRoot);
module.exports.patchSource = patchSource;
if (require.main === module) patchAndroid(process.cwd());
