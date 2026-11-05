"""Offline build of an ISOLATED APK. Never installs, runs Gradle or touches the Moodle build tree."""
import hashlib, json, os, pathlib, shutil, subprocess, sys, time, zipfile

root = pathlib.Path(__file__).resolve().parents[2]
source = root / 'src/MoodleIFRN/tests/fixtures/p08-native'
out = root / '.analise/correcoes-p0' / ('p08-harness-' + str(time.time_ns()))
out.mkdir()
if '--verify-existing' in sys.argv:
    metadata = json.loads((root / '.analise/correcoes-p0/p08-harness-build.json').read_text(encoding='utf-8'))
    previous = json.loads(pathlib.Path(metadata['commands']).read_text(encoding='utf-8'))[0]['args']
    args = list(previous)
    old_classes = pathlib.Path(args[args.index('-d') + 1])
    new_classes = out / 'classes-verified'
    new_classes.mkdir()
    args[args.index('-d') + 1] = str(new_classes)
    result = subprocess.run(args, cwd=out, text=True, capture_output=True)
    old = {str(p.relative_to(old_classes)): hashlib.sha256(p.read_bytes()).hexdigest() for p in old_classes.rglob('*.class')}
    new = {str(p.relative_to(new_classes)): hashlib.sha256(p.read_bytes()).hexdigest() for p in new_classes.rglob('*.class')}
    evidence = {'command': args, 'status': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
                'classes': len(new), 'byteIdenticalToPackagedClasses': old == new,
                'apkSha256': hashlib.sha256(pathlib.Path(metadata['apk']).read_bytes()).hexdigest()}
    (root / '.analise/correcoes-p0/p08-javac-verified.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps(evidence))
    sys.exit(0 if result.returncode == 0 and old == new and 'exception' not in result.stderr.lower() else 1)
sdk = pathlib.Path(os.environ.get('ANDROID_HOME', str(pathlib.Path.home() / 'AppData/Local/Android/Sdk')))
tools = sdk / 'build-tools/36.0.0'
android = sdk / 'platforms/android-36/android.jar'
cache = pathlib.Path.home() / '.gradle/caches/modules-2/files-2.1'
commands = []
def run(args):
    args = list(map(str, args))
    result = subprocess.run(args, cwd=out, text=True, capture_output=True)
    commands.append({'args': args, 'status': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
    (out / 'commands.json').write_text(json.dumps(commands, indent=2), encoding='utf-8')
    if result.returncode: raise RuntimeError('isolated build failed: ' + pathlib.Path(args[0]).name)
def cached(group, name, version, extension):
    found = list((cache / group / name / version).glob('*/*.' + extension))
    if len(found) != 1: raise RuntimeError('missing/ambiguous offline dependency: ' + name)
    return found[0]
def aar(name, archive):
    target = out / name
    target.mkdir()
    with zipfile.ZipFile(archive) as z: z.extractall(target)
    return target

try:
    sodium = aar('sodium', cached('com.goterl', 'lazysodium-android', '5.2.0', 'aar'))
    jna = aar('jna', cached('net.java.dev.jna', 'jna', '5.17.0', 'aar'))
    kotlin = cached('org.jetbrains.kotlin', 'kotlin-stdlib', '1.9.24', 'jar')
    sqlite = root / 'node_modules/cordova-sqlite-storage-dependencies/libs'
    sqlite_jars = [sqlite / 'sqlite-native-ndk-connector.jar', sqlite / 'sqlite-ndk-native-driver.jar']
    if not all(p.exists() for p in sqlite_jars): raise RuntimeError('missing actual SQLite plugin jars')
    # Reuse exact existing official encryption bytecode, fingerprinted below. No rewritten algorithm.
    crypto_root = root / 'platforms/android/app/build/tmp/kotlin-classes/debug'
    crypto_classes = ['com/adobe/phonegap/push/EncryptionHandler.class',
                      'com/adobe/phonegap/push/EncryptionHandler$Companion.class',
                      'com/adobe/phonegap/push/PushConstants.class']
    crypto_jar = out / 'official-encryption.jar'
    with zipfile.ZipFile(crypto_jar, 'w') as z:
        for name in crypto_classes: z.write(crypto_root / name, name)
    classes = out / 'classes'
    classes.mkdir()
    libraries = [android, crypto_jar, sodium / 'classes.jar', jna / 'classes.jar', kotlin] + sqlite_jars
    java_sources = [p for p in source.glob('*.java') if p.name != 'DurableVersionsJvmTest.java']
    java_sources += [root / 'node_modules/cordova-sqlite-storage/src/android/io/sqlc' / name
                     for name in ['SQLiteAndroidDatabase.java', 'SQLiteConnectorDatabase.java']]
    run(['javac', '--release', '8', '-cp', os.pathsep.join(map(str, libraries)), '-d', classes] + java_sources)
    harness_jar = out / 'harness.jar'
    with zipfile.ZipFile(harness_jar, 'w') as z:
        for file in classes.rglob('*.class'): z.write(file, file.relative_to(classes).as_posix())
    dex = out / 'dex'
    dex.mkdir()
    run(['java', '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--min-api', '26', '--lib', android,
         '--output', dex, harness_jar, crypto_jar, sodium / 'classes.jar', jna / 'classes.jar', kotlin] + sqlite_jars)
    resources = out / 'resources.apk'
    run([tools / 'aapt2.exe', 'link', '-I', android, '--manifest', source / 'AndroidManifest.xml', '-o', resources])
    unsigned = out / 'unsigned.apk'
    shutil.copyfile(resources, unsigned)
    with zipfile.ZipFile(unsigned, 'a', zipfile.ZIP_DEFLATED) as z:
        for file in dex.glob('*.dex'): z.write(file, file.name)
        for directory in [sodium, jna]:
            for file in (directory / 'jni').rglob('*.so'):
                z.write(file, 'lib/' + file.relative_to(directory / 'jni').as_posix())
        with zipfile.ZipFile(sqlite_jars[1]) as native:
            for name in native.namelist():
                if name.startswith('lib/') and name.endswith('.so'): z.writestr(name, native.read(name))
    aligned = out / 'aligned.apk'
    run([tools / 'zipalign.exe', '-f', '4', unsigned, aligned])
    key = out / 'synthetic-debug.keystore'
    run(['keytool', '-genkeypair', '-keystore', key, '-storepass', 'android', '-keypass', 'android', '-alias',
         'androiddebugkey', '-keyalg', 'RSA', '-validity', '365', '-dname', 'CN=IFRN P08 experimental only'])
    apk = out / 'p08-persistence.apk'
    run([tools / 'apksigner.bat', 'sign', '--ks', key, '--ks-pass', 'pass:android', '--ks-key-alias',
         'androiddebugkey', '--out', apk, aligned])
    run([tools / 'apksigner.bat', 'verify', '--verbose', apk])
    run([tools / 'aapt2.exe', 'dump', 'badging', apk])
    hashes = {str(crypto_root / name): hashlib.sha256((crypto_root / name).read_bytes()).hexdigest()
              for name in crypto_classes}
    result = {'packageId': 'br.edu.ifrn.experimental.p08.persistence', 'apk': str(apk), 'bytes': apk.stat().st_size,
              'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'installed': False,
              'officialEncryptionPrebuiltBytecode': hashes, 'freshKotlinCompile': False,
              'commands': str(out / 'commands.json')}
    (root / '.analise/correcoes-p0/p08-harness-build.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
except Exception as error:
    print(str(error), file=sys.stderr)
    print(str(out / 'commands.json'), file=sys.stderr)
    sys.exit(1)
