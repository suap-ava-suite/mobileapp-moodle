#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
ADB="$ANDROID_HOME/platform-tools/adb"
BUILD_TOOLS_VERSION="${MOODLE_IFRN_BUILD_TOOLS_VERSION:-36.0.0}"
AAPT="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/aapt"
APKSIGNER="$ANDROID_HOME/build-tools/$BUILD_TOOLS_VERSION/apksigner"
PACKAGE_ID="com.moodle.moodlemobile"
SERIAL=""
INSTALL_ALL=false

usage() {
    cat <<'USAGE'
Uso:
  run-android-studio-emulator.sh [--serial emulator-5554 | --all]

Faz um build Android debug novo, escolhe um emulador Android Studio já iniciado,
confere pacote/versão/assinatura e pede confirmação antes de instalar e abrir o app.
Sem opção, seleciona um emulador interativamente quando há mais de um conectado.

Opções:
  --serial SERIAL  Usa um emulador específico (serial deve começar com emulator-).
  --all            Atualiza/instala em todos os emuladores Android Studio conectados.
  -h, --help       Mostra esta ajuda sem compilar nem instalar.

O script não seleciona dispositivos USB físicos e nunca desinstala ou limpa dados.
USAGE
}

fail() {
    printf 'Erro: %s\n' "$1" >&2
    exit 1
}

while (($#)); do
    case "$1" in
        --serial)
            (($# >= 2)) || fail 'faltou o serial depois de --serial.'
            SERIAL="$2"
            shift 2
            ;;
        --all)
            INSTALL_ALL=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "opção desconhecida: $1 (use --help)."
            ;;
    esac
done

[[ -z "$SERIAL" || "$SERIAL" == emulator-* ]] || fail 'o serial informado não é de emulador Android Studio.'
[[ -z "$SERIAL" || "$INSTALL_ALL" == false ]] || fail 'use --serial ou --all, não ambos.'

[[ -x "$ADB" ]] || fail "ADB não encontrado em $ADB. Instale Android SDK Platform-Tools pelo Android Studio."
[[ -x "$AAPT" ]] || fail "aapt não encontrado em $AAPT. Instale Android SDK Build-Tools $BUILD_TOOLS_VERSION."
[[ -x "$APKSIGNER" ]] || fail "apksigner não encontrado em $APKSIGNER. Instale Android SDK Build-Tools $BUILD_TOOLS_VERSION."
[[ -x "$ROOT/node_modules/.bin/ionic" ]] || fail 'dependências ausentes; execute npm ci na raiz do projeto.'
[[ -x "$ROOT/node_modules/.bin/cordova" ]] || fail 'Cordova CLI local ausente; execute npm ci na raiz do projeto.'
[[ -d "$ROOT/platforms/android" ]] || fail 'plataforma Android Cordova ausente; prepare Android pelo guia do projeto antes de usar este script.'
[[ -f "$ANDROID_HOME/platforms/android-36/android.jar" ]] || fail 'Android SDK Platform 36 ausente; instale-a pelo SDK Manager do Android Studio.'

platforms="$("$ROOT/node_modules/.bin/cordova" platform ls)"
android_platform_version="$(awk '$1 == "android" { print $2; exit }' <<<"$platforms")"
[[ "$android_platform_version" == 15.1.0 ]] || fail "Cordova Android 15.1.0 é obrigatório; plataforma encontrada: ${android_platform_version:-nenhuma}."

if [[ -z "${JAVA_HOME:-}" ]]; then
    javac_path="$(command -v javac || true)"
    [[ -n "$javac_path" ]] || fail 'JDK não encontrado no PATH.'
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$javac_path")")")"
fi
export JAVA_HOME
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export CORDOVA_JAVA_HOME="$JAVA_HOME"

java_major="$("$JAVA_HOME/bin/javac" -version 2>&1 | sed -E 's/.* ([0-9]+)(\..*)?$/\1/')"
[[ "$java_major" == 17 ]] || fail "Cordova Android 15.1.0 requer JDK 17 neste projeto; encontrado Java $java_major em $JAVA_HOME."

cd "$ROOT"
printf 'Projeto: %s\n' "$ROOT"
printf 'Revisão: %s (%s)\n' "$(git branch --show-current 2>/dev/null || printf 'sem branch')" "$(git rev-parse --short HEAD 2>/dev/null || printf 'sem Git')"
printf '\nEstado Git antes do build:\n'
git status --short --branch

mapfile -t available_emulators < <("$ADB" devices | awk '$1 ~ /^emulator-[0-9]+$/ && $2 == "device" { print $1 }')
if [[ -n "$SERIAL" ]]; then
    printf '%s\n' "${available_emulators[@]}" | grep -Fxq "$SERIAL" || fail "$SERIAL não está conectado e autorizado. Inicie o AVD pelo Android Studio e tente novamente."
    targets=("$SERIAL")
elif [[ "$INSTALL_ALL" == true ]]; then
    ((${#available_emulators[@]} > 0)) || fail 'nenhum emulador Android Studio conectado. Inicie um AVD no Device Manager.'
    targets=("${available_emulators[@]}")
else
    ((${#available_emulators[@]} > 0)) || fail 'nenhum emulador Android Studio conectado. Inicie um AVD no Device Manager.'
    if ((${#available_emulators[@]} == 1)); then
        targets=("${available_emulators[0]}")
    else
        printf 'Emuladores conectados:\n'
        for i in "${!available_emulators[@]}"; do
            printf '  %d) %s\n' "$((i + 1))" "${available_emulators[$i]}"
        done
        read -r -p 'Escolha o número do emulador: ' choice
        [[ "$choice" =~ ^[0-9]+$ ]] || fail 'seleção inválida.'
        ((choice >= 1 && choice <= ${#available_emulators[@]})) || fail 'seleção fora da lista.'
        targets=("${available_emulators[$((choice - 1))]}")
    fi
fi

printf '\nEmuladores selecionados: %s\n' "${targets[*]}"
for target in "${targets[@]}"; do
    device_api="$("$ADB" -s "$target" shell getprop ro.build.version.sdk | tr -d '\r')"
    [[ "$device_api" =~ ^[0-9]+$ ]] || fail "não foi possível ler a API de $target."
    printf '  %s: Android API %s\n' "$target" "$device_api"
done

build_started_ns="$(date +%s%N)"
heap_mb="${MOODLE_IFRN_NODE_HEAP_MB:-8192}"
workers="${NG_BUILD_MAX_WORKERS:-2}"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=$heap_mb"
export NG_BUILD_MAX_WORKERS="$workers"
export NODE_ENV=production

printf '\nCompilando assets do plugin Moodle...\n'
npm run prod --prefix cordova-plugin-moodleapp

printf '\nGerando APK debug nova com assets web de produção...\n'
"$ROOT/node_modules/.bin/ionic" cordova build android --prod --debug

APK="$ROOT/platforms/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || fail "build terminou sem gerar $APK."
apk_mtime_ns="$(date -r "$APK" +%s%N)"
((apk_mtime_ns >= build_started_ns)) || fail 'a APK não foi recriada nesta execução; build interrompido para não instalar artefato antigo.'

badging="$("$AAPT" dump badging "$APK")"
package_line="$(printf '%s\n' "$badging" | grep -m1 '^package:')"
package_id="$(sed -n "s/.*name='\([^']*\)'.*/\1/p" <<<"$package_line")"
version_code="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$package_line")"
version_name="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$package_line")"
min_sdk="$(printf '%s\n' "$badging" | sed -n "s/^sdkVersion:'\([0-9]*\)'.*/\1/p" | head -1)"
[[ "$package_id" == "$PACKAGE_ID" ]] || fail "package ID inesperado na APK: $package_id."
[[ "$version_code" =~ ^[0-9]+$ && "$min_sdk" =~ ^[0-9]+$ ]] || fail 'não foi possível ler versionCode ou minSdk da APK.'
candidate_cert="$("$APKSIGNER" verify --print-certs "$APK" | awk '/Signer #1 certificate SHA-256 digest:/ { print tolower($NF); exit }')"
[[ "$candidate_cert" =~ ^[0-9a-f]{64}$ ]] || fail 'não foi possível ler o certificado SHA-256 da APK candidata.'

printf '\nAPK recém-gerada:\n  Caminho: %s\n  SHA-256: %s\n  Pacote: %s\n  Versão: %s (%s)\n  minSdk: %s\n  Certificado SHA-256: %s\n' \
    "$APK" "$(sha256sum "$APK" | awk '{print $1}')" "$package_id" "$version_name" "$version_code" "$min_sdk" "$candidate_cert"

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/ifrn-android-emulator.XXXXXX")"
trap 'rm -rf -- "$temp_dir"' EXIT
declare -A install_modes=()
declare -A installed_codes=()

for target in "${targets[@]}"; do
    printf '\n===== %s =====\n' "$target"
    device_api="$("$ADB" -s "$target" shell getprop ro.build.version.sdk | tr -d '\r')"
    ((device_api >= min_sdk)) || fail "$target usa API $device_api, abaixo do minSdk $min_sdk da APK."

    installed_path="$("$ADB" -s "$target" shell pm path "$package_id" 2>/dev/null | tr -d '\r' | sed -n 's/^package://p' | grep '/base.apk$' | head -1 || true)"
    install_mode=install
    if [[ -n "$installed_path" ]]; then
        installed_apk="$temp_dir/$target-base.apk"
        "$ADB" -s "$target" pull "$installed_path" "$installed_apk" >/dev/null
        installed_cert="$("$APKSIGNER" verify --print-certs "$installed_apk" | awk '/Signer #1 certificate SHA-256 digest:/ { print tolower($NF); exit }')"
        [[ "$installed_cert" == "$candidate_cert" ]] || fail "$target já tem $package_id com outra assinatura; atualização recusada para preservar os dados."

        installed_line="$("$ADB" -s "$target" shell dumpsys package "$package_id" | grep -m1 'versionCode=' | tr -d '\r')"
        installed_code="$(sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' <<<"$installed_line")"
        [[ "$installed_code" =~ ^[0-9]+$ ]] || fail "não foi possível ler o versionCode instalado em $target."
        ((version_code >= installed_code)) || fail "APK candidata ($version_code) é mais antiga que a instalação ($installed_code) em $target."
        install_modes["$target"]=update
        installed_codes["$target"]="$installed_code"
        printf 'Instalação existente compatível: versionCode %s; mesma assinatura. Dados serão preservados por adb install -r.\n' "$installed_code"
    else
        install_modes["$target"]=install
        printf 'O pacote ainda não está instalado neste emulador; será uma instalação nova.\n'
    fi
done

for target in "${targets[@]}"; do
    read -r -p "Instalar a APK nova em $target e abrir o app? [s/N] " answer
    [[ "$answer" =~ ^[sS]$ ]] || { printf 'Ignorado em %s.\n' "$target"; continue; }

    if [[ "${install_modes[$target]}" == update ]]; then
        current_code="$("$ADB" -s "$target" shell dumpsys package "$PACKAGE_ID" | grep -m1 'versionCode=' | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | tr -d '\r')"
        [[ "$current_code" == "${installed_codes[$target]}" ]] || fail "a instalação de $target mudou após a conferência; build ignorado nesse emulador."
        "$ADB" -s "$target" install -r "$APK"
    else
        "$ADB" -s "$target" install "$APK"
    fi
    "$ADB" -s "$target" shell monkey -p "$package_id" -c android.intent.category.LAUNCHER 1
done

printf '\nEstado Git depois do build (nenhuma alteração foi descartada):\n'
git status --short --branch
printf '\nConcluído. Login e validação funcional continuam manuais no emulador.\n'
