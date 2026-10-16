cd /home/matheusluiz/mobileapp-moodle
{
echo "## DEVICE"; adb devices; for p in ro.product.model ro.build.version.release; do adb shell getprop $p; done; adb shell wm size; adb shell wm density; adb shell dumpsys window displays | grep -i cutout | head -3
echo "## F01 config"; grep -nE "EdgeToEdge|StatusBarOverlays|targetSdk" config.xml; sed -n 20,45p src/core/initializers/initialize-edge-to-edge.ts; grep -n "safe-area" src/theme/theme.base.scss | head
echo "## F02 dark"; grep -rnE "classList\.(add|toggle)\(.*dark|'dark'" src/core --include=*.ts | head -5; grep -n "root.dark" src/theme/theme.dark.scss | head -3
echo "## F03 assign"; grep -rn "location.assign" src/MoodleIFRN --include=*.ts --include=*.js | cut -c1-140
echo "## F04 cdn"; grep -n "jsdelivr" src/MoodleIFRN/mobilemoodle/index.html | cut -c1-140
echo "## F05"; f=$(find src/MoodleIFRN -name ifrn-language.ts | head -1); echo $f; wc -c -l $f; grep -rn "ifrn-language" src --include=*.ts | cut -c1-140
echo "## F06/F14"; grep -rnE "openInApp|_system" src/MoodleIFRN --include=*.ts | cut -c1-140
echo "## F07"; sed -n 30,46p $(find src/MoodleIFRN -name navigation.guard.ts | head -1)
echo "## F09"; f=$(find src/MoodleIFRN -name moodle-course.scss | head -1); wc -l $f; grep -c '!important' $f
echo "## F10 cores"; grep -rnoE "#(19743c|1e3427|fbfcfa|1351b4|04122b)" src/MoodleIFRN --include=*.scss | cut -c1-100 | head -12
echo "## F11"; grep -n -B1 -A3 '"optimization"' angular.json | head -12; git log -3 --format='%h %s' -- angular.json
echo "## F13"; grep -rnE "ava\.ifrn\.edu\.br|ead\.ifrn\.edu\.br" src/MoodleIFRN --include=*.ts | cut -c1-120
echo "## CONTRASTE"; node -e "const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const R=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};console.log('637266/fbfcfa',R('#637266','#fbfcfa'),'666666/f6f6f6',R('#666666','#f6f6f6'))"
} > analise-aparelho/static.txt 2>&1
