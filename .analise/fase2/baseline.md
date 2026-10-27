# Baseline Fase 2 — dispositivo e build

**Data da tentativa:** 2026-10-27  
**Branch:** `refactor/ifrn-clean-arch`  
**Base:** `release/2.0.1` em `e211dc4e4`.  
**Condição informada pelo pedido:** Moto G20 / Android 11 por USB.  
**Condição observada nesta sessão:** ADB reconheceu um Moto G20/Android 11; o APK debug atual foi instalado com `adb install -r` e aberto. Sem throttling artificial. Dados do app foram preservados.

## Baseline atual

| Métrica | Valor atual | Condições / evidência |
|---|---|---|
| Dispositivo ADB | **Conectado** | MEDIDO por `adb devices -l`; modelo Moto G20/Android 11. Serial omitido deste relatório. |
| Pacote/processo/socket WebView | **MEDIDO** | Pacote `com.moodle.moodlemobile`; processo e socket confirmados, valores de PID omitidos. |
| CDP/forward/alvos | **MEDIDO** | CDP local acessível; alvos tinham caminhos `/login/painel` e `blank`; forward `tcp:9222` removido ao final. |
| Marketplace → Painel → Curso → voltar | **NÃO MEDIDO** | Não executei transições, portanto sem tempos nem classificação `Document`/rota. |
| Requisições/bytes por domínio | **PARCIAL: 0 / 0 bytes** | Captura CDP passiva por 15.000 ms no painel já aberto; não representa carregamento ou navegação. Nenhuma requisição própria a SUAP/AVA. |
| CDN jsDelivr / VLibras | **NÃO MEDIDO** | A captura em tela parada não confirma presença/ausência no carregamento. Histórico de 16/10 não substitui a contagem atual. |
| Long tasks, scripting/layout/paint, style recalcs | **PARCIAL** | Uma leitura de Performance: layout/recalc/script = 0 na janela ociosa. Long tasks e custo do curso não foram instrumentados. 50 ms é referência geral. |
| `moodle-course.scss` antes/depois | **NÃO MEDIDO** | Não houve abertura de curso. Bundle CSS atual é medida de build, não custo de recálculo. |
| Heap/DOM/listeners em 20 ciclos com GC | **PARCIAL** | Uma leitura: JS heap 20.664.012 bytes; DOM 1.343 nós. Sem GC, ciclos ou listeners. |
| Offline/401/403/500/JSON inválido | **NÃO MEDIDO** | Wi-Fi/dados não foram desligados; nada foi interceptado. Os testes automatizados são fixtures de unidade, não substituem A6. |
| Back/resume/pause/logcat | **NÃO MEDIDO** | Dispositivo disponível, mas não acionei esses eventos nem coletei logcat. |
| Cursos por ambiente | **NÃO MEDIDO** | Nenhum curso foi aberto nesta sessão; não houve inscrição, edição, logout ou interação real com conta. |
| Build produção inicial | **5.245.193 bytes (stats); 5,25 MB / 870,65 kB estimados para transferência (CLI)** | MEDIDO no host; 0 erros e 44 warnings. |
| Build Android debug | **BUILD SUCCESSFUL** | MEDIDO: `IONIC_CONFIG_DIRECTORY=/tmp/moodleifrn-ionic-config NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/ionic cordova build android --debug --no-interactive`; APK instalado com `adb install -r`. CLI relatou chunk inicial bruto de 4,30 MB. |
| Testes IFRN | **19/19 passaram** | MEDIDO: `npm run test:ifrn`, Node `v22.23.2`; duração reportada 944,129 ms. Além disso, caracterização local passou 1/1. |

## Histórico do relatório anterior — não usar como medida atual

`analise-aparelho/RELATORIO-APARELHO.md` registra sessão em **2026-10-16**, branch `feature/moodle-curso-ifrn`, Moto G20/Android 11 (`:3-18`). Naquela execução, o Painel gerou requests `Document` aos **16 s e 43 s** e mais de **40** downloads locais (`:90-91`). O relatório estima Java Heap de **6,480 kB para 20,816 kB** depois de apenas **3** ciclos (`:97-104`). Essas amostras não têm GC forçado/20 ciclos e pertencem a uma branch e build anteriores; portanto são só alerta histórico, não baseline antes/depois da Fase 2.

O mesmo relatório histórico afirma zero requisições jsDelivr (`:28-30,90-93`) e sucesso offline em modo avião (`:110-111`); ambos continuam sem reconfirmação atual. Não reutilizo as capturas ou logs históricos como tráfego desta sessão.

## Procedimento para completar as medidas restantes

1. O dispositivo já foi identificado e o forward removido ao fim desta rodada. Restabelecer apenas para medir e removê-lo ao final.
2. Não gravar HAR/trace bruto. Não ler headers, corpos ou identificadores da conta; persistir apenas agregados sanitizados.
3. Fazer uma rodada fria e ao menos cinco quentes para cada transição; voltar ao Painel sem sair da conta. Fazer 20 ciclos para heap/DOM/listeners, chamando `HeapProfiler.collectGarbage` antes de cada leitura.
4. Interceptar apenas respostas originadas pelo app em CDP; para offline alternar rede apenas se o aparelho estiver conectado e restaurar o estado original imediatamente.
5. Abrir no máximo um curso por ambiente, em leitura. Não tocar em envio, inscrição, notas, atividade, logout ou limpeza de dados.
