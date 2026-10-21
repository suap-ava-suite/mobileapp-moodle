(() => {
    const element = document.querySelector('page-moodle-open-course');
    const page = element && window.ng?.getComponent(element);
    const service = page?.moodleSite;
    let marker;
    try { marker = JSON.parse(sessionStorage.getItem('ifrn_moodle_resume_oauth') || 'null'); } catch { marker = null; }
    return {
        path: location.pathname,
        startOAuth: new URL(location.href).searchParams.get('startOAuth'),
        phase: page?.phase,
        loading: page?.loading,
        preparationPending: !!service?.oauthPreparation,
        sessionOpening: !!service?.sessionOpening,
        oauthFlowActive: !!service?.oauthFlowActive,
        oauthReturnNavigating: !!service?.oauthReturnNavigating,
        oauthPending: sessionStorage.getItem('ifrn_moodle_oauth_pending') === '1',
        resumeMarker: !!marker,
        resumeMarkerExpired: marker ? marker.until <= Date.now() : null,
        navigationEvents: window.__ifrnNavigationTrace || [],
    };
})()
