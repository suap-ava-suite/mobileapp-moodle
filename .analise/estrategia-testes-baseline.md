# Estratégia de testes — inventário e baseline

**Data:** 2026-10-28  
**Branch/HEAD:** `erro-fluxo` / `f46bb331c indice diciplina com front`  
**Escopo:** inspeção de `src/MoodleIFRN`, configuração de testes e build. Nenhum código de produção foi alterado para este baseline. Sem preflight, ADB input, automação física, login, curso real ou ação acadêmica.

## 1. Estado inicial e artefatos pedidos

`git status --short` estava vazio antes da inspeção. O checkout atual é `erro-fluxo`, não `refactor/ifrn-clean-arch` nem `release/2.0.1`.

Procurei no checkout e em `/home/matheusluiz` os seguintes artefatos e não os encontrei: `.analise/relatorio-moodleifrn.md`, `.analise/fase2/relatorio-fase2.md`, `.analise/fase2/coletor-cdp-aparelho.mjs` e `.analise/fase2/calibracao.json`. Portanto, números e resultados atribuídos a esses arquivos em conversas anteriores são **NÃO REVALIDÁVEIS neste checkout**. Não executei `--self-test` nem `--preflight`; o coletor não existe aqui.

## 2. Runner, scripts e baseline executado

- No inventário inicial, `package.json` tinha `test`, `test:ci`, `test:watch` e `test:coverage`, mas `test:ifrn` estava ausente. Nesta etapa, foi adicionado sem dependências: `node --test "src/MoodleIFRN/tests/*.test.cjs" "src/MoodleIFRN/tests/*.test.mjs"`.
- O runner Jest 30 usa `jest.config.js` com `testMatch: ['**/?(*.)test.ts']`. Há 48 arquivos `*.test.ts` no projeto e nenhum `*.test.ts`/`*.spec.ts` em `src/MoodleIFRN/tests`. A cobertura Jest está configurada, mas não foi executada neste baseline.
- Os testes customizados MoodleIFRN usam `node:test` (`.test.cjs` e `.test.mjs`), `node:assert`, `vm`, transpile/bundle via TypeScript/esbuild e fakes locais. O probe `painel-first-paint.android.mjs` é separado e foi **NÃO EXECUTADO**.
- Baseline antes da mudança: `npm run test:ifrn` retornou `Missing script: "test:ifrn"`. Depois, `npm run test:ifrn` passou com **20 arquivos/suites, 0 falhas**. `rg -c "\\btest\\(" src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs` conta **94 casos declarados** nesta etapa (baseline: 87).
- Execução por arquivo dos testes Node, incluindo os novos cenários: **94 casos declarados**. Comando reproduzível:

```bash
for f in src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs; do
  [ -f "$f" ] || continue
  node "$f" || exit $?
done
```

- `node --test src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs` terminou exit 0 e enumerou 19 suites/arquivos. As declarações individuais foram contadas por `rg -c` por arquivo.
- Jest direto, sem gulp, executado antes de mudanças:

```bash
NODE_OPTIONS=--max-old-space-size=3072 NODE_ENV=testing ./node_modules/.bin/jest --runInBand --verbose
```

**Resultado real:** 48 suites; 40 passaram e 8 falharam; 240 testes no total, 229 passaram, 8 falharam e 3 estão `todo`. Falhas observadas no núcleo: `src/core/static/tests/json-patch.test.ts` (logger lança ao reportar erro esperado), `src/core/static/tests/icons.test.ts` (ícone de fixture não encontrado), `src/core/static/tests/logger.test.ts` (console log em ambiente de teste) e testes de idioma em `date-day-or-time.pipe.test.ts`, `time-ago.pipe.test.ts`, `duration.pipe.test.ts`, `format-date.pipe.test.ts` e `bytes-to-size.pipe.test.ts` (retornam chaves `core.*` em vez das traduções esperadas). Não alterei nem atribuí essas falhas ao MoodleIFRN.

### Baseline de produção

Comando executado, saída em `/tmp/ifrn-strategy-baseline`:

```bash
NODE_OPTIONS=--max-old-space-size=3072 NODE_ENV=production ./node_modules/.bin/ng build --configuration=production --output-path=/tmp/ifrn-strategy-baseline --stats-json --delete-output-path=false --progress=false
```

**Resultado:** exit 0, `stats.errorsCount=0`, `stats.warningsCount=44`. Assets iniciais no `stats.json`: `main` 4.301.459 bytes, `styles` 869.119, `polyfills` 57.576 e `runtime` 19.333; total **5.247.487 bytes**, transferência estimada **870.598 bytes**. O Angular avisou que o bundle inicial excedeu o budget de 5 MB em 247,49 kB. O build também listou browsers antigos fora do suporte informado e avisos Sass/core; não são automaticamente atribuídos ao escopo MoodleIFRN.

## 3. Inventário individual dos testes Node MoodleIFRN

Todos abaixo são testes com fakes/fixtures locais; nenhum abre SUAP/AVA real. “Lacuna” indica o limite do teste, não afirma defeito de produção.

| Arquivo / casos | Nomes exatos declarados | Cenário e assertions principais | Mocks/fixtures | Lacunas |
|---|---|---|---|---|
| `course-back-panel.test.cjs` / 1 | `Android Back returns the IFRN course index to panel while delegating activities and overlays` | Prioridade do back, retorno do índice de curso ao painel e delegação quando a tela não é o índice. | `MoodleSiteService` transpile/VM; registro fake do evento Back. | Sem aparelho/Cordova real, overlays Ionic reais ou repetição de lifecycle. |
| `course-loading-compatibility.test.cjs` / 1 | `loading compatibility patch preserves placeholders and content while omitting destroyed-view animation hooks` | Preserva conteúdo/spinner/skeleton, remove hooks de animação e é idempotente. | Template do núcleo e helper real `loadingWithoutViewAnimations`. | Testa string/template, não animação visual ou WebView. |
| `course-native-route.test.cjs` / 3 | `from the IFRN panel or OAuth bridge, enters the course without opening the standalone main landing`; `opening another course from an existing native tab replaces the old course stack`; `rejected native route is reported instead of being treated as an opened course` | Curso/ambiente chegam ao helper; rota nativa reseta a pilha; rejeição não é sucesso. | `CoreCourseHelper` e `CoreNavigator` fake; VM/transpile. | Não verifica renderização do core nem curso real. |
| `course-navigation-races.test.cjs` / 6 | `iframe forwards clicks without replacing the active pending course, including repeated IDs across sites`; `logout bridge uses the current app origin as targetOrigin`; `native landing returns to the authenticated panel instead of marketplace`; `course opening and course activities are never redirected by the landing guard`; `session recovery retains the Moodle environment with the course ID`; `an old login marker cannot interrupt an active course opening` | Cliques duplicados/IDs por site, target origin do emissor, guardas, recuperação e marcador legado. | `window.parent`, storage, Router/guards e serviço fake em VM. | Sem corrida real de WebView/Angular Router e sem latência de rede real. |
| `course-oauth-recovery.test.cjs` / 13 | `selects SUAP by name, retaining the ID advertised by each environment`; `missing browser return ends waiting and permits a new official attempt for the same environment`; `leaving, cancelling and destroying the cached bridge remove its browser timer`; `official callback resuming a course does not start another browser or leave a timeout behind`; `leaving while session lookup is pending cannot open the browser afterwards`; `connect action reuses a session recovered since showing the connection prompt`; `a stale persisted account-switch flag cannot open the browser on another visit`; `the account-switch redirect cannot start OAuth twice when the cached bridge reenters`; `OAuth resume is one-use, scoped to course and environment, and expires`; `Academic session cannot consume a pending Presencial OAuth return`; `native session opening skips browser and waiting timer`; `session inspection failure displays an error without browser authentication`; `releasing a stalled browser preserves the pending course, account checks and saved credentials` | Estados de página, timers controlados, sessionStorage Map, services/router fake e navegação pendente. | Forte cobertura de estados, mas não testa contrato total de `authenticateWithBrowser` nem navegador real. |
| `course-saved-session.test.cjs` / 9 | `restores a valid historical session even when canonical entry is logged out`; `canonical ID never substitutes account and environment verification`; `read failures propagate instead of triggering browser authentication`; `explicitly logged out account is returned only when no usable session exists`; `after restart, restores the saved matching account and subsequently reuses current session`; `secure storage failure in another environment never affects the selected session`; `metadata read failure is propagated instead of being classified as missing session`; `account metadata without a native token offers connection instead of loading an unusable session`; `a tokenless canonical entry does not hide a usable historical session` | Recuperação e seleção de sessão por conta/ambiente; erros e token ausente. | `CoreSites`, armazenamento seguro, logger e URL helpers fake; VM/transpile de `MoodleSiteService`. | Não usa armazenamento Cordova criptografado real nem contas no dispositivo. |
| `course-session-opening.test.cjs` / 6 | `same course and Moodle site join one in-progress native opening`; `a different course or Moodle site cannot join the active opening`; `course tabs use the activated course route, not the previous bridge URL`; `course OAuth stays hidden inside the app and resumes the selected course natively`; `native course SSO preserves cookies, stays hidden and delegates token validation to Moodle`; `course tap resets the Ionic login route before entering the OAuth bridge` | Deduplicação de abertura, site/curso ativo, política de rota e propriedades do IAB. | Deferred Promise, IAB fake, `CoreLoginHelper`, schemes e eventos fake; algumas assertions por fonte. | Não valida cookie real, comportamento do plugin ou callback Android/iOS real. |
| `course-sso-browser.test.cjs` / 12 | `retoma launch do curso ao receber retorno para raiz oficial do Painel, uma única vez`; `não navega por páginas arbitrárias do Painel como fallback do curso`; `interrompe ciclo mesmo com novos parâmetros OAuth sem limpar sessões`; `segue redirects HTTPS preservando parâmetros; callback oficial é consumido uma vez`; `página iOS pode retornar o link launchapp sem abrir outro aplicativo`; `normaliza callback envolvido em HTTP sem fazer requisição com o token`; `formulário de senha exige renovar o login principal, sem mostrar segunda autenticação`; `consentimento pendente não é aceito automaticamente`; `esquemas externos, HTTP e domínios com prefixo parecido são recusados`; `cancelamento, timeout e rede fecham a janela e liberam listeners`; `retoma launch perdido na página inicial uma vez; nunca fica em loop`; `callback rejeitado pelo núcleo não cria conexão válida` | Browser/eventos/timeout/subscriptions fake; callback de fixture e URLs fabricadas. | Não fala com SUAP/Moodle, não testa cookie compartilhado nem UI de consentimento real. |
| `course-sso-native-hook.test.cjs` / 1 | `ajuste nativo mantém o UA do login principal e só permite opt-out explícito por janela` | Hook idempotente, configuração no `config.xml`, rejeição de fonte incompatível. | Java source string e `patchSource` real. | Não compila/executa plugin Android; só contrato textual do patch. |
| `course-trusted-sites.test.cjs` / 2 | `official trusted-site policy preserves tokens across Academic → Presencial → Academic`; `without configured trusted sites, upstream behavior reproduces token removal` | Política de retenção/remoção de token por sites confiáveis. | `moodle.config.json`, CoreLoginHelper/CoreSites fake em VM. | Tokens são fixtures sintéticos; não exercita CoreSites/storage real. |
| `painel-login-after-course.test.cjs` / 2 | `login principal retoma redirects após curso e preserva a política de cookies`; `authenticateWithBrowser conclui quando recebe dashboard e identidade sintéticos do Painel` | IAB oculto/cache/teardown e caminho de sucesso com resposta fabricada, identidade sintética, contagem de cursos e fechamento dos listeners. | `PainelAvaService` transpile/VM, RxJS e Browser fake. | Não cobre estados de login/SUAP, resposta inválida, timeout, erro, cancelamento ou execução real. |
| `render-course-characterization.test.cjs` / 1 | `renderCurso mantém cabeçalho, dados de progresso e seção vazia no fallback atual` | Caracteriza título, subtítulo, professor, progresso limitado, resumo escapado como texto, link externo e estado sem seções. | `app-views.ts` transpile/VM e elementos DOM mínimos fakes. | Não cobre seções com atividades, listeners de toggle, layout ou comportamento no navegador real. |
| `painel-native-course.test.cjs` / 7 | `panel opens native course directly and permits another click after completion`; `no native session keeps the official connection route scoped to the target environment`; `read, permission and identity errors open recovery without automatic OAuth`; `duplicate bridge messages cannot replace an in-progress course or environment`; `unconfirmed environment never selects a default Moodle`; `destroying an old Ionic panel does not unregister the active panel bridge`; `only the panel iframe on the app origin can post course commands` | Rota, erros, concorrência e aceitação/rejeição de mensagens por source/origin. | `PainelPage`, Router, serviço, `window`, iframe fake. | Receptor protegido é exercitado; emissor ainda usa wildcard; sem origem real da WebView. |
| `profile-storage-performance.test.cjs` / 3 | `restaura lista persistida uma vez; leituras seguintes não regravam listas e perfil`; `otimização não dispensa checagens de expiração ou troca de conta em cada leitura`; `alteração posterior no perfil ainda atualiza o snapshot usado pelo Painel` | Regravações, expiração, troca de conta e atualização de snapshot. | local/sessionStorage Maps e relógio controlado; bundle esbuild/VM. | Medição de chamadas de storage, não benchmark de aparelho. |
| `painel-course-mapping.test.mjs` / 3 | `Metodologia usa o ID Moodle 2836 e o Presencial, independentemente de diário SUAP`; `autoinscrição aceita estado aninhado v2 e preserva sua rota de detalhes`; `vitrine sem matrícula confirmada não é apresentada como já matriculada` | Normalização de ambiente, ID Moodle, detalhes e estado de inscrição. | JSON local em storage; bundle de `api-painel.ts` via esbuild/VM. | Fixtures não validam contrato atual do servidor nem executam inscrição. |
| `painel-courses.test.mjs` / 10 | `reúne páginas, mantém IDs iguais de ambientes distintos e encerra com vitrine repetida`; `falha de progresso preserva os cursos`; `integração Ninja recusa destino fora da API v1 antes de enviar cookies`; `falha numa página não entrega silenciosamente uma lista incompleta`; `rejeita corpo sem listas de cursos`; `trata HTTP 401, 403 e 500 sem converter falha em lista vazia`; `rejeita resposta sem JSON e JSON malformado`; `timeout aborta a requisição idempotente de leitura e propaga erro`; `conexão recusada na consulta principal é propagada; falha no progresso é opcional`; `script continua autônomo após transformação async e minificação` | Paginação, categorias, status/erros, origem/endpoint, schema e bundle serializado. `fetch`, respostas e timers são fakes. | O fetch embarcado não recebe sinal externo de cancelamento; apenas timeout interno é caracterizado. Sem navegador/servidor real. |
| `painel-favourites-isolation.test.mjs` / 2 | `favoritos sobrevivem à recriação do painel e distinguem sites com courseid igual`; `troca de conta bloqueia a instância antiga e mantém preferências separadas` | Persistência e chave por conta/site, IDs iguais entre ambientes. | `localStorage`/`sessionStorage` fake e bundle esbuild/VM. | Sem storage real/migração em atualização. |
| `painel-ios-layout.test.mjs` / 6 | `iframe resolve margens do host, acompanha rotação e limpa probes/observer`; `teclado nativo do host não reduz duas vezes o iframe e restaura home indicator`; `browser independente mantém visualViewport sem margem superior artificial`; `fallback de status bar continua exclusivo do Cordova Android`; `iframe Android mantém o cálculo local de teclado pelo visualViewport`; `pai de outra origem não quebra o fallback local` | Safe area, teclado, rotação, fallback por plataforma e disconnect de observer. | DOM/window/MutationObserver/viewport fakes. | Comentário do próprio teste ressalta que não equivale a WebKit/iPhone/Android real; não há 20 ciclos. |
| `profile-display-name.test.mjs` / 2 | `nome oficial calculado pelo backend tem prioridade sobre os campos separados`; `usa nome social ou de registro quando não há nome usual válido` | Prioridade e fallback de campos de nome. | Funções extraídas/transpiladas de fonte via esbuild/VM. | Fixtures sintéticos; sem UI/foto. |
| `profile-refresh.test.mjs` / 4 | `resposta válida atualiza ambos os snapshots, preservando foto, perfil, listas e prazo`; `perfil idêntico não grava snapshots nem solicita recarregar o Painel`; `não mistura contas, identidades conflitantes, respostas anônimas ou domínios`; `migração de snapshot legado exige autorização explícita da origem e mantém expiração` | Resposta parcial, persistência, identidade, origem, migração e prazo. | Storage Maps, URL e datas; bundle esbuild/VM. | Não envia HTTP real nem cobre todos os formatos/status de resposta. |

## 4. Arquitetura observada neste checkout

- A customização tem camadas reconhecíveis: páginas Angular (`marketplace-ifrn`, `painel`, `moodle-open-course`), serviços (`suap-entry`, `painel-ava`, `moodle-site`, SSO) e uma SPA TypeScript própria em `mobilemoodle/core_mobile` (API, roteamento, views, estado e favoritos).
- A ponte de `PainelPage` valida `event.source` e `event.origin`, com testes para remetente/origem inválidos. Os emissores de abertura de curso e logout agora usam `window.location.origin`, coberto por fakes; a origem runtime da WebView não foi medida fisicamente.
- Métricas atuais: `moodle-site.service.ts` tem 2.358 linhas e 52 métodos de classe; `painel-ava.service.ts` 1.402 linhas e 14 métodos de classe; `authenticateWithBrowser` ocupa 528 linhas. A complexidade aproximada por AST desta função foi 48 (base 1 + if/loops/catch/ternários/curtos-circuitos), não é regra oficial do ESLint. `renderCurso` em `app-views.ts` ocupa 166 linhas e a mesma aproximação dá 51.
- A extração já existente `course-sso-browser.ts` é um módulo separado testado com Browser fake. Não confundir isso com decomposição concluída de `authenticateWithBrowser`.
- A varredura AST de `.ts` de `src/MoodleIFRN` (exceto `static/vendor`, `theme/dsgov-auditoria` e `.d.ts`) encontrou 26 catch blocks vazios e 61 chamadas `console.*`. Não foi feita a classificação individual nem a auditoria completa dos argumentos de log; não concluo que todos sejam seguros.
- `renderCurso` agora tem um teste de caracterização restrito a cabeçalho, progresso, resumo e estado vazio. Não há DOM/browser E2E integrado na suíte Node. `authenticateWithBrowser` tem um caso de sucesso sintético e o teste antigo de opções/teardown; estados de falha ainda não foram caracterizados.
- Build de produção compilou sem erro. O import de `ifrn-language.ts` é estático em `moodle-site.service.ts`; qualquer lazy loading requer caracterização de idioma no curso antes da mudança. Não há base para atribuir ganho de runtime apenas com a build.
- Não reexecutei um algoritmo de ciclos de import no checkout atual. Contagem antiga de ciclos da Fase 1 não é tomada como baseline desta branch.

### Classificação dos 26 `catch` sem instrução

As posições abaixo foram obtidas com AST do TypeScript e conferidas com `sed -n` nos respectivos trechos. Classificação individual: **intencional/fallback**, pois o fluxo posterior mantém uma alternativa explícita ou a exceção significa estado opcional; nenhum catch foi alterado nesta etapa.

| Posição | Classificação e efeito observável |
|---|---|
| `mobilemoodle/core_mobile/api-auth.ts:72` | Intencional: falha ao limpar token de URL não interrompe restauração da tela. |
| `mobilemoodle/core_mobile/api-painel.ts:316` | Intencional: falha ao ler perfil SUAP mantém o perfil que o Painel já forneceu. |
| `mobilemoodle/core_mobile/app-accessibility.ts:79` | Intencional: JSON/storage de preferências inválido preserva defaults. |
| `mobilemoodle/core_mobile/app-accessibility.ts:87` | Intencional: quota/modo privado não bloqueia acessibilidade em memória. |
| `mobilemoodle/core_mobile/app-utils.ts:155` | Intencional: preferência de origem para logout não é requisito para abertura do curso. |
| `mobilemoodle/core_mobile/app-utils.ts:204` | Intencional: falha de storage não bloqueia handoff do curso. |
| `mobilemoodle/core_mobile/app-utils.ts:221` | Intencional: estado auxiliar de inscrição não bloqueia navegação fallback; sem afirmar que a inscrição é testada. |
| `mobilemoodle/core_mobile/course-favourites.ts:19` | Intencional: URL inválida tenta próxima origem/ambiente para chave local. |
| `mobilemoodle/core_mobile/course-favourites.ts:39` | Intencional: favoritos corrompidos viram estado vazio; não altera servidor. |
| `moodle-course/course-accessibility.ts:188` | Intencional: preferência corrompida mantém default. |
| `moodle-course/course-accessibility.ts:196` | Intencional: storage indisponível mantém configuração em memória. |
| `moodle-course/course-accessibility.ts:253` | Intencional: construtor do widget já inicializado não impede retorno da tela. |
| `moodle-course/course-accessibility.ts:272` | Intencional: widget indisponível/duplicado não interrompe curso. |
| `navigation/handoff-loading.ts:30` | Intencional: falha ao limpar chave transitória não deve travar remoção da classe/loading. |
| `painel/painel.ts:141` | Intencional: preferência de origem não bloqueia abrir curso. |
| `painel/painel.ts:191` | Intencional: falha de persistência não bloqueia continuar para a rota de painel. |
| `painel/painel.ts:235` | Intencional: acesso cross-origin a layout é opcional; layout local permanece. |
| `services_mobile/course-sso-browser.ts:85` | Intencional: URL não parseável não ganha permissão; validação de destino a rejeita depois. |
| `services_mobile/moodle-site.service.ts:770` | Intencional: redirect não HTTP permanece oculto. |
| `services_mobile/moodle-site.service.ts:776` | Intencional: falha de hide/show preserva handoff nativo como fallback. |
| `services_mobile/moodle-site.service.ts:795` | Intencional: URL/site inválido resulta em `false` para a política de domínio. |
| `services_mobile/painel-ava.service.ts:232` | Intencional: corpo não JSON usa status/fallback, sem parse obrigatório. |
| `services_mobile/painel-ava.service.ts:516` | Intencional: ausência de hide é coberta por overlay Ionic. |
| `services_mobile/painel-ava.service.ts:1064` | Intencional: hide indisponível é coberto pelo overlay no início de navegação. |
| `services_mobile/painel-ava.service.ts:1074` | Intencional: mesma política de overlay durante parada/carregamento. |
| `services_mobile/suap-entry.service.ts:293` | Intencional: perfil anterior inválido não é mesclado à sessão nova. |
| `services_mobile/suap-entry.service.ts:302` | Intencional: URL de foto original é mantida quando `fixPluginfileURL` falha. |

Esta classificação não cobre ainda cada um dos 61 argumentos `console.*`; os logs requerem uma revisão separada de conteúdo e risco de PII antes de declarar sanitização completa.

## 5. Lacunas priorizadas e plano

1. **P0 — Test runner rastreável (FEITO):** `test:ifrn` foi adicionado e documentado sem dependências; execução atual: 20 arquivos sem falhas, 94 declarações individuais.
2. **P0 — Baseline Jest:** as 8 falhas preexistentes do core permanecem registradas. Jest não foi rerodado após mudanças em arquivos que não são coletados pelo Jest; repetir antes de integrar a branch.
3. **P1 — Resiliência (PARCIAL):** mocks cobrem HTTP 401/403/500, HTML no lugar de JSON, JSON inválido, schema sem lista, conexão recusada, timeout interno e falha opcional no progresso. Não existe sinal externo de cancelamento para esse fetch; não se introduziu retry.
4. **P1 — Segurança da ponte (PARCIAL):** receptor já rejeita origem/remetente inválidos; abertura de curso e logout agora usam targetOrigin derivado da origem atual, com testes. A origem runtime ainda requer aparelho. Testes de logs com marcadores sintéticos e revisão completa de logs continuam pendentes.
5. **P1 — Lifecycle (PARCIAL):** testes existentes cobrem timeout/cancelamento do SSO, unsubscribe/close, callback tardio e disconnect de observer. Mount/unmount repetido e contagem total de listeners/timers ainda não foram medidos.
6. **P1 — Caracterização B3 (PARCIAL):** há um caminho feliz de `authenticateWithBrowser` com payload sintético e um teste restrito de `renderCurso`; faltam falhas/cancelamento/render de atividades. A decomposição B3 não foi iniciada.
7. **P2 — B4 (PENDENTE):** nenhuma extração de `MoodleSiteService` foi feita. Faltam caracterização pública mais ampla e mapa atual de dependências/ciclos. O relatório de especificação anterior não existe neste checkout; foi consultado apenas o escopo B3/B4 descrito na solicitação anterior da conversa.
8. **P2 — E2E ADB/CDP (BLOQUEADO):** o coletor, calibração e adaptadores pedidos não existem nesta branch. A suíte cobre partes do fluxo com fakes de Router/IAB/bridge, não o orquestrador ADB/CDP. Não foi criado teste simulando código inexistente.
9. **P2 — Medição física (NÃO EXECUTADA):** preflight, smoke, seis rodadas, abertura de curso e baseline + 20 ciclos não foram executados; nenhuma interação física foi feita. Operador deve fornecer artefatos/calibração e evidência sanitizada.
10. **P3 — Bundle/idioma (SEM MUDANÇA):** build antes/depois tem assets iniciais idênticos; não foi aplicado lazy loading sem teste de idioma pronto antes do conteúdo dependente.

## 6. Resultado da etapa e limitações

### Arquivos alterados

- `package.json`: script `test:ifrn` com runner nativo do Node.
- `src/MoodleIFRN/docs/README.md`: comandos e limites do runner.
- `src/MoodleIFRN/tests/painel-courses.test.mjs`: quatro cenários novos de resiliência.
- `src/MoodleIFRN/tests/painel-login-after-course.test.cjs`: caracterização adicional do caminho feliz de `authenticateWithBrowser`.
- `src/MoodleIFRN/tests/render-course-characterization.test.cjs`: novo teste de caracterização direta de `renderCurso`.
- `src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts` e `app.ts`: `postMessage` usa `window.location.origin` em vez de `'*'`.
- `src/MoodleIFRN/tests/course-navigation-races.test.cjs`: assertions de `targetOrigin` e teste de logout.
- `.analise/estrategia-testes-baseline.md`: inventário e resultados desta etapa.

### Validação após as mudanças

- `node src/MoodleIFRN/tests/painel-courses.test.mjs`: 10/10 passou.
- `node src/MoodleIFRN/tests/course-navigation-races.test.cjs`: 6/6 passou.
- `npm run test:ifrn`: 20 arquivos passaram, 0 falharam; `rg -c "\\btest\\(" src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs` contou 94 declarações.
- `git diff --check`: exit 0, sem saída.
- Build produção antes e depois: exit 0, `errorsCount=0`, `warningsCount=44`. Assets iniciais idênticos no `stats.json`: `main` 4.301.459 B, `styles` 869.119 B, `polyfills` 57.576 B, `runtime` 19.333 B; total 5.247.487 B. A mudança de bridge não alterou o bundle inicial.
- O build continua avisando que o bundle inicial de 5,25 MB supera o budget de 5,00 MB em 247,49 kB; esta diferença não foi causada pela mudança porque os assets são idênticos aos do baseline.
- Cobertura não foi executada, portanto não há percentual a reportar.
- Jest não foi reexecutado após as mudanças; o baseline anterior teve 8 falhas nos testes do core, e essas mudanças não estão nos arquivos `*.test.ts` do Jest.

### Plano físico para operador (não executado)

1. Confirmar aparelho, conta de teste autorizada e curso somente de leitura; não abrir curso que exija inscrição, envio, avaliação, edição ou exclusão.
2. Conferir `adb forward --list`. Se `tcp:9222` estiver ocupada, identificar o dono antes de qualquer remoção; não remover forwards alheios.
3. Usar checkout que contenha coletor/calibração; executar `node --check`, `--self-test` e `--preflight`, com o operador no controle do aparelho.
4. Fazer smoke de uma rodada e conferir a sanitização dos arquivos antes de compartilhar.
5. Fazer seis rodadas Marketplace → Painel → curso de leitura → voltar, sempre começando no Marketplace; registrar a primeira rodada fria separada das demais.
6. Para vazamento, marcar baseline e 20 ciclos entre as mesmas duas telas, sem ações acadêmicas; deltas são observações, não prova de leak.
7. Repetir em matriz de Androids; todos os resultados físicos ficam **NÃO EXECUTADOS** até evidência do operador.

Nenhum ADB, preflight, toque físico, request SUAP/AVA independente, login real ou mutação acadêmica foi feito. Nenhuma dependência foi adicionada. A pasta FastAPI foi removida pelo usuário durante esta etapa e não foi recriada. Os relatórios/coletor/calibração mencionados não estão no checkout; build e testes simulados não substituem validação física.

### Apêndice de comandos e saídas desta etapa

```text
npm run test:ifrn
# Subtest: 20 arquivos de teste ... ok
# tests 20
# pass 20
# fail 0
# exit 0

node src/MoodleIFRN/tests/painel-courses.test.mjs
# tests 10; pass 10; fail 0; exit 0

node src/MoodleIFRN/tests/course-navigation-races.test.cjs
# tests 6; pass 6; fail 0; exit 0

node src/MoodleIFRN/tests/painel-login-after-course.test.cjs
# tests 2; pass 2; fail 0; exit 0

node src/MoodleIFRN/tests/render-course-characterization.test.cjs
# tests 1; pass 1; fail 0; exit 0

rg -c "\btest\(" src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs | awk -F: '{n+=$NF} END {print "declared tests=" n}'
# declared tests=94

AST TypeScript: traversar CatchClause vazio e chamadas console.* em src/MoodleIFRN,
excluindo static, theme, tests e .d.ts.
# AST empty catches=26; console calls=61

NODE_OPTIONS=--max-old-space-size=3072 NODE_ENV=production ./node_modules/.bin/ng build --configuration=production --output-path=/tmp/ifrn-strategy-after --stats-json --delete-output-path=false --progress=false
# Build at 2026-10-28T17:49:56.972Z; errorsCount=0; warningsCount=44; exit 0
# initial assets: main 4,301,459; styles 869,119; polyfills 57,576; runtime 19,333 bytes

git diff --check
# sem saída; exit 0
```

O teste Jest completo não foi repetido após as mudanças. O resultado baseline preservado acima é 40/48 suites aprovadas e 8 falhas do core. `--preflight`, ADB, `--auto` e qualquer teste de conta real: **NÃO EXECUTADOS**, por restrição do pedido.
