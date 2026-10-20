const {execFileSync} = require('node:child_process');
const pid=execFileSync('adb',['shell','pidof','com.moodle.moodlemobile'],{encoding:'utf8'}).trim();
if(!/^\d+$/.test(pid)) throw new Error('App process unavailable');
const raw=execFileSync('adb',['logcat','-d','--pid='+pid,'-t','5000'],{encoding:'utf8',maxBuffer:8*1024*1024});
const markers=['card-click','session-and-identity','need-oauth','oauth-public-config','oauth-provider',
 'openBrowserForOAuthLogin resultado','callback recebido','CoreEvents.LOGIN','afterOAuthLogin',
 'getAndOpenCourse','curso nativo aberto','session-switch','oauth-mismatch','sessão Moodle ausente',
 'sessão Moodle existente','estado do site armazenado correspondente','sessão existente corresponde'];
for(const line of raw.split('\n')) {
 const marker=markers.find(m=>line.includes(m));
 if(marker) console.log(JSON.stringify({time:line.slice(0,18),stage:marker,
  outcome:line.match(/"outcome":"(ok|error)"/)?.[1],
  opened:line.match(/"opened":(true|false)/)?.[1],
  hasSession:line.match(/"hasSession":(true|false)/)?.[1],
  isLoggedIn:line.match(/"isLoggedIn":(true|false)/)?.[1],
  storedSites:line.match(/"storedSitesForUrl":(\d+)/)?.[1],
  loggedOut:line.match(/"loggedOut":(true|false)/)?.[1]}));
}
