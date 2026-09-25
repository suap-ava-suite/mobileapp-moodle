/**
 * Configuracao do acesso GOV.BR.
 *
 * O client_secret do GOV.BR nunca deve ser colocado no aplicativo. Para o
 * acesso integrado, informe somente a URL publica do broker mantido pelo IFRN.
 * Consulte docs/GOVBR-AUTENTICACAO.md antes de habilitar.
 */
export const GOVBR_AUTH_CONFIG = {
    /**
     * Exemplo: https://auth.ava.ifrn.edu.br
     * Vazio mantem o modo seguro de consulta: abre o GOV.BR oficial do SUAP.
     */
    brokerBaseUrl: '',

    /** Entrada GOV.BR usada atualmente pela pagina oficial do SUAP IFRN. */
    suapGovBrUrl: 'https://suap.ifrn.edu.br/accounts/login/?code=',

    /** Paths esperados no broker do IFRN. */
    authorizePath: '/api/auth/govbr/authorize',
    exchangePath: '/api/auth/govbr/token',
} as const;
