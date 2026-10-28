# Painel AVA → sessão nativa do Moodle Mobile

Este documento descreve o fluxo implementado neste checkout. Para eventos e
resultados de uma versão datada, consulte os [relatórios históricos](./README.md#relatórios-históricos).

## Fluxo atual

```text
Marketplace
  → SuapEntryService.loginWithSuap()
  → PainelAvaService.authenticateWithBrowser()
  → sessão web do Painel e resposta JSON de /api/v1/diarios/
  → dashboard associado à identidade confirmada
  → toque no cartão (ID Moodle + URL do ambiente)
  → ponte validada por PainelPage
  → MoodleSiteService.ensureSessionAndOpenCourse()
  → sessão nativa correspondente ou OAuth do Moodle selecionado
  → rota de curso do Moodle Mobile
```

O InAppBrowser é usado para a sessão web do Painel. A tela começa oculta e pode
ser apresentada quando o fluxo institucional exigir interação. A consulta dos
cursos é feita na origem do Painel com a sessão web dessa janela. O ID do curso e
a origem do ambiente vêm dos dados do Painel; o app não deriva um Moodle ID de
um identificador SUAP de diário.

## Tokens, cookies e identidade

- Cookies da sessão web permanecem no InAppBrowser e são enviados ao Painel em
  chamadas same-origin.
- O app não converte JWT SUAP/Painel em `wstoken` Moodle, nem assume que cookies
  de navegadores diferentes sejam compartilhados.
- A sessão nativa do Moodle é criada/validada pelo fluxo oficial do Moodle e
  pelo núcleo do Moodle Mobile.
- Perfil/dashboard só são aceitos depois da conferência da identidade; os dados
  permanecem associados à conta em uso.
- O clique preserva curso e ambiente para a retomada após OAuth. Duplicatas da
  mesma abertura são deduplicadas pelo serviço de cursos.

## Componentes principais

| Código | Papel |
|---|---|
| `marketplace-ifrn/marketplace-ifrn.ts` | Inicia a entrada e conclui callbacks |
| `services_mobile/suap-entry.service.ts` | Coordena identidade e retorno ao Painel |
| `services_mobile/painel-ava.service.ts` | Sessão web e consultas same-origin do Painel |
| `painel/painel.ts` | Trata a escolha de curso e valida a ponte recebida |
| `services_mobile/moodle-site.service.ts` | Valida sessão/identidade e abre a rota nativa |
| `services_mobile/course-sso-browser.ts` | Estado do OAuth de curso em janela interna controlada |
| `mobilemoodle/core_mobile/app-utils.ts` | Emite o comando de abertura do curso |

## Limites

O app não pode criar uma sessão institucional que o servidor não concedeu, nem
contornar senha, consentimento, autorização ou expiração. Se o usuário precisar
renovar a autenticação, o fluxo depende da tela institucional. O acesso real a
cada ambiente precisa ser validado com conta autorizada e somente leitura.

Referências atuais: [visão geral](./VISAO-GERAL.md), [painel de cursos](./PAINEL-CURSOS.md)
e [SSO de cursos](./SSO-CURSOS-LOGIN-UNICO-2026-10-26.md).
