// Consulta local: retorna apenas ambiente, estado e comparação de identidade.
(async () => {
    if (!window.sqlitePlugin) return { available: false };
    const profile = JSON.parse(sessionStorage.getItem('ifrn_painel_profile') || 'null');
    const expected = String(profile?.matricula || profile?.username || profile?.identificacao
        || sessionStorage.getItem('ifrn_username') || '').trim().toLowerCase();
    const db = window.sqlitePlugin.openDatabase({ name: 'MoodleMobile', location: 'default' });
    return new Promise(resolve => db.executeSql(
        'SELECT id, siteUrl, loggedOut, info, CASE WHEN token IS NULL OR token = ? THEN 0 ELSE 1 END AS tokenInDatabase FROM sites_2',
        [''], async result => {
            const sessions = [];
            for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                let info;
                try { info = JSON.parse(row.info || '{}'); } catch { info = {}; }
                let site;
                try { site = new URL(row.siteUrl).origin; } catch { site = '(invalid)'; }
                let tokenInSecureStorage = null;
                try {
                    const secure = window.cordova?.MoodleApp?.secureStorage;
                    if (secure) {
                        let timer;
                        try {
                            const result = await Promise.race([
                                secure.get(['token'], row.id),
                                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 3000); }),
                            ]);
                            tokenInSecureStorage = !!result?.token;
                        } finally { clearTimeout(timer); }
                    }
                } catch { /* presença não confirmada */ }
                sessions.push({ site, loggedOut: !!row.loggedOut, tokenInDatabase: !!row.tokenInDatabase,
                    tokenInSecureStorage,
                    identityAvailable: !!info.username,
                    matchesPanel: !!expected && String(info.username || '').trim().toLowerCase() === expected });
            }
            resolve({ available: true, panelIdentityAvailable: !!expected, sessions });
        }, () => resolve({ available: false, reason: 'session-database-unavailable' }),
    ));
})()
