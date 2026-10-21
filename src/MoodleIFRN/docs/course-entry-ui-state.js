(() => ({
    path: location.pathname,
    ready: document.readyState,
    marketplaceCount: document.querySelectorAll('page-marketplace-ifrn').length,
    buttons: [...document.querySelectorAll('ion-button')].filter(button => button.getClientRects().length)
        .map(button => ({ text: button.textContent.trim().slice(0, 100), disabled: button.disabled,
            className: button.className })),
    visiblePages: [...document.querySelectorAll('.ion-page')]
        .filter(page => !page.classList.contains('ion-page-hidden')).map(page => page.tagName),
    angular: !!document.querySelector('[ng-version]'),
}))()
