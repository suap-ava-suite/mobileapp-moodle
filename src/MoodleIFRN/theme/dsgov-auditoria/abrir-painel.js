(async () => {
    const element = document.querySelector('page-marketplace-ifrn');
    const component = element && window.ng?.getComponent(element);
    if (!component?.router) return 'Navegação requer interface do celular.';
    await component.router.navigate(['/login/painel']);
    return 'Painel aberto pela navegação existente.';
})()
