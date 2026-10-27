# Fase 2 — medições no aparelho e refatoração MoodleIFRN

**Data:** 2026-10-27  
**Branch de trabalho:** `refactor/ifrn-clean-arch`, criada a partir de `release/2.0.1` (`e211dc4e4`).  
**Commit feito:** `03ed25b44 test(ifrn): add isolated Node test command`.  
**Evidência:** achados/mudanças estão rotulados MEDIDO, LIDO, INFERIDO ou NÃO VERIFICADO. Nenhum acesso autenticado ao SUAP/AVA foi iniciado nesta sessão.

## 1. Resumo executivo

- O ADB encontrou um Moto G20/Android 11. O build Cordova Android debug foi concluído, instalado com `adb install -r` e aberto sem limpar dados; a WebView retornou ao `/login/painel`.
- Uma janela passiva de 15 s no painel do APK atualizado registrou 0 requests e 0 bytes concluídos; métricas pontuais: 1.343 nós DOM, heap JS 20.664.012 bytes, 0 recálculos/layouts na janela. Isso não mede transições nem frio/quente.
- As medidas do relatório de 2026-10-16 são preservadas apenas como históricas; não são tratadas como baseline desta branch.
- B1 foi concluído: `npm run test:ifrn` executa os 19 testes MoodleIFRN, sem selecionar o probe Android. Caracterização 1/1 e suíte 19/19 passaram.
- O build de produção passou com 0 erros e 44 warnings. Bundle inicial permaneceu em 5.245.193 bytes (5,25 MB / 870,65 kB estimados); B1 não altera runtime.
- Não apliquei B2–B8: a janela CDP foi passiva e não validou pt-BR dentro de curso, transições repetidas, listeners, interceptação nem ciclos de memória. Parei antes das mudanças de runtime para não alterar comportamento sem caracterização suficiente.
- B9 fica somente como proposta; nenhum diff B9 foi aplicado. Não usei `git add` nos relatórios, stash, nem no diretório `suap-auth-service-Teste-Mobile/`; não houve push.

## 2. Condições e segurança

- Estado antes da edição: `git status --short` mostrou `?? .analise/` e `?? suap-auth-service-Teste-Mobile/`; `git stash list` mostrou um stash WIP preexistente. O stash não foi aplicado nem alterado.
- ADB confirmou dispositivo conectado. Pacote `com.moodle.moodlemobile`; processo/socket foram usados apenas para encaminhar CDP local. O forward `tcp:9222` foi removido ao final.
- Build Android: `IONIC_CONFIG_DIRECTORY=/tmp/moodleifrn-ionic-config NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/ionic cordova build android --debug --no-interactive`; Gradle terminou `BUILD SUCCESSFUL`. APK instalado por `adb install -r`; monkey abriu o app. Não houve limpeza de dados, logout, navegação a curso ou ação acadêmica.
- CDP selecionou `/login/painel` sem ler texto, dados de perfil ou respostas. Captura passiva: 15.000 ms, zero solicitações/bytes concluídos, 1.343 nós, heap JS 20.664.012 bytes. Não salvei HAR/trace/screenshot. Um launcher `monkey` imprimiu avisos de tombstones; processo do app permaneceu ativo. Não interpretei esses avisos como falha do app sem diagnóstico adicional.
- O build usou limite Node de 3 GiB; nenhum servidor de desenvolvimento foi iniciado. Rede do aparelho não foi alterada.
- Nenhum comando Docker, instalação, patcher ou endpoint real foi executado. Nenhum arquivo-fonte em `src/MoodleIFRN` ou no núcleo foi alterado.

## 3. A — lacunas de medição do aparelho

| Item | Resultado desta Fase 2 | Evidência / motivo |
|---|---|---|
| A1 — pacote, PID, socket, forward e alvos CDP | **MEDIDO** | `adb devices -l` reconheceu aparelho; pacote e socket WebView confirmados; CDP listou `/login/painel` e `blank`; forward temporário removido. Identificadores do device omitidos. |
| A2 — Marketplace → Painel → Curso → voltar, document/hash e tempos | **NÃO MEDIDO** | Nenhuma transição foi executada nem document request contado. Uma sessão passiva no painel não substitui 5 execuções. |
| A3 — requests/bytes por domínio, jsDelivr e VLibras | **PARCIAL — MEDIDO** | Janela 15 s na tela do painel do APK atualizado: 0 requests / 0 bytes concluídos. Sem navegação, não valida tráfego inicial, jsDelivr ou VLibras. |
| A4 — long tasks, CPU, layout/paint, recálculo e custo do CSS | **PARCIAL — MEDIDO** | `Performance.getMetrics`: 0 layout/recalc/script na janela parada; não foram ativados observadores de long task/tracing e não se abriu curso. Limite de 50 ms é referência geral. |
| A5 — 20 ciclos, GC, heap, DOM e listeners | **PARCIAL — MEDIDO** | Uma leitura: heap JS 20.664.012 bytes, 1.343 nós. Nenhum GC forçado, comparação ou ciclo de navegação; listeners não contados. |
| A6 — offline, rede lenta, 401/403/500/JSON inválido | **NÃO MEDIDO** | Rede não alterada e Fetch interception não habilitada. |
| A7 — voltar, pause/resume e listeners | **NÃO MEDIDO** | Não houve acionamento de voltar/pause/resume nem contagem de listeners. |
| A8 — abrir um curso por ambiente | **NÃO MEDIDO** | Nenhum curso foi aberto; nenhum dado acadêmico alterado. |

### Tabela BASELINE

Medições pontuais do dispositivo e suas limitações constam em [baseline.md](/home/matheusluiz/mobileapp-moodle/.analise/fase2/baseline.md). Não extrapolei a janela ociosa para transições ou ciclos.

| Métrica | Antes (Fase 1) | Depois (Fase 2) | Condição |
|---|---:|---:|---|
| Bundle inicial produção | 5,25 MB / 870,65 kB estimados | 5.245.193 bytes / 5,25 MB / 870,65 kB estimados | MEDIDO no host; mesmos assets hashed e totals. Histórico de aparelho era build debug e não comparável. |
| Marketplace → Painel / Curso → voltar | NÃO MEDIDO pela Fase 1 automatizada; há apenas histórico antigo de Document ao entrar no painel | NÃO MEDIDO | Aparelho conectado, mas nenhuma transição executada. |
| Requisições e bytes por tela | NÃO MEDIDO | Painel ocioso: 0 requests / 0 bytes em 15 s | Janela CDP não incluiu navegação. |
| Long tasks / scripting / layout / paint / recálculo CSS | NÃO MEDIDO | Parcial: métricas ociosas sem layout/recalc/script | Não habilitados trace/long-task; curso não aberto. |
| Heap / DOM / listeners | NÃO MEDIDO em ciclos com GC; relatório antigo tinha três ciclos sem GC | Parcial: heap 20.664.012 bytes; 1.343 nós; listeners não medidos | Uma leitura, sem GC e sem ciclo. |
| Testes MoodleIFRN | 19 testes diretos passaram na Fase 1 | `npm run test:ifrn`: 19/19; caracterização: 1/1 | MEDIDO, fixtures locais. |

## 4. Mudança aplicada — B1

**B1 — MEDIDO/LIDO, concluído.** Acrescentei `test:ifrn` em `package.json:35`:

```json
"test:ifrn": "node --test \"src/MoodleIFRN/tests/*.test.cjs\" \"src/MoodleIFRN/tests/*.test.mjs\""
```

Node 22 expandiu os dois glob patterns e executou somente `*.test.cjs`/`*.test.mjs`; o probe `painel-first-paint.android.mjs` não corresponde aos padrões.

Antes da mudança, o teste de caracterização `node --test .analise/fase2/B1-characterization.test.cjs` confirmou a existência de 19 arquivos de teste e excluiu o probe Android; passou 1/1. Depois da mudança, `npm run test:ifrn` passou 19/19, 0 falhas, 0 cancelados/ignorados. O comando de suíte levou 944,129 ms nesta execução; é duração da suíte local, não performance do app.

Build obrigatório depois de B1:

```bash
NODE_OPTIONS=--max-old-space-size=3072 NODE_ENV=production ./node_modules/.bin/ng build --configuration=production --output-path=/tmp/moodleifrn-fase2-b1 --stats-json --delete-output-path=false --progress=false
```

Resultado: exit code 0; `stats.errorsCount = 0`, `stats.warningsCount = 44`; CLI reportou total inicial de 5,25 MB e 870,65 kB estimados. `stats.json` somou 5.245.193 bytes nos quatro assets iniciais. O build repetiu warning de budget de 5 MB excedido por 245,19 kB e avisos Browserslist já vistos na Fase 1. B1 não mudou o bundle.

## 5. B2–B8: decisão de parada

**B2–B8 — NÃO APLICADOS.** A ordem exige prova de que o import dinâmico do idioma saiu do chunk inicial e que pt-BR continua aplicado antes do conteúdo nativo do curso, com reteste no dispositivo quando houver efeito runtime. Sem aparelho conectado, não há como garantir comportamento observável; parei antes de B2 e não avancei para mudanças mais arriscadas.

| Item | Estado | Motivo/evidência |
|---|---|---|
| B2 — idioma lazy | NÃO APLICADO | Build atual confirma baseline 5.245.193 bytes; não é possível testar ordem de idioma no WebView. |
| B3 — decompor autenticação/painel e `renderCurso` | NÃO APLICADO | Fluxos de autenticação e render não devem ser reestruturados sem a etapa B2, caracterização específica e validação no app. |
| B4 — extrair serviços de `MoodleSiteService` | NÃO APLICADO | Não iniciar mudança arquitetural grande sem baseline de runtime e testes de caracterização de cada caso de uso. |
| B5 — classificar 26 catches e logs | NÃO APLICADO | A contagem é da análise estática da Fase 1; a classificação/telemetria pode alterar resultados e não foi validada em runtime. |
| B6 — target origin explícito no postMessage | NÃO APLICADO | A Fase 1 constatou wildcard com validação de `source` e `origin` no receptor; sem reteste da ponte no app, mantive o comportamento. |
| B7 — teardown teclado/viewport/hashchange | NÃO APLICADO | Sem contagem A5 não há evidência de que listeners acumulem por reinicialização. |
| B8 — onerror/timeout VLibras | NÃO APLICADO | Sem WebView e sem interceptação de recursos não medi a falha nem o timeout; não introduzi fallback não caracterizado. |

## 6. B9 — propostas apenas, sem aplicar

As linhas abaixo são propostas para decisão; não foram editadas.

### CSP de produção

`src/MoodleIFRN/mobilemoodle/index.html:13` permite loopback `127.0.0.1:8000` e `localhost:8000` em `connect-src`. Proposta condicional: gerar CSP diferente para build de desenvolvimento e de produção; remover loopback apenas do artefato de produção após confirmar que nenhum fluxo oficial depende dele. Risco: quebrar integração demo/local se a distinção de ambiente não for configurada.

```diff
- connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 https://suap.ifrn.edu.br ...
+ connect-src 'self' https://suap.ifrn.edu.br ...
```

### Exibição de matrícula/login em divergência

`src/MoodleIFRN/moodle-open-course/moodle-open-course.html:55-65` mostra identificadores disponíveis no aviso de conta divergente. Proposta para decisão de produto: substituir os valores completos por uma mensagem genérica (“a conta autenticada é diferente da conta do Painel”) e deixar recuperação pelo login principal; se suporte exigir conferência visual, exibir apenas forma mascarada depois de teste de usabilidade/privacidade. Nenhum dado real foi lido ou salvo nesta Fase 2.

```diff
- <dd>{{ issue.expectedLogin || 'Não informado pelo Painel' }}</dd>
- <dd>{{ issue.actualLogin || 'Não identificada' }}</dd>
+ <dd>Conta do Painel</dd>
+ <dd>Conta autenticada diferente</dd>
```

### Budget de bundle

`angular.json:84-89` hoje avisa em 5 MB e falha em 20 MB; build atual está em 5.245.193 bytes. Proposta: manter warning em 5 MB e, depois que lazy-loading atingir <=5 MB de baseline, reduzir `maximumError` para 10 MB (aproximadamente 1,9× o bundle atual) para impedir crescimento descontrolado. Risco: budget de 10 MB ainda permite quase dobrar o download inicial; time deve aprovar o ponto de corte.

```diff
- "maximumError": "20mb"
+ "maximumError": "10mb"
```

### CSS do curso sob demanda

`moodle-course.scss` está no array global `styles` e o build mede esse CSS entre os estilos iniciais. Proponho não preparar diff executável até A4 medir recalculação e até se confirmar um hook de entrada/saída do curso nativo. Remover o estilo global sem substituto pode quebrar o tema ou causar flash; não existe evidência para afirmar ganho agora.

## 7. Hipóteses da Fase 1 após a tentativa no aparelho

| Hipótese | Estado após esta Fase 2 |
|---|---|
| `ifrn-language.ts` entra no bundle inicial | **CONFIRMADA no build do host; não alterada.** Stats atual tem os mesmos 5.245.193 bytes iniciais. A nova verificação de ordem pt-BR em aparelho continua NÃO MEDIDA. |
| Painel recarrega seu documento ao abrir; navegação Angular de curso não recarrega | **LIDO como histórico**, relatório de aparelho anterior reporta Document ao entrar no painel e não ao navegar páginas Angular (`analise-aparelho/RELATORIO-APARELHO.md:90-91`). **NÃO RECONFIRMADA nesta sessão.** |
| 40+ assets locais; jsDelivr ausente | **LIDO como histórico** (`:90-93,110-111`); **NÃO RECONTADO** no aparelho atual. |
| Requests de AVA e nenhum CDN | **LIDO como histórico**, sem URL query/cabeçalhos persistidos neste relatório (`:90-93`); **NÃO RECONFIRMADO**. |
| Java Heap cresce em ciclos | Histórico mede crescimento após 3 ciclos sem coleta de GC (`:98-104`). **INCONCLUSIVO como vazamento**; 20 ciclos/GC seguem necessários. |
| B1 deve executar 19 testes sem Android probe | **CONFIRMADA/MEDIDA**: caracterização 1/1 e `npm run test:ifrn` 19/19. |

## 8. Backlog restante

### Fazer agora

1. Reconectar Moto G20 e fechar A1–A8 com dados sanitizados — maior lacuna, esforço M. Sem dispositivo, não há ação segura agora.
2. Após A2/A3, testar B2 isoladamente e comparar stats pré/pós — impacto potencial de até 191.687 bytes de módulo no chunk inicial, esforço M; comprovar idioma no curso antes de manter.

### Fazer depois

3. Caracterizar cada operação de sessão/curso e então avaliar B3/B4 em commits pequenos — impacto estrutural indicado pelo AST da Fase 1, esforço G.
4. Medir A5 e classificar cada catch antes de B5/B7 — não alterar estado global por contagem estática, esforço M.
5. Validar bridge e falhas VLibras no WebView antes de B6/B8 — esforço P/M.

### Decidir com o time

6. Aprovar CSP de produção sem loopback, política de identidade no aviso e budget de erro de 10 MB.
7. Só decidir CSS lazy depois de medir recálculo em aparelho e identificar lifecycle hook nativo correto.

## 9. Comandos e saídas relevantes

| Comando | Resultado |
|---|---|
| `git status --short; git stash list; git branch --show-current; git log -1 --oneline` (antes de mudar) | `?? .analise/`; `?? suap-auth-service-Teste-Mobile/`; stash WIP existente; base `release/2.0.1` / `e211dc4e4`. |
| `adb devices -l` (primeira execução) | Daemon não conseguiu iniciar no sandbox (`Operation not permitted`). |
| `adb devices -l` (execução autorizada) | Um dispositivo `device`, modelo Moto G20/Android 11; serial omitido. |
| `adb shell pm list packages \| grep -i moodle`; `pidof`; socket em `/proc/net/unix` | Pacote `com.moodle.moodlemobile`; processo e socket confirmados (PID omitido). |
| `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`; CDP `/json/list` | Alvos locais `/login/painel` e `blank`; forward removido no final, `adb forward --list` vazio. |
| `Performance.getMetrics` via CDP, janela de 15.000 ms no painel aberto | 0 requests, 0 bytes concluídos; 1.343 nós; heap JS 20.664.012 bytes; layout/recalc/script 0. Medida única, tela ociosa. |
| `IONIC_CONFIG_DIRECTORY=/tmp/moodleifrn-ionic-config NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/ionic cordova build android --debug --no-interactive` | `BUILD SUCCESSFUL`; APK gerado em `platforms/android/app/build/outputs/apk/debug/app-debug.apk`; chunk inicial principal 4,30 MB. |
| `adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk` | `Success`; dados do app preservados. Processo ativo depois de abrir. |
| `node --test .analise/fase2/B1-characterization.test.cjs` | 1 teste, 1 passou, 0 falhas. |
| `node --test "src/MoodleIFRN/tests/*.test.cjs" "src/MoodleIFRN/tests/*.test.mjs"` | 19 testes, 19 passaram, 0 falhas. |
| `npm run test:ifrn` | Mesmo resultado 19/19; duração 944,129 ms. |
| Build de produção na seção 4 | exit 0; `stats.errorsCount=0`, `stats.warningsCount=44`; assets iniciais `4.301.332 + 866.952 + 57.576 + 19.333 = 5.245.193` bytes. CLI: 5,25 MB / 870,65 kB estimados. |
| `git diff --check -- package.json`; JSON parse do `package.json` | Sem whitespace error; JSON válido. |
| `git log --oneline release/2.0.1..HEAD` | `03ed25b44 test(ifrn): add isolated Node test command`. |
| `git diff --stat release/2.0.1...HEAD` | Uma linha em `package.json` (1 insertion). |
| `git status --short` final | esperado: `?? .analise/`, `?? suap-auth-service-Teste-Mobile/`; nenhuma alteração versionada pendente. |
| `git stash list` final | stash preexistente intacto. |

## 10. Autoverificação

- **Arquivos:linha:** citações do código e do relatório de aparelho foram verificadas com `sed -n` nas faixas indicadas; nenhuma linha com dado de conta foi reproduzida.
- **Números:** contagem de testes vem do runner; tamanho inicial vem de `stats.json`/saída CLI; históricos de memória/navegação estão identificados como dados do relatório de 16/10, não desta execução.
- **Rótulos:** achados/mudanças usam MEDIDO, LIDO, INFERIDO ou NÃO VERIFICADO/NÃO MEDIDO; histórico é explicitamente separado.
- **Git:** branch de trabalho criada; commit contém só `package.json`. `release/2.0.1` não recebeu commit nem checkout de retorno. Stash e diretório não rastreado FastAPI preservados; nenhum `reset`, `clean`, rebase ou push.
- **Conta:** sem requisições próprias ao SUAP/AVA; sem login, logout, curso ou ação de escrita; nenhuma resposta ou conteúdo pessoal foi lido ou salvo. Não foram gerados screenshot, trace, HAR ou logcat.
- **Rede do aparelho:** Wi-Fi/dados não foram alterados; estado não precisou de restauração.
- **Processos:** build finalizado; servidor não iniciado; forward CDP temporário removido. Processo do app permaneceu ativo.
- **NÃO MEDIDO:** A2 (transições), A6 (falhas simuladas), A7 (back/resume), A8 (curso), long tasks e 20 ciclos com GC. A3/A4/A5 tiveram apenas leituras pontuais ociosas, descritas na tabela.
