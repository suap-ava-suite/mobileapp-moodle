(()=>{const r={};const cs=e=>getComputedStyle(e);r.safeTop=cs(document.documentElement).getPropertyValue('--ion-safe-area-top');
const b=document.querySelector('.brand');r.brandTop=b?b.getBoundingClientRect().top:null;
const h=document.querySelector('.welcome__header');r.header=h?{pt:cs(h).paddingTop,mh:cs(h).minHeight}:null;
r.anc=[];let el=h;while(el){const s=cs(el);if(parseFloat(s.paddingTop)||parseFloat(s.marginTop))r.anc.push([el.tagName,String(el.className).slice(0,50),s.paddingTop,s.marginTop]);el=el.parentElement}
const c=document.querySelector('ion-content');r.inner=c&&c.shadowRoot&&c.shadowRoot.querySelector('.inner-scroll')?cs(c.shadowRoot.querySelector('.inner-scroll')).paddingTop:null;
r.innerH=innerHeight;r.dpr=devicePixelRatio;r.url=location.href.slice(0,80);r.darkClass=document.documentElement.classList.contains('dark');r.bodyBg=cs(document.body).backgroundColor;
r.fonts=[...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status);
r.external=performance.getEntriesByType('resource').filter(e=>!e.name.startsWith(location.origin)).map(e=>e.name).slice(0,40);
r.ionApp=!!customElements.get('ion-app');return JSON.stringify(r)})()
