/** Resolve ambiente sem transportar query strings, credenciais ou nomes de cursos. */
export function resolveCourseSite(course: {
    moodle_site_url?: string;
    viewurl?: string;
    details_url?: string;
    environment?: string;
    moodle?: string;
    ambiente?: { titulo?: string };
}): string | undefined {
    const raw = course.moodle_site_url || course.viewurl || course.details_url;
    if (raw) {
        try {
            const url = new URL(raw);
            if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.ava.ifrn.edu.br')) {
                return undefined;
            }

            return url.origin;
        } catch {
            return undefined;
        }
    }

    return undefined;
}
