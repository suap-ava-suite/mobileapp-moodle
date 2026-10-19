JSON.stringify((() => {
    const visible = e => !!(e.getClientRects().length && e.getBoundingClientRect().width && e.getBoundingClientRect().height);
    const page = [...document.querySelectorAll('ion-router-outlet > *, ion-nav > *')].filter(visible).map(e => e.tagName);
    const root = getComputedStyle(document.documentElement);
    return {
        page,
        ready: document.readyState,
        structure: [...document.body.children].filter(e => e.tagName !== 'SCRIPT').map(e => ({tag:e.tagName,children:[...e.children].map(c => c.tagName)})),
        dark: document.documentElement.classList.contains('dark'),
        frames: [...document.querySelectorAll('iframe')].map(e => ({ visible: visible(e), origin: new URL(e.src, location.origin).origin })),
        tokens: Object.fromEntries(['surface','canvas','text','muted','interactive','button-background'].map(k => [k, root.getPropertyValue('--ifrn-' + k).trim()])),
        fonts: [...document.fonts].filter(f => f.family.includes('Rawline')).map(f => ({weight:f.weight,status:f.status})),
    };
})())
