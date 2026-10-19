import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const original=process.argv.includes('--original');
const source = original ? execFileSync('git',['show','HEAD:src/MoodleIFRN/theme/ifrn-dsgov-tokens.scss'],{encoding:'utf8'}) : fs.readFileSync(path.join(dir, '../ifrn-dsgov-tokens.scss'), 'utf8');
const blocks = [...source.matchAll(/:root(?:\.dark)?\s*\{([^}]+)\}/g)];
const parse = s => Object.fromEntries([...s.matchAll(/--ifrn-([\w-]+):\s*(#[\da-f]+)\s*;/gi)].map(m => [m[1], m[2]]));
const light = parse(blocks[0][1]), dark = {...light, ...parse(blocks[1][1])};
function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255)
        .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const pairs = [['text','surface'], ['secondary','surface'], ['muted','canvas'],
    ['interactive','surface'], ['white','interactive'], ['text','canvas'],
    ['error','surface'], ['success','surface'], ['interactive','dark'],
    ['white','button-background'], ['white','button-active']];
const lines = ['Contraste WCAG: valores extraídos do SCSS atual; texto normal >= 4.5, UI >= 3.',
    'O cálculo anterior em analise-aparelho usa valores fixos e não representa as correções atuais.'];
for (const [name, tokens] of [['claro',light], ['escuro: derivado, não oficial',dark]]) {
    tokens['button-background'] ??= tokens.interactive;
    tokens['button-active'] ??= tokens.active;
    lines.push('\n' + name);
    for (const [fg,bg] of pairs) {
        const a = fg === 'white' ? '#ffffff' : tokens[fg], b = tokens[bg];
        const value = contrast(a,b);
        const status = value >= 4.5 ? 'APROVADO' : 'PENDÊNCIA texto normal';
        lines.push(`${fg}/${bg}: ${a}/${b} = ${value.toFixed(2)}:1 | ${status}${value >= 3 && value < 4.5 ? '; permite UI/texto grande' : ''}`);
    }
}
lines.push('\nPendências: sucesso claro não serve para texto normal. Usar success-hover para texto.',
    'Branco sobre interactive no escuro reprova. Sem os tokens button-background/button-active, a verificação de botão usa os tokens interactive/active efetivos.',
    'Interactive sobre dark no claro reprova. Nessas faixas usar branco ou border-blue.',
    'Todos os valores do escuro são derivados, não oficiais. Branco sobre button-background/button-active é verificado separadamente do azul claro de links.',
    original ? 'Este arquivo descreve o HEAD original, antes das correções desta rodada.' : 'Este arquivo descreve as correções atuais, reaplicadas após resolver o empacotamento Cordova.');
fs.writeFileSync(path.join(dir, original ? 'contraste-original.txt' : 'contraste.txt'), lines.join('\n') + '\n');
console.log('Contraste recalculado com tokens reais; pendências explícitas em contraste.txt.');
