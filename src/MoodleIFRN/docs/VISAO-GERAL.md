# MoodleIFRN — visão geral atual

Esta página resume o fluxo implementado neste checkout. Para relatórios de
versões anteriores, consulte a seção [Relatórios históricos](./README.md#relatórios-históricos).

## Fluxo do aluno

```text
Marketplace
   → autenticação SUAP pelo fluxo web institucional do Painel AVA
   → confirmação de identidade e dashboard do Painel
   → lista de cursos com IDs e origens Moodle fornecidos pelo Painel
   → toque no curso
   → sessão Moodle nativa correspondente ou conexão OAuth do ambiente
   → tela nativa do Moodle Mobile
```

O Marketplace chama `SuapEntryService.loginWithSuap()`. O serviço usa
`PainelAvaService.authenticateWithBrowser()` para obter uma sessão web do Painel
no InAppBrowser e consultar os dados na origem institucional. A identidade é
conferida antes de salvar o snapshot do perfil e do dashboard. O app não usa o
FastAPI de teste como provedor de login nem converte um JWT SUAP/Painel em
`wstoken` Moodle.

Ao abrir um curso, `PainelPage` encaminha o ID e a URL do ambiente para
`MoodleSiteService.ensureSessionAndOpenCourse()`. A abertura nativa depende de
uma sessão Moodle válida para a conta e o ambiente selecionados. Se ela não
existir, o app inicia a conexão oficial daquele Moodle e mantém o curso pendente
para retomá-lo depois do callback.

## Componentes

| Camada | Localização | Responsabilidade |
|---|---|---|
| Entrada | `marketplace-ifrn/` | Inicia o fluxo SUAP e apresenta estados/erros |
| Sessão web do Painel | `services_mobile/painel-ava.service.ts` | InAppBrowser, consulta same-origin e normalização do perfil/dashboard |
| Identidade e retorno | `services_mobile/suap-entry.service.ts` | Confere a conta e conclui o retorno ao Marketplace |
| Abertura Moodle | `services_mobile/moodle-site.service.ts` e `moodle-open-course/` | Resolve sessão/ambiente e abre a rota nativa |
| UI do Painel | `mobilemoodle/` | Shell HTML, views, roteamento, estado e acessibilidade |
| Ponte | `mobilemoodle/core_mobile/app-utils.ts` + `painel/painel.ts` | Encaminha o curso escolhido ao app e valida a mensagem recebida |

A SPA `mobilemoodle` é um bundle independente: `mobilemoodle.ts` importa os
módulos de `core_mobile/`; `build.mjs` produz `mobilemoodle.js` e o CSS do tema.
O Angular copia essa pasta como assets. Ionic e Ionicons usados pelo painel são
sincronizados localmente pelo build do painel.

## Fontes de dados e credenciais

- A autenticação do Painel usa a sessão web criada no InAppBrowser; a lista de
  cursos vem do endpoint de diários do Painel AVA.
- Perfil e identidade são aceitos conforme os campos disponíveis e a conta
  autenticada. Respostas parciais não devem inventar matrícula ou foto.
- O curso aberto usa a sessão nativa do Moodle; os tokens SUAP/Painel não são
  tokens de serviço Moodle.
- `AuthService` e os adaptadores de API com Bearer permanecem no repositório
  para fluxos compatíveis/legados. Não confunda essa implementação com o caminho
  normal descrito acima.

## Verificação local

```bash
npm run test:ifrn
npm run build:mobilemoodle
npm run prod:android
```

Os testes Node usam fakes/fixtures e não comprovam login real, sessão Moodle ou
abertura de todos os cursos. A matriz de dispositivo e ambiente precisa ser
registrada separadamente. Instruções: [README de documentação](./README.md).
