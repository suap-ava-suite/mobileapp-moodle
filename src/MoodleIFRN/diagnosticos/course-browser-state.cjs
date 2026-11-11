const {execFileSync}=require('node:child_process');
const xml=execFileSync('adb',['shell','cat','/data/local/tmp/ifrn-course-window.xml'],{encoding:'utf8'});
const address=xml.match(/text="([^"]*)"[^>]*resource-id="com.android.chrome:id\/url_bar"/)?.[1];
let location;
try {const u=new URL(address.includes('://')?address:'https://'+address);location={host:u.hostname,path:u.pathname};}catch{}
console.log(JSON.stringify({location,
 nodes:(xml.match(/<node /g)||[]).length,
 webviews:(xml.match(/android.webkit.WebView/g)||[]).length,
 progress:xml.includes('ProgressBar'),
 textLengths:[...xml.matchAll(/text="([^"]*)"/g)].map(m=>m[1].length),
 passwordField:/password="true"/.test(xml),
 browserNetworkError:/ERR_[A-Z_]+/.exec(xml)?.[0],
 openAppPrompt:/Abrir.*aplicativo|Open.*app/i.test(xml),
 suapLogin:/SUAP/.test(xml),
 moodleLaunchError:/Erro|error|Exceção/.test(xml)}));
