// Encerra somente a tentativa de curso do teste e recupera a shell IFRN.
// Perfil, dashboard, cookies e tokens nativos são preservados.
(() => {
    window.__ifrnNavigationSubscription?.unsubscribe();
    for (const key of ['ifrn_moodle_pending_open_course', 'ifrn_moodle_oauth_pending',
        'ifrn_moodle_resume_oauth', 'ifrn_course_origin', 'ifrn_course_id']) {
        sessionStorage.removeItem(key);
    }
    window.location.assign('/login/painel');
    return { returningToPanel: true };
})()
