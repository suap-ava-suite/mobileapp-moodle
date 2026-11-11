// Somente métodos/arquivos da stack Angular; nunca imprime linhas brutas.
const { execFileSync } = require('node:child_process');
const pid = execFileSync('adb', ['shell', 'pidof', 'com.moodle.moodlemobile'], { encoding: 'utf8' }).trim();
if (!/^\d+$/.test(pid)) throw new Error('App unavailable');
const lines = execFileSync('adb', ['logcat', '-d', '--pid=' + pid, '-t', '3000'], {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
}).split('\n');
const errors = [];
for (let index = 0; index < lines.length; index++) {
    if (!/NG\d{4}|Cannot read properties|Unhandled Promise rejection/.test(lines[index])) continue;
    const stack = lines.slice(index, index + 15).join('\n');
    errors.push({ time: lines[index].slice(0, 18), code: lines[index].match(/NG\d{4}/)?.[0] || 'js-runtime-error',
        methods: [...stack.matchAll(/\bat ([\w.$]+)/g)].map(match => match[1]).slice(0, 15),
        sources: [...stack.matchAll(/\b([\w_-]+\.js:\d+:\d+)/g)].map(match => match[1]).slice(0, 15),
    });
}
console.log(JSON.stringify(errors.slice(-5), null, 2));
