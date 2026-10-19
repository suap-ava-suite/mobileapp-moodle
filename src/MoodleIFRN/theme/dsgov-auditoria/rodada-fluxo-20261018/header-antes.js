(async()=>{
 const frame=document.querySelector('page-painel iframe');if(!frame?.contentDocument)return JSON.stringify({frame:false});
 const doc=frame.contentDocument,win=frame.contentWindow;
 const measure=()=>({parentTop:getComputedStyle(document.documentElement).getPropertyValue('--ion-safe-area-top').trim(),frameTop:win.getComputedStyle(doc.documentElement).getPropertyValue('--ion-safe-area-top').trim(),frameVisible:!!frame.getClientRects().length && !frame.closest('.ion-page-hidden'),headerTop:doc.querySelector('ion-header')?.getBoundingClientRect().top,headerHeight:doc.querySelector('ion-header')?.getBoundingClientRect().height});
 const before=measure();win.visualViewport?.dispatchEvent(new Event('scroll'));await new Promise(r=>requestAnimationFrame(r));
 return JSON.stringify({before,afterViewportScroll:measure()});
})()
