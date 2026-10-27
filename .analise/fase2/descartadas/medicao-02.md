# Medição CDP no aparelho — medicao-02

**Início:** 2026-10-27T19:01:14.655Z  
**Duração:** 200116 ms  
**App:** `com.moodle.moodlemobile`  
**Alvo CDP:** http://localhost/[segment]/home/course/[redacted]/[segment]  
**Observação:** a primeira rodada é a rodada fria por instrução do operador; não houve limpeza de dados/cache. O tempo até conteúdo utilizável vem da marcação manual `u`, portanto inclui o tempo de reação do operador. Requests/hosts cobrem somente o intervalo gravado.

## Transições

| # | Tipo | De → para | Tempo até conteúdo utilizável | Requests | Bytes codificados | Long tasks | Heap JS (bytes) | Nós DOM |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | início | início → http://localhost/[segment]/home/course/[redacted]/[segment] | 3951 ms (marcação manual) | 0 | 0 | 5 | 28966308 | 3690 |
| 2 | rota | http://localhost/[segment]/home/course/[redacted]/[segment] → http://localhost/login/painel | NÃO MARCADO | 0 | 0 | 0 | 29222444 | 3710 |
| 3 | Document | início → about:[segment] | NÃO MARCADO | 0 | 0 | 0 | 29348340 | 3715 |
| 4 | Document | about:[segment] → http://localhost/mobilemoodle/index.html | 18058 ms (marcação manual) | 60 | 3218 | 0 | 29611180 | 4146 |

## Rede por host

| Host | Requests | Bytes codificados |
|---|---:|---:|
| cdn.suap.ifrn.edu.br | 1 | 2607 |
| localhost | 58 | 0 |
| suap.ifrn.edu.br | 1 | 611 |

## CDN

- jsDelivr: **não observado nesta captura** (0 requests).
- VLibras (vlibras.gov.br e subdomínios): **não observado nesta captura** (0 requests).
- Ausência significa apenas que não houve request ao host durante esta captura; o carregamento anterior ao início da gravação não é contado.

## Performance e listeners

- Long tasks via PerformanceObserver: 5; duração acumulada 681 ms; maior 229 ms.
- Tasks de trace acima de 50 ms: 0; 50 ms é referência geral.
- trace indisponível nesta WebView
- Contagem instrumentada: window 7; document 8.
- a contagem instrumentada não reflete remoção por AbortSignal nem listeners once; prefira a contagem por DOMDebugger.
- Performance.getMetrics foi amostrado em cada evento de navegação/rota; ver os campos por transição no JSON.

## Ciclos de memória e listeners

Modo LEAK não executado nesta gravação.

## Limitações

- O operador precisa digitar `u` e Enter quando cada tela estiver visualmente utilizável; Enter sem texto encerra a gravação.
- A instrumentação dos listeners intercepta add/remove após a injeção e não inclui os handlers anteriores. Ela não reflete remoção por AbortSignal nem listeners once; prefira a contagem por DOMDebugger.
- Long tasks e trace só cobrem períodos/contextos observados pelo alvo CDP conectado. Uma WebView separada do InAppBrowser pode aparecer em outro alvo e não será automaticamente anexada.
- O arquivo contém hosts e caminhos de navegação sanitizados; não contém query, fragmento, headers, cookies, corpo de resposta, texto da tela ou identificadores numéricos.
