/* eslint-disable header/header */
import type { InternalBrowserPage } from './suap-profile-browser.service';

/** Destinos oficiais da seção Ajuda do Painel AVA. */
export const PAINEL_HELP_LINKS = {
    'central-ajuda': {
        title: 'Central de Ajuda',
        url: 'https://ajuda.ead.ifrn.edu.br/',
        allowedHosts: ['ajuda.ead.ifrn.edu.br', 'ead.ifrn.edu.br', 'suap.ifrn.edu.br'],
    },
    'ouvidoria': {
        title: 'Ouvidoria',
        url: 'https://ead.ifrn.edu.br/acesso-a-informacao/ouvidoria/',
        allowedHosts: ['ead.ifrn.edu.br', 'suap.ifrn.edu.br'],
    },
    'contatos': {
        title: 'Contatos',
        url: 'https://ajuda.ead.ifrn.edu.br/agenda-telefonica-2022-campus-natal-zona-leste/',
        allowedHosts: ['ajuda.ead.ifrn.edu.br', 'ead.ifrn.edu.br', 'suap.ifrn.edu.br'],
    },
    'ava-moodle': {
        title: 'AVA (Moodle)',
        url: 'https://bit.ly/41734xv',
        allowedHosts: ['suap.ifrn.edu.br'],
        allowedUrls: ['https://bit.ly/41734xv'],
    },
    'secretaria-academica': {
        title: 'Secretaria Acadêmica',
        url: 'https://bit.ly/3odPfis',
        allowedHosts: ['suap.ifrn.edu.br'],
        allowedUrls: ['https://bit.ly/3odPfis'],
    },
    'central-servico-suap': {
        title: 'Central de serviço SUAP',
        url: 'https://bit.ly/3KXiQEH',
        allowedHosts: ['suap.ifrn.edu.br'],
        allowedUrls: ['https://bit.ly/3KXiQEH'],
    },
} as const satisfies Record<string, InternalBrowserPage>;

export type PainelHelpLinkId = keyof typeof PAINEL_HELP_LINKS;

/**
 * Resolve somente identificadores definidos localmente; o iframe nunca envia uma URL.
 *
 * @param id Identificador enviado pelo painel incorporado.
 * @returns Configuração local da página ou undefined para um identificador desconhecido.
 */
export function getPainelHelpLink(id: unknown): InternalBrowserPage | undefined {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PAINEL_HELP_LINKS, id)) {
        return undefined;
    }

    return PAINEL_HELP_LINKS[id as PainelHelpLinkId];
}
