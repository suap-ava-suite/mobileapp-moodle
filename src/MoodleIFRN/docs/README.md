# Documentação do MoodleIFRN

Índice da customização do AVA IFRN no Moodle Mobile. O código do módulo fica em
[`../`](../); os documentos abaixo diferenciam o fluxo atual de contratos antigos
e relatórios de uma versão específica.

## Comece por aqui

| Preciso entender… | Documento |
|---|---|
| O fluxo atual de entrada, painel e curso | [Visão geral](./VISAO-GERAL.md) |
| Como os cursos reais chegam ao Moodle Mobile | [Ponte Painel → curso nativo](./PONTE-PAINEL-MOODLE.md) |
| A SPA do Painel AVA, seus módulos e build | [Painel de cursos](./PAINEL-CURSOS.md) |
| O OAuth/SSO de cursos e suas limitações | [SSO de cursos](./SSO-CURSOS-LOGIN-UNICO-2026-10-26.md) |
| Segurança do cliente | [Segurança](./SEGURANCA.md) |
| Como reaplicar a customização após atualizar o Moodle Mobile | [Patch de atualização](./PATCH-AO-ATUALIZAR.md) |

## Desenvolvimento

| Tarefa | Comando |
|---|---|
| Testes Node da customização IFRN | `npm run test:ifrn` |
| Suíte geral do projeto | `npm test` |
| Reaplicar rotas e integração IFRN | `npm run patch:ifrn` |
| Compilar a SPA mobilemoodle | `npm run build:mobilemoodle` |
| Build Android de produção | `npm run prod:android` |

`test:ifrn` usa `node:test` com fakes e fixtures; não chama SUAP/AVA nem testa
um aparelho. O probe Android `painel-first-paint.android.mjs` é separado e não
faz parte desse comando.

## Referência por assunto

| Assunto | Documento |
|---|---|
| APIs e endpoints observados | [APIs e endpoints](./apis-e-endpoints.md) |
| Contrato antigo de login JWT / FastAPI | [Contrato legado](./CONTRATO-API.md) |
| Entrada atual pelo SUAP | [Entrada do Marketplace](./ENTRADA-DIRETA-SUAP.md) |
| Login de compatibilidade | [LOGIN-IFRN](./LOGIN-IFRN.md) |
| Serviços de autenticação e biometria compatíveis | [Serviços](./SERVICOS-AUTH-BIOMETRIA.md) |
| Templates e tema | [Templates HTML](./TEMPLATES-HTML.md) · [Tema visual](./TEMA-VISUAL.md) · [Logo](./LOGO-MOODLE-IFRN.md) |
| Beta na Google Play | [Play Store](./PLAY-STORE-BETA.md) |
| Splash Android | [Trocar imagem de abertura](./TROCAR-IMAGEM-ABERTURA-ANDROID.md) |

## Relatórios históricos

Os arquivos com data no nome registram inspeções, builds ou testes de uma versão
específica. Use-os como histórico, não como prova do estado atual do código ou
do servidor.

- [Abertura de cursos — 19/10/2026](./COURSE-OPENING-2026-10-19.md)
- [Teste de API do Painel — 20/10/2026](./TESTE-API-PAINEL-2026-10-20.md)
- [Sessões e Django Ninja — 20/10/2026](./SESSOES-E-DJANGO-NINJA-2026-10-20.md)
- [Metodologia de acessibilidade — 20/10/2026](./TESTE-ACESSIBILIDADE-METODOLOGIA-2026-10-20.md)
- [Correção do nome do perfil — 25/10/2026](./CORRECAO-NOME-PERFIL-2026-10-25.md)
- [Retorno ao Painel — 25/10/2026](./CORRECAO-FLASH-RETORNO-PAINEL-2026-10-25.md)
- [Desempenho do Painel — 26/10/2026](./DESEMPENHO-PAINEL-2026-10-26.md)
- [Adaptação iOS](./RELATORIO-IOS.md)

> Os dados de backend, compatibilidade, APK e publicação nesses relatórios podem
> ter mudado. Confirme no código e no ambiente antes de usá-los como instrução.
