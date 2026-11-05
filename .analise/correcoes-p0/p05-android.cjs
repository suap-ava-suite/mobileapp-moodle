// Inspeção ADB com filtragem em memória. Nunca grava UI XML, logcat bruto ou storage do estudante.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,mode=process.argv[2],pkg='com.moodle.moodlemobile';
function adb(args,binary=false){
    const r=cp.spawnSync('adb',args,{encoding:binary?undefined:'utf8',maxBuffer:100*1024*1024,timeout:45000,windowsHide:true});
    if(r.status!==0||r.error)throw new Error(`ADB falhou: status ${r.status ?? 'indisponível'}; saída bruta omitida.`);
    return r.stdout;
}
const devices=adb(['devices','-l']).split(/\r?\n/).slice(1).filter(l=>l.trim());
if(devices.length!==1||!/^\S+\s+device\b/.test(devices[0]))throw new Error('É necessário exatamente um dispositivo autorizado.');
const shell=(...args)=>adb(['-d','shell',...args]).trim();
const save=(name,value)=>{fs.writeFileSync(path.join(dir,`p05-${name}.json`),JSON.stringify(value,null,2));console.log(JSON.stringify(value));};
const activity=()=>{
    const raw=shell('dumpsys','activity','activities');
    const resumed=raw.split('\n').find(l=>l.includes('mResumedActivity:'))||'';
    return /\b([a-zA-Z][\w.]+\/[\w.$]+)/.exec(resumed)?.[1]||null;
};
if(mode==='info'){
    const info=shell('dumpsys','package',pkg),flags=/^\s*flags=\[(.*?)\]/m.exec(info)?.[1]||'';
    const apk=shell('pm','path',pkg).split(/\r?\n/).filter(l=>l.startsWith('package:')).map(l=>l.slice(8));
    const apkHashes=apk.map(file=>({kind:file.endsWith('/base.apk')?'base':'split',sha256:/^[a-f0-9]{64}/i.exec(shell('sha256sum',file))?.[0]}));
    const localFile='platforms/android/app/build/outputs/apk/debug/app-debug.apk';
    const local=fs.existsSync(localFile)?fs.readFileSync(localFile):null;
    const resolved=shell('cmd','package','resolve-activity','--brief',pkg).split('\n').find(l=>l.includes(`${pkg}/`))||null;
    const power=shell('dumpsys','power');
    save('device',{at:new Date().toISOString(),authorizedDevices:1,android:shell('getprop','ro.build.version.release'),
        model:shell('getprop','ro.product.model'),packageId:pkg,
        versionName:/\bversionName=([^\s]+)/.exec(info)?.[1],versionCode:/\bversionCode=(\d+)/.exec(info)?.[1],
        targetSdk:/\btargetSdk=(\d+)/.exec(info)?.[1],debuggable:/\bDEBUGGABLE\b/.test(flags),
        testOnly:/\bTEST_ONLY\b/.test(flags),flags:flags.split(/\s+/).filter(Boolean),launcherActivity:resolved,
        resumedActivity:activity(),pid:shell('pidof',pkg)||null,wakefulness:/mWakefulness=(\w+)/.exec(power)?.[1],
        installedApks:apkHashes,localApk:local?{file:localFile,bytes:local.length,sha256:crypto.createHash('sha256').update(local).digest('hex')}:null,
        deviceLogStart:shell('date','+%m-%dT%H:%M:%S.000').replace('T',' ')});
}else if(mode==='ui'){
    const xml=adb(['-d','exec-out','uiautomator','dump','/dev/tty']);
    const allowed=new Set(['Painel AVA','Meus cursos','Disciplinas','Cursos','Abrir','Acessar','Acessar curso','Voltar',
        'Entrar no AVA','Entrar com SUAP','Moodle IFRN','Menu','Sair','Conectar','Tentar novamente','Cancelar',
        'Página inicial','Início','Conteúdo','Participantes','Notas','Painel','Nenhuma disciplina encontrada']);
    const nodes=[];
    for(const match of xml.matchAll(/<node\b([^>]+)>/g)){
        const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
        const text=attrs.text||'',desc=attrs['content-desc']||'';
        if(attrs.clickable!=='true'&&!allowed.has(text)&&!allowed.has(desc))continue;
        nodes.push({label:allowed.has(text)?text:allowed.has(desc)?desc:'(conteúdo omitido)',
            class:/^(android\.|com\.android\.|org\.chromium\.)[\w.$]+$/.test(attrs.class||'')?attrs.class:undefined,
            clickable:attrs.clickable==='true',bounds:/^\[\d+,\d+\]\[\d+,\d+\]$/.test(attrs.bounds||'')?attrs.bounds:undefined});
    }
    const label=process.argv[3]||'current';
    if(!/^[a-z0-9-]+$/.test(label))throw new Error('Etiqueta inválida.');
    save(`ui-${label}`,{at:new Date().toISOString(),activity:activity(),nodeCount:nodes.length,nodes});
}else if(mode==='start'){
    const component=shell('cmd','package','resolve-activity','--brief',pkg).split('\n').find(l=>l.includes(`${pkg}/`));
    if(!component||!/^[\w.]+\/[\w.$]+$/.test(component))throw new Error('Activity não resolvida.');
    const response=shell('am','start','-W','-n',component);
    save('start',{at:new Date().toISOString(),component,status:/Status:\s*(\w+)/.exec(response)?.[1],
        totalTimeMs:Number(/TotalTime:\s*(\d+)/.exec(response)?.[1]||0),
        waitTimeMs:Number(/WaitTime:\s*(\d+)/.exec(response)?.[1]||0),
        alreadyRunning:/not started|brought to the front|current task/i.test(response),activity:activity()});
}else if(mode==='apk'){
    const zlib=require('node:zlib');
    const base=shell('pm','path',pkg).split('\n').map(l=>l.replace(/^package:/,'')).find(l=>l.endsWith('/base.apk'));
    if(!base)throw new Error('APK base indisponível.');
    const data=adb(['-d','exec-out','cat',base],true);
    let eocd=data.length-22;
    while(eocd>=Math.max(0,data.length-65557)&&data.readUInt32LE(eocd)!==0x06054b50)eocd--;
    if(eocd<0)throw new Error('ZIP não reconhecido.');
    const count=data.readUInt16LE(eocd+10);let offset=data.readUInt32LE(eocd+16);const scripts=[];
    for(let i=0;i<count;i++){
        if(data.readUInt32LE(offset)!==0x02014b50)throw new Error('Diretório ZIP inválido.');
        const method=data.readUInt16LE(offset+10),bytes=data.readUInt32LE(offset+20),nameLength=data.readUInt16LE(offset+28),
            extra=data.readUInt16LE(offset+30),comment=data.readUInt16LE(offset+32),local=data.readUInt32LE(offset+42);
        const name=data.subarray(offset+46,offset+46+nameLength).toString('utf8');offset+=46+nameLength+extra+comment;
        if(!/^assets\/www\/.*\.js$/.test(name))continue;
        const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28),compressed=data.subarray(start,start+bytes);
        const body=method===8?zlib.inflateRawSync(compressed):compressed,text=body.toString('utf8');
        scripts.push({file:name,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex'),
            hasEpochLiteral:text.includes('ifrn_moodle_session_epoch'),hasCourseGeneration:text.includes('courseSsoGeneration')});
    }
    save('apk',{at:new Date().toISOString(),sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length,
        executableScripts:scripts.length,epochLiteralInExecutableJs:scripts.some(s=>s.hasEpochLiteral),
        courseGenerationInExecutableJs:scripts.some(s=>s.hasCourseGeneration),
        panelBundle:scripts.find(s=>s.file==='assets/www/mobilemoodle/mobilemoodle.js')||null,
        rawApkStored:false,sourceMapContentRead:false});
}else if(mode==='debug'){
    const pid=shell('pidof',pkg);
    if(!/^\d+$/.test(pid))throw new Error('Processo não encontrado.');
    const socket=shell('cat','/proc/net/unix').split('\n').map(l=>l.match(/@(webview_devtools_remote_\d+)\s*$/)?.[1])
        .find(name=>name===`webview_devtools_remote_${pid}`);
    if(!socket)throw new Error('WebView de depuração do processo não encontrado.');
    adb(['-d','forward','tcp:9483',`localabstract:${socket}`]);
    save('debug',{at:new Date().toISOString(),port:9483,pid:Number(pid),socketBelongsToApp:true});
}else if(mode==='cleanup'){
    adb(['-d','forward','--remove','tcp:9483']);
    console.log(JSON.stringify({localForwardRemoved:9483,appStateChanged:false}));
}else if(mode==='tap'){
    const [x,y]=process.argv.slice(3).map(Number);
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>4000||y>4000)throw new Error('Coordenadas inválidas.');
    shell('input','tap',String(x),String(y));console.log(JSON.stringify({action:'tap',x,y}));
}else if(mode==='back'){
    shell('input','keyevent','KEYCODE_BACK');console.log(JSON.stringify({action:'Android Back'}));
}else if(mode==='logs'){
    const start=JSON.parse(fs.readFileSync(path.join(dir,'p05-device.json'),'utf8')).deviceLogStart;
    const pid=shell('pidof',pkg);
    if(!/^\d+$/.test(pid))throw new Error('Processo principal único não encontrado.');
    const raw=adb(['-d','logcat','-d','--pid',pid,'-T',start,'-v','brief']);
    const stages=new Set(['session-and-identity','session-switch','oauth-public-config','oauth-provider','language',
        'enrolments-cache-or-network','native-helper-and-navigation','course-first-paint','native-open','stored-site-lookup']);
    const timings=[];
    for(const line of raw.split('\n')){
        const payload=line.match(/\[IFRN-TIMING\]\s*(\{[^\n]*\})/)?.[1];
        if(!payload)continue;
        try{const t=JSON.parse(payload);if(stages.has(t.stage)&&Number.isFinite(t.ms)&&['ok','error'].includes(t.outcome))
            timings.push({stage:t.stage,ms:t.ms,outcome:t.outcome});}catch{}
    }
    const markers=['[IFRN-COURSE] curso nativo aberto','[IFRN-COURSE] abrindo curso nativo Moodle',
        '[IFRN-COURSE] getAndOpenCourse / navegação FALHOU','[IFRN-SITE] CoreSites.checkSite sucesso',
        '[IFRN-SITE] CoreSites.checkSite FALHOU','[IFRN-COURSE-NAV] redirecting to painel'];
    markers.push('[IFRN-SITE] startSuapOAuthLogin','[IFRN-IDENTITY] sessão correta definida como current');
    const counts=Object.fromEntries(markers.map(marker=>[marker,raw.split(marker).length-1]));
    const system=adb(['-d','logcat','-d','-b','system','-T',start,'-v','brief']);
    save('logs',{at:new Date().toISOString(),pid:Number(pid),windowStart:start,timings,markers:counts,
        appFatalExceptionMarkers:(raw.match(/FATAL EXCEPTION/g)||[]).length,
        appAnrMarkers:system.split('\n').filter(l=>l.includes(`ANR in ${pkg}`)).length,
        rawLogsStored:false,personalDataStored:false});
}else throw new Error('Modo inválido.');
