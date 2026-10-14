const fs = require('node:fs');
const path = require('node:path');

const importLine = "import { IfrnCourseMenuComponent } from '@/MoodleIFRN/moodle-course/course-menu';";
const start = '<!-- BEGIN MoodleIFRN course menu -->';
const end = '<!-- END MoodleIFRN course menu -->';

/** Adaptação mínima do núcleo, reaplicável e validada antes de gravar. */
function patchCourseMenu(projectRoot) {
    const base = path.join(projectRoot, 'src/core/features/course/pages/contents');
    const tsPath = path.join(base, 'contents.ts');
    const htmlPath = path.join(base, 'contents.html');
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
    return source !== previousSource || html !== previousHtml;
}

module.exports = { patchCourseMenu };
