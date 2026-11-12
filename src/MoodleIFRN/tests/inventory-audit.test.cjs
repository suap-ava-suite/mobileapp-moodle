'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const { escapeHtml, jsonForHtml, walk, resolveReference, documentReferences, classify } = require('../scripts/inventory-moodleifrn.cjs');
const { fixtures, retiredFiles } = require('../scripts/inventory-catalog.cjs');

test('inventory includes hidden files but never traverses a junction outside the audited tree', t => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-inventory-'));
    t.after(() => {
        assert.equal(path.dirname(fs.realpathSync(temp)).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
        assert(path.basename(temp).startsWith('ifrn-inventory-'));
        fs.rmSync(temp, { recursive: true });
    });
    fs.mkdirSync(path.join(temp, 'tree'));
    fs.mkdirSync(path.join(temp, 'outside'));
    fs.writeFileSync(path.join(temp, 'tree/.hidden'), 'audited');
    fs.writeFileSync(path.join(temp, 'outside/private.txt'), 'not-to-be-inventoried');
    fs.symlinkSync(path.join(temp, 'outside'), path.join(temp, 'tree/dependencies'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = walk(temp, 'tree');
    assert.deepEqual(result.files.map(file => file.path), ['tree/.hidden']);
    assert.deepEqual(result.links, ['tree/dependencies']);
    assert(!JSON.stringify(result).includes('private.txt'));
});

test('inventory resolves lazy imports, asset query strings and Sass partials without guessing external URLs', () => {
    const paths = new Set(['src/MoodleIFRN/painel/painel.ts', 'src/MoodleIFRN/mobilemoodle/mobilemoodle.css',
        'src/MoodleIFRN/theme/_tokens.scss']);
    assert.deepEqual(resolveReference('src/core/features/login/login.module.ts', '@/MoodleIFRN/painel/painel', paths), ['src/MoodleIFRN/painel/painel.ts']);
    assert.deepEqual(resolveReference('src/MoodleIFRN/mobilemoodle/index.html', 'mobilemoodle.css?v=123', paths), ['src/MoodleIFRN/mobilemoodle/mobilemoodle.css']);
    assert.deepEqual(resolveReference('src/MoodleIFRN/theme/main.scss', './tokens', paths), ['src/MoodleIFRN/theme/_tokens.scss']);
    assert.deepEqual(resolveReference('src/MoodleIFRN/painel/painel.ts', 'https://example.invalid/painel.ts', paths), []);
});

test('absence of import or directory-copy evidence never becomes automatic permission to remove production assets', () => {
    const production = { path: 'src/MoodleIFRN/services_mobile/unknown.service.ts' };
    const unreferenced = classify(production, []);
    assert.equal(unreferenced.usage, 'Nenhuma referência encontrada');
    assert.equal(unreferenced.role, 'A');
    const copied = classify({ path: 'src/MoodleIFRN/mobilemoodle/static/vendor/icon.svg' }, [
        { source: 'angular.json', line: 45, kind: 'cópia de diretório no build' },
    ]);
    assert.equal(copied.usage, 'Uso provável/indireto');
    assert.equal(copied.role, 'A');
    assert.equal(copied.generated, true);
    const historical = classify({ path: 'src/MoodleIFRN/docs/old.md', localOnly: true }, []);
    assert.equal(historical.usage, 'Uso desconhecido');
    assert.match(historical.recommendation, /Preservar/);
});

test('F08 patch removes the retired bootstrap script idempotently without recreating any source file', () => {
    const file = 'src/MoodleIFRN/patch-moodle-ifrn.js';
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
        && ['replaceBetweenMarkers', 'patchIndexEarlyHandoff'].includes(node.name?.text));
    assert.equal(functions.length, 2);
    const marker = ast.statements.filter(ts.isVariableStatement)
        .flatMap(statement => [...statement.declarationList.declarations]).find(node => node.name.getText(ast) === 'MARKER');
    assert(marker?.initializer);
    let html;
    const writes = [];
    const context = {
        FILES: { indexHtml: 'synthetic-index.html' }, console: { log() {} },
        readFile: filename => { assert.equal(filename, 'synthetic-index.html'); return html; },
        writeFile: (filename, content) => { assert.equal(filename, 'synthetic-index.html'); writes.push(filename); html = content; },
    };
    vm.runInNewContext('const MARKER = ' + marker.initializer.getText(ast) + ';\n'
        + functions.map(node => node.getText(ast)).join('\n')
        + '\nglobalThis.patch = patchIndexEarlyHandoff; globalThis.markers = MARKER;', context, { timeout: 1000 });
    html = '<html>' + context.markers.earlyHandoffStart
        + '<script src="assets/MoodleIFRN/navigation/early-course-handoff.js"></script>'
        + context.markers.earlyHandoffEnd + '<app-root></app-root></html>';
    context.patch();
    const first = html;
    assert(!html.includes('early-course-handoff.js'));
    assert(html.includes('<app-root></app-root>'));
    context.patch();
    assert.equal(html, first);
    assert(writes.every(filename => filename === 'synthetic-index.html'));
});

test('harness entry HTML, inline styles and runtime JavaScript are unchanged after scaffold removal', () => {
    const root = 'src/MoodleIFRN/tests/fixtures/p10-sqlite-extension/harness/www/';
    for (const file of ['index.html', 'js/index.js']) {
        const current = fs.readFileSync(root + file, 'utf8').replace(/\r\n/g, '\n');
        const baseline = execFileSync('git', ['show', 'e4909876e:' + root + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
        assert.equal(current, baseline);
    }
    const document = new JSDOM(fs.readFileSync(root + 'index.html', 'utf8')).window.document;
    assert.equal(document.querySelectorAll('link[rel="stylesheet"],img[src="img/logo.png"]').length, 0);
    assert(document.querySelector('style')?.textContent.includes('body'));
    assert(document.querySelector('script[src="js/index.js"]'));
    assert.equal(fs.existsSync(root + 'css/index.css'), false);
    assert.equal(fs.existsSync(root + 'img/logo.png'), false);
});

test('CLI examples and inline code are collected as documentation references, without claiming runtime execution', () => {
    const content = 'node src/MoodleIFRN/build-native.mjs --check\n<code>scripts/build-android-web.cjs</code>\n[Guia](../docs/html/README.html)';
    const refs = documentReferences(content);
    assert(refs.some(ref => ref.spec === 'src/MoodleIFRN/build-native.mjs'));
    assert(refs.some(ref => ref.spec === '../docs/html/README.html'));
    const inline = refs.find(ref => ref.spec === 'scripts/build-android-web.cjs');
    const paths = new Set(['src/MoodleIFRN/scripts/build-android-web.cjs']);
    assert.deepEqual(resolveReference('src/MoodleIFRN/docs/estrutura-arquitetura.html', inline.spec, paths), [...paths]);
    assert.equal(classify({ path: 'src/MoodleIFRN/scripts/build-android-web.cjs' }, [
        { source: 'src/MoodleIFRN/docs/estrutura-arquitetura.html', line: 1, kind: 'documentação' },
    ]).usage, 'Uso provável/indireto');
});

test('all 37 active tracked fixtures have an individual reviewed catalog entry, including hidden config and binary libraries', () => {
    const root = 'src/MoodleIFRN/tests/fixtures';
    const files = execFileSync('git', ['ls-files', '-z', '--', root], { encoding: 'utf8' })
        .split('\0').filter(Boolean).map(file => file.slice(root.length + 1)).sort();
    assert.equal(files.length, 37);
    assert.deepEqual(Object.keys(fixtures).sort(), files);
    assert(files.some(file => file.endsWith('.gitignore')));
    assert.equal(files.filter(file => file.endsWith('.jar')).length, 2);
    for (const entry of Object.values(fixtures)) {
        assert.equal(entry.length, 4);
        assert(entry.every(value => typeof value === 'string' && value.trim()));
    }
});

test('source paths and metadata cannot break out of HTML or embedded JSON script tags', () => {
    const payload = '</script><img src=x onerror=alert(1)>\u2028&"';
    const json = jsonForHtml({ path: payload });
    assert(!json.includes('<'));
    assert.deepEqual(JSON.parse(json), { path: payload });
    const document = new JSDOM('<div>' + escapeHtml(payload) + '</div>').window.document;
    assert.equal(document.querySelector('div').textContent, payload);
    assert.equal(document.querySelectorAll('img,script').length, 0);
});

test('file:// inventory filters all records, paginates, resets the page and remains usable with unavailable localStorage', () => {
    const html = fs.readFileSync('src/MoodleIFRN/docs/inventario-arquivos.html', 'utf8');
    const dom = new JSDOM(html, { url: 'file:///repo/src/MoodleIFRN/docs/inventario-arquivos.html', runScripts: 'outside-only' });
    const { window } = dom;
    const { document } = window;
    window.eval(fs.readFileSync('src/MoodleIFRN/docs/assets/manual.js', 'utf8'));
    window.eval(fs.readFileSync('src/MoodleIFRN/docs/assets/inventario.js', 'utf8'));
    assert.equal(document.querySelectorAll('#inventory-rows tr').length, 50);
    document.getElementById('inventory-next').click();
    assert.match(document.getElementById('inventory-page').textContent, /2/);
    const role = document.getElementById('inventory-role');
    role.value = 'G';
    role.dispatchEvent(new window.Event('change'));
    assert.equal(document.querySelectorAll('#inventory-rows tr').length, 0);
    assert.equal(document.getElementById('inventory-prev').disabled, true);
    assert.equal(document.getElementById('inventory-next').disabled, true);
    role.value = 'B';
    role.dispatchEvent(new window.Event('change'));
    assert(document.querySelectorAll('#inventory-rows tr').length > 0);
    assert.equal(document.getElementById('inventory-prev').disabled, true);
    const query = document.getElementById('inventory-query');
    query.value = 'no-such-inventory-file-7265';
    query.dispatchEvent(new window.Event('input'));
    assert.equal(document.querySelectorAll('#inventory-rows tr').length, 0);
    assert.match(document.getElementById('inventory-status').textContent, /^0 de/);
    document.getElementById('theme-toggle').click();
    assert.equal(document.documentElement.dataset.theme, 'dark');
    dom.window.close();
});

test('approved removals remain historical only in the original workspace and never return as active fixtures', () => {
    const data = JSON.parse(new JSDOM(fs.readFileSync('src/MoodleIFRN/docs/inventario-arquivos.html', 'utf8'))
        .window.document.getElementById('inventory-data').textContent);
    assert.equal(Object.keys(retiredFiles).length, 5);
    for (const relative of Object.keys(retiredFiles)) {
        const file = 'src/MoodleIFRN/' + relative;
        assert.equal(fs.existsSync(file), false, file);
        assert(!data.files.some(entry => entry.path === file && !entry.localOnly), file);
        for (const entry of data.files.filter(candidate => candidate.path === file)) {
            assert.equal(entry.localOnly, true);
            assert.equal(entry.retired, true);
            assert.equal(entry.role, 'D');
            assert.equal(entry.fixture, false);
        }
    }
    assert.equal(data.files.filter(file => file.fixture).length, 37);
    assert.equal(data.files.filter(file => file.role === 'G').length, 0);
});

test('shared documentation navigation respects root and html subdirectory without duplicated links', () => {
    for (const file of ['index.html', 'html/SEGURANCA.html']) {
        const dom = new JSDOM(fs.readFileSync('src/MoodleIFRN/docs/' + file, 'utf8'), {
            url: 'file:///repo/src/MoodleIFRN/docs/' + file, runScripts: 'outside-only',
        });
        dom.window.eval(fs.readFileSync('src/MoodleIFRN/docs/assets/manual.js', 'utf8'));
        const prefix = file.startsWith('html/') ? '../' : '';
        const links = [...dom.window.document.querySelectorAll('#sidebar a')];
        for (const page of ['estrutura-arquitetura.html', 'inventario-arquivos.html', 'inventario-fixtures.html', 'plano-limpeza.html']) {
            assert.equal(links.filter(link => link.getAttribute('href') === prefix + page).length, 1);
        }
        dom.window.close();
    }
});
