/** Select only the institutional provider advertised by this Moodle. IDs differ between sites. */
export function selectSuapProvider<T extends { name: string; url: string }>(providers: T[]): T | undefined {
    return providers.find(provider => /^suap(?:\s|$)/i.test(provider.name.trim()));
}
