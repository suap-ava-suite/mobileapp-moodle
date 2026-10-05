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
