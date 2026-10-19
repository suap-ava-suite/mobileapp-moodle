(()=>{
    const r = {};
    const cs = e => e ? getComputedStyle(e) : null;
    r.safeTop = cs(document.documentElement).getPropertyValue('--ion-safe-area-top');
    const b = document.querySelector('.brand');
    r.brandTop = b ? b.getBoundingClientRect().top : null;
    if (r.brandTop !== null && r.safeTop) {
        r.brandTopMinusSafeTop = (parseFloat(r.brandTop) - parseFloat(r.safeTop)).toFixed(2) + 'px';
    }
    const h = document.querySelector('.welcome__header');
    r.header = h ? { pt: cs(h).paddingTop, mh: cs(h).minHeight } : null;
    const btn = document.querySelector('.btn-enter, ion-button.btn-enter');
    r.btnEnter = btn ? {
        bg: cs(btn).getPropertyValue('--background') || cs(btn).backgroundColor,
        color: cs(btn).getPropertyValue('--color') || cs(btn).color
    } : null;
    const ava = document.querySelector('.ava-label');
    r.avaLabel = ava ? {
        color: cs(ava).color,
        border: cs(ava).borderColor,
        bg: cs(ava).backgroundColor
    } : null;
    r.url = location.href;
    r.darkClass = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    r.bodyBg = cs(document.body).backgroundColor;
    r.fonts = [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status);
    return JSON.stringify(r);
})()
