# Possíveis remoções, alcance e risco

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

## Remoções com evidência forte

O compilador e o ESLint concordam em 12 símbolos sem uso. A busca foi feita em `src`, nos testes, nas rotas e nos scripts relevantes; não apenas em um único arquivo.

| Item | Localização | Evidência | Quantidade/risco |
|---|---|---|---|
| Import `CoreLang` | `marketplace-ifrn.ts:8`, `auth.service.ts:17` | TS6133; nenhuma leitura nesses módulos | 2 bindings; baixo |
| Import `MM` | `app-accessibility.ts:10`, `app-status.ts:9`, `app-utils.ts:11`, `app-views.ts:11`, `app.ts:16` | TS6133; `App` permanece importado do mesmo módulo | 5 bindings; baixo; manter efeitos do módulo |
| `identityFingerprint` | `moodle-site.service.ts:259–274` | Função local não exportada; apenas declaração encontrada; TS6133 | 16 linhas físicas; baixo |
| `isValidPainelToken` | `painel-ava.service.ts:184–202` | Função local sem chamadas; TS6133 | 19 linhas; baixo |
| `describeHttpError` | `painel-ava.service.ts:204–258` | Função local sem chamadas; TS6133 | 55 linhas; baixo |
| `getSafeHttpErrorDiagnostic` | `painel-ava.service.ts:268–301` | Função local sem chamadas; TS6133 | 34 linhas; baixo; não confundir com logs ativos |
| Parâmetro `hash` | `auth.service.ts:371` | Valor ignorado; navegação fixa para `/login/painel` | 1 parâmetro; médio por contrato público e chamador `openMobileMoodle('/painel')` |

**Estimativa justificável:** 124 linhas dos corpos/declaradores das quatro funções locais, sem contar seus comentários externos. O helper `readJwtPayload` de `painel-ava.service.ts:172–182` tem 11 linhas e só alimenta o validador morto: a remoção transitiva chegaria a **135 linhas**, após refazer análise de referências. Sete bindings de import não equivalem a sete linhas inteiras porque alguns imports compartilham `App`. Não há fundamento para prometer milhares de linhas removíveis sem decisão funcional.

`moodle-site.service.ts:1676–1684` contém um segundo `if (!match.hasExpected)` depois do guard de `1668–1670` que já lança erro nessa condição. `match` não é reatribuído e não existe await entre os dois. São mais nove linhas de ramo de diagnóstico inalcançável, risco baixo, preservando o guard inicial. Não somar essa oportunidade a remoções de componentes ainda não comprovadas.

## Candidatos dependentes de contrato

| Item | Localização | Evidência atual | Risco/condição |
|---|---|---|---|
| `changeMoodleAccount`, `continueAccountSwitch` e estado associado | `moodle-open-course.ts:104`, `:113` e template atual | Nenhuma ligação no template atual; métodos públicos ainda existem | Médio; procurar chamadas programáticas, testes e compatibilidade antes de remover |
| `openCourseAccountLogout` | `moodle-site.service.ts:730` | Sem chamador estático encontrado; mantém browser/subscriptions próprios | Médio/alto; possível compatibilidade com integrações |
| `SuapEntryService.login()` | `suap-entry.service.ts:211` | Marketplace usa `loginWithSuap:167`; fluxo alternativo continua ligado a `complete`, estado nativo e guard | Alto; não declarar serviço inteiro obsoleto |
| Renderizador de curso web | `app-views.ts:729`, `app-router.ts:155`, `api.ts:169`, `api-suap.ts:436` | Cards atuais sempre usam curso nativo; rota `#/curso/:id` ainda existe e chama esses métodos dinamicamente | Alto; contrato de links legados e modo standalone precisa ser decidido |
| Handoff desativado | `handoff-loading.ts:9`, `early-course-handoff.js:6`, `moodle-site.service.ts:635` | Predicado retorna sempre false e script early é no-op | Médio; há compatibilidade para remover resíduos de versões anteriores |
| Parciais SCSS antigos | `mobilemoodle/static/theme/ifrn/scss/` | Entrada ativa está achatada; parciais ainda versionados/copied como assets | Médio; mapear autoria, build e referências antes de arquivar |

## O que não remover

- `ifrn-login` tem **rota lazy ativa** em `src/core/features/login/login.module.ts:50`, redireciona links antigos e é chamado pela recuperação Moodle. Não é componente órfão.
- `SuapBrowserService` está injetado; `cancelConnection`, caminhos alternativos e referências por eventos impedem classificá-lo como morto apenas pelo fluxo principal.
- `BiometricService.disable()` é chamado no commit da entrada para não herdar credencial de outra conta. A dependência nativa de biometria não está comprovadamente dispensável.
- `course-menu.html` participa de componente/patch nativo, mesmo sem rota própria. Catálogo de idioma grande não é lógica obsoleta e garante português offline.
- Guardas de identidade, matrícula, origem e isolamento de ambiente não são alvos de redução sem equivalência demonstrada.
- Não remover bibliotecas Moodle por ausência de uso no IFRN: `package.json` tem 83 dependências e 49 devDependencies para o app inteiro. **Zero pacotes foram certificados como removíveis.**

## Comentários e documentação

Há comentários desatualizados, por exemplo login com senha em `VISAO-GERAL.md`/`SEGURANCA.md` e “API ainda mockada” em `app-views.ts:306`, apesar do fluxo de autoinscrição pelo bridge. Isso deve ser atualizado após confirmar contratos, não apagado como código morto.
O link `docs/README.md` para `../ifrn-login/LOGIN-IFRN.md` não corresponde ao arquivo atual `docs/LOGIN-IFRN.md`. Corrigir documentação é uma fase pequena e reversível.

Não foram encontrados componentes certificados como descartáveis. Ausência de referência estática é apenas pista para os candidatos públicos/dinâmicos desta seção.
