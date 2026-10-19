JSON.stringify((() => {
    const frame = document.querySelector('page-painel:not(.ion-page-hidden) iframe');
    const doc = frame?.contentDocument;
    if (!doc) return {frame:false};
    const cs = frame.contentWindow.getComputedStyle(doc.body);
    return {frame:true,bodyChildren:doc.body.childElementCount,
        cards:doc.querySelectorAll('.painel-card-link').length,
        background:cs.backgroundColor,font:cs.fontFamily,
        dark:doc.documentElement.classList.contains('dark'),
        fonts:[...doc.fonts].filter(f=>f.family.includes('Rawline')).map(f=>({weight:f.weight,status:f.status})),
        controls:[...doc.querySelectorAll('button,ion-button,a')].filter(e=>e.getClientRects().length).slice(0,25).map(e=>({tag:e.tagName,cls:e.className}))};
})())
