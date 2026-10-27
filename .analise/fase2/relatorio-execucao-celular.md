# Relatório da execução no celular

**Data:** 27/10/2026  
**Projeto:** Mobile Moodle / AVA IFRN  
**Branch:** `refactor/ifrn-clean-arch` (base `release/2.0.1`)  
**Dispositivo:** Moto G20, Android 11, conectado por USB. O serial foi omitido.

## Resumo

O build Android debug foi gerado, instalado e aberto no aparelho. A instalação foi feita com `adb install -r`; o app manteve seus dados locais. A WebView foi encontrada na rota local `/login/painel` depois de abrir o app.

Uma captura CDP passiva de 15 segundos nessa tela registrou zero requisições e zero bytes concluídos durante a janela. Ela também retornou 1.343 nós DOM e `JSHeapUsedSize` de 20.664.012 bytes. Esses valores são uma leitura pontual da tela parada: não representam o tempo de abertura do painel, não medem o curso e não permitem afirmar ausência de tráfego no carregamento inicial.

Não foi aberto curso nem feita ação na conta. As medições de transições, CDN, erros de rede, long tasks e ciclos de memória continuam pendentes.

## Procedimento executado

1. Confirmei o aparelho em `adb devices -l`, identifiquei o pacote `com.moodle.moodlemobile`, o processo e o socket WebView. Os identificadores técnicos do aparelho e o PID não foram guardados neste relatório.
2. Encaminhei temporariamente o socket WebView à porta local 9222 e consultei os alvos CDP. A tela do app estava em `/login/painel`; havia também um alvo `blank`.
3. Gerei o APK com o comando abaixo. O hook Gulp terminou e Gradle informou `BUILD SUCCESSFUL`.
4. Instalei o APK com `adb install -r` e abri o app. O processo continuou ativo e a WebView voltou à rota `/login/painel`.
5. Ativei `Network` e `Performance` via CDP por 15.000 ms na página do painel. A coleta ignorou conteúdo, headers, texto, query strings e corpos de resposta; imprimiu somente contagens agregadas e métricas numéricas.
6. Removi o encaminhamento CDP e confirmei que `adb forward --list` ficou vazio.

### Comando de build

```bash
IONIC_CONFIG_DIRECTORY=/tmp/moodleifrn-ionic-config \
NODE_OPTIONS=--max-old-space-size=3072 \
./node_modules/.bin/ionic cordova build android --debug --no-interactive
```

APK gerado em:

```text
platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

O relatório do build mostrou chunk principal inicial de 4,30 MB. Esse número é o bundle bruto exibido pela compilação Cordova debug; não equivale ao tamanho total do APK nem ao bundle transferido em produção.

### Instalação

```bash
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Resultado observado: `Success`.

## Resultados observados

| Medida | Resultado | Limite da evidência |
|---|---:|---|
| Build Cordova Android debug | `BUILD SUCCESSFUL` | Build de depuração; não é publicação de produção. |
| Instalação no aparelho | `Success` com `-r` | Atualização preservando os dados locais. |
| Rota local depois de abrir | `/login/painel` | Não confirma autenticação upstream nem carregamento do curso. |
| Janela CDP | 15.000 ms | Uma amostra passiva, sem throttling artificial. |
| Requests iniciados na janela | 0 | Não inclui requests ocorridos antes de habilitar CDP. |
| Bytes concluídos na janela | 0 | Soma de `Network.loadingFinished.encodedDataLength` durante a janela. |
| Nós DOM | 1.343 | Leitura única da página; sem comparação antes/depois. |
| Heap JavaScript | 20.664.012 bytes | Leitura única; sem forçar GC. |
| Contadores de layout e recálculo | 0 durante a janela | A tela ficou ociosa; não mede custo de navegação. |
| Contador de script do Performance | 0 durante a janela | Métrica pontual fornecida pelo CDP. |

## Avisos e ressalvas

- O build avisou que alguns navegadores listados no Browserslist estão fora do suporte desta versão do Angular, incluindo entradas antigas de Chrome e uma entrada Android futura. A compilação ainda terminou com sucesso.
- Gradle avisou que a versão do Android Gradle Plugin em uso foi testada até `compileSdk` 35, enquanto o projeto usa `compileSdk` 36. A compilação terminou com sucesso; isso fica registrado como aviso de compatibilidade.
- O comando `monkey` usado para abrir o app exibiu notificações de tombstones no dispositivo. O processo do app permaneceu ativo e a rota do painel apareceu no CDP. Não coletei nem analisei tombstones, portanto não atribuo esses avisos a uma falha específica do app.
- A instalação não limpou dados, não houve logout e não alterei Wi-Fi ou dados móveis.
- Não fiz requests próprios para SUAP ou AVA, nem registrei tokens, cookies, credenciais, matrícula, nome, notas, headers, corpos, screenshots ou HAR.

## O que esta execução não mediu

| Item | Estado | Motivo |
|---|---|---|
| Marketplace → Painel, curso, retorno ao painel e tipo de navegação | **NÃO MEDIDO** | Não executei transições; sem amostras quentes/frias ou classificação de navegação `Document`/rota. |
| Requisições de carregamento inicial e agrupamento por host | **NÃO MEDIDO** | CDP foi habilitado depois da abertura da tela e a janela medida ficou ociosa. |
| jsDelivr e VLibras | **NÃO MEDIDO** | A janela ociosa não confirma presença nem ausência no carregamento. |
| Long tasks acima de 50 ms | **NÃO MEDIDO** | Não instalei observador `longtask` nem gravei trace. 50 ms é referência geral, não resultado do app. |
| Custo de `moodle-course.scss` e abertura de curso | **NÃO MEDIDO** | Nenhum curso foi aberto. |
| Heap/DOM/listeners com 20 ciclos e GC | **NÃO MEDIDO** | Só houve leitura pontual; sem `HeapProfiler.collectGarbage`, ciclos ou contagem de listeners. |
| Offline, lentidão, 401, 403, 500 e JSON inválido | **NÃO MEDIDO** | Não alterei a rede do aparelho nem habilitei interceptação Fetch. |
| Back, pause/resume e cursos por ambiente | **NÃO MEDIDO** | Não interagi com essas funções. |

## Estado do repositório

Esta execução não alterou código de produção. A branch permaneceu `refactor/ifrn-clean-arch`; o commit desta branch continua sendo `03ed25b44 test(ifrn): add isolated Node test command`. `git diff --stat release/2.0.1...HEAD` permanece em uma inserção no `package.json`. O estado não rastreado `?? .analise/` e `?? suap-auth-service-Teste-Mobile/` foi preservado. O forward CDP foi removido.

## Conclusão

O APK de debug foi compilado e executado no Moto G20 conectado, e o app abriu o painel preservando os dados locais. A captura passiva confirma apenas o estado ocioso da WebView. Não há evidência nesta rodada para concluir sobre velocidade de transição, acesso a cursos ou comportamento de rede durante a navegação.
