// Only --inspect is read-only. --install-authorized requires the user's explicit package/install approval.
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const mode = process.argv[2];
const harness = 'br.edu.ifrn.experimental.p08.persistence';
const main = 'com.moodle.moodlemobile';
const build = JSON.parse(fs.readFileSync(`${__dirname}/p08-harness-build.json`, 'utf8'));
const evidence = {harnessPackage: harness, commands: [], installed: false, mainPackage: main};
function adb(args) {
    const result = cp.spawnSync('adb', args, {encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024});
    if (result.status !== 0) throw new Error('ADB operation failed; raw output deliberately not retained');
    return result.stdout.trim();
}
function exactDevice() {
    const devices = adb(['devices', '-l']).split(/\r?\n/).filter(line => line.trim() && !line.startsWith('List of devices'));
    if (devices.length !== 1 || !/^\S+\s+device\b/.test(devices[0])) throw new Error('exactly one authorized Android is required');
    evidence.authorizedDevices = 1;
}
function mainSnapshot() {
    const dump = adb(['-d', 'shell', 'dumpsys', 'package', main]);
    // The Moodle app may be closed. Treat only an empty pidof result as a
    // valid absent process; keep ADB/transport errors fatal.
    const pidResult = cp.spawnSync('adb', ['-d', 'shell', 'pidof', main], {encoding: 'utf8', timeout: 60000});
    if (pidResult.error || (pidResult.status !== 0 && (pidResult.stderr || '').trim())) {
        throw new Error('unable to inspect main app process; raw output deliberately not retained');
    }
    return {versionCode: dump.match(/versionCode=(\d+)/)?.[1] ?? null,
        versionName: dump.match(/versionName=([^\s]+)/)?.[1] ?? null,
        lastUpdateTime: dump.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() ?? null,
        pid: pidResult.status === 0 ? pidResult.stdout.trim() || null : null};
}
function phase(name) {
    const output = adb(['-d', 'shell', 'am', 'instrument', '-w', '-e', 'phase', name,
        `${harness}/br.edu.ifrn.experimental.p08.PersistenceInstrumentation`]);
    const lines = output.split(/\r?\n/).filter(line => /^INSTRUMENTATION_RESULT: p08_/.test(line));
    const result = {phase: name, result: lines};
    evidence.commands.push(result);
    if (!lines.some(line => /p08_failed=0$/.test(line))) throw new Error('native harness did not report success');
}
if (!['--inspect', '--install-authorized'].includes(mode)) throw new Error('choose explicit inspection or authorized installation');
try {
    exactDevice();
    evidence.model = adb(['-d', 'shell', 'getprop', 'ro.product.model']);
    evidence.android = adb(['-d', 'shell', 'getprop', 'ro.build.version.release']);
    const before = mainSnapshot();
    evidence.mainVersionBefore = {versionCode: before.versionCode, versionName: before.versionName};
    if (mode === '--install-authorized') {
        if (build.packageId !== harness) throw new Error('unapproved package');
        const hash = crypto.createHash('sha256').update(fs.readFileSync(build.apk)).digest('hex');
        if (hash !== build.sha256 || hash !== '481e1e0da6e1991b43787ec386cdec12ebd8ca0cb572ed27177e1acf71fdfda4') throw new Error('APK differs from presented candidate');
        const existing = adb(['-d', 'shell', 'pm', 'list', 'packages', harness]).split(/\r?\n/);
        if (existing.includes(`package:${harness}`)) {
            evidence.previouslyInstalled = true;
        } else {
            const install = adb(['-d', 'install', build.apk]);
            if (!/Success/.test(install)) throw new Error('installation was not confirmed');
            evidence.installed = true;
        }
        evidence.apkSha256 = hash;
        const apkPath = adb(['-d', 'shell', 'pm', 'path', harness]).replace(/^package:/, '');
        if (!/^\/data\/app\/[A-Za-z0-9_/.=+~\-]+\/base\.apk$/.test(apkPath)) throw new Error('unexpected installed harness path');
        evidence.installedHashMatches = adb(['-d', 'shell', 'sha256sum', apkPath]).split(/\s+/)[0] === hash;
        if (!evidence.installedHashMatches) throw new Error('installed APK hash mismatch');
        phase('seed');
        adb(['-d', 'shell', 'am', 'force-stop', harness]); // ONLY the new experimental sandbox, never Moodle.
        evidence.ownProcessStoppedBetweenPhases = true;
        phase('recover');
        adb(['-d', 'shell', 'am', 'force-stop', harness]);
        const after = mainSnapshot();
        evidence.mainVersionUnchanged = before.versionCode === after.versionCode && before.versionName === after.versionName;
        evidence.mainPackageUpdateTimeUnchanged = before.lastUpdateTime === after.lastUpdateTime;
        evidence.mainProcessUnchanged = before.pid === after.pid;
    }
} catch (error) { evidence.failure = error.message;process.exitCode = 1; }
fs.writeFileSync(`${__dirname}/${mode === '--inspect' ? 'p08-device.json' : 'p08-android-result.json'}`, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
