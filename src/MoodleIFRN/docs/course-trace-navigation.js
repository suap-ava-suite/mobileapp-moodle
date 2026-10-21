(() => {
    const page = document.querySelector('page-moodle-open-course') || document.querySelector('page-painel');
    const service = page && window.ng?.getComponent(page)?.moodleSite;
    if (!service?.router) return { available: !!window.__ifrnNavigationTrace,
        events: window.__ifrnNavigationTrace || [], path: location.pathname };
    if (!window.__ifrnNavigationTrace) {
        window.__ifrnNavigationTrace = [];
        window.__ifrnNavigationSubscription = service.router.events.subscribe(event => {
            const row = { type: event.constructor.name };
            if (typeof event.url === 'string') row.path = event.url.split(/[?#]/)[0];
            if (typeof event.urlAfterRedirects === 'string') row.destination = event.urlAfterRedirects.split(/[?#]/)[0];
            if (typeof event.code === 'number') row.code = event.code;
            window.__ifrnNavigationTrace.push(row);
            if (window.__ifrnNavigationTrace.length > 100) window.__ifrnNavigationTrace.shift();
        });
    }
    return { available: true, events: window.__ifrnNavigationTrace,
        active: service.isNativeCourseHandoffActive(), path: service.router.url.split(/[?#]/)[0] };
})()
