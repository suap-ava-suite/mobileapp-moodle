(() => {
    const frame=document.querySelector('page-painel:not(.ion-page-hidden) iframe');
    const link=frame?.contentDocument?.querySelector('.painel-card:not(.painel-card--autoinscricao) .painel-card-link');
    if (!link) return 'Nenhum curso existente disponível para abrir; nenhuma matrícula solicitada.';
    link.click();
    return 'Abertura de curso existente solicitada pela interface do painel.';
})()
