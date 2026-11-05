# Complexidade, arquitetura e estados

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

## Classificação de manutenção

| Nível | Arquivo/módulo | Evidência e responsabilidade |
|---|---|---|
| Crítico | `services_mobile/moodle-site.service.ts` | 2.337 linhas, 31 imports distintos, 36 chamadas diretas a console; identidade, seleção de conta, OAuth, browser, pending course, roteamento, timers, navegação, retorno e recuperação |
| Crítico | `services_mobile/painel-ava.service.ts` | 1.407 linhas; `authenticateWithBrowser:493–1025` ocupa 533 linhas e contém callback de 531 linhas, HTML/scripts injetados, probes, perfil, listas, enrol e persistência |
| Crítico | `services_mobile/course-sso-browser.ts` | 130 linhas, mas ciclo de vida sensível; deadline encerrado antes da aceitação do callback e cancelamento ineficaz nessa fase |
| Alto | `moodle-open-course/moodle-open-course.ts` | 478 linhas; lifecycle Ionic, fallback microtask, estados, versionamento de tentativa, erros e navegação; dois returns em finally |
| Alto | `services_mobile/suap-entry.service.ts` | 399 linhas, 14 imports; entrada web e alternativa nativa, staging/commit/rollback e evento LOGIN |
| Alto | `mobilemoodle/core_mobile/app-views.ts` | 898 linhas; listas, perfil, favoritos, autoinscrição e conteúdo legado de curso no mesmo módulo |
| Alto | `mobilemoodle/static/theme/ifrn/scss/painel.scss` | 2.214 linhas, 59 cabeçalhos repetidos; fonte achatada e overrides posteriores |
| Alto | `patch-moodle-ifrn.js` | 477 linhas; altera rotas, core, assets, gulp e shell por substituição textual; grande superfície de compatibilidade |
| Médio | `services_mobile/auth.service.ts`, `api-auth.ts`, `oauth-profile.ts` | múltiplos modelos de sessão e inventários de limpeza; contratos devem ser explícitos |
| Médio | `painel/painel.ts`, `app-router.ts`, scripts de build | bridge, iframe, cache e pipelines; simplificar após caracterização |
| Baixo na lógica | `ifrn-language.ts` | 2.818 linhas predominantemente dados; avaliar distribuição, não dividir por meta de LOC |
| Baixo | `suap-provider.ts`, `course-target.ts`, `navigation-policy.ts` | unidades pequenas com responsabilidade reconhecível; não criar abstrações extras |

Classificação é julgamento técnico do risco/manutenção, não pontuação automática de vulnerabilidade. Os demais arquivos têm inventário completo no JSON; não há certificação individual de adequação visual.

## Funções com mais decisões

| Arquivo | Função | Linha | LOC | CC aproximada AST | CC ESLint clássico | Profundidade |
| --- | --- | --- | --- | --- | --- | --- |
| mobilemoodle/core_mobile/app-views.ts | renderCurso | 729 | 166 | 36 | 38 | 1 |
| services_mobile/suap-entry.service.ts | complete | 256 | 88 | 35 | 38 | 3 |
| moodle-open-course/moodle-open-course.ts | ionViewWillEnter | 134 | 131 | 29 | 32 | 4 |
| services_mobile/painel-ava.service.ts | describeHttpError | 204 | 55 | 27 | 30 | 4 |
| services_mobile/moodle-site.service.ts | ensureMatchingMoodleSession | 1415 | 119 | 26 | 30 | 4 |
| mobilemoodle/core_mobile/app-status.ts | showStatusError | 101 | 89 | 24 | 25 | 2 |
| services_mobile/moodle-site.service.ts | performOpenCourseById | 1646 | 193 | 24 | 28 | 3 |
| mobilemoodle/core_mobile/api-painel.ts | fetchPainelDashboard | 292 | 58 | 21 | 25 | 3 |
| moodle-course/patch-course-menu.cjs | patchCourseMenu | 32 | 49 | 21 | não medido neste escopo | 2 |
| services_mobile/moodle-site.service.ts | performStartSuapOAuthLogin | 1934 | 167 | 21 | 31 | 2 |
| services_mobile/suap-entry.service.ts | mapNativeProfile | 75 | 46 | 21 | 22 | 3 |
| mobilemoodle/core_mobile/api-painel.ts | mapPainelDiario | 160 | 33 | 19 | 26 | 1 |

A medição adicional com a regra clássica do ESLint, nos 45 arquivos TS, encontrou 54 funções acima de 10 e 14 com valor ≥20. `renderCurso` e `complete` têm valor 38; `ionViewWillEnter`, 32; `performStartSuapOAuthLogin`, 31. A contagem considera a sintaxe conforme a implementação da ferramenta. Funções JS de scripts não foram avaliadas nessa rodada específica; seus valores AST continuam apenas aproximações.

O CC de `authenticateWithBrowser` aparece baixo na função externa porque as decisões estão nos callbacks e nas strings executadas no WebView; **não significa função simples**. Tamanho, dependências e scripts injetados complementam a medida. Funções aninhadas não foram somadas duas vezes. Complexidade cognitiva padronizada permanece não medida.

## Fluxo rastreado

1. Marketplace (`marketplace-ifrn.ts:169`) chama `SuapEntryService.loginWithSuap`, não a entrada nativa alternativa.
2. `PainelAvaService.authenticateWithBrowser` abre IAB oculto e mostra apenas a interação SUAP necessária; consulta listas/perfil no contexto autenticado.
3. `SuapEntryService` compara identidade, faz staging/commit e grava snapshot/dashboard com dono. Perfil não é token de curso.
4. `PainelPage` carrega iframe, bridge e revalidação de perfil; mensagens exigem origem e `event.source` corretos.
5. Card usa `resolveCourseSite` e bridge. `ensureSessionAndOpenCourse` reutiliza sessão do mesmo usuário/ambiente ou carrega conta armazenada; valida matrícula.
6. Sem sessão utilizável, a ponte inicia SSO e prepara passport via núcleo. O IAB dos cursos é separado do dispatcher global.
7. Callback passa ao núcleo; LOGIN e ponte retomam o curso pendente, conferindo identidade. Curso nativo usa componentes originais.
8. Guardas/observadores/back retornam ao Painel no limite do curso, preservando navegação de atividades.

## Fatos reproduzidos e suspeitas

**Comprovado em prova isolada:** `AuthService.logout:343` e `api-auth.ts:125` usam chaves `ifrn_moodle_poc_oauth_pending`/`ifrn_moodle_poc_resume_oauth`, enquanto o serviço usa `ifrn_moodle_oauth_pending`/`ifrn_moodle_resume_oauth` (`moodle-site.service.ts:55–56`). O corpo real de logout, executado com armazenamento sintético, deixa as duas flags atuais presentes. Isso prova limpeza inconsistente, não bypass de conta.

**Comprovado em prova isolada:** `course-sso-browser.ts:47–65` chama `dispose()` antes de aguardar `acceptToken`. `dispose` remove o timer, e `fail` ignora chamadas quando `accepting=true`. Com um handler que nunca resolve, a completion continua pendente após timeout e cancelamento. Tratar a fase “validando callback” como parte cancelável da tentativa; não reduzir timeout da interação manual principal.

**Comprovado por código:** `moodle-open-course.ts:359/457` retorna de `finally` em entradas obsoletas. Pode suprimir retorno/exceção; o propósito de não atualizar a tela antiga é válido. Reformular só depois de testar navegação e rejeição tardias. ESLint não prova um bug em toda execução desses ramos.

**Comprovado por código:** provider/id é buscado e exigido em `moodle-site.service.ts:2029–2048`, mas a chamada atual prepara o launch com provider `undefined` e usa `auth/suap/login.php:2107–2113`. O id é apenas logado. É candidato a simplificar preparo, mas o gate pode documentar capacidade institucional; medir requests reais antes de removê-lo.

**Suspeita, não leak confirmado:** dois observers de Router no serviço (`:640`, `:1039`) e listeners CoreEvents têm vida de singleton e flags de registro. Não chamar isso de vazamento só por não haver unsubscribe. O observer da página Painel é desligado em destroy, mas páginas Ionic podem ficar em cache; avaliar custo enquanto ocultas. O observer de teclado tem cleanup em `pagehide:268`. A espera por navegação libera sua subscription em `moodle-site.service.ts:1859`.

## Acoplamento e proposta

O namespace `MM/App` recebe 14 módulos; `oauth-profile` tem 7 consumidores estáticos; PainelAvaService, 5. Dependências por globais e eventos ampliam esse grafo. Não substituir tudo por uma arquitetura nova.

Ordem de extração proposta: (a) constantes/contratos puros e sanitização; (b) seleção/validação de conta pura preservando prioridades; (c) posse da tentativa e seus recursos; (d) adaptador de navegação com contrato de origem/destino; (e) separação dos scripts/probes do IAB mantendo payloads serializáveis. Cada extração deve manter API pública e testes antes/depois. Não mover nem editar o core/addons.
