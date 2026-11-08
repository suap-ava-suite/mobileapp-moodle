const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { buildSync } = require('esbuild');

const bundle = buildSync({
    entryPoints: ['src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
}).outputFiles[0].text;

function setup(parentBridge) {
    const messages = [];
    const parent = {
        MoodleIfrnBridge: parentBridge,
        postMessage: (data, targetOrigin) => messages.push({ data, targetOrigin }),
    };
    const window = {
        MobileMoodle: {},
        location: { href: 'https://app.example/mobilemoodle/index.html', origin: 'https://app.example' },
        parent,
    };
    const document = { getElementsByTagName: () => [] };

    vm.runInNewContext(bundle, { window, document, URL, console });

    return { app: window.MobileMoodle.App, messages };
}

test('fallbacks de curso e matrícula enviam comandos somente à origem do Painel host', () => {
    const { app, messages } = setup(undefined);

    app.openMoodleCourse(42, 'Disciplina sintética', 'https://presencial.ava.ifrn.edu.br');
    app.openPainelEnrol(43, 2);

    assert.equal(messages.length, 2);
    assert.deepEqual(messages.map(message => message.targetOrigin), [
        'https://app.example', 'https://app.example',
    ]);
    assert.deepEqual(messages.map(message => message.data.type), [
        'MOODLE_IFRN_OPEN_COURSE', 'MOODLE_IFRN_OPEN_ENROL',
    ]);
});

test('ponte direta existente continua sendo preferida ao postMessage', () => {
    const calls = [];
    const { app, messages } = setup({
        openCourse: (...args) => calls.push(args),
        openEnrol: (...args) => calls.push(args),
    });

    app.openMoodleCourse(42, 'Disciplina sintética', 'https://academico.ava.ifrn.edu.br');
    app.openPainelEnrol(43, 2);

    assert.equal(calls.length, 2);
    assert.equal(messages.length, 0);
});

test('logout usa a mesma ponte com origem restrita', () => {
    const appSource = fs.readFileSync('src/MoodleIFRN/mobilemoodle/core_mobile/app.ts', 'utf8');

    assert.match(appSource, /postIfrnHostMessage\(\{ type: 'MOODLE_IFRN_LOGOUT' \}\)/);
    assert.doesNotMatch(appSource, /postMessage\([^;]*,\s*['"]\*['"]\s*\)/s);
});
