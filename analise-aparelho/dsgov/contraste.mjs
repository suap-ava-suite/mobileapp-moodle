import fs from 'fs';
import path from 'path';

/**
 * Cálculo de luminância relativa e contraste WCAG 2.1
 */
function sRgbToLinear(c) {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex) {
    hex = hex.replace('#', '').trim();
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const rLin = sRgbToLinear(r);
    const gLin = sRgbToLinear(g);
    const bLin = sRgbToLinear(b);

    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function getContrastRatio(hex1, hex2) {
    const l1 = getRelativeLuminance(hex1);
    const l2 = getRelativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// Tokens do Tema DS Gov (Claro - Oficial web ref)
const lightTokens = {
    texto: '#333333',
    secundario: '#444444',
    muted: '#666666',
    superficie: '#ffffff',
    canvas: '#f6f6f6',
    interativo: '#1351b4',
    branco: '#ffffff',
    erro: '#d93514',
    sucesso: '#2d8a45',
    sucessoHoverWeb: '#184f16', // $green-cool-hover da web ref para texto normal
    superficieEscura: '#071d41', // Faixa escura institucional DS Gov
    interativoSobreEscuro: '#c5d6f5' // Borda/link suave DS Gov sobre fundo escuro
};

// Tokens do Modo Escuro (Derivado, não oficial - dark-palette Moodle)
const darkTokens = {
    texto: '#f8f9fa',
    secundario: '#dee2e6',
    muted: '#a6a6a6',
    superficie: '#1e1e1e',
    canvas: '#121212',
    interativo: '#82b1ff',
    branco: '#ffffff',
    erro: '#ff6b6b',
    sucesso: '#69db7c',
    superficieEscura: '#121212',
    interativoSobreEscuro: '#82b1ff'
};

const checksLight = [
    { name: 'texto / superfície', c1: lightTokens.texto, c2: lightTokens.superficie, min: 4.5, desc: 'Texto padrão sobre card/superfície' },
    { name: 'secundário / superfície', c1: lightTokens.secundario, c2: lightTokens.superficie, min: 4.5, desc: 'Texto secundário sobre card' },
    { name: 'muted / canvas', c1: lightTokens.muted, c2: lightTokens.canvas, min: 4.5, desc: 'Texto suave/auxiliar sobre fundo' },
    { name: 'interativo / superfície', c1: lightTokens.interativo, c2: lightTokens.superficie, min: 4.5, desc: 'Links e botões sobre superfície' },
    { name: 'branco / interativo', c1: lightTokens.branco, c2: lightTokens.interativo, min: 4.5, desc: 'Texto branco sobre botão primário' },
    { name: 'texto / canvas', c1: lightTokens.texto, c2: lightTokens.canvas, min: 4.5, desc: 'Texto padrão sobre fundo de página' },
    { name: 'erro / superfície', c1: lightTokens.erro, c2: lightTokens.superficie, min: 4.5, desc: 'Alerta de erro sobre fundo claro' },
    { 
        name: 'sucesso / superfície', 
        c1: lightTokens.sucesso, 
        c2: lightTokens.superficie, 
        min: 3.0, 
        note: '4.35:1 aprovado para UI/Badges (min 3.0). Para texto normal longo (min 4.5), o tema web fornece $green-cool-hover (#184f16) com 9.68:1.' 
    },
    { 
        name: 'interativo / superfície escura', 
        c1: lightTokens.interativoSobreEscuro, 
        c2: lightTokens.superficieEscura, 
        min: 4.5, 
        note: 'Elemento interativo/destaque sobre faixa institucional escura (#071d41) usa o token oficial $blue-warm-vivid-20 (#c5d6f5) ou branco (#ffffff, 16.65:1).' 
    }
];

const checksDark = [
    { name: 'texto / superfície', c1: darkTokens.texto, c2: darkTokens.superficie, min: 4.5, desc: 'Texto claro sobre card escuro' },
    { name: 'secundário / superfície', c1: darkTokens.secundario, c2: darkTokens.superficie, min: 4.5, desc: 'Texto secundário sobre card escuro' },
    { name: 'muted / canvas', c1: darkTokens.muted, c2: darkTokens.canvas, min: 4.5, desc: 'Texto suave sobre tela escura' },
    { name: 'interativo / superfície', c1: darkTokens.interativo, c2: darkTokens.superficie, min: 4.5, desc: 'Azul interativo derivado sobre card escuro' },
    { name: 'branco / interativo', c1: darkTokens.branco, c2: '#1351b4', min: 4.5, desc: 'Texto branco sobre botão azul (#1351b4)' },
    { name: 'texto / canvas', c1: darkTokens.texto, c2: darkTokens.canvas, min: 4.5, desc: 'Texto claro sobre tela escura' },
    { name: 'erro / superfície', c1: darkTokens.erro, c2: darkTokens.superficie, min: 4.5, desc: 'Vermelho de erro derivado sobre card escuro' },
    { name: 'sucesso / superfície', c1: darkTokens.sucesso, c2: darkTokens.superficie, min: 4.5, desc: 'Verde de sucesso derivado sobre card escuro' },
    { name: 'interativo / superfície escura', c1: darkTokens.interativoSobreEscuro, c2: darkTokens.superficieEscura, min: 4.5, desc: 'Azul interativo derivado sobre tela escura' }
];

let report = '========================================================================\n';
report += 'RELATÓRIO DE CONTRASTE WCAG 2.1 — DESIGN SYSTEM GOV.BR (IFRN)\n';
report += '========================================================================\n\n';

report += 'Nota de Conformidade: Todos os cálculos utilizam a fórmula matemática\n';
report += 'de luminância relativa da WCAG 2.1 (ISO/IEC 40500:2012).\n';
report += 'Mínimos regulamentares: 4.5:1 para texto normal; 3.0:1 para texto grande e componentes de UI.\n\n';

report += '------------------------------------------------------------------------\n';
report += '1. TEMA CLARO (Oficial — tokens extraídos diretamente da web ref)\n';
report += '------------------------------------------------------------------------\n';
for (const item of checksLight) {
    const ratio = getContrastRatio(item.c1, item.c2);
    const passed = ratio >= item.min;
    report += `[${passed ? 'APROVADO' : 'REPROVADO'}] ${item.name}\n`;
    report += `  Cores: ${item.c1} vs ${item.c2}\n`;
    report += `  Razão: ${ratio.toFixed(2)}:1 (Mínimo exigido: ${item.min}:1)\n`;
    if (item.note) {
        report += `  Observação: ${item.note}\n`;
    }
    report += '\n';
}

report += '------------------------------------------------------------------------\n';
report += '2. MODO ESCURO (Derivado, não oficial — adaptado do dark-palette do Moodle)\n';
report += '------------------------------------------------------------------------\n';
for (const item of checksDark) {
    const ratio = getContrastRatio(item.c1, item.c2);
    const passed = ratio >= item.min;
    report += `[${passed ? 'APROVADO' : 'REPROVADO'}] ${item.name} [derivado, não oficial]\n`;
    report += `  Cores: ${item.c1} vs ${item.c2}\n`;
    report += `  Razão: ${ratio.toFixed(2)}:1 (Mínimo exigido: ${item.min}:1)\n`;
    report += '\n';
}

const outputPath = path.resolve('analise-aparelho/dsgov/contraste.txt');
fs.writeFileSync(outputPath, report, 'utf8');
console.log('Relatório de contraste gerado com sucesso em:', outputPath);
