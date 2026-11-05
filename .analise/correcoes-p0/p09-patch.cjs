'use strict';

const path = require('node:path');
const {loadManifest, inspect, apply} = require('../../src/MoodleIFRN/tests/fixtures/p09/patch-runner.cjs');

function main(args) {
    const mode = args[0];
    const manifestFile = args[1];
    const rootArg = args.indexOf('--root');
    const root = path.resolve(rootArg >= 0 ? args[rootArg + 1] : process.cwd());
    if (!['--inspect', '--apply'].includes(mode) || !manifestFile) {
        throw new Error('usage: node p09-patch.cjs --inspect|--apply manifest.json [--root project-root]');
    }
    const manifest = loadManifest(path.resolve(manifestFile));
    const result = mode === '--inspect' ? {manifest: manifest.id, states: inspect(manifest, root)} : apply(manifest, root);
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

try { main(process.argv.slice(2)); }
catch (error) { process.stderr.write(`IFRN patch refused: ${error.message}\n`); process.exitCode = 1; }
