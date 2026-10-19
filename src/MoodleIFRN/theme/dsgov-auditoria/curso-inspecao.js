JSON.stringify((() => {
    const page=[...document.querySelectorAll('page-core-course-index,page-core-course-contents')].find(e=>!e.closest('.ion-page-hidden') && e.getClientRects().length);
    if(!page) return {courseVisible:false};
    const cs=getComputedStyle(page);
    return {courseVisible:true,page:page.tagName,font:cs.fontFamily,color:cs.color,
        tokens:Object.fromEntries(['surface','canvas','text','muted','ava','button-background'].map(k=>[k,cs.getPropertyValue('--ifrn-'+k).trim()])),
        fonts:[...document.fonts].filter(f=>f.family.includes('Rawline')).map(f=>({weight:f.weight,status:f.status}))};
})())
