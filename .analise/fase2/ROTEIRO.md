# Roteiro do coletor CDP Android

Use Node 22; não há dependências novas. Faça as verificações antes de iniciar qualquer navegação. O coletor grava somente URLs sanitizadas, contagens, hosts e métricas numéricas.

## 0. Verificações antes de coletar

Na raiz do repositório, rode nesta ordem:

```bash
node --check .analise/fase2/coletor-cdp-aparelho.mjs
node .analise/fase2/coletor-cdp-aparelho.mjs --self-test
node .analise/fase2/coletor-cdp-aparelho.mjs --preflight
```

O preflight só consulta ADB, cria um forward temporário, lê `/json/list` e remove o forward criado. Não abre o app, não navega nem injeta scripts. Continue somente quando aparecer `Pronto para coletar.`. Se a porta `tcp:9222` estiver ocupada por um forward obsoleto confirmado, em outro terminal rode `adb forward --remove tcp:9222` e execute o preflight novamente. Não remova outros forwards.

## 1. Calibração para automação

Ative **Opções do desenvolvedor → Localização do ponteiro** no Android. Anote as coordenadas exibidas ao tocar manualmente em uma área segura do botão de Painel, no cartão do curso que será apenas aberto, e em uma área sem ação acadêmica da tela usada no teste de vazamento. Preencha `calibracao.json` com esses valores em pixels, mantendo `tela.largura` e `tela.altura` iguais ao tamanho reportado pela calibração. O arquivo inicial tem os três pontos como `null`, então o modo automático se recusa a iniciar até ser preenchido. Não escolha coordenadas de inscrição, envio, edição, exclusão, avaliação ou perfil.

O modo exige que o operador digite exatamente `SIM` antes do primeiro toque e imprime os pontos e a quantidade de toques prevista. Qualquer outra resposta cancela sem tocar.

## 2. Seis rodadas Marketplace → Painel → curso → Painel

Deixe o app aberto, logado e sempre no Marketplace antes de iniciar. A coleta não limpa cache nem garante cache frio. Use o mesmo curso já acessível e não interaja dentro dele.

1. Em outro terminal, rode `node .analise/fase2/coletor-cdp-aparelho.mjs`.
2. Na rodada 1, marque o Marketplace com `u` + Enter quando estiver utilizável. Toque uma vez para abrir o Painel e marque `u` quando estiver utilizável.
3. Toque uma vez no mesmo cartão de curso e marque `u` quando o curso estiver utilizável. O curso ou o SSO pode aparecer no terminal como `alvo extra`; aguarde a linha do alvo e use `u` quando a tela correspondente estiver pronta.
4. Pressione Voltar do Android uma vez para retornar ao Painel e marque `u`.
5. Para começar cada uma das rodadas 2–6, volte ao Marketplace pelo fluxo normal, marque `u` quando estiver utilizável e repita os passos 2–4. Cada tela fica marcada uma vez. Na rodada 6, depois de marcar o retorno ao Painel, pressione Enter vazio no terminal do coletor para encerrar.

A primeira tela começa no Marketplace. Não confirme inscrição, envio, alteração de perfil, nota ou outra ação acadêmica. A marcação `u` é manual e inclui o tempo de reação. Durante a gravação, o coletor procura novos alvos CDP a cada segundo e identifica cada transição, request e long task com o alvo e sua URL sanitizada.

### Execução automatizada

Depois de preencher e conferir `calibracao.json`, rode primeiro uma rodada de teste:

```bash
node .analise/fase2/coletor-cdp-aparelho.mjs --auto=rodadas --rodadas=1
```

Se o fluxo terminar corretamente, rode as seis rodadas:

```bash
node .analise/fase2/coletor-cdp-aparelho.mjs --auto=rodadas
```

Comece sempre no Marketplace. O script toca no Painel, no cartão configurado e usa Voltar; dentro do curso não toca em mais nada. A tela pode surgir em um `alvo extra`. Antes e depois dos toques, confere as rotas sanitizadas e aborta se detectar rota bloqueada ou qualquer POST. A heurística de pronta exige 1000 ms sem requests em andamento e variação de DOM até 2%, com timeout de 20 s; ela não equivale à marcação manual `u`.

## 3. Modo de vazamento — A5

Com o app numa tela estável, execute em outro terminal:

```bash
GC=1 LEAK=1 node .analise/fase2/coletor-cdp-aparelho.mjs
```

Digite `c` + Enter uma vez para o baseline. Depois complete 20 ciclos de ida e volta entre as mesmas duas telas, sem acionar ações acadêmicas, e digite `c` + Enter no fim de cada ciclo. São **21 marcações `c`** no total. Use `u` quando também quiser marcar uma tela utilizável. Sem 21 amostras, o relatório diz `amostra insuficiente (<20 ciclos)`; mesmo com 21, a variação não confirma nem descarta vazamento sem baseline repetido.

Para a sequência automatizada do modo de vazamento, use:

```bash
node .analise/fase2/coletor-cdp-aparelho.mjs --auto=vazamento
```

Esse modo ativa GC/LEAK internamente, registra o baseline e executa 20 ciclos com o ponto `ida`. Faça o teste somente entre telas estáveis e sem interagir com ações acadêmicas.

## 4. Encerramento e arquivos

O coletor gera o próximo par livre `medicao-NN.json` e `medicao-NN.md` dentro de `.analise/fase2/`, e remove o forward que criou. Em outro terminal, confirme:

```bash
adb forward --list
```

Não deve restar `tcp:9222` criado pela coleta. Se sobrar um forward que você confirmou ser obsoleto, remova somente `tcp:9222` em outro terminal com `adb forward --remove tcp:9222`. Nunca digite `rm` ou comandos `adb` no terminal interativo do coletor; use outro terminal. Não remova forwards de outras sessões.

## Privacidade e limites

- O JSON não guarda query, fragmento bruto, headers, cookies, tokens, corpos, texto da página, IDs de alvos/frame ou identificadores numéricos de caminho. Paths, hosts e URLs dos alvos são sanitizados antes de salvar ou exibir.
- As conexões extras podem falhar ou não representar a WebView visível. Verifique `Novo alvo detectado` e `Alvo encerrado`; conexão e cobertura de alvos extras só ficam confirmadas durante uma navegação real.
- O trace pode não estar disponível na versão da WebView. Não há throttling artificial de CPU ou rede.
- Long tasks anteriores ao início ficam em `longTasks.preGravacao` e não entram nas transições.
- A contagem instrumentada não reflete remoção por `AbortSignal` nem listeners `once`; prefira os snapshots do DOMDebugger.
- `u` mede a marcação manual e inclui tempo de reação; não é um TTI automático. Requests e hosts contam somente depois do começo da gravação.
