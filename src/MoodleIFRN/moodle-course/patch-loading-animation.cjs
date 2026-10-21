const fs = require('node:fs');
const path = require('node:path');

// Angular 20.3: animate.enter/leave may schedule afterNextRender on an already
// destroyed Ionic view during site switching (NG0911). Keep the loading content
// and its existing CSS hide workaround; omit only the framework animation hooks.
function loadingWithoutViewAnimations(source) {
    if (!source.includes('class="core-loading-container"')) {
        throw new Error('Core loading template changed; review the IFRN animation compatibility patch.');
    }
    return source.replace(/ animate\.(?:enter|leave)="(?:show|hide)-animation"/g, '');
}

function patchLoadingAnimation(root) {
    const file = path.join(root, 'src/core/components/loading/core-loading.html');
    const source = fs.readFileSync(file, 'utf8');
    const result = loadingWithoutViewAnimations(source);
    if (result === source) return false;
    fs.writeFileSync(file, result);
    return true;
}
module.exports = { loadingWithoutViewAnimations, patchLoadingAnimation };
