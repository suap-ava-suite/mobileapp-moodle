# AVA IFRN Mobile — correções e validação de 18/10/2026

## Escopo e preservação

Foram relidos o Git, os fontes atuais e o relatório anterior antes das alterações. As três alterações locais já existentes em SCSS foram preservadas; sua diferença inicial está em `alteracoes-preexistentes.patch`. Nenhum commit, push, instalação de dependências, execução de `patch-moodle-ifrn.js` ou limpeza de dados do aplicativo foi feita.

`src/core`, `src/addons` e `analise-aparelho/` foram apenas lidos. Os registros anteriores desta auditoria não foram substituídos. Arquivos de aplicação modificados/adicionados ficam em `src/MoodleIFRN/`; o build também atualiza os artefatos gerados em `www/` e `platforms/`.

O OAuth continua usando **`CoreLoginHelper.openBrowserForOAuthLogin`**, com os mesmos parâmetros e navegador oficial. Não foi criado navegador interno, servidor Python ou túnel.

## 1. Abertura dos cursos: causas e correções

### Causas identificadas

- **Ponte Ionic reutilizada com estado antigo.** A página só inicializava em `ngOnInit`. No aparelho, após passar pelo Presencial, um novo toque no Acadêmico manteve a ponte esperando autenticação do Presencial. Esse caso foi reproduzido nesta rodada.
- **Origem recebida pela rota ignorada.** A ponte recebia `siteUrl` do painel, mas resolvia o ambiente somente pelo pendente em armazenamento. Agora os parâmetros atuais são lidos a cada entrada e têm precedência sobre um pendente incompatível.
- **Janela sem limite antes de navegar.** O limite anterior começava depois da consulta de matrículas. Validação/restauração da sessão e preparação do OAuth podiam continuar sem esse limite.
- **Preparações concorrentes e temporizador órfão.** Existia um temporizador global de 60 s associado a um overlay já removido. Ele podia alterar a recuperação enquanto outra etapa ainda trabalhava. A preparação do OAuth não tinha proteção própria antes da abertura do navegador.
- **Identidade ausente aceita como fallback.** Havia caminhos que reutilizavam uma sessão quando o painel não fornecia identificador forte. Agora identidade ausente interrompe a abertura com orientação para reabrir o painel; conta divergente continua bloqueada.
- **Ambiente ausente ou contraditório.** O painel não tinha uma resolução explícita por metadados para o caso sem URL. O novo resolver usa a URL oficial ou o rótulo inequívoco do ambiente e bloqueia conflitos, URLs de testes e origem não identificada.

### Correções aplicadas

- `ionViewWillEnter` relê curso/ambiente a cada entrada; uma versão da entrada impede resultados cancelados de alterar a próxima tentativa.
- Sessão e preparação OAuth não executam preparações paralelas. A retomada após troca de site aguarda a preparação anterior terminar e inicia a etapa correta.
- Etapas assíncronas têm cancelamento e limite, com tempos monotônicos sem identificadores. O temporizador órfão foi removido.
- O ambiente é conferido novamente antes de abrir o curso. A identidade e a matrícula exata continuam sendo verificadas.
- `getUserCourses(true)` foi preservado: **`true` já significa preferir cache**, conforme a implementação do núcleo. Não foi apresentado como chamada forçada à rede.
- Não há consulta ao banco apenas para preencher um log quando a sessão atual já corresponde à conta.
- Em erro na abertura nativa, os carregamentos novos pertencentes à operação são dispensados. A ponte existente continua oferecendo tentar novamente e voltar ao painel.

### O que foi observado no Android

- Acadêmico: duas aberturas com sessão existente, retorno pela seta nativa e nova abertura.
- Sequência final com o ajuste Ionic: Acadêmico → painel → Presencial → espera pelo navegador oficial → cancelamento → painel → Acadêmico novamente. O curso voltou a abrir e exibiu **11 módulos visíveis**.
- A seta permaneceu no canto superior esquerdo: `left=8px`, `top≈31,57px`.
- Presencial: ambiente identificado corretamente e chegada ao navegador oficial. **A autenticação nova não foi concluída nesta rodada**; não há aprovação de abertura completa nem medição de sessão quente desse ambiente.
- O cancelamento da espera pelo navegador retornou ao painel. Interações via CDP enquanto o navegador estava em primeiro plano precisaram trazer o AVA de volta à frente; resultados de espera em segundo plano não foram usados como aprovação.

Evidências: `reentrada-presencial.json`, `cancelamento-reentrada-estavel.json`, `reentrada-academico-3.json`, `reentrada-curso-final.json`, `seta-aparelho.json` e testes locais indicados abaixo.

### Tempos efetivamente medidos

Todos os valores abaixo foram coletados no aparelho, depois das correções, em aberturas do **Acadêmico com sessão existente**. São execuções sucessivas; **não representam uma comparação antes/depois com o código original**.

| Etapa | Execução 1 | Reabertura 2 | Execução após ajuste Ionic |
| --- | ---: | ---: | ---: |
| Sessão e identidade | 328 ms | 23 ms | 5 ms |
| Idioma | 291 ms | 1 ms | 1 ms |
| Matrículas, preferindo cache | 75 ms | 178 ms | 35 ms |
| Helper nativo e confirmação da navegação | 3.009 ms | 2.876 ms | 2.445 ms |
| Primeira pintura estilizada | 122 ms | 58 ms | 52 ms |
| Soma das etapas | **3.825 ms** | **3.136 ms** | **2.538 ms** |

A soma não inclui toda a renderização posterior das atividades. Houve uma leitura inicial com zero módulos antes de os conteúdos terminarem de carregar; posteriormente foram confirmados 11 visíveis. Não confundir primeira pintura do curso com conclusão de carregamento das atividades.

A etapa do helper nativo foi a maior nessas amostras. Ela engloba cache, chamadas internas e navegação: **não foi isolado o tempo do servidor**. Sem dados suficientes para atribuir a demora do Presencial à rede, servidor ou autenticação. A espera pelo usuário no navegador não é tempo de processamento do aplicativo.

Arquivos: `tempos-depois-academico.json` e `tempos-depois-academico-entrega.json`. A primeira tentativa de medição anterior às alterações terminou aguardando OAuth, sem tempo completo válido.

## 2. Cabeçalho recortado

O wrapper copiava a safe area nativa para o iframe. Porém o código de teclado do iframe, sem Cordova próprio, recalculava o fallback como zero em eventos de viewport. Um teste local do fonte anterior reproduziu a substituição de 28,57 px por zero. O novo código usa o host como autoridade e acompanha seus insets, preservando valores fracionários e zero legítimo.

O wrapper deixou de ser uma segunda área de rolagem; a rolagem pertence ao conteúdo interno do painel. Não foi acrescentado padding fixo.

Também foi confirmada divergência entre SCSS e CSS gerado: largura do contêiner de 1200 px no fonte contra 1300 px no CSS. Esse era um CSS desatualizado; **não foi atribuído a ele, sozinho, o recorte do cabeçalho**. O CSS foi regenerado e comparado com uma segunda compilação: conteúdos iguais.

No aparelho, foram executados rolagem até o fim e retorno, abertura/fechamento de ajuda, acessibilidade e perfil, em retrato e paisagem. Logo, título e três ícones permaneceram dentro do cabeçalho. Em retrato, altura de aproximadamente 92,57 px; em paisagem, adaptação responsiva para 72,57 px após estabilização. Safe area observada: 28,57 px. A seta do curso retornou ao painel.

Os testes usaram controles e elementos reais da WebView, acionados programaticamente via CDP. Não são testes físicos de gesto manual. Não foi obtida uma captura anterior do recorte: a regressão do inset anterior foi demonstrada localmente e os estados corrigidos foram medidos no Android.

Evidências: `test-insets.log`, `header-aparelho.json`, `header-paisagem-validado.json`, `header-retrato-entrega.json`, `css-antes.diff` e `claro-painel-final.png`.

## 3. Arco do carregamento

Havia uma segunda regra de `.moodle-open-course__brand` que substituía `grid` por `inline-flex`, deslocando a imagem em relação ao spinner absoluto. A regra de marca horizontal foi restringida ao cabeçalho; o carregamento manteve seu contêiner quadrado e centralizado.

A imagem passou a ocupar 68% do diâmetro no spinner Ionic e 74% no gauge SVG, de acordo com a geometria interna de cada anel. Os contêineres não encolhem no flex e isolam o empilhamento. Não foi usado recorte para esconder o arco.

Na ponte real do Presencial, em tema escuro, foram medidos **132×132 px**, imagem de aproximadamente **89,76 px**, desvio de centro menor que **0,01 px** e espaço interno do anel de aproximadamente **4,62 px**. Esses valores se mantiveram em retrato (**411×866 CSS px**) e paisagem (**866×411 CSS px**), com texto e ação de cancelamento visíveis.

O loading do marketplace e o gauge do painel foram corrigidos no fonte e compilados. A medição geométrica real desta rodada foi da ponte; os demais estados de autenticação ainda devem ser exercitados no roteiro manual.

Evidências: `loading-retrato.json`, `loading-paisagem.json` e `loading-paisagem.png`.

## 4. Aparência laranja na entrada

Foi removida a espera fixa de 380 ms. Os tokens são disponibilizados durante a preparação e a entrada no menu nativo, com limite para confirmação de rota e primeira pintura.

A amostragem no aparelho encontrou o menu nativo com `#f98012` após o estado temporário de abertura terminar (`tema-frames-entrega.json`). Isso motivou o último ajuste: o contexto azul do menu permanece enquanto o curso aberto pelo painel está na pilha e só é liberado no `ionViewDidEnter` do painel ou marketplace, depois da transição. O seletor continua condicionado ao contexto IFRN; não foi sobrescrito o primário global do núcleo e não foi criado overlay.

A amostragem verifica tokens dos elementos sob pontos da tela; não é uma gravação de pixels e não mede o navegador oficial. Resultado da repetição após esse último ajuste registrado no fechamento deste relatório.

## 5. DS Gov e idioma

- Houve alternância real pela ação de preferências da página de configurações, persistindo a preferência do app; não foi apenas aplicada uma classe `.dark` artificial.
- Marketplace, painel e curso foram conferidos no tema escuro. O iframe acompanha a classe e os insets do host. As superfícies principais do painel passaram a `#282828`, sem o fundo claro residual observado como risco anteriormente.
- Controles nativos passaram a usar `#04122b` como contraste do azul claro `#82b1ff`, com RGB correspondente. Botões preenchidos do marketplace continuam no azul escuro com branco.
- O curso exibiu 5 abas e 11 módulos; não foram abertas atividades que possam registrar conclusão, enviados formulários ou alterados dados acadêmicos.
- Todos os valores escuros continuam **derivados, não oficiais**. A conferência cobre as telas vistas, não todos os tipos de atividade nem todos os estados dos plugins.
- `pt-br.json` era solicitado pelo carregador nativo, mas não existia nos assets. O novo build extrai as 2.795 entradas do dicionário já existente e publica o JSON no artefato, preservando o carregador do Moodle e suas traduções de plugins/site. No Android, a URL passou a responder **HTTP 200**, com 2.795 entradas e Cordova disponível (`idioma-final.json`).
- O tema original claro e a rotação original foram restaurados após os testes.

Capturas: `claro-marketplace-final.png`, `claro-painel-final.png`, `claro-curso-final.png`, `escuro-marketplace.png`, `escuro-painel.png`, `escuro-curso-final.png`. Algumas capturas escuras antecedem o último ajuste funcional de reentrada, mas usam os mesmos fontes de paleta e layout conferidos.

## Arquivos de aplicação

**Alterados:**

- `marketplace-ifrn/marketplace-ifrn.ts` e `.scss`;
- `moodle-open-course/moodle-open-course.ts` e `.scss`;
- `moodle-course/moodle-course.scss`;
- `services_mobile/moodle-site.service.ts`;
- `painel/painel.ts`, `.html` e `.scss`;
- `theme/ifrn-dsgov-tokens.scss`;
- `mobilemoodle/core_mobile/app-views.ts` e `app-keyboard.ts`;
- `mobilemoodle/static/theme/ifrn/scss/_dsgov-tokens.scss`, `_variables.scss` e `_splash.scss`;
- `mobilemoodle/mobilemoodle.js` e `mobilemoodle/static/theme/ifrn/css/painel.css`, regenerados.

**Adicionados:** `navigation/course-opening-attempt.ts`, `mobilemoodle/core_mobile/course-target.ts`, `build-native.mjs` e os registros/scripts desta subpasta de auditoria.

Nenhum arquivo de aplicação foi excluído. Foto, perfil, favoritos e VLibras não tiveram suas implementações substituídas. O teste existente de proteção de perfil/foto passou; ajuda, acessibilidade e perfil foram abertos/fechados no aparelho. Favoritos e tradução automática do VLibras não foram acionados para alterar o estado do usuário.

## Compilações e testes executados

Usado o Node 22.17.0 já instalado, selecionado apenas no PATH dos processos desta execução. Sem `npm install` ou `npm ci`.

```bash
npm run build:mobilemoodle
node node_modules/sass/sass.js src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss src/MoodleIFRN/mobilemoodle/static/theme/ifrn/css/painel.css --no-source-map
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json --incremental false
node src/MoodleIFRN/build-native.mjs --check
node src/MoodleIFRN/build-native.mjs
node node_modules/cordova/bin/cordova prepare android
# No Windows, executado pelo PowerShell:
platforms/android/gradlew.bat -p platforms/android assembleDebug
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

O build nativo usa `app:ionic-cordova-build --platform=android --browser-target=app:build:development`, seguido da publicação do idioma. **O script preservado em `analise-aparelho/correcao/deploy.sh` ainda usa o build web comum; não foi modificado. Para o APK, use o novo build nativo.**

Testes locais passaram: `test-fluxo.cjs`, `test-insets.cjs`, `test-identidade.cjs`, `test-oauth-preparation.cjs`, `test-ciclo-ionic.cjs` e o teste preexistente `src/MoodleIFRN/docs/test-suap-entry-profile.cjs`. Cobrem resolução de ambientes, origem contraditória, timeout/cancelamento, conta ausente/divergente, inset do iframe, preparação OAuth concorrente, reentrada Ionic e preservação de perfil/foto. **São testes isolados; não são autenticação de contas reais.**

Uma compilação intermediária detectou incompatibilidade de iteração de `NodeList` com o tsconfig existente. Foi corrigida usando `Array.from`, sem alterar o tsconfig; os typechecks e builds seguintes passaram. Logs de tentativas anteriores ou amostragens sem dados foram preservados, mas não usados como aprovação.

## Validação que ainda precisa do usuário

1. Concluir o login oficial do Presencial, conferir o curso e repetir com sessão válida. Aguardar retorno automático sem trocar de conta. Não enviar credenciais, cookies ou códigos.
2. Cancelar enquanto prepara a sessão e durante o navegador; depois concluir um retorno OAuth antigo para conferir que não retoma indevidamente um curso cancelado. Esse retorno tardio real não foi validado nesta rodada.
3. Em uma sessão de teste, desligar a conexão e abrir um curso não disponível em cache. Conferir encerramento do loading, mensagem de erro e tentar novamente após reconectar. Não foi provocado erro físico de rede no aparelho.
4. Se houver uma segunda conta de teste autorizada, provocar divergência painel/Moodle. A abertura deve ser bloqueada, sem reaproveitar dados da outra conta. Esse cenário foi testado localmente, não com duas contas reais.
5. Abrir uma atividade de leitura sem conclusão automática e conferir conteúdo claro/escuro. Não iniciar tentativa de prova, enviar resposta, marcar conclusão nem alterar notas. Nesta rodada foram conferidos a listagem e os módulos, não o interior de todas as atividades.
6. Repetir manualmente gestos de rolagem, menus e rotação em uso normal. Os testes automatizados mediram o cabeçalho nas duas orientações; em parte da automação, a navegação voltou ao marketplace após mudança de orientação. A persistência da rota em todas as sequências de rotação ainda requer conferência manual.

O Presencial completo, o retorno OAuth tardio, a falha física de rede, duas contas reais e o conteúdo interno das atividades **não estão aprovados**. Não foi afirmado que a demora do servidor esteja resolvida.

## Fechamento da última versão instalada

O build nativo, `cordova prepare android`, Gradle `assembleDebug` e a instalação preservando os dados (`adb install -r`) concluíram com sucesso. Logs finais: `build-tema-contexto.log`, `prepare-tema-contexto.log` e `gradle-tema-contexto.log`. O typecheck final passou (`typecheck-tema-contexto.log`).

A repetição no aparelho após o último ajuste coletou **1.380 amostras**, com primário **#1351b4** no menu nativo durante e depois da transição e no curso, **sem o token laranja** (`tema-frames-contexto-final.json`). Essa evidência cobre a abertura medida do Acadêmico; não substitui inspeção de todos os cursos ou do navegador externo. A seta nativa permaneceu à esquerda (8 px) e retornou ao painel. O aparelho foi deixado no painel, no tema claro original.

Não foram criados commits nem enviados dados acadêmicos. As alterações anteriores foram preservadas. `git diff --check` passou; `areas-preservadas.txt` não apresenta diferenças rastreadas em `src/core`, `src/addons` ou `analise-aparelho/`. Estado e histórico finais estão em `git-status-final.txt` e `git-log-final.txt`.
