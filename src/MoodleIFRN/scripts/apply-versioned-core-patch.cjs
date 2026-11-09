'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256Source = value => sha256(value.toString('utf8').replace(/\r\n/g, '\n'));

function resolveInside(root, relativePath) {
    if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)
            || relativePath.split(/[\\/]/).includes('..')) {
        throw new Error('Caminho do patch deve ser relativo e permanecer dentro do repositório.');
    }

    const realRoot = fs.realpathSync(root);
    const target = path.resolve(realRoot, relativePath);
    const relative = path.relative(realRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Caminho do patch escapa do repositório.');
    }

    return target;
}

function inspectVersionedPatch(manifestPath, root) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.schema !== 'ifrn-core-patch/v1' || !manifest.id || !manifest.baseCommit
            || !Array.isArray(manifest.targets) || !manifest.targets.length) {
        throw new Error('Manifesto do patch de núcleo IFRN inválido.');
    }

    const patchPath = resolveInside(root, manifest.patchPath);
    const patch = fs.readFileSync(patchPath);
    if (sha256(patch) !== manifest.patchSha256) {
        throw new Error(`Hash do patch diverge do manifesto: ${manifest.patchPath}`);
    }

    const states = manifest.targets.map(target => {
        const filePath = resolveInside(root, target.path);
        const content = fs.readFileSync(filePath);
        const actual = sha256Source(content);
        if (actual === target.postSha256) {
            return { path: target.path, state: 'already-applied', sha256: actual };
        }
        if (actual === target.baseSha256) {
            return { path: target.path, state: 'ready', sha256: actual };
        }

        throw new Error(`Arquivo incompatível com o patch IFRN: ${target.path}`);
    });

    const allApplied = states.every(state => state.state === 'already-applied');
    const allReady = states.every(state => state.state === 'ready');
    if (!allApplied && !allReady) {
        throw new Error('Patch IFRN parcialmente aplicado; interrompido sem escrita.');
    }

    return { manifest, patchPath, state: allApplied ? 'already-applied' : 'ready', targets: states };
}

function applyVersionedPatch(manifestPath, root) {
    const inspected = inspectVersionedPatch(manifestPath, root);
    if (inspected.state === 'already-applied') {
        return inspected;
    }

    execFileSync('git', ['apply', '--check', '--', inspected.patchPath], { cwd: root, stdio: 'pipe' });
    execFileSync('git', ['apply', '--', inspected.patchPath], { cwd: root, stdio: 'pipe' });

    const after = inspectVersionedPatch(manifestPath, root);
    if (after.state !== 'already-applied') {
        throw new Error('O patch IFRN foi aplicado sem alcançar os hashes pós-imagem esperados.');
    }

    return { ...after, applied: true };
}

module.exports = { applyVersionedPatch, inspectVersionedPatch, sha256, sha256Source };
