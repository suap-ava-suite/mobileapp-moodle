/** Preferências locais do painel; não altera os favoritos no servidor Moodle. */
const PREFIX = 'ifrn_course_favourites_v1:';

function currentOwner(): string {
    return (sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();
}

/** Nunca usa somente courseid: o mesmo número pode existir em vários Moodles. */
export function favouriteCourseKey(course: DashboardCourse): string | null {
    const id = Number(course.moodle_course_id ?? (course.source === 'painel' ? course.id : NaN));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    for (const candidate of [course.moodle_site_url, course.viewurl, course.details_url]) {
        if (!candidate) continue;
        try {
            const url = new URL(candidate);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
            const sitePath = url.pathname.split('/course/')[0].replace(/\/+$/, '');
            return JSON.stringify([url.origin + sitePath, id]);
        } catch { /* Tenta a próxima URL ou o identificador oficial de ambiente. */ }
    }
    if (course.ambiente?.id != null) {
        return JSON.stringify(['painel-ambiente:' + course.ambiente.id, id]);
    }
    return null;
}

export function createCourseFavourites() {
    const owner = currentOwner();
    const storageKey = PREFIX + encodeURIComponent(owner);
    let values: Record<string, boolean> = Object.create(null);
    if (owner) {
        try {
            const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                for (const [key, value] of Object.entries(parsed)) {
                    if (typeof value === 'boolean') values[key] = value;
                }
            }
        } catch { /* Preferência ausente/corrompida não bloqueia os cursos. */ }
    }
    const canEdit = (course: DashboardCourse): boolean =>
        !!owner && currentOwner() === owner && favouriteCourseKey(course) !== null;
    const isFavourite = (course: DashboardCourse): boolean => {
        if (!owner || currentOwner() !== owner) return false;
        const key = favouriteCourseKey(course);
        if (key && typeof values[key] === 'boolean') return values[key];
        return course.isfavourite === true || course.favourite === true;
    };
    const toggle = (course: DashboardCourse): boolean => {
        const key = favouriteCourseKey(course);
        if (!key || !canEdit(course)) throw new Error('Não foi possível identificar a conta ou o ambiente deste curso.');
        const next = !isFavourite(course);
        const updated = { ...values, [key]: next };
        // Só confirma na interface após gravar; false também precisa persistir
        // para permitir remover um favorito que veio marcado pelo servidor.
        localStorage.setItem(storageKey, JSON.stringify(updated));
        values = updated;
        return next;
    };
    return { canEdit, isFavourite, toggle };
}
