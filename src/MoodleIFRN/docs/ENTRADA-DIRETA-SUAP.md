# Marketplace → SUAP → painel

Fluxo normal: o botão do marketplace abre o OAuth nativo do Moodle Acadêmico
(provedor SUAP). Não há formulário próprio de matrícula/senha nem backend OAuth
local (Python/Cloudflare).

Após o retorno SSO, o app lê o perfil Moodle (`core_user_get_users_by_field`),
abre o Painel AVA no navegador interno e consulta `/api/v1/diarios/` com a sessão
web. A matrícula vem, nesta ordem: `/api/v2/usuario/info/` no painel (ainda 404
no host de produção em 2026-10) e, se ausente, `/api/rh/eu/` no SUAP usando a
mesma sessão do InAppBrowser. Logcat só registra `identidadeDisponivel` e
`contaCorresponde` (booleanos), nunca a matrícula.

A entrada só grava perfil/dashboard quando a matrícula observada no painel
coincide com o username Moodle. Dados anteriores de outra conta não são
reaproveitados. A foto prefere URL utilizável (SUAP/Moodle tokenizado) e ignora
`url_foto_*` vazia ou avatar padrão.

Correções de retorno mantidas: callback com `loading` ativo é reprocessado;
`queryParamMap` + `ionViewWillEnter` cobrem reutilização do marketplace; leitura
sem cache do perfil cobre LOGIN não reemitido com o mesmo token.

Depois de alterar fontes em `mobilemoodle/core_mobile`, execute:

```bash
npm run build:mobilemoodle
npm run prod:android
```

Validação local: `test-suap-entry-profile.cjs`, `test-marketplace-entry.cjs`,
`test-oauth.cjs`. O fluxo real no Android ainda precisa ser confirmado no aparelho.
