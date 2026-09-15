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
