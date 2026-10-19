(async () => {
    const element = document.querySelector('page-marketplace-ifrn');
    const component = element && window.ng?.getComponent(element);
    if (component?.router) {
        await component.router.navigate(['/login/marketplace-ifrn'], {queryParams:{forceLogin:true}});
        return 'Marketplace aberto para inspeção visual; sessão preservada.';
    }
    if (window.MoodleIfrnBridge?.goToMarketplace) {
        await window.MoodleIfrnBridge.goToMarketplace();
        return 'Navegação solicitada pela ponte existente.';
    }
    return 'Navegação requer interface do celular.';
})()
