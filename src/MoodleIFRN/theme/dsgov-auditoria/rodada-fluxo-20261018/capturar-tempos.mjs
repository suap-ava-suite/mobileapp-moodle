import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const environment=['academico','presencial'].includes(process.argv[2])?process.argv[2]:'academico';
const tag=/^[a-z-]+$/.test(process.argv[3]||'')?'-'+process.argv[3]:'';
const started=Date.now(),rows=[];
const list=await(await fetch('http://localhost:9222/json')).json();
const ws=new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl);
let timer;
function save(){clearTimeout(timer);fs.writeFileSync(fileURLToPath(new URL(`tempos-depois-${environment}${tag}.json`,import.meta.url)),JSON.stringify({environment,kind:'observado no aparelho',stages:rows},null,2));}
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method!=='Runtime.consoleAPICalled'||m.params.timestamp<started)return;const a=m.params.args;if(a[0]?.value!=='[IFRN-TIMING]')return;try{const row=JSON.parse(a[1].value);if(/^[a-z-]+$/.test(row.stage)&&Number.isFinite(row.ms)&&['ok','error'].includes(row.outcome))rows.push({stage:row.stage,ms:row.ms,outcome:row.outcome});}catch{}};
ws.onclose=save;
await new Promise(r=>ws.onopen=r);ws.send(JSON.stringify({id:1,method:'Runtime.enable'}));
timer=setTimeout(()=>{save();ws.close();},Math.min(90000,Math.max(10000,Number(process.argv[4])||90000)));
console.log('Coleta sanitizada de tempos iniciada por 90 segundos.');
