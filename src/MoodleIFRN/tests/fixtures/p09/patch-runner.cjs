'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const fail = message => { throw new Error(message); };

function loadManifest(file) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.schema !== 'ifrn-patch/v1' || !/^[a-z0-9][a-z0-9.-]+$/.test(manifest.id) ||
        !Array.isArray(manifest.targets) || !Array.isArray(manifest.operations)) {
        fail('invalid IFRN patch manifest');
    }
    return manifest;
}

function resolveTarget(root, relative) {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
        fail('target path must be relative and contained');
    }
    const rootReal = fs.realpathSync(path.resolve(root));
    const resolved = path.resolve(rootReal, relative);
    const rel = path.relative(rootReal, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) fail('target escapes patch root');
    if (fs.existsSync(resolved)) {
        const actual = fs.realpathSync(resolved);
        const actualRel = path.relative(rootReal, actual);
        if (actualRel.startsWith('..') || path.isAbsolute(actualRel)) fail('target symlink escapes patch root');
    }
    return resolved;
}

function inspect(manifest, root) {
    const states = [];
    for (const target of manifest.targets) {
        const file = resolveTarget(root, target.path);
        if (!fs.existsSync(file)) fail(`missing target: ${target.path}`);
        const content = fs.readFileSync(file, 'utf8');
        const actual = sha256(content);
        const applicable = target.sha256 === actual;
        const post = target.postSha256 && target.postSha256 === actual;
        if (!applicable && !post) fail(`hash mismatch: ${target.path}`);
        for (const anchor of target.anchors || []) {
            const n = content.split(anchor).length - 1;
            if (n !== 1) fail(`anchor count ${n}, expected one: ${target.path}`);
        }
        states.push({path: target.path, state: post ? 'already-applied' : 'compatible', sha256: actual});
    }

    for (const op of manifest.operations) {
        const file = resolveTarget(root, op.path);
        const content = fs.readFileSync(file, 'utf8');
        const actual = sha256(content);
        if (actual === op.postSha256 && content.includes(op.after)) {
            states.push({path: op.path, state: 'already-applied', sha256: actual});
        } else if (actual === op.sha256 && content.split(op.before).length - 1 === 1) {
            states.push({path: op.path, state: 'ready', sha256: actual});
        } else {
            fail(`operation incompatible or ambiguous: ${op.path}`);
        }
    }
    return states;
}

function apply(manifest, root) {
    if (manifest.status === 'blocked') fail(`manifest is inspection-only: ${manifest.blockReason || 'integration dependency unresolved'}`);
    const states = inspect(manifest, root); // Complete preflight before any write.
    const operationsByPath = new Map();
    for (const op of manifest.operations) {
        const group = operationsByPath.get(op.path) || [];
        group.push(op);
        operationsByPath.set(op.path, group);
    }
    const prepared = [];
    for (const [relative, ops] of operationsByPath) {
        const file = resolveTarget(root, relative);
        let next = fs.readFileSync(file, 'utf8');
        const initial = next;
        if (ops.length !== 1) fail(`one reviewed hunk per file is required: ${relative}`);
        for (const op of ops) {
            if (sha256(next) === op.postSha256 && next.includes(op.after)) continue;
            if (sha256(next) !== op.sha256) fail(`chained operations need one manifest hunk per file: ${relative}`);
            next = next.replace(op.before, op.after);
            if (sha256(next) !== op.postSha256) fail(`postimage hash mismatch: ${relative}`);
        }
        if (next !== initial) prepared.push({file, original: initial, next});
    }

    const written = [];
    try {
        for (const item of prepared) {
            const temp = `${item.file}.ifrn-${process.pid}.tmp`;
            fs.writeFileSync(temp, item.next, 'utf8');
            fs.renameSync(temp, item.file);
            written.push(item);
        }
    } catch (error) {
        for (const item of written.reverse()) fs.writeFileSync(item.file, item.original, 'utf8');
        throw error;
    }
    return {preflight: states, applied: prepared.map(item => path.relative(root, item.file))};
}

module.exports = {sha256, loadManifest, inspect, apply};
