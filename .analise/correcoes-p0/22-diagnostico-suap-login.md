# Diagnóstico do login SUAP e fluxo do Painel AVA

Data da análise: 2026-11-01  
Branch: `fix/p0-release-2.0.1`  
HEAD analisado: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`  
Branch de destino, sem alterações: `release/2.0.1` em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

## Diagnóstico do fluxo real

O caminho principal examinado no código é:

1. `MarketplaceIfrnPage.enterAva()` impede cliques repetidos enquanto a entrada está ocupada, limpa o estado de retorno nativo pendente, aguarda a transição visual e chama `SuapEntryService.loginWithSuap()`.
2. `loginWithSuap()` chama `PainelAvaService.authenticateWithBrowser({ readOnly: true, reuseSession: false })`. O serviço abre `https://ava.ifrn.edu.br/` num InAppBrowser. O fluxo web oficial do AVA encaminha para a página de autenticação SUAP quando necessário. Uma entrada nova limpa cookies web para evitar reutilizar a conta anterior; a retomada de sessão é um caminho separado.
3. Depois que a sessão web está autenticada, o serviço consulta os diários e os dados de identidade dentro da sessão do Painel. A tela de SUAP valida que há identidade e que o proprietário dos dados corresponde à identidade apresentada; em caso de divergência, o fluxo não grava o perfil como autenticado.
4. `SuapEntryService.commit()` grava o perfil, o painel e o proprietário validados, e solicita a navegação para `/painel`.
5. O Painel carrega o perfil salvo e o dashboard. A abertura de disciplinas usa o serviço de sessão Moodle existente, que é uma sessão interna separada da autenticação SUAP.

O fluxo inspecionado não exige formulário Moodle como etapa principal e não usa credencial SUAP como token Moodle. O SUAP/Painel permanece a autoridade da identidade institucional.

## Gargalo confirmado e correção pequena

Depois do `commit()` bem-sucedido, `PainelPage.ngOnInit()` chamava `PainelAvaService.refreshSavedProfile()`. Esse método abria outro InAppBrowser para buscar `/api/v2/usuario/info/`, embora o login imediatamente anterior já tivesse obtido e validado o perfil usando a sessão web ativa. Se a resposta diferisse, o fluxo ainda podia atualizar o perfil e recarregar o iframe do painel.

Foi adicionada uma marca de uso único, limitada a 60 segundos e mantida em `sessionStorage`. O commit a define após salvar o resultado validado; a primeira chamada subsequente de `refreshSavedProfile()` consome a marca e não abre outro navegador. A próxima atualização normal não é suprimida. A marca é removida no logout e participa do rollback local do commit caso a navegação/commit falhe.

O teste executa o método real `refreshSavedProfile()` extraído do serviço e confirma que, com a marca válida, ele retorna sem abrir o navegador. Testes adicionais cobrem consumo único, expiração, valor inválido e formato dos logs. Essa evidência confirma a remoção de uma abertura e consulta redundantes por login concluído; não quantifica duração em milissegundos.

## Medição de duração

Foram adicionados logs `[IFRN-SUAP-TIMING]` com somente um nome curto de etapa e duração numérica. Nenhum URL, resposta, perfil, matrícula, token, cookie ou senha é escrito por essa instrumentação. Os nomes permitem separar:

| Etapa | O que mede |
|---|---|
| `marketplace-preflight` | Limpeza de estado, navegação de preparação e espera por pintura antes de iniciar o serviço. |
| `inappbrowser-open-call` | Duração síncrona da chamada que solicita abrir o InAppBrowser. Não mede até o WebView estar pronto. |
| `browser-load-suap`, `browser-load-painel`, `browser-load-other` | Intervalo entre eventos de navegação observados para cada classe de origem. |
| `suap-visible-wait` | Tempo em que a autenticação foi exibida ao estudante até o browser ser ocultado; inclui interação humana e rede, portanto não representa tempo puro do servidor. |
| `courses-api-response`, `panel-profile-api-response`, `suap-profile-api-response` | Duração observada no script do navegador para cada resposta usada pelo fluxo. |
| sufixo `-ttfb-approx` | Estimativa de TTFB reportada pela Navigation/Resource Timing do navegador. É aproximada e inclui rede, proxy e comportamento do browser; não é uma medição isolada do servidor SUAP. |
| `browser-to-panel-data`, `suap-entry-to-validated-data` | Tempo desde a abertura do fluxo até os dados estarem disponíveis e validados pelo app. |
| `panel-navigation-requested` | Tempo total até o pedido de navegação ao Painel. Não significa que a tela já foi pintada. |
| `panel-iframe-document-load` | Tempo de início da inicialização da página Angular até o evento `load` do iframe; inclui espera de plataforma/rota, portanto não é só rede. |
| `panel-templates-ready`, `panel-dashboard-ready`, `panel-render-to-frame` | Preparação dos templates, carregamento do dashboard e tempo de rota até o próximo frame após renderizar. |

**Medições reais em aparelho: pendentes.** A instrumentação foi adicionada ao código, mas não foi compilada nem instalada nesta etapa. Não houve um novo login SUAP observado com esses logs; portanto, não existem amostras comparáveis para os intervalos 1–6 solicitados. O evento do navegador mede a navegação percebida pelo app, não separa com precisão o processamento do servidor. O período de interação humana aparece separado como `suap-visible-wait`, mas também contém espera de rede enquanto o login está visível.

Os artefatos P0.5 existentes dizem respeito a abertura de cursos e retorno ao painel, não ao login SUAP; eles não foram usados como medição do login.

## Outras verificações

- O método `enterAva()` já tem guarda contra reentrada enquanto `loading`, `waitingBrowser` ou `openingPainel` estão ativos. O caminho observado não mostra uma segunda chamada deliberada ao login antes de a primeira terminar.
- O refresh automático de perfil após a entrada é a duplicação comprovada e foi limitado a uma chamada pós-login.
- Não foi alterada a política de cookie de login novo/retomada, nem as validações de identidade, o algoritmo SUAP, o serviço de sessão Moodle, o mapeamento de disciplinas ou a interface visual.
- A atualização do painel continua sujeita a erros de rede; a correção não os mascara nem suprime refreshes futuros.

## P0.4 — pendência separada

A regressão `P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B` permanece falhando. O teste mostra `synthetic-site-a` ativado, com persistência, evento de login e navegação depois do cancelamento e início de B. Isso é uma concorrência na sessão nativa Moodle e não é a causa da demora do login SUAP. Não foi alterado, ignorado ou marcado como skip/todo nesta tarefa.

## Arquivos modificados nesta etapa

- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts` — mede a preparação ao entrar no AVA.
- `src/MoodleIFRN/services_mobile/suap-entry.service.ts` — mede chegada aos dados validados e pedido de navegação; marca o perfil recém-validado.
- `src/MoodleIFRN/services_mobile/painel-ava.service.ts` — mede estágios do browser/respostas e evita a busca de perfil imediatamente redundante.
- `src/MoodleIFRN/services_mobile/suap-login-telemetry.ts` — logger restrito e marca temporária de perfil.
- `src/MoodleIFRN/services_mobile/auth.service.ts` — limpa a marca temporária no logout.
- `src/MoodleIFRN/painel/painel.ts` — mede o evento de carga do iframe.
- `src/MoodleIFRN/mobilemoodle/core_mobile/app-router.ts` — mede templates, dashboard e render da rota do painel.
- `src/MoodleIFRN/tests/suap-login-telemetry.test.cjs` — cobertura do logger, expiração e ausência da abertura redundante.
- `src/MoodleIFRN/tests/painel-login-after-course.test.cjs` — adiciona mocks da telemetria e relógio de alta resolução exigidos pelo serviço.

Não foram alterados `src/core/`, `src/addons/`, plugins, a branch `release/2.0.1` ou o APK instalado.

## Validação executada

- Baseline conhecido antes desta etapa: 250 testes, 249 aprovados e uma falha P0.4.
- Suíte completa atual: 255 testes, 254 aprovados, uma falha P0.4; zero skip/todo. Nenhuma outra falha foi observada.
- Testes focados do logger e da política de redirects: 6/6 aprovados.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` aprovado.
- `git diff --check`: aprovado.
- ESLint: o helper novo foi verificado; a execução em arquivos inteiros existentes encontra diagnósticos preexistentes. Não foi possível concluir uma comparação diferencial confiável de todo o conjunto nesta execução, então não se declara ausência de novos diagnósticos de lint.

## Próxima validação necessária

Para medir o comportamento real, será necessário compilar uma build de diagnóstico e instalá-la no aparelho, com autorização específica antes de substituir o aplicativo instalado. Depois, realizar um login SUAP normal e coletar somente as linhas `[IFRN-SUAP-TIMING]`, sem executar logout, limpeza de dados ou troca de conta real. Comparar várias execuções equivalentes antes/depois é necessário para atribuir mudanças de tempo; este relatório não afirma que o login ficou mais rápido em duração medida.
