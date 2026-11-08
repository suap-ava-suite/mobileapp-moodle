/*!
 * namespace.ts
 * ----------------------------------------------------------------------------
 * Cria (ou reutiliza) o objeto global compartilhado entre todos os módulos:
 *
 *   window.MobileMoodle  →  MM   (funções de API + helpers)
 *   window.MobileMoodle.App → App (DOM, render, sidebar, rotas…)
 *
 * Cada arquivo .ts importa MM/App daqui e “pendura” suas funções nesses objetos.
 * Assim o bundle IIFE funciona sem classes/DI do Angular.
 */
export const MM = (window.MobileMoodle = window.MobileMoodle || ({} as MobileMoodleNamespace));
export const App = (MM.App = MM.App || ({} as MobileMoodleApp));

/**
 * Entrega comandos somente ao host da mesma origem do Painel incorporado.
 *
 * @param message Comando de navegação sem credenciais ou dados de sessão.
 * @returns Se existe um host diferente da janela atual para receber a mensagem.
 */
export function postIfrnHostMessage(message: unknown): boolean {
    const parent = window.parent;
    if (!parent || parent === window) {
        return false;
    }

    parent.postMessage(message, window.location.origin);

    return true;
}
