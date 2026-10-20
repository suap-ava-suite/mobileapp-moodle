(() => {
 const frame=document.querySelector('iframe')?.contentDocument;
 const data=JSON.parse(sessionStorage.getItem('ifrn_painel_dashboard') || 'null');
 const target=data?.diarios?.find(c=>String(c.id)==='4024');
 const link=[...frame?.querySelectorAll('a.painel-card-link') || []]
  .find(a=>target?.fullname && a.textContent.includes(target.fullname));
 if(!link) return {clicked:false};
 link.click();
 return {clicked:true,path:location.pathname};
})()
