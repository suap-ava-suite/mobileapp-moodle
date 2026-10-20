// Anonymous HTTP probe of the launch URL currently visible in Chrome.
// Uses an in-memory anonymous cookie jar; never prints query strings, cookies or bodies.
const {execFileSync}=require('node:child_process');
(async()=>{
 const xml=execFileSync('adb',['shell','cat','/data/local/tmp/ifrn-course-window.xml'],{encoding:'utf8'});
 const address=xml.match(/text="([^"]*)"[^>]*resource-id="com.android.chrome:id\/url_bar"/)?.[1]?.replace(/&amp;/g,'&');
 if(!address) throw new Error('No Chrome address');
 let url=new URL(address.includes('://')?address:'https://'+address);
 if(url.pathname!=='/admin/tool/mobile/launch.php') throw new Error('Not a Moodle launch page');
 const jars=new Map(); const chain=[];
 for(let hop=0;hop<8;hop++){
  if(url.protocol!=='https:' || !url.hostname.endsWith('.ifrn.edu.br')) break;
  const jar=jars.get(url.hostname)||new Map();jars.set(url.hostname,jar);
  const start=performance.now();
  const r=await fetch(url,{redirect:'manual',headers:jar.size?{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{},signal:AbortSignal.timeout(15000)});
  for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0];const index=pair.indexOf('=');jar.set(pair.slice(0,index),pair.slice(index+1));}
  const row={host:url.hostname,path:url.pathname,status:r.status,type:r.headers.get('content-type'),ms:Math.round(performance.now()-start)};
  chain.push(row);
  const redirect=r.headers.get('location');
  if(redirect && r.status>=300 && r.status<400){url=new URL(redirect,url);await r.body?.cancel();continue;}
  const body=await r.text();row.loginForm=/type=["']password/.test(body);
  break;
 }
 console.log(JSON.stringify({authentication:'anonymous; no device cookies',chain},null,2));
})().catch(e=>{console.error(e.name);process.exitCode=1});
