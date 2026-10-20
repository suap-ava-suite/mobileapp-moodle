(() => {
 const data = JSON.parse(sessionStorage.getItem('ifrn_painel_dashboard') || 'null');
 const safe = c => ({id:c.id,courseid:c.courseid,ambiente:c.ambiente,
   enrolled:c.is_enrolled,viewurl:(()=>{try{const u=new URL(c.viewurl||c.url);return u.origin+u.pathname+'?id='+u.searchParams.get('id')}catch{return null}})()});
 const lists = {};
 for (const k of ['diarios','coordenacoes','praticas','reutilizaveis','autoinscricoes']) if(Array.isArray(data?.[k])) lists[k]=data[k].map(safe);
 const frame=document.querySelector('iframe')?.contentDocument;
 return {path:location.pathname,ambientes:data?.ambientes,lists,
 links:frame ? [...frame.querySelectorAll('a[role=button]')].map(a=>({class:a.className,href:a.getAttribute('href')})) : []};
})()
