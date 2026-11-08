/** Telas principais antigas; cursos e páginas internas não fazem parte deste bloqueio. */
export function isNativeMoodleLanding(url: string): boolean {
    const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean).map((part) => part.split(';')[0]);

    if (parts[0] !== 'main') {
        return false;
    }

    if (parts.length <= 2) {
        return true;
    }

    return (
        (parts[1] === 'home' && ['dashboard', 'sitehome', 'courses', 'mycourses'].includes(parts[2]))
        || (parts[1] === 'courses' && ['list', 'mycourses'].includes(parts[2]))
    );
}

/** Identifies only the Moodle course-storage manager routes. */
export function isCourseStorageManagerRoute(url: string): boolean {
    const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean).map((part) => part.split(';')[0]);
    const last = parts.at(-1);

    return last === 'storage' || (parts.at(-2) === 'storage' && /^\d+$/.test(last ?? ''));
}
