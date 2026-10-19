#!/usr/bin/env bash
set -e

echo "=== [1/4] Build Angular Moodle ==="
npm run build

echo "=== [2/4] Cordova Prepare Android ==="
npx cordova prepare android

echo "=== [3/4] Gradle Assemble Debug ==="
cd platforms/android
if [ -f "./gradlew" ]; then
    ./gradlew assembleDebug
else
    cmd.exe /c gradlew.bat assembleDebug
fi
cd ../..

echo "=== [4/4] Adb Install -r ==="
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.moodle.moodlemobile/.MainActivity

echo "Deploy DS Gov concluído com sucesso!"
