# P0.14 — Validação do login SUAP em emulador

Data: 2026-11-01  
Branch: `fix/p0-release-2.0.1`  
HEAD: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`  
APK: `.analise/correcoes-p0/p13-suap-diagnostic-20261101.apk`

## Resultado

A APK e a alteração que dispensa a consulta redundante do perfil foram verificadas localmente. Os 8 testes focados passaram. **O teste real SUAP não foi executado**, porque não há AVD nem imagem de sistema Android instalados no SDK desta máquina. Não houve instalação, inicialização de app ou autenticação no moto g(20), e nenhum login foi iniciado.

## Ambiente Android

- Android Studio presente: `261.26222.65.0-AI`.
- Android Emulator presente: `37.1.11.0`.
- Android SDK: `C:\Users\T-GAMER\AppData\Local\Android\Sdk`.
- Plataformas de build presentes: `android-35`, `android-36`, `android-37.0`.
- Build Tools presentes: `35.0.0`, `36.0.0`.
- `emulator -list-avds` não listou dispositivos virtuais.
- `system-images` não contém imagens instaladas; a pasta de AVD não contém configuração de aparelho.
- Sem uma imagem inicializável, não foi possível verificar Chrome, Android System WebView, HTTPS, InAppBrowser, conectividade ou recebimento de callback em runtime.

A consulta do SDK Manager dentro do sandbox falhou ao abrir o lock de `C:\Users\T-GAMER\.android\cli\bundles` por acesso negado. Com execução autorizada fora do sandbox, `sdkmanager --install "system-images;android-30;google_apis_playstore;x86_64"` foi encaminhado à nova Android CLI, que respondeu `Package ... not found` para cada parte do identificador legado. O comando não baixou pacote nem alterou o SDK. A nova CLI informa que o `sdkmanager` foi substituído, mas não foi possível determinar sua sintaxe de instalação nesta execução.

Configuração sugerida para reproduzir o Android 11: AVD Pixel 4 ou equivalente, imagem `Google Play x86_64`, API 30, com Google Play Services, Chrome e Android System WebView atualizados. É necessário confirmar a conectividade HTTPS e o pacote `com.android.webview`/Chrome dentro do AVD antes do teste. Para testar o deep link de app, validar também o intent filter instalado. Nenhum AVD foi criado nesta execução.

## APK

O hash solicitado foi confirmado por SHA-256:

`D09631055854BF5C849C652A9F7B448C39AF56E301F7515AA9685326E24A7025`

`aapt dump badging` confirmou:

- Package ID: `com.moodle.moodlemobile`.
- Version name/code: `5.2.1` / `52100`.
- Min SDK: 24; target SDK: 36; compile SDK: 36.
- APK debug de diagnóstico.

`apksigner verify --verbose --print-certs` confirmou assinatura v2 com um certificado. SHA-256 do certificado:

`a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`

A APK declara o esquema `moodlemobile` em intent filter browsable da `MainActivity`. As permissões e a comparação com o app instalado no telefone já estão descritas no relatório P0.13; não consultei nem alterei o telefone nesta fase. A assinatura da APK continua diferente daquela registrada para o app do moto g(20), portanto ela não deve ser instalada por cima dele.

## Fluxo SUAP e callback

O caminho que o botão atual do Marketplace chama é `MarketplaceIfrnPage.enterAva()` → `SuapEntryService.loginWithSuap()` → `PainelAvaService.authenticateWithBrowser({ readOnly: true, reuseSession: false })`. Esse último abre um InAppBrowser para a origem configurada do Painel. O OAuth institucional é iniciado pelo próprio site/Painel no navegador; o app mantém a navegação e coleta os dados permitidos da sessão web. O serviço espera a volta às origens do Painel/SUAP e não depende de um redirect URI `moodlemobile://` registrado para essa entrada.

O código reporta o caminho web como OAuth SUAP que retorna ao endpoint `/authenticate/` do Painel. Não foi consultado cadastro OAuth institucional nem feita requisição autenticada; portanto não afirmo a configuração atual do servidor além do fluxo que o app implementa. Não foi inventado nem alterado redirect URI.

Há um caminho separado em `SuapEntryService.login()`: consulta os provedores do Moodle, encontra `suap`, chama `CoreLoginHelper.openBrowserForOAuthLogin()` e define um `redirectPath` interno do app. Esse caminho usa a integração OAuth/deep link do núcleo Moodle. A APK declara o esquema `moodlemobile`; não foi possível comprovar a entrega do callback em runtime sem AVD. O caminho alternativo não é o método chamado pelo botão atual `enterAva()`.

A ausência de AVD impede confirmar em prática se a página SUAP abre, se as respostas HTTPS carregam no WebView, e se o retorno web chega ao Painel. Para a entrada principal, o callback esperado é web para o domínio do Painel; para o caminho nativo alternativo, é o esquema/app callback já configurado pelo Moodle. Não é seguro inferir a configuração institucional ao vivo sem executar o fluxo.

## Correção da consulta redundante e testes

A correção existente deixa uma marca de perfil fresco depois de validar proprietário e identidade do perfil/dashboard; a marca dura no máximo 60 segundos, é vinculada ao proprietário e é consumida uma única vez pelo refresh posterior. A evidência automatizada exercita o `commit()` do serviço e o método real de refresh extraído do serviço, incluindo o cenário em que a atualização dispensada não abre um segundo InAppBrowser. Isso comprova a lógica local testada, não a resposta em runtime do SUAP.

Executado nesta fase:

```text
node --test src/MoodleIFRN/tests/painel-login-after-course.test.cjs src/MoodleIFRN/tests/suap-login-telemetry.test.cjs
8 testes aprovados; 0 falhas; 0 skip; 0 todo.
```

Também foram executados `aapt dump badging`, `aapt dump xmltree`, `apksigner verify --verbose --print-certs` e `Get-FileHash -Algorithm SHA256`. A inspeção do manifesto confirmou `com.moodle.moodlemobile` e o intent filter `moodlemobile`.

Não foram coletados tempos de login ou marcadores `[IFRN-SUAP-TIMING]` reais. Não houve dados reais de autenticação para provar ao vivo a ausência da segunda consulta, o carregamento do Painel, a listagem de disciplinas ou a abertura de cursos Acadêmico/Presencial. A evidência disponível para a consulta redundante continua sendo os testes automatizados e o bundle já verificado no relatório P0.13. Não se afirma ganho percentual de desempenho.

## Próximo teste seguro

1. Instalar uma imagem API 30 `Google Play x86_64` e criar um AVD novo e sem dados pessoais.
2. Confirmar que o AVD é o único alvo conectado, validar Chrome/WebView e HTTPS, e inspecionar novamente o package e esquema da APK.
3. Instalar a APK somente no AVD. O package coincide com o app, mas os dados do AVD são isolados do telefone físico.
4. O estudante deve autenticar-se manualmente na página oficial SUAP; não automatizar senha nem coletar cookies/tokens.
5. Coletar somente linhas `[IFRN-SUAP-TIMING]`, sem logcat amplo. Distinguir espera visível/interação humana das etapas observadas pelo app.
6. Confirmar retorno ao Painel, disciplinas e, separadamente, cursos Acadêmico e Presencial e retorno ao Painel. Login principal aprovado sozinho não aprova os cursos.

A instalação do APK não foi realizada nesta fase: o ambiente não dispõe de emulador inicializável. A autorização e a condição de callback para teste ficam pendentes até que haja um AVD preparado. A sessão e o aplicativo `com.moodle.moodlemobile` do moto g(20) permaneceram intocados.

## Preservação e pendências

- Nenhum APK foi recompilado ou instalado.
- Nenhum app, sessão ou dado do telefone físico foi acessado ou alterado.
- Nenhum logout, troca de conta, limpeza de dados, alteração de autenticação institucional, `src/core/`, `src/addons/`, plugins ou `release/2.0.1` foi executado.
- P0.4 permanece documentada como pendência separada e não foi investigada nesta tarefa.
- Não foi medido desempenho real; a validação Android depende de instalar uma imagem API 30 e executar o fluxo manual no AVD.

