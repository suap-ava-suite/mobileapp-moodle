JSON.stringify({
    angular: typeof window.ng,
    cordova: typeof window.cordova,
    scripts: [...document.scripts].map(s=>({file:new URL(s.src || '/',location.origin).pathname.split('/').pop(),type:s.type})),
    resources: performance.getEntriesByType('resource').filter(e => /main|polyfill|runtime|cordova|styles/.test(new URL(e.name).pathname)).map(e=>({file:new URL(e.name).pathname.split('/').pop(),duration:Math.round(e.duration),size:e.transferSize})),
    bodyChildren: document.querySelector('app-root')?.childElementCount,
    online: navigator.onLine,
})
