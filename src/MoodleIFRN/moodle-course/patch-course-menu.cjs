const fs = require('node:fs');
const path = require('node:path');

const importLine = "import { IfrnCourseMenuComponent } from '@/MoodleIFRN/moodle-course/course-menu';";
const start = '<!-- BEGIN MoodleIFRN course menu -->';
const end = '<!-- END MoodleIFRN course menu -->';

/** Move apenas o Voltar do índice; atividades mantêm sua própria pilha nativa. */
function patchCourseBackButton(html) {
    const marker = '<!-- BEGIN MoodleIFRN course back -->';
    const endMarker = '<!-- END MoodleIFRN course back -->';
    const markedBlock = /<!-- BEGIN MoodleIFRN course back -->[\s\S]*?<!-- END MoodleIFRN course back -->/;
    const button = `${marker}\n        <ion-buttons slot="start" class="ifrn-course-back">\n            <ion-back-button text="" defaultHref="/main/home" aria-label="Voltar" />\n        </ion-buttons>\n        ${endMarker}`;

    if (html.includes(marker) || html.includes(endMarker)) {
        if (!markedBlock.test(html)) throw new Error('Marcadores incompletos do botão Voltar IFRN.');
        return html.replace(markedBlock, button);
    }

    const toolbar = html.match(/<ion-toolbar(?:\s[^>]*)?>[\s\S]*?<\/ion-toolbar>/);
    const nativeBack = /<ion-buttons\s+slot="start"\s*>\s*<ion-back-button\b[^>]*(?:\/>|>\s*<\/ion-back-button>)\s*<\/ion-buttons>/;
    if (!toolbar || !nativeBack.test(toolbar[0])) {
        throw new Error('Toolbar nativa do curso incompatível: botão Voltar IFRN não aplicado.');
    }
    const updated = toolbar[0].replace(nativeBack, '')
        .replace('</ion-toolbar>', `${button}\n    </ion-toolbar>`);

    return html.replace(toolbar[0], updated);
}

/** Adaptação mínima do núcleo, reaplicável e validada antes de gravar. */
function patchCourseMenu(projectRoot) {
    const base = path.join(projectRoot, 'src/core/features/course/pages/contents');
    const tsPath = path.join(base, 'contents.ts');
    const htmlPath = path.join(base, 'contents.html');
    const indexHtmlPath = path.join(projectRoot, 'src/core/features/course/pages/index/index.html');
    const previousIndexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const indexHtml = patchCourseBackButton(previousIndexHtml);
    let source = fs.readFileSync(tsPath, 'utf8');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const previousSource = source;
    const previousHtml = html;

    if (!source.includes('CoreCourseContentsPage') || !source.includes('CoreCourseFormatComponent')) {
        throw new Error('Página de conteúdos incompatível; menu IFRN não aplicado.');
    }
    // Moodle recente usa viewChild(); versões anteriores podem usar @ViewChild.
    const formatExpression = /formatComponent\s*=\s*viewChild(?:\.required)?\(/.test(source)
        ? 'formatComponent()'
        : /\bformatComponent\s*[?!]?\s*:\s*CoreCourseFormatComponent/.test(source) ? 'formatComponent' : null;
    if (!formatExpression || !/imports:\s*\[/.test(source) || !/<ion-content(?:\s[^>]*)?>/.test(html)) {
        throw new Error('Não foi possível localizar imports, formatComponent ou ion-content. Nenhum arquivo do curso foi gravado.');
    }
    if (!source.includes(importLine)) {
        // Preserva o cabeçalho/licença do núcleo.
        const firstImport = source.search(/^import\s/m);
        if (firstImport < 0) throw new Error('Imports do curso não encontrados.');
        source = source.slice(0, firstImport) + importLine + '\n' + source.slice(firstImport);
    }
    const imports = source.match(/imports:\s*\[([^\]]*)\]/);
    if (!imports) throw new Error('Lista de componentes do curso não encontrada.');
    if (!imports[1].includes('IfrnCourseMenuComponent')) {
        source = source.replace(/imports:\s*\[/, '$&\n        IfrnCourseMenuComponent,');
    }
    const block = `${start}\n    @if (dataLoaded && course) {\n        <ifrn-course-menu [courseId]="course.id" [format]="${formatExpression}" />\n    }\n    ${end}`;
    const a = html.indexOf(start);
    const b = html.indexOf(end);
    if ((a < 0) !== (b < 0) || (a >= 0 && b < a)) {
        throw new Error('Marcadores incompletos do menu IFRN; confira contents.html.');
    }
    if (a >= 0) {
        html = html.slice(0, a) + block + html.slice(b + end.length);
    } else {
        html = html.replace(/<ion-content(?:\s[^>]*)?>/, '$&\n    ' + block);
    }
    if (source !== previousSource) fs.writeFileSync(tsPath, source);
    if (html !== previousHtml) fs.writeFileSync(htmlPath, html);
    if (indexHtml !== previousIndexHtml) fs.writeFileSync(indexHtmlPath, indexHtml);
    return source !== previousSource || html !== previousHtml || indexHtml !== previousIndexHtml;
}

module.exports = { patchCourseMenu, patchCourseBackButton };
