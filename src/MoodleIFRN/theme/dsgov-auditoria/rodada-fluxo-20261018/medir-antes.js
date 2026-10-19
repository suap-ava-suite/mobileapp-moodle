(() => {
    const doc=document.querySelector('page-painel:not(.ion-page-hidden) iframe')?.contentDocument;
    if(!doc)return 'Painel não está visível.';
    window.__ifrnAuditTimings=[];
    const started=performance.now();
    let wrapped=false;
    const observer=new MutationObserver(()=>{
        const bridge=document.querySelector('page-moodle-open-course');
        const service=bridge && window.ng?.getComponent(bridge)?.moodleSite;
        if(service && !wrapped){
            wrapped=true;
            for(const name of ['ensureMatchingMoodleSession','checkPresencialSite','findSuapProvider','openCourseById']){
                const original=service[name];
                service[name]=async function(...args){const t=performance.now();try{const result=await original.apply(this,args);window.__ifrnAuditTimings.push({stage:name,ms:Math.round(performance.now()-t),ok:true});return result;}catch(e){window.__ifrnAuditTimings.push({stage:name,ms:Math.round(performance.now()-t),ok:false});throw e;}};
            }
        }
        const course=[...document.querySelectorAll('page-core-course-index')].find(e=>!e.closest('.ion-page-hidden') && e.getClientRects().length);
        if(course){window.__ifrnAuditTimings.push({stage:'click-to-course-visible',ms:Math.round(performance.now()-started),ok:true});observer.disconnect();}
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    window.setTimeout(()=>observer.disconnect(),90000);
    const links=[...doc.querySelectorAll('.painel-card:not(.painel-card--autoinscricao) .painel-card-link')];
    const link=links.find(e=>/presencial/i.test(e.closest('.painel-card')?.querySelector('.painel-card-header-env')?.textContent || ''));
    if(!link){observer.disconnect();return 'Não há card Presencial para medir.';}
    link.click();return 'Medição Presencial iniciada; nenhum identificador coletado.';
})()
