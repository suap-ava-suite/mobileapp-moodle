# Conferência DS Gov — 18/10/2026

Tema claro conferido no aparelho. Aguardando a alternância real para o escuro solicitada na Fase 5. Não há novos commits enquanto a conferência dos dois temas estiver pendente.

Os registros novos estão em `src/MoodleIFRN/theme/dsgov-auditoria/`, pois a regra do usuário exige preservar `analise-aparelho/` e editar somente dentro de `src/MoodleIFRN/`.

| Região | Antes → depois nesta rodada | Evidência | Commit existente | Situação |
| --- | --- | --- | --- | --- |
| Marketplace e tokens | Ciclos CSS removidos; foco válido; Rawline carregada; botão azul com contraste branco aprovado | `dsgov-claro-marketplace.png`, `dsgov-claro-marketplace.txt`, `contraste.txt` | `eb67d0f23` existente; correções sem commit | APROVADO no claro; escuro pendente |
| Curso | Tokens herdados corretamente; texto/superfície definidos; 43 ocorrências de `!important` preservadas | `dsgov-claro-curso.png`, `dsgov-claro-curso.txt`, `antes-curso.txt` | `c56f67e53` existente; correções sem commit | APROVADO no claro para a área renderizada; escuro pendente |
| Painel | Nenhuma alteração nova; divergências estruturais preservadas; Rawline e azul já presentes | `dsgov-claro-painel.png`, `dsgov-claro-painel.txt`, `painel-divergencias.txt` | `7a5015faa` existente | APROVADO no claro; escuro pendente |

## Inventário e referência

- `_variables.scss`, `pre.scss` e `_fonts.scss` em `analise-aparelho/dsgov/ref/` são idênticos ao ZIP indicado pelo usuário: `referencia-zip.txt`.
- `inventario.txt` registra cores por arquivo, 40 valores mais frequentes, famílias tipográficas e fontes Rawline disponíveis.
- O app tem Rawline 400/500/600/700 normais. O tema web também oferece itálicos 400/600/700; não foram acrescentados arquivos de fonte.
- Os azuis claros principais já estavam alinhados. As divergências históricas do marketplace foram corrigidas nos commits existentes; a checagem das três cores verdes antigas retorna zero ocorrências.
- Há tokens estruturais/de status ausentes no painel. Não foram adicionados: o escopo proíbe reestruturação.
- O `moodle-course.scss` é global via `angular.json:59`, usa `@use` e importa os tokens. Nenhuma configuração foi alterada.
- `patch-moodle-ifrn.js` foi apenas lido: menciona o caminho do SCSS para registrar sua importação, mas não reescreve os três arquivos que foram editados e revertidos. Não foi executado.

## Contraste

`contraste.mjs` extrai valores do SCSS atual e aplica a luminância relativa WCAG. O relatório anterior em `analise-aparelho/` usa valores fixos e aprova branco no escuro contra um fundo diferente do efetivamente consumido pelos botões.

Pendências do estado original: branco sobre o interativo escuro (2,17:1); branco sobre active escuro (1,56:1); azul primário sobre faixa escura clara (2,27:1); sucesso claro em texto normal (4,35:1, aprovado apenas para UI/texto grande).

As correções usam fundo de botão `#1351b4` e ativo `#0c326f`, com branco: 7,33:1 e 12,34:1. As superfícies seguem `gray-900`/`white`/`gray-700` do Moodle. Todos os valores do escuro são **derivados, não oficiais**. `contraste-original.txt` descreve o HEAD anterior; `contraste.txt` descreve as correções atuais. Componentes nativos que usem o azul claro com contraste branco ainda exigem conferência no escuro.

## Inicialização e USB

O usuário relatou que o app abre ao desconectar o USB. Não foi possível atribuir esse comportamento a um guard ou reproduzir a dependência do cabo. Após o empacotamento correto, o app abriu com o USB conectado, incluindo painel e curso pela sessão existente.

- O script existente foi executado sem alterações. Angular e Gradle compilaram; `adb install -r` retornou `Success` (`deploy.log`).
- A WebView ficou com `APP-ROOT` sem filhos, `cordova` indisponível e nenhum curso/painel/marketplace renderizado. A captura `dsgov-claro-inicializacao-bloqueada.png` mostra a logo de inicialização, sem dados pessoais.
- Não foi detectado JavaScript pausado em breakpoint.
- O Android tinha o Moodle selecionado como aplicativo de depuração, mas `wait_for_debugger=0`. Essa seleção foi removida e o app reiniciado sem apagar dados; o bloqueio permaneceu.
- Erros sanitizados mostram `pt-br.json` com HTTP 404, avisos de Cordova indisponível e erro de site atual. Nenhuma credencial, cookie ou token foi coletado ou registrado.
- O build web comum do script não inclui o carregador Cordova. O alvo `app:ionic-cordova-build` já existente acrescenta esse carregador ao artefato gerado. Ele foi compilado, preparado e instalado com sucesso sem alterar `src/index.html` ou configurações (`build-cordova.log`, `gradle-cordova.log`). A WebView passou a reconhecer Cordova e renderizou as três regiões com USB conectado.
- As correções de tema, revertidas inicialmente por precaução, foram reaplicadas depois dessa recuperação e instaladas com o mesmo alvo nativo (`build-tema-final.log`, `gradle-tema-final.log`). O patch guardado com o nome histórico `correcoes-nao-aplicadas.patch` corresponde às correções que agora estão aplicadas.
- Guards ainda não podem ser apontados como causa: a falha observada ocorre antes da renderização das páginas.

## Verificações e preservação

- Sass compilou sem erro (`sass.log`); `git diff --check` passou novamente após a reaplicação.
- `!important`: 43 antes e 43 depois. Não houve remoção de `!important` nesta rodada.
- Marketplace: Rawline 400 e 700 carregadas; `brandTop - safeTop = 18,71px` antes e depois, aprovado no intervalo 8–20px; safe-top real 28,57px. Curso: Rawline 400/500/600/700 carregadas. Painel: Rawline 400/600/700 carregadas.
- As três capturas claras foram conferidas. O curso renderiza cabeçalho e progresso; sua área de conteúdo estava vazia também na captura anterior. Conteúdo de atividades não foi validado nesta rodada.
- As três capturas escuras e a comparação visual entre os temas continuam pendentes. A solicitação de alternância foi feita uma única vez. A última consulta ainda indicou tema claro.
- O painel é um documento em iframe e não possui uma variante escura explícita nos arquivos inspecionados; a conferência do escuro deve registrar eventual fundo claro residual. Não foi criada uma estrutura nova, conforme o escopo.
- Nenhum commit novo foi criado. `git-log.txt` e `git-status.txt` registram o estado da árvore.
- Nenhum arquivo-fonte fora de `src/MoodleIFRN/` foi editado por mim. Os três arquivos protegidos e `analise-aparelho/` foram preservados. O deploy gerou artefatos em `www/` e `platforms/`, como parte da compilação.
