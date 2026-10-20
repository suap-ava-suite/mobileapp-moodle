import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';
const bundle = buildSync({ entryPoints: ['src/MoodleIFRN/mobilemoodle/core_mobile/api-painel.ts'], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
async function dashboard(data) {
    const entries = new Map([['ifrn_painel_dashboard', JSON.stringify(data)]]);
    const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
    const context = vm.createContext({ window: {}, sessionStorage: storage, localStorage: storage, URL, console: { log() {} } });
    vm.runInContext(bundle, context);
    return context.window.MobileMoodle.fetchPainelDashboard();
}
test('Metodologia usa o ID Moodle 2836 e o Presencial, independentemente de diário SUAP', async () => {
    const data = await dashboard({ diarios: [{ id: '2836', fullname: 'Metodologia Científica e Tecnológica (NCT)', diario_id: 123456,
        ambiente: { id: 3, titulo: 'Presencial' }, viewurl: 'https://presencial.ava.ifrn.edu.br/course/view.php?id=2836' }] });
    assert.equal(data.diarios[0].moodle_course_id, 2836);
    assert.equal(data.diarios[0].moodle_site_url, 'https://presencial.ava.ifrn.edu.br');
});
test('autoinscrição aceita estado aninhado v2 e preserva sua rota de detalhes', async () => {
    const data = await dashboard({ autoinscricoes: [{ id: '91', ambiente: { label: 'Acadêmico', value: 'academico' },
        viewurl: 'https://academico.ava.ifrn.edu.br/course/view.php?id=91',
        autoinscricao: { is_enrolled: false, details_url: '/curso/2/91/' } }] });
    assert.equal(data.autoinscricoes[0].is_enrolled, false);
    assert.equal(data.autoinscricoes[0].environment, 'Acadêmico');
    assert.equal(data.autoinscricoes[0].details_url, '/curso/2/91/');
});
test('vitrine sem matrícula confirmada não é apresentada como já matriculada', async () => {
    const data = await dashboard({ autoinscricoes: [{ id: 91 }] });
    assert.equal(data.autoinscricoes[0].is_enrolled, false);
});

test('preserva práticas e reutilizáveis com chaves distintas para mesmo ID em ambientes diferentes', async () => {
    const data = await dashboard({ praticas: [{ id: 7, viewurl: 'https://ead.ava.ifrn.edu.br/course/view.php?id=7' }],
        reutilizaveis: [{ id: 7, viewurl: 'https://presencial.ava.ifrn.edu.br/course/view.php?id=7' }] });
    assert.equal(data.praticas.length, 1);
    assert.equal(data.reutilizaveis.length, 1);
    assert.notEqual(data.praticas[0].key, data.reutilizaveis[0].key);
    assert.equal(data.courses.length, 2);
    assert.equal(data.praticas[0].launch.kind, 'moodle_native');
});
