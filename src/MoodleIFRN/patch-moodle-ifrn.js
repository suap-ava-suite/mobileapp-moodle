#!/usr/bin/env node
/**
 * Reaplica integrações do MoodleIFRN após atualizar o Moodle Mobile.
 *
 * O Moodle sobrescreve arquivos do núcleo a cada atualização (~3 anos).
 * Copie a pasta MoodleIFRN para src/ e execute este script na raiz do projeto.
 *
 * Uso:
 *   node src/MoodleIFRN/patch-moodle-ifrn.js
 *   npm run patch:ifrn
 *
 * O script é idempotente: pode rodar várias vezes sem duplicar rotas.
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const FILES = {
    loginModule: path.join(PROJECT_ROOT, 'src/core/features/login/login.module.ts'),
    mainMenuModule: path.join(PROJECT_ROOT, 'src/core/features/mainmenu/mainmenu.module.ts'),
    angularJson: path.join(PROJECT_ROOT, 'angular.json'),
    gulpfile: path.join(PROJECT_ROOT, 'gulpfile.js'),
    packageJson: path.join(PROJECT_ROOT, 'package.json'),
};

const MARKER = {
    loginRoutesStart: '// BEGIN MoodleIFRN login routes',
    loginRoutesEnd: '// END MoodleIFRN login routes',
    gulpTaskStart: '// BEGIN MoodleIFRN gulp',
    gulpTaskEnd: '// END MoodleIFRN gulp',
};

/**
 * Rotas IFRN inseridas em login.module.ts (dentro de loadChildren).
 *
 * Fluxo:
 *   /login              → redirect para marketplace-ifrn
 *   /login/marketplace-ifrn → tela inicial (marketplace)
 *   /login/ifrn-login       → login com IFRN-id
 *   /login/moodle-open-course → ponte → CoreCourseHelper.getAndOpenCourse (curso NATIVO)
 *   /login/painel-enrol     → matrícula via Painel
 *
 * O visual do curso nativo fica em moodle-course/moodle-course.scss
 * (stylesheet global). NÃO existe rota paralela de curso.
 */
const IFRN_LOGIN_ROUTES = `            ${MARKER.loginRoutesStart}
            {
                path: 'marketplace-ifrn',
                loadComponent: () =>
                    import('@/MoodleIFRN/marketplace-ifrn/marketplace-ifrn')
                        .then(m => m.MarketplaceIfrnPage),
            },
            {
                path: 'ifrn-login',
                loadComponent: () =>
                    import('@/MoodleIFRN/ifrn-login/ifrn-login')
                        .then(m => m.IfrnLoginPage),
            },
            {
                path: 'moodle-open-course',
                loadComponent: () =>
                    import('@/MoodleIFRN/moodle-open-course/moodle-open-course')
                        .then(m => m.MoodleOpenCoursePage),
            },
            {
                path: 'painel-enrol',
                loadComponent: () =>
                    import('@/MoodleIFRN/painel-enrol/painel-enrol')
                        .then(m => m.PainelEnrolPage),
            },
            ${MARKER.loginRoutesEnd}`;

const MOODLEMOODLE_ASSET = `              {
                "glob": "**/*",
                "input": "src/MoodleIFRN/mobilemoodle",
                "output": "mobilemoodle"
              }`;

const GULP_MOBILEMOODLE_BLOCK = `${MARKER.gulpTaskStart}
gulp.task('mobilemoodle-ts', (done) => {
    try {
        execSync('node src/MoodleIFRN/mobilemoodle/build.mjs', { stdio: 'inherit' });
        done();
    } catch (error) {
        done(error);
    }
});
${MARKER.gulpTaskEnd}`;

function readFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function replaceBetweenMarkers(content, start, end, replacement) {
    const startIndex = content.indexOf(start);
    const endIndex = content.indexOf(end);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const before = content.slice(0, startIndex);
        const after = content.slice(endIndex + end.length);
        return before + replacement + after;
    }

    return null;
}

function stripLegacyIfrnRoutes(content) {
    let next = content;

    next = replaceBetweenMarkers(next, MARKER.loginRoutesStart, MARKER.loginRoutesEnd, '') ?? next;

    const legacyPaths = ['marketplace-ifrn', 'ifrn-login', 'moodle-open-course', 'moodle-course/:courseId', 'painel-enrol', 'ifrn'];
    for (const routePath of legacyPaths) {
        const pattern = new RegExp(
            `\\{[^{}]*path:\\s*'${routePath}'[\\s\\S]*?\\n\\s*\\},?\\s*`,
            'g',
        );
        next = next.replace(pattern, '');
    }

    return next;
}

function patchLoginRedirect(content) {
    return content.replace(
        /(path:\s*''\s*,\s*pathMatch:\s*'full'\s*,\s*redirectTo:\s*)'[^']+'/,
        "$1'marketplace-ifrn'",
    );
}

function isLoginModulePatched(content) {
    return content.includes(MARKER.loginRoutesStart)
        && content.includes(MARKER.loginRoutesEnd)
        && content.includes("path: 'marketplace-ifrn'")
        && content.includes("path: 'ifrn-login'")
        && content.includes("path: 'moodle-open-course'")
        && content.includes("path: 'painel-enrol'")
        && !content.includes("path: 'moodle-course/:courseId'")
        && /redirectTo:\s*'marketplace-ifrn'/.test(content)
        && content.includes('@/MoodleIFRN/marketplace-ifrn/marketplace-ifrn')
        && content.includes('@/MoodleIFRN/ifrn-login/ifrn-login')
        && content.includes('@/MoodleIFRN/moodle-open-course/moodle-open-course')
        && content.includes('@/MoodleIFRN/painel-enrol/painel-enrol');
}

function patchLoginModule() {
    let content = readFile(FILES.loginModule);

    if (isLoginModulePatched(content)) {
        console.log('• login.module.ts já estava atualizado');
        return;
    }

    const original = content;

    content = stripLegacyIfrnRoutes(content);
    content = patchLoginRedirect(content);

    const redirectRoutePattern = /(\{\s*path:\s*''\s*,\s*pathMatch:\s*'full'\s*,\s*redirectTo:\s*'marketplace-ifrn'\s*,\s*\},)/;

    if (!redirectRoutePattern.test(content)) {
        throw new Error(
            'Não foi possível localizar a rota de redirect (path: \'\') em login.module.ts.',
        );
    }

    content = content.replace(redirectRoutePattern, `$1\n${IFRN_LOGIN_ROUTES}`);

    if (content === original) {
        console.log('• login.module.ts já estava atualizado');
        return;
    }

    writeFile(FILES.loginModule, content);
    console.log('✔ login.module.ts — redirect e rotas marketplace-ifrn / ifrn-login ');
}

const COURSE_THEME_STYLE = `{
                "input": "src/MoodleIFRN/moodle-course/moodle-course.scss"
              }`;

/** Só registra guard/initializer IFRN; a implementação nativa não é substituída. */
function patchMainMenuNavigation() {
    let content = readFile(FILES.mainMenuModule);
    const original = content;
    const importLine = "import { ifrnMainMenuGuard, provideIfrnNavigationShell } from '@/MoodleIFRN/navigation/navigation.guard';";

    if (!content.includes(importLine)) {
        const authImport = /import \{ authGuard \} from ['"]@features\/mainmenu\/guards\/auth['"];\r?\n/;
        if (!authImport.test(content)) {
            throw new Error('Não foi possível localizar authGuard para registrar a navegação IFRN.');
        }
        content = content.replace(authImport, (match) => `${match}${importLine}\n`);
    }

    if (!content.includes('canActivateChild: [ifrnMainMenuGuard]')) {
        const nativeGuard = /canActivate:\s*\[authGuard\],/;
        if (!nativeGuard.test(content)) {
            throw new Error('Não foi possível localizar canActivate do Main Menu nativo.');
        }
        content = content.replace(nativeGuard,
            "canActivate: [authGuard, ifrnMainMenuGuard],\n        canActivateChild: [ifrnMainMenuGuard],\n        runGuardsAndResolvers: 'always',");
    }

    if (!content.includes('provideIfrnNavigationShell(),')) {
        if (!/providers:\s*\[/.test(content)) {
            throw new Error('Não foi possível localizar providers do Main Menu para a inicialização IFRN.');
        }
        content = content.replace(/providers:\s*\[/, (match) => `${match}\n        provideIfrnNavigationShell(),`);
    }

    if (content !== original) {
        writeFile(FILES.mainMenuModule, content);
        console.log('✔ mainmenu.module.ts — guard global e inicialização IFRN registrados');
    } else {
        console.log('• navegação IFRN do Main Menu já estava registrada');
    }
}

function patchAngularAssets() {
    let content = readFile(FILES.angularJson);
    let changed = false;

    if (!content.includes('"input": "src/MoodleIFRN/mobilemoodle"')) {
        const assetsMarker = `"input": "src/assets",
                "output": "assets"
              },`;

        if (!content.includes(assetsMarker)) {
            throw new Error('Não foi possível localizar o bloco de assets padrão em angular.json.');
        }

        content = content.replace(
            assetsMarker,
            `${assetsMarker}
${MOODLEMOODLE_ASSET},`,
        );
        changed = true;
        console.log('✔ angular.json — assets do painel mobilemoodle adicionados');
    } else {
        console.log('• angular.json já inclui assets do mobilemoodle');
    }

    if (!content.includes('"input": "src/MoodleIFRN/moodle-course/moodle-course.scss"')) {
        const stylesPattern = /("input"\s*:\s*"src\/theme\/theme\.scss"\s*\r?\n\s*\})/;

        if (!stylesPattern.test(content)) {
            throw new Error('Não foi possível localizar o bloco de styles em angular.json.');
        }

        content = content.replace(
            stylesPattern,
            `$1,\n              ${COURSE_THEME_STYLE}`,
        );
        changed = true;
        console.log('✔ angular.json — tema visual do curso nativo (moodle-course.scss)');
    } else {
        console.log('• angular.json já inclui moodle-course.scss');
    }

    if (!content.includes('"input": "src/MoodleIFRN/navigation/navigation-shell.scss"')) {
        const themeStyle = /("input"\s*:\s*"src\/MoodleIFRN\/moodle-course\/moodle-course\.scss"\s*\r?\n\s*\})/;
        if (!themeStyle.test(content)) {
            throw new Error('Não foi possível localizar o tema IFRN para inserir navigation-shell.scss.');
        }
        content = content.replace(themeStyle,
            '$1,\n              { "input": "src/MoodleIFRN/navigation/navigation-shell.scss" }');
        changed = true;
        console.log('✔ angular.json — estilo de navegação IFRN adicionado');
    }

    if (changed) {
        writeFile(FILES.angularJson, content);
    }
}

function patchGulpfile() {
    let content = readFile(FILES.gulpfile);

    if (content.includes("gulp.task('mobilemoodle-ts'")) {
        console.log('• gulpfile.js já compila mobilemoodle-ts');
        return;
    }

    if (!content.includes("const gulp = require('gulp');")) {
        throw new Error('gulpfile.js não tem o formato esperado.');
    }

    if (!content.includes("const { execSync } = require('child_process');")) {
        content = content.replace(
            "const gulp = require('gulp');",
            "const gulp = require('gulp');\nconst { execSync } = require('child_process');",
        );
    }

    const insertPoint = "gulp.task('freeze-dependencies', (done) => {\n    new FreezeDependenciesTask().run(done);\n});\n";

    if (!content.includes(insertPoint)) {
        throw new Error('Não foi possível localizar o ponto de inserção em gulpfile.js.');
    }

    content = content.replace(insertPoint, `${insertPoint}\n${GULP_MOBILEMOODLE_BLOCK}\n`);

    content = content.replace(
        /gulp\.task\(\s*'default',\s*gulp\.parallel\(\[\s*'lang',\s*'env',\s*'icons',/,
        "gulp.task(\n    'default',\n    gulp.parallel([\n        'lang',\n        'env',\n        'icons',\n        'mobilemoodle-ts',",
    );

    const watchBlock = "gulp.watch(['./moodle.config.json', './moodle.config.*.json'], { interval: 500 }, gulp.parallel('env'));";

    if (content.includes(watchBlock) && !content.includes('src/MoodleIFRN/mobilemoodle/core_mobile/**/*.ts')) {
        content = content.replace(
            watchBlock,
            `${watchBlock}\n    gulp.watch('src/MoodleIFRN/mobilemoodle/core_mobile/**/*.ts', { interval: 500 }, gulp.parallel('mobilemoodle-ts'));\n    gulp.watch('src/MoodleIFRN/mobilemoodle/mobilemoodle.ts', { interval: 500 }, gulp.parallel('mobilemoodle-ts'));`,
        );
    }

    writeFile(FILES.gulpfile, content);
    console.log('✔ gulpfile.js — tarefa mobilemoodle-ts adicionada');
}

function patchPackageScripts() {
    const pkg = JSON.parse(readFile(FILES.packageJson));
    let changed = false;

    if (!pkg.scripts['build:mobilemoodle']) {
        pkg.scripts['build:mobilemoodle'] = 'node src/MoodleIFRN/mobilemoodle/build.mjs';
        changed = true;
    }

    const patchScript = 'node src/MoodleIFRN/patch-moodle-ifrn.js';

    if (pkg.scripts['patch:ifrn'] !== patchScript) {
        pkg.scripts['patch:ifrn'] = patchScript;
        changed = true;
    }

    if (!changed) {
        console.log('• package.json já contém scripts do MoodleIFRN');
        return;
    }

    writeFile(FILES.packageJson, `${JSON.stringify(pkg, null, 4)}\n`);
    console.log('✔ package.json — scripts patch:ifrn e build:mobilemoodle garantidos');
}

function main() {
    console.log('MoodleIFRN — reaplicando integrações...\n');
    console.log(`Projeto: ${PROJECT_ROOT}\n`);

    patchLoginModule();
    patchMainMenuNavigation();
    patchAngularAssets();
    patchGulpfile();
    patchPackageScripts();

    console.log('\n✔ Patch concluído.');
    console.log('  Rotas: /login → marketplace-ifrn, /login/ifrn-login, /login/moodle-open-course');
    console.log('  Curso: nativo via CoreCourseHelper.getAndOpenCourse + tema moodle-course.scss');
    console.log('  Próximo passo: npm run build:mobilemoodle');
}

try {
    main();
} catch (error) {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
}
