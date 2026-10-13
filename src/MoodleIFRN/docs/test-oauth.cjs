// Execute na raiz do projeto: node src/MoodleIFRN/docs/test-oauth.cjs
// Testes isolados de estado/rollback e contrato do navegador, sem acessar contas reais.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
class MemoryStorage {
    map = new Map();
    getItem(k) { return this.map.get(k) ?? null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    clear() { this.map.clear(); }
}
const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
const instances = new Map();
class HttpHeaders { set() { return this; } }
class HttpErrorResponse extends Error {}
class HttpBackend {}
let httpPost;
class HttpClient { post(...args) { return { pipe: () => httpPost(...args) }; } }
class PainelAvaService {}
class BiometricService {}
class Router {}
const navigations = [];
const window = { atob, btoa,
    location: { origin: 'http://localhost', assign: u => navigations.push(u), search: '' },
};
const external = {
    '@angular/core': { Injectable: () => x => x, Component: () => x => x,
        inject: type => instances.get(type) || new type() },
    '@angular/common/http': { HttpClient, HttpBackend, HttpHeaders, HttpErrorResponse },
    '@angular/router': { Router },
    '@/core/shared.module': { CoreSharedModule: {} },
    '@/MoodleIFRN/services_mobile/painel-ava.service': { PainelAvaService },
    '@/MoodleIFRN/services_mobile/biometric.service': { BiometricService },
    '@services/lang': { CoreLang: { getCurrentLanguageSync: () => 'pt-br' } },
    '@services/overlays/alerts': { CoreAlerts: { showError() {}, confirm() {} } },
    '@static/logger': { CoreLogger: { getInstance: () => ({ debug() {}, warn() {} }) } },
    '@services/platform': { CorePlatform: { ready: async () => {} } },
    '@services/navigator': { CoreNavigator: {} },
    rxjs: { firstValueFrom: value => Promise.resolve(value),  timeout: () => {}, map: () => {}, TimeoutError: class extends Error {} },
};
const cache = new Map();
function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
    }).outputText;
    const context = {
        module, exports: module.exports, window, sessionStorage, localStorage,
        URL, URLSearchParams, TextEncoder, Uint8Array, btoa, atob, queueMicrotask, console, setTimeout, clearTimeout,
        document: { querySelector: () => null },
        require(name) {
            if (external[name]) return external[name];
            if (name.startsWith('@/MoodleIFRN/')) return load(path.join(root, name.slice('@/MoodleIFRN/'.length) + '.ts'));
            if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
            throw new Error('Dependencia inesperada: ' + name);
        },
    };
    vm.runInNewContext(js, context, { filename: file });
    return module.exports;
}
const state = load(path.join(root, 'mobilemoodle/core_mobile/oauth-profile.ts'));
const { AuthService } = load(path.join(root, 'services_mobile/auth.service.ts'));
const profile = { identificacao: '00123', nome: 'Aluno teste', email: '', email_google_classroom: 'fake@example.invalid', campus: { sigla: 'XX' }, extra: 'preservado', foto: 'https://suap.ifrn.edu.br/media/foto.jpg' };
const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.ZmFrZQ';
function reset() {
    sessionStorage.clear(); localStorage.clear(); instances.clear(); navigations.length = 0;
    sessionStorage.setItem('ifrn_username', '00999');
    sessionStorage.setItem('ifrn_painel_dashboard', JSON.stringify({ diarios: [{ id: 99 }] }));
    sessionStorage.setItem('ifrn_painel_owner', '00999');
    sessionStorage.setItem('ifrn_painel_profile', JSON.stringify({ identificacao: '00999', nome: 'Anterior' }));
    localStorage.setItem('ifrn_access_token', jwt);
    localStorage.setItem('ifrn_refresh_token', jwt);
    localStorage.setItem('ifrn_biometric_login_enabled', 'true');
}
async function main() {
    reset();
    const auth = new AuthService();
    auth.saveOAuthSession(profile, 1800);
    assert.equal(state.readOAuthProfile().identity, '00123');
    assert.equal(state.readOAuthProfile().profile.extra, 'preservado');
    assert.equal(state.readOAuthProfile().profile.foto, profile.foto);
    assert.equal(auth.getToken(), null);
    assert.equal(sessionStorage.getItem('ifrn_username'), '00123');
    assert.equal(await auth.restoreSession(), true);

    reset();
    auth.saveOAuthSession(profile, 1800);
    const record = JSON.parse(sessionStorage.getItem(state.OAUTH_PROFILE_KEY));
    record.expiresAt = Date.now() - 1;
    sessionStorage.setItem(state.OAUTH_PROFILE_KEY, JSON.stringify(record));
    localStorage.setItem('ifrn_access_token', jwt);
    assert.equal(await auth.restoreSession(), false); // Nao recuperar conta JWT antiga.
    assert.equal(auth.getToken(), null);
    auth.saveSession({ access_token: jwt, refresh_token: jwt });
    assert.equal(state.hasOAuthProfileMode(), false);
    assert.equal(auth.getToken(), jwt); // Login atual continua aceito.
    auth.saveOAuthSession(profile, 1800);
    auth.logout();
    assert.equal(state.hasOAuthProfileMode(), false);

    console.log('OK: snapshot de perfil, foto preservada, expiração e compatibilidade da sessão.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
