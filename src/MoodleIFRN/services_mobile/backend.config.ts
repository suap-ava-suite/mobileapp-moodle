/** Build-time choice. Keep official for production; mock requires a separate test build. */
export const backendConfig: { provider: 'official' | 'mock'; baseUrl: string } = {
    provider: 'official',
    baseUrl: 'mock',
};
