#!/usr/bin/env bash
set -euo pipefail

checkout="${1:?Uso: $0 CAMINHO_DO_CHECKOUT HEAD_COMPLETO [BRANCH]}"
expected_head="${2:?Uso: $0 CAMINHO_DO_CHECKOUT HEAD_COMPLETO [BRANCH]}"
expected_branch="${3:-release/2.0.1}"
tool_dir="${MOODLE_IFRN_TOOL_DIR:-$HOME/opt}"
node_dir="$tool_dir/node-v22.17.0-linux-x64"
gradle_dir="$tool_dir/gradle-8.14.2"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${MOODLE_IFRN_JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export CORDOVA_JAVA_HOME="$JAVA_HOME"
sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
build_tools="$ANDROID_HOME/build-tools/36.0.0"

cd "$checkout"
if [[ "$(git branch --show-current)" != "$expected_branch" ||
      "$(git rev-parse HEAD)" != "$expected_head" ]]; then
    printf 'A cópia de build não corresponde à branch/revisão informada. Confira git status e git log antes de prosseguir.\n' >&2
    exit 1
fi
git diff --quiet HEAD -- package.json package-lock.json config.xml \
    cordova-plugin-moodleapp/package.json cordova-plugin-moodleapp/package-lock.json
"$JAVA_HOME/bin/javac" -version
mkdir -p "$tool_dir"

downloads=$(mktemp -d)
trap 'rm -rf -- "$downloads"' EXIT

download_verified() {
    local url=$1 checksum=$2 file=$3
    curl --fail --show-error --location --retry 2 --connect-timeout 15 "$url" --output "$file"
    printf '%s  %s\n' "$checksum" "$file" | sha256sum --check
}

if [[ ! -x "$node_dir/bin/node" ]]; then
    node_archive=node-v22.17.0-linux-x64.tar.xz
    download_verified "https://nodejs.org/dist/v22.17.0/$node_archive" \
        325c0f1261e0c61bcae369a1274028e9cfb7ab7949c05512c5b1e630f7e80e12 "$downloads/$node_archive"
    tar -xJf "$downloads/$node_archive" -C "$tool_dir"
fi
export PATH="$node_dir/bin:$JAVA_HOME/bin:$PATH"
node_version=$(node --version)
printf 'Node %s\n' "$node_version"
test "$node_version" = v22.17.0
npm --version
npm ci --include=dev
git diff --exit-code HEAD -- package.json package-lock.json \
    cordova-plugin-moodleapp/package.json cordova-plugin-moodleapp/package-lock.json

if [[ ! -x "$gradle_dir/bin/gradle" ]]; then
    gradle_archive=gradle-8.14.2-bin.zip
    download_verified "https://services.gradle.org/distributions/$gradle_archive" \
        7197a12f450794931532469d4ff21a59ea2c1cd59a3ec3f89c035c3c420a6999 "$downloads/$gradle_archive"
    unzip -qn "$downloads/$gradle_archive" -d "$tool_dir"
fi

if [[ ! -x "$sdkmanager" ]]; then
    sdk_archive=commandlinetools-linux-15859902_latest.zip
    download_verified "https://dl.google.com/android/repository/$sdk_archive" \
        4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583 "$downloads/$sdk_archive"
    unzip -q "$downloads/$sdk_archive" -d "$downloads/android"
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    mv -T "$downloads/android/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

sdk_java_home="${MOODLE_IFRN_SDKMANAGER_JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
JAVA_HOME="$sdk_java_home" "$sdkmanager" --sdk_root="$ANDROID_HOME" \
    "platform-tools" "platforms;android-36" "build-tools;36.0.0"
test -x "$ANDROID_HOME/platform-tools/adb"
test -f "$ANDROID_HOME/platforms/android-36/android.jar"
test -x "$build_tools/apksigner"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$gradle_dir/bin:$PATH"

npm run prod --prefix cordova-plugin-moodleapp
# Cordova CLI exige www/ para reconhecer um checkout novo como projeto.
mkdir -p www
if [[ ! -d platforms/android ]]; then
    npx --no-install cordova platform add android@15.1.0 --nosave
fi
platforms=$(npx --no-install cordova platform ls)
printf '%s\n' "$platforms"
android_version=$(awk '$1 == "android" { print $2; exit }' <<< "$platforms")
if [[ "$android_version" != 15.1.0 ]]; then
    printf 'A plataforma preparada precisa ser Cordova Android 15.1.0.\n' >&2
    exit 1
fi
# Restaura plugins mesmo depois de uma preparação parcial.
npx --no-install cordova prepare android
android_plugin_metadata=platforms/android/platform_www/cordova_plugins.js
if ! grep -Fq '"cordova-sqlite-storage": "7.0.0"' "$android_plugin_metadata"; then
    npx --no-install cordova plugin add cordova-sqlite-storage@7.0.0 --nosave
    npx --no-install cordova prepare android
fi
if ! grep -Fq '"cordova-sqlite-storage": "7.0.0"' "$android_plugin_metadata"; then
    printf 'O SQLite 7.0.0 precisa estar registrado na plataforma Android antes do build.\n' >&2
    exit 1
fi
build_started=$(date +%s)
# Usa o limite de heap já adotado pelo build web de produção do projeto.
NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${MOODLE_IFRN_NODE_HEAP_MB:-8192}" \
    NG_BUILD_MAX_WORKERS="${NG_BUILD_MAX_WORKERS:-2}" \
    npx --no-install cross-env NODE_ENV=production ionic cordova build android --prod --debug
git diff --exit-code HEAD -- config.xml package.json package-lock.json \
    cordova-plugin-moodleapp/package.json cordova-plugin-moodleapp/package-lock.json
git status -sb

apk="$checkout/platforms/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$apk" ]] || (( $(stat -c '%Y' "$apk") < build_started )); then
    printf 'O build terminou sem uma APK nova no caminho esperado.\n' >&2
    exit 1
fi
printf '\nAPK gerada a partir de %s\n' "$expected_head"
sha256sum "$apk"
"$build_tools/aapt" dump badging "$apk" | awk '/^(package:|sdkVersion:|targetSdkVersion:|launchable-activity:|native-code:)/'
printf '\nCertificado da candidata\n'
"$build_tools/apksigner" verify --print-certs "$apk"

if [[ "$(adb -d get-state 2>/dev/null || true)" == device ]]; then
    installed_path=$(adb -d shell pm path com.moodle.moodlemobile | tr -d '\r' |
        awk '/^package:.*\/base\.apk$/ { sub(/^package:/, ""); print }')
    if [[ -n "$installed_path" ]] && adb -d pull "$installed_path" "$downloads/installed-base.apk"; then
        printf '\nCertificado do Moodle instalado\n'
        "$build_tools/apksigner" verify --print-certs "$downloads/installed-base.apk"
        adb -d shell getprop ro.product.cpu.abilist
        adb -d shell dumpsys package com.moodle.moodlemobile | awk '/versionCode=|versionName=/'
    fi
fi
