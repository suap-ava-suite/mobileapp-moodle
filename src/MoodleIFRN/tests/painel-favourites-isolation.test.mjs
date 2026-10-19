import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import vm from 'node:vm';
import test from 'node:test';

const bundle = buildSync({
    entryPoints: ['src/MoodleIFRN/mobilemoodle/core_mobile/course-favourites.ts'],
    bundle: true, write: false, format: 'iife', globalName: 'favourites',
}).outputFiles[0].text;
const course = site => ({ id: 7, moodle_course_id: 7, moodle_site_url: site });
const academico = course('https://academico.ava.ifrn.edu.br');
const presencial = course('https://presencial.ava.ifrn.edu.br');

function setup() {
    const session = new Map([['ifrn_username', 'conta-a']]);
    const local = new Map();
    const context = vm.createContext({
        URL,
        sessionStorage: { getItem: key => session.get(key) ?? null },
        localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) },
    });
    vm.runInContext(bundle, context);
    return { api: context.favourites, session };
}

test('favoritos sobrevivem à recriação do painel e distinguem sites com courseid igual', () => {
    const { api } = setup();
    api.createCourseFavourites().toggle(academico);
    const reopened = api.createCourseFavourites();
    assert.equal(reopened.isFavourite(academico), true);
    assert.equal(reopened.isFavourite(presencial), false);
    reopened.toggle(academico);
    assert.equal(api.createCourseFavourites().isFavourite(academico), false);
});

test('troca de conta bloqueia a instância antiga e mantém preferências separadas', () => {
    const { api, session } = setup();
    const first = api.createCourseFavourites();
    first.toggle(academico);
    session.set('ifrn_username', 'conta-b');
    assert.equal(first.isFavourite(academico), false);
    assert.throws(() => first.toggle(academico), /conta ou o ambiente/);
    assert.equal(api.createCourseFavourites().isFavourite(academico), false);
    session.set('ifrn_username', 'conta-a');
    assert.equal(api.createCourseFavourites().isFavourite(academico), true);
});
