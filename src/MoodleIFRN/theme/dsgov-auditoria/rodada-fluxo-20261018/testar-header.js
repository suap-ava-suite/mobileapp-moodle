(async()=>{
 const frame=document.querySelector('page-painel:not(.ion-page-hidden) iframe');if(!frame?.contentDocument)return JSON.stringify({error:'painel não visível'});
 const doc=frame.contentDocument,win=frame.contentWindow,content=doc.querySelector('ion-content#page-content');
 const next=()=>new Promise(r=>win.requestAnimationFrame(()=>win.requestAnimationFrame(r)));
 const rows=[];
 const measure=state=>{const header=doc.querySelector('ion-header'),h=header.getBoundingClientRect();const safe=parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--ion-safe-area-top'))||0;
 rows.push({state,safeTop:safe,headerTop:h.top,headerHeight:h.height,elements:[...doc.querySelectorAll('.ava-header-logo,.ava-header-title,.ava-header-action')].map(e=>{const b=e.getBoundingClientRect();return{tag:e.tagName,top:b.top,bottom:b.bottom,visible:!!b.width&&b.top>=safe-1&&b.bottom<=h.bottom+1};})});};
 measure('before');
 if(content?.scrollToBottom){await content.scrollToBottom(0);await next();await content.scrollToTop(0);await next();measure('scroll-bottom-and-top');}
 for(const id of ['btn-toggle-help','btn-toggle-accessibility','btn-toggle-profile']){
  const button=doc.getElementById(id);if(!button)continue;button.click();await next();doc.getElementById('sidebar-modal-close')?.click();await next();measure(id+'-closed');
 }
 return JSON.stringify({device:'Android WebView',kind:'rolagem e cliques programáticos em controles reais',states:rows});
})()
