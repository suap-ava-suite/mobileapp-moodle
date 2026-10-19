/** Resolve ambiente sem transportar query strings, credenciais ou nomes de cursos. */
export function resolveCourseSite(course: {
    moodle_site_url?: string;
    viewurl?: string;
    details_url?: string;
    environment?: string;
    moodle?: string;
    ambiente?: { titulo?: string };
}): string | undefined {
    const environment = [course.environment, course.moodle, course.ambiente?.titulo].filter(Boolean).join(' ');
    const expected = /presencial/i.test(environment) ? 'https://presencial.ava.ifrn.edu.br'
        : /acad[eê]mico/i.test(environment) ? 'https://academico.ava.ifrn.edu.br' : undefined;
    const raw = course.moodle_site_url || course.viewurl || course.details_url;
    if (raw) {
        try {
            const url = new URL(raw);
            if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.ava.ifrn.edu.br')) {
                return undefined;
            }
            if (expected && url.origin !== expected) {
                return undefined;
            }

            return url.origin;
        } catch {
            return undefined;
        }
    }

    return expected;
}
