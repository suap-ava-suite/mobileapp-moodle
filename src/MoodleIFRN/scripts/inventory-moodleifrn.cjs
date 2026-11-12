#!/usr/bin/env node
'use strict';

// Somente lê fontes. As únicas saídas são as duas páginas de inventário em docs/.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { folders, fixtures, purposes, folderFor } = require('./inventory-catalog.cjs');

const PREFIX = 'src/MoodleIFRN/';
const OUTPUT = `${PREFIX}docs/inventario-arquivos.html`;
const FIXTURE_OUTPUT = `${PREFIX}docs/inventario-fixtures.html`;
const GENERATED = new Set([OUTPUT, FIXTURE_OUTPUT]);
const AUDIT_DOCUMENTS = new Set([...GENERATED, `${PREFIX}docs/estrutura-arquitetura.html`, `${PREFIX}docs/plano-limpeza.html`]);
const TEXT = /\.(?:[cm]?js|ts|html|s?css|json|xml|md|txt|py|ps1|sh|ya?ml|java|m|patch|properties|gradle|toml)$/i;
const slash = value => value.replace(/\\/g, '/');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const jsonForHtml = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

function walk(root, relative = PREFIX.slice(0, -1), result = { files: [], directories: [], links: [] }) {
    result.directories.push(relative);
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const name = `${relative}/${entry.name}`;
        if (entry.isSymbolicLink()) {
            result.links.push(name); // Não seguir junctions para dependências externas ao escopo.
        } else if (entry.isDirectory()) {
            walk(root, name, result);
        } else {
            const content = fs.readFileSync(path.join(root, name));
            result.files.push({ path: name, bytes: content.length, hash: hash(content) });
        }
    }
    return result;
}

function resolveReference(from, specifier, paths) {
    if (!specifier || specifier.length > 512 || /^(?:https?:|data:|mailto:|#)/i.test(specifier)) return [];
    const spec = slash(specifier).split(/[?#]/)[0];
    const bases = spec.startsWith('@/') ? [`src/${spec.slice(2)}`]
        : spec.startsWith('src/') ? [spec]
            : [path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)), spec,
                ...(from.includes('/docs/') && !spec.startsWith('.') ? [`${PREFIX}${spec}`] : []),
                ...(spec.startsWith('pages/') || spec.startsWith('static/') ? [`${PREFIX}mobilemoodle/${spec}`] : [])];
    const found = new Set();
    for (const base of bases) {
        const directory = path.posix.dirname(base);
        const name = path.posix.basename(base);
        for (const candidate of [base, ...['.ts', '.js', '.cjs', '.mjs', '.scss'].map(ext => base + ext),
            `${base}/index.ts`, `${directory}/_${name}.scss`, `${base}.scss`]) {
            if (paths.has(candidate)) found.add(candidate);
        }
    }
    return [...found];
}

function referenceKind(file, kind) {
    if (file.endsWith('.md') || /(?:^|\/)(?:docs|\.analise)\//.test(file) && /\.(?:html|txt)$/.test(file)) return 'documentação';
    return kind;
}

function documentReferences(content) {
    const found = [];
    for (const match of content.matchAll(/src\/MoodleIFRN\/[A-Za-z0-9_./-]+/g)) found.push({ spec: match[0].replace(/[.,]+$/, ''), offset: match.index });
    for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g)) found.push({ spec: match[1], offset: match.index });
    for (const match of content.matchAll(/<code>([^<>\r\n]{1,512})<\/code>|`([^`\r\n]{1,512})`/g)) {
        found.push({ spec: match[1] || match[2], offset: match.index });
    }
    return found;
}

function collectReferences(root, records, externalRoot) {
    const paths = new Set(records.map(file => file.path));
    const incoming = new Map(records.map(file => [file.path, []]));
    const outgoing = new Map(records.map(file => [file.path, []]));
    const modules = new Map(records.map(file => [file.path, []]));
    const texts = new Map();
    const security = [];
    const metrics = [];
    const anyTypes = [];
    const repoFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean);
    const sources = new Map(repoFiles.map(file => [file, root]));
    for (const record of records) sources.set(record.path, record.localOnly ? externalRoot : root);
    // Ferramentas locais ignoradas também podem carregar fixtures: lê apenas fontes, sem executar.
    if (externalRoot && fs.existsSync(path.join(externalRoot, '.analise'))) {
        function diagnostics(directory) {
            for (const entry of fs.readdirSync(path.join(externalRoot, directory), { withFileTypes: true })) {
                const name = `${directory}/${entry.name}`;
                if (entry.isSymbolicLink()) continue;
                if (entry.isDirectory() && !/harness-|node_modules|\.gradle/.test(name)) diagnostics(name);
                else if (entry.isFile() && /\.(?:cjs|mjs|py|ps1|sh)$/.test(name) && !sources.has(name)) sources.set(name, externalRoot);
            }
        }
        diagnostics('.analise');
    }
    const add = (target, source, line, kind) => {
        if (!incoming.has(target) || target === source) return;
        const refs = incoming.get(target);
        if (!refs.some(ref => ref.source === source && ref.line === line && ref.kind === kind)) refs.push({ source, line, kind });
        if (outgoing.has(source) && !outgoing.get(source).includes(target)) outgoing.get(source).push(target);
    };
    const basenames = new Map();
    for (const record of records) {
        const name = path.posix.basename(record.path);
        basenames.set(name, [...basenames.get(name) || [], record.path]);
    }
    for (const [file, sourceRoot] of sources) {
        if (!sourceRoot || AUDIT_DOCUMENTS.has(file) || file.endsWith('inventory-catalog.cjs') || !TEXT.test(file)
                || /(?:package-lock\.json|\.map)$/.test(file)) continue;
        const full = path.join(sourceRoot, file);
        if (!fs.existsSync(full)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('\0')) continue;
        if (file.startsWith(PREFIX) && sourceRoot === root && !file.includes('/static/vendor/')) texts.set(file, content);
        const internal = file.startsWith(PREFIX);
        if (!internal && !/MoodleIFRN|mobilemoodle|fixtures/.test(content)) continue;
        const sourceKind = file.includes('/static/vendor/') ? 'import de distribuição' : 'caminho literal';
        const remember = (spec, offset, kind) => {
            if (file.endsWith('inventory-moodleifrn.cjs') && kind !== 'import dinâmico/require') return;
            const line = lineAt(content, offset);
            const targets = resolveReference(file, spec, paths);
            if (modules.has(file) && /^(?:@|node:|sass:|[a-z][a-z0-9-]*$)/.test(spec)
                    && ['import/export', 'import dinâmico/require'].includes(kind) && !targets.length
                    && !modules.get(file).includes(spec)) modules.get(file).push(spec);
            for (const target of targets) add(target, file, line, referenceKind(file, kind));
            // Evidência de enumeração de pasta, não de execução individual dos seus arquivos.
            const normalized = slash(spec).replace(/\/$/, '');
            if (normalized.startsWith(PREFIX) && !path.posix.extname(normalized)) {
                for (const target of paths) if (target.startsWith(`${normalized}/`)) add(target, file, line, referenceKind(file, 'pasta/caminho dinâmico'));
            }
            // Menção de basename é conservadora: não prova que o arquivo é carregado.
            if (!targets.length && path.posix.basename(normalized) === normalized && basenames.has(normalized)) {
                for (const target of basenames.get(normalized)) add(target, file, line, referenceKind(file, 'menção de nome (revisar)'));
            }
        };
        if (/\.(?:ts|[cm]?js)$/.test(file) && !file.includes('/static/vendor/')) {
            const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
            let anyCount = 0;
            function visit(node) {
                if (node.kind === ts.SyntaxKind.AnyKeyword) anyCount += 1;
                if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
                    remember(node.moduleSpecifier.text, node.getStart(ast), 'import/export');
                } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require')
                        && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
                    remember(node.arguments[0].text, node.getStart(ast), 'import dinâmico/require');
                } else if (ts.isStringLiteralLike(node)) {
                    remember(node.text, node.getStart(ast), sourceKind);
                }
                if (internal && !file.includes('/static/vendor/') && (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node))) {
                    const lines = ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
                    if (lines >= 80) metrics.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, name: node.name?.getText(ast) || '(anônima)', lines });
                }
                ts.forEachChild(node, visit);
            }
            visit(ast);
            if (anyCount) anyTypes.push({ file, count: anyCount });
        } else {
            for (const match of content.matchAll(/(?:src|href|url|@(?:use|forward|import))\s*(?:=|\()?\s*["']([^"']+)["']/g)) remember(match[1], match.index, 'template/estilo/configuração');
            if (/\.(?:css|scss)$/.test(file)) {
                for (const match of content.matchAll(/\burl\(\s*(?!["'])([^)\s]+)\s*\)/g)) remember(match[1], match.index, 'url de estilo');
            }
            for (const match of content.matchAll(/["']([^"'\r\n]{1,512})["']/g)) remember(match[1], match.index, sourceKind);
        }
        if (/\.(?:md|html)$/.test(file)) {
            for (const item of documentReferences(content)) remember(item.spec, item.offset, 'caminho em texto/documentação');
        }
        if (file.startsWith(PREFIX) && !file.includes('/static/vendor/') && !file.includes('/node_modules/')) {
            for (const match of content.matchAll(/(?:eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}|[?&](?:wstoken|access_token|refresh_token)=[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/g)) {
                security.push({ file, line: lineAt(content, match.index), kind: 'formato potencial de segredo; revisar origem/validade sem publicar o valor', testContext: /\/(?:tests|fixtures)\//.test(file) });
            }
        }
    }
    function reviewed(target, source, needle, kind) {
        const content = texts.get(source) || fs.readFileSync(path.join(root, source), 'utf8');
        const offset = content.indexOf(needle);
        if (offset < 0) throw new Error(`Âncora revisada ausente: ${source}`);
        add(target, source, lineAt(content, offset), kind);
    }
    for (const record of records.filter(file => !file.localOnly && file.path.startsWith(`${PREFIX}mobilemoodle/`))) {
        reviewed(record.path, 'angular.json', '"input": "src/MoodleIFRN/mobilemoodle"', 'cópia de diretório no build');
        if (record.path.includes('/static/vendor/')) reviewed(record.path, `${PREFIX}mobilemoodle/build.mjs`, 'function syncVendorAssets', 'sincronização de distribuição (grupo)');
    }
    for (const name of ['painel', 'curso', 'erros']) reviewed(`${PREFIX}mobilemoodle/pages/${name}.html`, `${PREFIX}mobilemoodle/core_mobile/app-router.ts`, `'pages/${name}.html'`, 'fetch dinâmico revisado');
    for (const name of ['DurableVersions.java', 'DurableVersionsJvmTest.java']) {
        reviewed(`${PREFIX}tests/fixtures/p08-native/${name}`, `${PREFIX}tests/native-persistence-contract.test.cjs`, "['javac'", 'javac explícito revisado (JVM)');
    }
    for (const record of records.filter(file => !file.localOnly && file.path.endsWith('.ts'))) {
        reviewed(record.path, 'tsconfig.app.json', '"src/**/*.ts"', 'include de tipos (não prova uso em tela)');
    }
    for (const record of records.filter(file => file.path.startsWith(`${PREFIX}tests/fixtures/p08-native/`) && file.path.endsWith('.java') && !file.path.endsWith('DurableVersionsJvmTest.java'))) {
        const source = '.analise/correcoes-p0/p08-build-harness.py';
        if (fs.existsSync(path.join(root, source))) reviewed(record.path, source, "source.glob('*.java')", 'glob Java revisado (compilação)');
    }
    return { incoming, outgoing, modules, texts, security, anyTypes: anyTypes.sort((a, b) => b.count - a.count),
        styleMetrics: [...texts].filter(([file]) => /\.(?:scss|css)$/.test(file)).map(([file, content]) => ({ file, important: (content.match(/!important\b/g) || []).length })),
        metrics: metrics.sort((a, b) => b.lines - a.lines) };
}

function classify(record, refs) {
    const relative = record.path.slice(PREFIX.length);
    const fixture = fixtures[relative.replace(/^tests\/fixtures\//, '')];
    const [folderPurpose, folderRole] = folderFor(path.posix.dirname(relative));
    let role = relative.startsWith('docs/') ? 'C' : relative.startsWith('tests/') || relative.startsWith('diagnosticos/') || relative.startsWith('scripts/') || relative.startsWith('patches/') || /(?:build|patch).*\.(?:cjs|mjs|js)$/.test(relative) ? 'B' : 'A';
    let purpose = purposes[relative] || fixture?.[1] || (/\.test\.[cm]?js$/.test(relative) ? `Regressões de ${path.posix.basename(relative).replace(/\.test\.[cm]?js$/, '')}; assertions e mocks no próprio arquivo.` : folderPurpose);
    let classification = fixture?.[0] || (role === 'C' ? 'Documentação' : role === 'B' ? 'Necessária ao desenvolvimento' : 'Essencial para produção/build');
    let recommendation = 'Manter; revisar dependências e testes antes de alterar.';
    let risk = role === 'A' ? 'Alto' : 'Médio';
    if (/^(?:patches\/|patch-moodle-ifrn|scripts\/(?:apply-versioned|generate-p04|cordova-inappbrowser|patch-inappbrowser))/.test(relative)) risk = 'Alto (reprodução do build/patch)';
    const runtime = refs.filter(ref => !['documentação', 'menção de nome (revisar)', 'cópia de diretório no build', 'sincronização de distribuição (grupo)', 'pasta/caminho dinâmico'].includes(ref.kind));
    let usage = runtime.length || role === 'C' && refs.some(ref => ref.kind === 'documentação') ? 'Uso comprovado (estático/build)' : refs.length ? 'Uso provável/indireto' : 'Nenhuma referência encontrada';
    if (relative.startsWith('course-loading/') || relative === 'navigation/early-course-handoff.js') {
        role = 'G'; classification = 'Candidata à remoção'; risk = 'Médio';
        recommendation = 'Aguardar Fase 2: componente sem consumidor encontrado ou IIFE desativada; conferir seletor, patches e intenção da release.';
    }
    if (relative.includes('/static/vendor/')) {
        purpose = 'Asset de distribuição Ionic/Ionicons; cópia em bloco e resolução por imports, registry ou nome de ícone.';
        recommendation = 'Manter nesta fase; revisar estratégia de cópia/empacotamento em vez de apagar chunks ou SVG isolados.';
    }
    if (/^docs\/markdown\//.test(relative)) recommendation = 'Preservar fonte Markdown da migração; diferenças editoriais exigem revisão antes de consolidação.';
    if (/mobilemoodle\.(?:js|css)$/.test(relative)) { record.generated = true; recommendation = 'Editar TS/SCSS e regenerar com mobilemoodle/build.mjs; não editar a saída manualmente.'; }
    if (relative.includes('/static/vendor/')) record.generated = true;
    if (fixture?.[0] === 'Candidata à remoção') { role = 'G'; risk = 'Baixo (somente harness)'; recommendation = 'Fase 2: revisar scaffold CSS/logo em conjunto e validar o harness; não excluir nesta execução.'; }
    if (fixture?.[0] === 'Duplicada' || fixture?.[0] === 'Histórica') recommendation = 'Preservar proveniência/snapshots nesta fase; propor fonte única somente com hashes, manifesto e build do harness revisados.';
    if (relative.startsWith('resources/') && /(?:icon|splash)\.png$/.test(relative)) { classification = 'Sem referência de consumo encontrada'; recommendation = 'Revisar geradores Cordova/branding antes de propor remoção; fonte gráfica pode ser útil sem import.'; }
    if (record.localOnly) {
        role = /\/(?:platforms|plugins|\.gradle|build)\//.test(record.path) ? 'F' : 'D';
        classification = role === 'F' ? 'Gerado/local; não rastreado nesta release' : 'Somente no workspace original; fora desta release';
        purpose = role === 'F' ? 'Artefato local do harness/Cordova, cache, cópia de plugin ou resultado de compilação.' : 'Arquivo presente na árvore anterior/local; a release contém outra organização/versão.';
        recommendation = 'Preservar. Comparar com fontes e reprodução antes de qualquer limpeza autorizada.';
        usage = role === 'F' ? 'Uso provável/indireto' : 'Uso desconhecido';
        risk = /\.(?:keystore|jks)$/.test(record.path) ? 'Alto (material de chave local)' : 'Indeterminado';
        record.generated = role === 'F';
    }
    if (/\.d\.ts$/.test(record.path)) recommendation = 'Manter declaração de tipos, também incluída por tsconfig; não exige import de runtime.';
    return { role, folderRole, purpose, classification, recommendation, risk, usage, fixture: !!fixture && !record.localOnly };
}

function collect(root, localRoot) {
    const primary = walk(root);
    const local = localRoot ? walk(localRoot) : null;
    const records = primary.files.map(file => ({ ...file, source: 'release/auditoria' }));
    const byPath = new Map(records.map(file => [file.path, file]));
    for (const file of local?.files || []) {
        const existing = byPath.get(file.path);
        if (existing) {
            existing.localVariant = existing.hash !== file.hash;
        } else {
            const extra = { ...file, localOnly: true, source: 'somente workspace original' };
            records.push(extra); byPath.set(extra.path, extra);
        }
    }
    for (const output of GENERATED) {
        if (!byPath.has(output)) {
            const record = { path: output, bytes: null, hash: null, source: 'release/auditoria', generated: true };
            records.push(record); byPath.set(output, record);
        } else { byPath.get(output).bytes = null; byPath.get(output).hash = null; }
    }
    const refs = collectReferences(root, records, localRoot);
    const hashes = new Map();
    for (const file of records.filter(record => record.hash && !record.localOnly)) hashes.set(file.hash, [...hashes.get(file.hash) || [], file.path]);
    const duplicates = [...hashes.values()].filter(group => group.length > 1);
    const duplicateIndex = new Map(duplicates.flatMap((group, index) => group.map(file => [file, index + 1])));
    const files = records.sort((a, b) => a.path.localeCompare(b.path, 'en')).map(record => {
        const references = refs.incoming.get(record.path) || [];
        return { ...record, ...classify(record, references), extension: path.posix.extname(record.path) || '(sem extensão)',
            references, dependencies: refs.outgoing.get(record.path) || [], externalDependencies: refs.modules.get(record.path) || [], duplicateGroup: duplicateIndex.get(record.path) || null };
    });
    return {
        base: '6e58913fe', scope: 'snapshot da release/auditoria + metadados dos arquivos locais adicionais; sem seguir junctions',
        files, directories: primary.directories, localDirectories: local?.directories || [], links: local?.links || [],
        duplicates, security: refs.security, longFunctions: refs.metrics.slice(0, 35), anyTypes: refs.anyTypes, styleMetrics: refs.styleMetrics,
        summary: { files: files.length, primaryFiles: files.filter(file => !file.localOnly).length, localExtraFiles: files.filter(file => file.localOnly).length,
            primaryDirectories: primary.directories.length, localDirectories: local?.directories.length || 0,
            uniqueDirectories: new Set([...primary.directories, ...local?.directories || []]).size,
            fixtures: files.filter(file => file.fixture).length, duplicateGroups: duplicates.length,
            candidates: files.filter(file => file.role === 'G').length,
            noReference: files.filter(file => !file.localOnly && file.usage === 'Nenhuma referência encontrada').length },
    };
}

function portalShell(root, title, filename, body, extraHead = '') {
    const index = fs.readFileSync(path.join(root, `${PREFIX}docs/index.html`), 'utf8');
    const header = index.slice(index.indexOf('<body>') + 6, index.indexOf('<main id="conteudo"'));
    const prepared = header.replace(/href="#/g, 'href="index.html#').replace('href="index.html#conteudo"', 'href="#conteudo"').replace(/href="(?:index\.html#inicio)"(?= aria-label)/g, 'href="index.html"');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)} | Moodle IFRN</title><link rel="stylesheet" href="assets/manual.css"><link rel="stylesheet" href="assets/inventario.css"><script src="assets/manual.js" defer></script>${extraHead}</head><body data-document="${escapeHtml(filename)}">${prepared}<main id="conteudo" class="content inventory-content">${body}</main></div><p id="live-status" class="visually-hidden" role="status" aria-live="polite"></p></body></html>`;
}

function fixturesHtml(root, data) {
    const rows = data.files.filter(file => file.fixture).map(file => {
        const key = file.path.slice(`${PREFIX}tests/fixtures/`.length);
        const entry = fixtures[key];
        const refs = file.references.map(ref => `${ref.source}:${ref.line} (${ref.kind})`).join('\n');
        return `<tr><td><code>${escapeHtml(key)}</code><br>${escapeHtml(file.extension)} · ${file.bytes} bytes</td><td>${escapeHtml(entry[1])}</td><td>${escapeHtml(entry[2])}<br>${escapeHtml(entry[3])}<details><summary>Referências coletadas (${file.references.length})</summary><pre>${escapeHtml(refs || 'Sem referência literal coletada; examinar o contrato/convenção descrito.')}</pre></details></td><td>${escapeHtml(entry[0])}${file.duplicateGroup ? `<br>Grupo SHA-256 ${file.duplicateGroup}` : ''}</td><td>${escapeHtml(file.recommendation)}<br>Risco: ${escapeHtml(file.risk)}</td></tr>`;
    }).join('');
    return portalShell(root, 'Inventário individual das fixtures', 'inventario-fixtures.html', `<section class="hero searchable"><p class="eyebrow">AUDITORIA · FASE 1</p><h1>Inventário individual das fixtures</h1><p>39 fontes e artefatos rastreados do snapshot inicial da release. São contratos executáveis e harnesses, não dados reais de alunos.</p><p><a href="estrutura-arquitetura.html">Arquitetura</a> · <a href="inventario-arquivos.html">Inventário completo e filtros</a></p></section><section class="doc-section searchable"><h2>Como interpretar</h2><p>Require, fs, processo filho, glob Python, plugin.xml e convenções Cordova são dependências válidas. Histórico, duplicado ou sem import não significa descartável. Os arquivos locais adicionais do harness estão na tabela completa, separados das 39 fontes rastreadas.</p><p>A revisão dos arquivos textuais identificou identidades/tokens explicitamente sintéticos e metadados públicos do scaffold; nenhum dado de aluno ou token real foi confirmado nas fontes das fixtures. Os dois JARs são binários de dependência: não equivalem a dados simulados e sua origem deve continuar verificável. Não foram executadas autenticações ou instrumentação no celular. Isto não é certificação de ausência de segredos.</p><div class="table-wrap"><table><thead><tr><th>Arquivo e tipo</th><th>Finalidade real</th><th>Consumidores e carregamento</th><th>Classificação</th><th>Recomendação/risco</th></tr></thead><tbody>${rows}</tbody></table></div></section>`);
}

function qualityHtml(data) {
    const functions = data.longFunctions.map(item => `<tr><td><code>${escapeHtml(item.file)}:${item.line}</code></td><td>${escapeHtml(item.name)}</td><td>${item.lines}</td></tr>`).join('');
    const anyTypes = data.anyTypes.map(item => `${item.file}: ${item.count}`).join('\n');
    const styles = data.styleMetrics.filter(item => !item.file.includes('/docs/') && item.important)
        .map(item => `${item.file}: ${item.important}`).join('\n');
    const primaryDirectories = new Set(data.directories);
    const extraDirectories = data.localDirectories.filter(directory => !primaryDirectories.has(directory));
    return `<section class="doc-section searchable"><h2>Indicadores de manutenção</h2>
      <p>Contagens estáticas, não defeitos automaticamente confirmados: funções/métodos declarados com 80 ou mais linhas (até 35 maiores), nós AnyKeyword da AST e ocorrências textuais de !important nos estilos próprios, incluindo comentários. Arquivos gerados podem repetir regras das fontes: não somar esses números como dívida independente.</p>
      <details><summary>Funções e métodos extensos</summary><div class="table-wrap"><table><thead><tr><th>Arquivo/linha</th><th>Função</th><th>Linhas</th></tr></thead><tbody>${functions}</tbody></table></div></details>
      <details><summary>Tipos any explícitos</summary><pre>${escapeHtml(anyTypes || 'Nenhum nó encontrado no conjunto analisado.')}</pre></details>
      <details><summary>Ocorrências de !important</summary><pre>${escapeHtml(styles || 'Nenhuma ocorrência encontrada.')}</pre></details>
      <p>Priorizar extração de funções puras e limites de responsabilidade, com testes de sessão preservados. Subscriptions/listeners exigem análise de ciclo de vida; uma contagem de add/remove não comprova vazamento.</p>
      <h3>Diretórios locais adicionais</h3><p>${data.summary.uniqueDirectories} diretórios únicos entre as duas árvores, incluindo a raiz. A arquitetura descreve os 69 da release. Os ${extraDirectories.length} abaixo existem somente na árvore original; plataformas/plugins/build são gerados do harness, os demais precisam de comparação histórica. Diretórios vazios também foram contados. Nada foi movido ou removido.</p>
      <details><summary>Diretórios locais fora da release (${extraDirectories.length})</summary><pre>${escapeHtml(extraDirectories.join('\n'))}</pre></details>
      <details><summary>Limites por junction (${data.links.length})</summary><pre>${escapeHtml(data.links.join('\n') || 'Nenhuma junction adicional.')}</pre></details></section>`;
}

function inventoryHtml(root, data) {
    const compact = data.files;
    const html = portalShell(root, 'Inventário completo de arquivos', 'inventario-arquivos.html', `<section class="hero searchable"><p class="eyebrow">AUDITORIA · FASE 1 · BASE 6e58913fe</p><h1>Inventário completo de arquivos</h1><p>${data.summary.primaryFiles} arquivos da release/novos documentos e ferramentas, ${data.summary.primaryDirectories} diretórios (incluindo a raiz), mais ${data.summary.localExtraFiles} arquivos adicionais encontrados no workspace original. Nenhuma exclusão, movimentação ou renomeação foi realizada.</p><p><a href="estrutura-arquitetura.html">Estrutura e arquitetura</a> · <a href="inventario-fixtures.html">As 39 fixtures, uma a uma</a> · <a href="plano-limpeza.html">Proposta da Fase 2</a></p></section><section class="doc-section searchable"><h2>Método e limites</h2><p>Árvore percorrida por filesystem, incluindo arquivos ocultos e ignorados. Junctions não são seguidas (${data.links.length} no workspace original). Hash SHA-256 para duplicação exata na árvore da release; imports/exports/require, caminhos literais, HTML/SCSS/XML, diretórios copiados e contratos dinâmicos revisados. Dependências externas são pesquisadas nos arquivos rastreados do repositório e nas ferramentas locais de diagnóstico; nada é executado para descobrir utilização.</p><p>“Uso comprovado” significa referência estática/build encontrada, não execução no aparelho. Cópia em bloco e menção de nome são evidência indireta. Sem referência não prova inutilidade. Markdown e HTML equivalentes são fontes/migração, não duplicação binária. Os dados desta tabela não contam como referências para si mesmos. Os relatórios gerados não possuem tamanho/hash no próprio snapshot para evitar autorreferência.</p><p>Base inicial: 3.101 arquivos/69 diretórios na release; workspace original: 4.196 arquivos/705 diretórios e uma junction. As diferenças locais foram inventariadas como metadados, sem importar seu conteúdo para a branch. ${data.summary.duplicateGroups} grupos de duplicação exata, ${data.summary.noReference} arquivos da release sem referência coletada e ${data.summary.candidates} candidatos conservadores de revisão. Veja os filtros, não interprete esses totais como autorização para apagar.</p><p>O scanner procura apenas alguns formatos de segredo; ${data.security.length} ocorrências textuais exigem revisão contextual. Publica localização/tipo, nunca valores. Keystores locais e outros binários não são certificados por essa busca. A lista de dependências inclui apenas caminhos resolvidos dentro do inventário; imports de Angular, RxJS, Moodle, npm e APIs estão explicados na arquitetura.</p><details><summary>Localizações que exigem revisão de segurança (${data.security.length})</summary><pre>${escapeHtml(data.security.map(item => `${item.file}:${item.line} · ${item.kind}${item.testContext ? ' · contexto de teste' : ''}`).join('\n') || 'Nenhum formato procurado foi encontrado; isso não comprova ausência de dados sensíveis.')}</pre></details></section><section class="doc-section"><h2>Arquivos, dependências e recomendações</h2><div class="inventory-filters"><label>Pesquisar caminho, finalidade ou referência<input id="inventory-query" type="search" autocomplete="off"></label><label>Categoria<select id="inventory-role"><option value="">Todas</option>${['A','B','C','D','F','G'].map(role => `<option>${role}</option>`).join('')}</select></label><label>Evidência<select id="inventory-usage"><option value="">Todas</option>${['Uso comprovado (estático/build)','Uso provável/indireto','Nenhuma referência encontrada','Uso desconhecido'].map(value => `<option>${escapeHtml(value)}</option>`).join('')}</select></label><label>Origem<select id="inventory-source"><option value="">Todas</option><option>release/auditoria</option><option>somente workspace original</option></select></label><label><input id="inventory-duplicates" type="checkbox"> Somente duplicados exatos</label></div><p>A: produção/build · B: desenvolvimento/testes · C: documentação · D: somente árvore anterior · F: gerado local · G: candidato à revisão. Duplicação é indicada separadamente.</p><p id="inventory-status" role="status" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Caminho/tipo/origem</th><th>Finalidade/classificação</th><th>Dependências e evidência</th><th>Recomendação/risco</th></tr></thead><tbody id="inventory-rows"></tbody></table></div><div class="inventory-pagination"><button id="inventory-prev" type="button">Anterior</button><span id="inventory-page"></span><button id="inventory-next" type="button">Próxima</button></div><noscript>Ative JavaScript para filtrar a tabela local. A página de fixtures e a arquitetura permanecem legíveis sem JavaScript.</noscript></section><script id="inventory-data" type="application/json">${jsonForHtml({ summary: data.summary, files: compact })}</script>`, '<script src="assets/inventario.js" defer></script>');
    return html.replace('<script id="inventory-data"', qualityHtml(data) + '<script id="inventory-data"');

}

function main() {
    const root = path.resolve(__dirname, '../../..');
    const args = process.argv.slice(2);
    if (args.some(arg => !arg.startsWith('--local-root='))) throw new Error('Uso: node src/MoodleIFRN/scripts/inventory-moodleifrn.cjs [--local-root=workspace]');
    const localRoot = args[0] ? path.resolve(args[0].slice('--local-root='.length)) : null;
    const data = collect(root, localRoot);
    fs.writeFileSync(path.join(root, OUTPUT), inventoryHtml(root, data));
    fs.writeFileSync(path.join(root, FIXTURE_OUTPUT), fixturesHtml(root, data));
    console.log(JSON.stringify(data.summary));
}

if (require.main === module) main();
module.exports = { escapeHtml, jsonForHtml, walk, resolveReference, documentReferences, classify, collect, portalShell, fixturesHtml, inventoryHtml };
