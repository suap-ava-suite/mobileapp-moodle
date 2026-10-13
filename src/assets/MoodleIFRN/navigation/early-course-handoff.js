/**
 * Early handoff — roda no index.html ANTES do Angular.
 * Cobre o WebView preto enquanto o Ionic sobe após o clique no curso no Painel.
 * Injetado por patch-moodle-ifrn.js (marcadores BEGIN/END MoodleIFRN).
 */
(function ifrnEarlyCourseHandoff() {
    try {
        // Só a flag curta do reload — pending_open_course vive até o curso abrir
        // e não pode manter este overlay sozinho.
        var pending = sessionStorage.getItem('ifrn_course_handoff_pending') === '1';
        if (!pending || document.getElementById('ifrn-handoff-loading')) {
            return;
        }

        document.documentElement.classList.add('ifrn-native-handoff');
        document.documentElement.style.background = '#ffffff';
        if (document.body) {
            document.body.style.background = '#ffffff';
        }

        var el = document.createElement('div');
        el.id = 'ifrn-handoff-loading';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-busy', 'true');
        el.innerHTML = ''
            + '<style>'
            + '#ifrn-handoff-loading{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;'
            + 'background:#fff;color:#333;font:1rem Arial,Helvetica,sans-serif;text-align:center;'
            + 'padding:max(24px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))}'
            + '#ifrn-handoff-loading .brand{width:min(132px,34vw);aspect-ratio:1;display:grid;place-items:center;position:relative;margin:0 auto}'
            + '#ifrn-handoff-loading .ring{position:absolute;inset:0;animation:ifrn-early-spin 1.1s linear infinite}'
            + '#ifrn-handoff-loading .track{fill:none;stroke:rgba(22,136,33,.14);stroke-width:4}'
            + '#ifrn-handoff-loading .arc{fill:none;stroke:#168821;stroke-width:5;stroke-dasharray:68 271;stroke-linecap:round}'
            + '#ifrn-handoff-loading img{position:relative;width:86%;height:86%;border-radius:50%;object-fit:cover;'
            + 'background:#fff;box-shadow:0 2px 10px rgba(11,79,27,.12);z-index:1}'
            + '#ifrn-handoff-loading p{margin:1rem 0 0;font-weight:600}'
            + '@keyframes ifrn-early-spin{to{transform:rotate(360deg)}}'
            + '@media (prefers-reduced-motion:reduce){#ifrn-handoff-loading .ring{animation:none;opacity:.9}}'
            + '</style>'
            + '<div><div class="brand" aria-hidden="true">'
            + '<svg class="ring" viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="54"></circle>'
            + '<circle class="arc" cx="60" cy="60" r="54"></circle></svg>'
            + '<img src="mobilemoodle/static/theme/ifrn/img/splash-logo.png" alt="">'
            + '</div><p>Carregando curso...</p></div>';

        function mount() {
            (document.body || document.documentElement).appendChild(el);
            try {
                var splash = navigator.splashscreen;
                if (splash && typeof splash.hide === 'function') {
                    splash.hide();
                }
            } catch (e) { /* ignore */ }
        }

        if (document.body) {
            mount();
        } else {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        }
    } catch (e) {
        // Falha silenciosa: a ponte Ionic ainda mostra o handoff depois.
    }
})();
