// CDP sobre ADB: consultas agregadas, sem leitura de tokens/cookies/storage ou texto pessoal.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const mode=process.argv[2]||'state',label=process.argv[3]||'current';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Etiqueta inválida.');
const dir=__dirname;
const envs={academic:'https://academico.ava.ifrn.edu.br',presencial:'https://presencial.ava.ifrn.edu.br'};
const stateExpression=`(()=>{
    const path=location.pathname;
    const match=path.match(/\\/course(?:\\/deep)*\\/(\\d+)(?:\\/|$)/);
    const panel=document.querySelector('page-painel');
    const frame=panel?.querySelector('iframe');
    const app=frame?.contentWindow?.MobileMoodle?.App;
    const courses=Array.isArray(app?.dashboardCache?.courses)?app.dashboardCache.courses:[];
    const component=window.ng?.getComponent?.(panel);
    const service=component?.moodleSite;
    const avatar=frame?.contentDocument?.getElementById('toolbar-avatar');
    const image=avatar?.tagName==='IMG'?avatar:avatar?.querySelector('img');
    const known={academic:'https://academico.ava.ifrn.edu.br',presencial:'https://presencial.ava.ifrn.edu.br'};
    const matchingCurrent={};
    for(const [key,url] of Object.entries(known)){
        try{matchingCurrent[key]=typeof service?.hasMatchingPresencialSession==='function'
            ?service.hasMatchingPresencialSession(url):null;}catch{matchingCurrent[key]=null;}
    }
    return {route:path==='/login/painel'?'painel':match?'curso-nativo':path==='/login/moodle-open-course'?'ponte-curso':
        path==='/login/marketplace-ifrn'?'marketplace':path==='/login/ifrn-login'?'login-ifrn':'outra',
        courseIdForComparison:match?.[1]||null,panels:document.querySelectorAll('page-painel').length,
        panelCards:frame?.contentDocument?.querySelectorAll('.painel-card-link').length||0,
        cachedCourses:courses.length,enrolledCourses:courses.filter(c=>c.is_enrolled).length,
        academicCourses:courses.filter(c=>c.is_enrolled&&c.moodle_site_url?.startsWith(known.academic)).length,
        presencialCourses:courses.filter(c=>c.is_enrolled&&c.moodle_site_url?.startsWith(known.presencial)).length,
        nativeContents:!!document.querySelector('page-core-course-contents'),
        nativeModules:document.querySelectorAll('core-course-module').length,
        visibleLoaders:[...document.querySelectorAll('ion-loading')].filter(n=>n.getClientRects().length>0).length,
        iframeCount:document.querySelectorAll('iframe').length,
        bridgeAvailable:typeof window.MoodleIfrnBridge?.openCourse==='function',
        avatarElementPresent:!!avatar,avatarImageLoaded:!!image?.complete&&image?.naturalWidth>0,
        componentInspectable:!!component,matchingCurrent};
})()`;
(async()=>{
    const targets=await(await fetch('http://127.0.0.1:9483/json')).json();
    const page=targets.find(p=>{try{return new URL(p.url).origin==='http://localhost';}catch{return false;}});
    if(!page)throw new Error('WebView local principal indisponível.');
    const ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=()=>no(new Error('Falha na conexão CDP.'));});
    let seq=0;
    async function rpc(method,params){
        const id=++seq;
        return new Promise((ok,no)=>{
            const timer=setTimeout(()=>{ws.close();no(new Error('Consulta CDP excedeu o prazo.'));},25000);
            ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id!==id)return;clearTimeout(timer);
                if(m.error||m.result?.exceptionDetails)return no(new Error('Avaliação indisponível; detalhe omitido.'));
                ok(m.result);};
            ws.send(JSON.stringify({id,method,params}));
        });
    }
    async function inspectBridgeOwner(){
        const fn=await rpc('Runtime.evaluate',{expression:'window.MoodleIfrnBridge?.openCourse',returnByValue:false});
        if(!fn.result?.objectId)return {found:false};
        const props=await rpc('Runtime.getProperties',{objectId:fn.result.objectId,ownProperties:true});
        const queue=[...props.internalProperties?.filter(p=>['[[BoundThis]]','[[TargetFunction]]'].includes(p.name)).map(p=>p.value)||[]];
        const seen=new Set();
        async function inspect(value){
            if(!value?.objectId||seen.has(value.objectId))return null;seen.add(value.objectId);
            const properties=await rpc('Runtime.getProperties',{objectId:value.objectId,ownProperties:true});
            const service=properties.result?.find(p=>p.name==='moodleSite')?.value?.objectId;
            if(service)return service;
            for(const p of properties.internalProperties||[]){
                if(['[[BoundThis]]','[[TargetFunction]]'].includes(p.name))queue.push(p.value);
                if(p.name==='[[Scopes]]'&&p.value?.objectId){
                    const scopes=await rpc('Runtime.getProperties',{objectId:p.value.objectId,ownProperties:true});
                    for(const scope of scopes.result||[]){
                        if(!scope.value?.objectId||!/^\d+$/.test(scope.name)||scope.value.description==='Global')continue;
                        const fields=await rpc('Runtime.getProperties',{objectId:scope.value.objectId,ownProperties:true});
                        if((fields.result?.length||0)>3)continue;
                        for(const field of fields.result||[])if(field.value?.objectId)queue.push(field.value);
                    }
                }
            }
            return null;
        }
        const scopes=props.internalProperties?.find(p=>p.name==='[[Scopes]]')?.value?.objectId;
        if(!scopes)return {found:false};
        const list=await rpc('Runtime.getProperties',{objectId:scopes,ownProperties:true});
        const summary=[];
        for(const scope of list.result||[]){
            if(!scope.value?.objectId||!/^\d+$/.test(scope.name)||scope.value.description==='Global')continue;
            const fields=await rpc('Runtime.getProperties',{objectId:scope.value.objectId,ownProperties:true});
            const diagnostic={fieldCount:fields.result?.length||0,fieldTypes:(fields.result||[]).map(p=>p.value?.type||'accessor'),candidateFieldNames:[]};summary.push(diagnostic);
            for(const field of fields.result||[]){
                if(field.value?.type==='function'&&(fields.result?.length||0)<=3)queue.push(field.value);
                if(field.value?.type!=='object'||!field.value?.objectId)continue;
                const candidate=await rpc('Runtime.getProperties',{objectId:field.value.objectId,ownProperties:true});
                diagnostic.candidateFieldNames.push((candidate.result||[]).map(p=>p.name)
                    .filter(n=>/^(moodleSite|moodleSiteService|moodle|authService|painelAva|router|bridgeApi|openingCourse)$/.test(n)));
                const service=candidate.result?.find(p=>p.name==='moodleSite')?.value?.objectId;
                if(service)return {found:true,serviceId:service};
            }
        }
        while(queue.length&&seen.size<30){const id=await inspect(queue.shift());if(id)return {found:true,serviceId:id};}
        return {found:false,scopes:summary};
    }
    async function evaluate(expression,awaitPromise=true){
        const id=++seq;
        return new Promise((ok,no)=>{
            const timer=setTimeout(()=>{ws.close();no(new Error('Consulta CDP excedeu o prazo.'));},25000);
            ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id!==id)return;clearTimeout(timer);
                if(m.error||m.result?.exceptionDetails)return no(new Error('Avaliação indisponível; detalhe omitido.'));
                ok(m.result?.result?.value);};
            ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise,returnByValue:true}}));
        });
    }
    try{
        let value;
        if(mode==='probe'){
            value=await inspectBridgeOwner();delete value.serviceId;
        }else if(mode==='state')value=await evaluate(stateExpression);
        else if(mode==='open'){
            const origin=envs[label];if(!origin)throw new Error('Ambiente inválido.');
            // Abertura normal autorizada. A identidade continua sendo validada pelo aplicativo.
            value=await evaluate(`(async()=>{
                if(location.pathname!='/login/painel')return {requested:false,reason:'fora-do-painel'};
                const host=document.querySelector('page-painel');const component=window.ng?.getComponent?.(host);
                const service=component?.moodleSite;
                const canInspect=typeof service?.hasMatchingPresencialSession==='function';
                const currentMatches=canInspect?service.hasMatchingPresencialSession(${JSON.stringify(origin)}):null;
                if(canInspect&&!currentMatches)return {requested:false,reason:'sessao-nativa-atual-nao-confirmada'};
                const data=host?.querySelector('iframe')?.contentWindow?.MobileMoodle?.App?.dashboardCache;
                const course=data?.courses?.find(c=>c.is_enrolled&&c.moodle_course_id&&c.moodle_site_url?.startsWith(${JSON.stringify(origin)}));
                if(!course||!window.MoodleIfrnBridge?.openCourse)return {requested:false,reason:'curso-ou-bridge-indisponivel'};
                const start=performance.now();
                await window.MoodleIfrnBridge.openCourse(course.moodle_course_id,course.name,course.moodle_site_url);
                return {requested:true,bridgeReturnedMs:Math.round(performance.now()-start),
                    precheck:canInspect?'matched-current':'delegated-to-app',
                    courseIdForComparison:String(course.moodle_course_id)};
            })()`);
        }else throw new Error('Modo inválido.');
        const rawId=value.courseIdForComparison;delete value.courseIdForComparison;
        if(rawId)value.courseFingerprint=crypto.createHash('sha256').update(String(rawId)).digest('hex').slice(0,16);
        const priorFile=path.join(dir,'p05-webview-open-'+label+'.json');
        if(mode==='state'&&value.courseFingerprint){
            const opens=fs.readdirSync(dir).filter(f=>/^p05-webview-open-(academic|presencial)\.json$/.test(f));
            value.matchesRequestedCourse=opens.some(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).courseFingerprint===value.courseFingerprint);
        }
        const result={at:new Date().toISOString(),mode,label,...value};
        fs.writeFileSync(mode==='open'?priorFile:path.join(dir,`p05-webview-state-${label}.json`),JSON.stringify(result,null,2));
        console.log(JSON.stringify(result));
    }finally{ws.close();}
})().catch(e=>{console.log(JSON.stringify({failed:true,reason:e.message}));process.exitCode=1;});
