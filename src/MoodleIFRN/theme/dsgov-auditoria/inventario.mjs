import fs from 'node:fs';
import path from 'node:path';
const base = 'src/MoodleIFRN', out = path.join(base,'theme/dsgov-auditoria');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const files = walk(base).filter(f => /\.(scss|css|html|ts)$/.test(f) && !f.includes('dsgov-auditoria'));
const colors = new Map(), fonts = new Map(), counts = [];
for (const file of files) {
    const text = fs.readFileSync(file,'utf8');
    const matches = [...text.matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)];
    counts.push([file,matches.length]);
    for (const m of matches) colors.set(m[0].toLowerCase(), (colors.get(m[0].toLowerCase()) || 0) + 1);
    for (const m of text.matchAll(/font-family\s*:\s*([^;\n}]+)/gi)) fonts.set(m[1],(fonts.get(m[1]) || 0) + 1);
}
const top = map => [...map].sort((a,b) => b[1]-a[1]).slice(0,40).map(([v,n]) => `${n}\t${v}`).join('\n');
const ref = 'analise-aparelho/dsgov/ref/ifrn_dsgov/scss/';
const appVars = path.join(base,'mobilemoodle/static/theme/ifrn/scss/dsgov/_variables.scss');
function declarations(file) {
    return new Map(fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap((line,i) => {
        const m = line.match(/^\s*\$([\w-]+):\s*([^;]+);/);
        return m ? [[m[1], {value:m[2].trim(),line:i+1}]] : [];
    }));
}
const web = declarations(ref+'_variables.scss'), app = declarations(appVars);
const divergences = ['Token | tema web | app | arquivo:linha'];
for (const [token,entry] of web) {
    const current = app.get(token);
    if (!current || current.value !== entry.value) divergences.push(`$${token} | ${entry.value} | ${current?.value || 'ausente'} | ${appVars}:${current?.line || 'ausente'}`);
}
const text = ['Inventário atual: contagem de todas as cores/fontes em SCSS/CSS/HTML/TS.',
    '\nCORES POR ARQUIVO\n'+counts.sort((a,b)=>b[1]-a[1]).map(([f,n])=>`${n}\t${f}`).join('\n'),
    '\nCORES POR VALOR (40)\n'+top(colors),'\nFONT-FAMILY POR VALOR\n'+top(fonts),
    '\nFONTES LOCAIS\n'+walk(base).filter(f=>/rawline-.*\.woff2$/.test(f)).join('\n'),
    '\nDIVERGÊNCIAS PAINEL\n'+divergences.join('\n'),
    '\nFonte web: 400,400i,500,600,600i,700,700i. App: 400,500,600,700 normais; itálicos não fornecidos.',
    'moodle-course.scss: entrada global em angular.json:59; sintaxe @use. Nenhum arquivo de configuração alterado.',
    'Comparação histórica: analise-aparelho/dsgov/inventario.txt (somente leitura).',
    'Correções atuais, reaplicadas após corrigir o empacotamento: removidas autorreferências que invalidavam tokens; foco usa box-shadow; Rawline herdada; botões preenchidos usam azul oficial com branco no escuro.',
    'Painel: divergências semânticas/estruturais ausentes preservadas. container-max-width já foi alterado por commit anterior; nenhuma alteração nova no painel.',
    'Cores de marca IFRN e modos de acessibilidade preexistentes preservados.'];
fs.writeFileSync(path.join(out,'inventario.txt'),text.join('\n')+'\n');
fs.writeFileSync(path.join(out,'painel-divergencias.txt'),divergences.join('\n')+'\n');
console.log('Inventário e divergências registrados.');
