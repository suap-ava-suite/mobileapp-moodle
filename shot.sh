#!/usr/bin/env bash
OUTPUT=${1:-analise-aparelho/dsgov/shot.png}
adb shell screencap -p /sdcard/temp_shot.png
adb pull /sdcard/temp_shot.png "$OUTPUT"
adb shell rm /sdcard/temp_shot.png
echo "Screenshot salvo em $OUTPUT"
