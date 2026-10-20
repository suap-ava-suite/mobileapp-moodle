const {execFileSync}=require('node:child_process');
const raw=execFileSync('adb',['logcat','-d','-t','8000'],{encoding:'utf8',maxBuffer:12*1024*1024});
const counters={};
for(const line of raw.split('\n')) {
 for(const [key,re] of Object.entries({
  chromeRendererAttachTimeout:/chrome.*sandboxed_process.*failed to attach/,
  chromeRendererStartTimeout:/Killing.*chrome.*start timeout/,
  chromiumNetworkError:/chromium.*ERR_[A-Z_]+/,
  chromiumSslError:/chromium.*(ssl_client_socket|SSL handshake|net_error)/,
  chromiumRenderCrash:/chromium.*(renderer.*crash|Render process.*gone)/i,
  lowMemoryKill:/lmkd.*chrome/,
  moodleCallback:/IFRN-SITE.*callback deep link/,
  nativeLogin:/IFRN-SITE.*CoreEvents.LOGIN/,
 })) if(re.test(line)) {
  const c=counters[key] ||= {count:0,lastTime:''}; c.count++;c.lastTime=line.slice(0,18);
 }
}
console.log(JSON.stringify(counters,null,2));
