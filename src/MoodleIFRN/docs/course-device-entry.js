(() => {
 const page=document.querySelector('page-marketplace-ifrn:not(.ion-page-hidden)');
 const button=page?.querySelector('.btn-enter:not([disabled])');
 if(!button) return {continued:false};
 button.click();return {continued:true};
})()
