# Moodle IFRN Mobile — instalação, compilação e execução

Guia para montar o ambiente do zero, gerar uma APK, atualizar uma instalação Android por USB e preparar o projeto iOS. Execute os comandos na raiz de `mobileapp-moodle`, salvo quando indicado. Os exemplos Bash servem para Linux, macOS e Git Bash. Em PowerShell, use `npm.cmd` e `npx.cmd` no lugar de `npm` e `npx`, caso a política do terminal bloqueie os atalhos `.ps1`.

A revisão de referência é `127167c87` da release, consultada em 24/11/2026. Os manifestos e scripts de build dessa revisão coincidem com os do checkout inspecionado (`b9097f633`). Escolha a branch indicada pela equipe para a sua tarefa e confira a revisão antes de compilar.

## Sumário

Use o sumário para ir ao capítulo e clique na linha abaixo do título para abrir o conteúdo. Os capítulos começam recolhidos.

- [1. Instalação de dependências](#1-instalação-de-dependências)
- [2. Preparação do repositório](#2-preparação-do-repositório)
- [3. Métodos Android](#3-métodos-android)
- [4. Android físico](#4-android-físico)
- [5. Emulador Android](#5-emulador-android)
- [6. iOS no Mac](#6-ios-no-mac)
- [7. Checklist funcional](#7-checklist-funcional)
- [8. Solução de problemas](#8-solução-de-problemas)
- [9. Referências e escopo da verificação](#9-referências-e-escopo-da-verificação)

## 1. Instalação de dependências

<details>
<summary>Ferramentas, versões e configuração no Windows, Linux e macOS</summary>

### 1.1 Ferramentas e versões

| Ferramenta | Versão para este repositório | Uso e conferência |
|---|---|---|
| Git | Versão estável suportada pelo sistema | Obrigatório para obter e identificar o código. `git --version`. |
| Node.js e npm | `package.json` exige Node `>=22.17 <23`. `.nvmrc` aponta para `lts/jod` (Node 22). Use o npm incluído no Node escolhido. | Obrigatórios. `node --version` e `npm --version`. Node 22.17.0 atende ao mínimo. Prefira um patch mantido da linha 22. |
| Gerenciador de Node | NVM para Linux/macOS ou NVM for Windows | Opcional. Use um gerenciador ou o instalador oficial da linha 22. `nvm --version` no Unix ou `nvm version` no Windows. |
| Angular e TypeScript | Angular 20.3.18, CLI 20.3.22, TypeScript 5.9.3 | Instalados pelo lockfile. `npm ls --depth=0 @angular/core @angular/cli typescript`. |
| Ionic | Framework 8.8.1, CLI 7.2.1, builder Cordova 12.3.0 | Versões locais. `npm ls --depth=0 @ionic/angular @ionic/cli @ionic/cordova-builders`. |
| Apache Cordova | CLI 13.0.0, Android 15.1.0, iOS 7.1.1 | Versões locais. `npx --no-install cordova --version` e `npx --no-install cordova platform ls`. |
| Java | JDK 17, referência do Cordova Android 15.x | Obrigatório para Android. `java -version` e `javac -version`. Use `JAVA_HOME` ou `CORDOVA_JAVA_HOME` para selecionar o JDK. |
| Android SDK | Plataforma API 36, Build Tools 36.0.0, Platform Tools e Command-line Tools | Obrigatórios para compilar, diagnosticar e instalar pelo terminal. `adb version`, `sdkmanager --list_installed` e `npx --no-install cordova requirements android`. |
| Android Studio | Meerkat Feature Drop ou edição compatível com AGP 8.10.1 | Opcional para build por CLI. Recomendado para SDK Manager, Device Manager, Logcat e assinatura. Verifique em **Help → About**. |
| Gradle | Gradle Wrapper 8.14.2, Android Gradle Plugin 8.10.1, Kotlin 2.1.21 | Disponibilize `gradle` no `PATH` para o Cordova montar o wrapper. A compilação usa a versão do wrapper gerado. `gradle --version` e `platforms/android/gradle/wrapper/gradle-wrapper.properties`. |
| Xcode e ferramentas de linha de comando | Xcode estável que suporte o macOS do Mac, o deployment target iOS 16.0, o runtime e o dispositivo que você testará | Obrigatórios para iOS. `xcode-select -p`, `xcodebuild -version`, `xcrun simctl list runtimes`. O mínimo histórico do Cordova iOS 7.x não comprova compatibilidade com um Xcode específico. |
| CocoaPods e ios-deploy | Cordova iOS 7.x documenta CocoaPods ≥ 1.8.0 e ios-deploy ≥ 1.9.2 como mínimos históricos | CocoaPods é necessário para os plugins iOS com Pods deste projeto. `ios-deploy` se aplica ao caminho CLI para o iPhone. Xcode Run pode instalar sem `ios-deploy`. `pod --version`, `ios-deploy --version`. |

O SDK 36 gera o binário Android. As imagens de Android 11 (API 30) e Android 16 (API 36) do emulador são instalações separadas. O Android mínimo declarado no app é 7.0 (API 24). A versão mínima aceita na instalação e a compatibilidade da WebView em cada aparelho devem ser avaliadas separadamente. [Cordova Android](https://cordova.apache.org/docs/en/latest/guide/platforms/android/) · [Cordova Android 15.1.0](https://cordova.apache.org/announcements/2026/07/22/cordova-android-15.1.0.html) · [Cordova iOS](https://cordova.apache.org/docs/en/latest/guide/platforms/ios/)

**Ambiente conferido nesta revisão.** Linux com Node 22.23.2, npm 10.9.8, OpenJDK 21.0.13.0.3, Gradle 8.13 disponível, ADB 36.0.0, SDK Platform 36 e Build Tools 35.0.0. `platform ls` mostrou Android **14.0.1**, também instalado em `node_modules`, enquanto o lockfile exige **15.1.0**. Ionic, Angular, Cordova CLI e o pacote Cordova iOS conferem com a tabela. A pasta `platforms/ios` e as ferramentas Apple não estavam presentes. Para reproduzir a release, prepare a plataforma Android certa com JDK 17 e Build Tools 36.0.0 em um clone separado.

### 1.2 Windows 10 e 11

1. Instale [Git for Windows](https://git-scm.com/downloads/win), com Git Bash. Instale o [Node.js](https://nodejs.org/en/download) 22 para a arquitetura da máquina ou use [NVM for Windows](https://github.com/nvm-windows/nvm). Evite dois `node.exe` concorrentes no `PATH`.
2. Instale um JDK 17, por exemplo [Temurin 17](https://adoptium.net/temurin/releases/?version=17). Instale [Android Studio](https://developer.android.com/studio/install) compatível com AGP 8.10.1 e com a sua edição de Windows. Pelo **SDK Manager**, instale Android 16/API 36, Build Tools 36.0.0, Platform Tools e Command-line Tools. AVD e imagens são opcionais para quem só usa celular.
3. Instale o [Gradle 8.14.2](https://gradle.org/releases/) e ponha o diretório `bin` no `PATH`. O caminho da SDK pode ser conferido no SDK Manager. Ajuste os dois caminhos de exemplo de JDK e Gradle para os da sua máquina. Para uso recorrente, configure as variáveis no painel de ambiente do Windows.

```powershell
git --version
# Com NVM for Windows, use PowerShell ou CMD e escolha uma versão 22.x explícita.
nvm install 22.17.0
nvm use 22.17.0
node --version
npm.cmd --version

$env:JAVA_HOME = 'C:\Dev\jdk-17'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;C:\Dev\gradle-8.14.2\bin;$env:Path"
java -version
javac -version
gradle --version
adb version
sdkmanager.bat --list_installed
```

Use `where.exe node`, `where.exe npm`, `where.exe java` e `where.exe adb` se houver mais de uma instalação. Em Git Bash, confirme `bash --version` e se as variáveis de ambiente estão disponíveis. O hook Cordova `before_plugin_add.sh` precisa de Bash. Para comandos com shell Unix, use Git Bash e, se o npm continuar invocando `cmd.exe` para os scripts, selecione Bash apenas na sessão com o comando abaixo. Em WSL, instale as dependências no ambiente Linux. Para USB, o ADB do Windows pode instalar a APK gerada após copiá-la para um caminho acessível no Windows.

```bash
export npm_config_script_shell="$(cygpath -w "$(command -v bash)")"
```

### 1.3 Ubuntu e Linux

Instale Git, certificados do sistema, `curl` e o JDK. Use o [NVM](https://github.com/nvm-sh/nvm) ou os binários oficiais do Node 22. Após instalar o NVM e abrir um terminal, selecione a linha definida no `.nvmrc`, a partir da raiz do clone, ou use a versão de exemplo. Instale Android Studio pela distribuição oficial ou as ferramentas de linha de comando da SDK. Baixe o binário do Gradle indicado na tabela e descompacte-o em `~/opt` ou ajuste o caminho conforme sua instalação. Confirme `ANDROID_HOME` no SDK Manager.

```bash
sudo apt update
sudo apt install git ca-certificates curl openjdk-17-jdk
git --version
nvm install 22.17.0
nvm use 22.17.0
node --version
npm --version

# Exemplo Ubuntu amd64. Confira o caminho em update-java-alternatives -l.
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$HOME/opt/gradle-8.14.2/bin:$PATH"
java -version
javac -version
gradle --version
adb version
sdkmanager --list_installed
```

Se `ANDROID_SDK_ROOT` estiver definido, ele precisa concordar com `ANDROID_HOME`. Para USB, confira o grupo `plugdev` e as regras udev conforme o guia Android. A virtualização (KVM, quando aplicável) é necessária para a aceleração do emulador. O Android Studio ou `sdkmanager` instala a SDK. O pacote `adb` sozinho não instala a plataforma, imagens ou Build Tools. [Dispositivo Android e regras USB](https://developer.android.com/studio/run/device) · [sdkmanager](https://developer.android.com/tools/sdkmanager)

### 1.4 macOS

Instale Git pelas Command Line Tools ou por um gerenciador de pacotes. Use NVM ou o instalador oficial para Node 22. Para Android, instale JDK 17, Android Studio/SDK e Gradle como nas outras plataformas. Para iOS, instale o **Xcode completo**, abra-o para baixar os componentes e instale CocoaPods. O [Homebrew](https://brew.sh/) é uma opção para instalar as ferramentas.

```bash
xcode-select --install
git --version
nvm install 22.17.0
nvm use 22.17.0
node --version
npm --version

# Após instalar o Xcode completo no caminho padrão, se necessário:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcodebuild -version
xcrun simctl list runtimes
brew install cocoapods
pod --version
```

Para Android no Mac, instale o JDK 17 antes de selecionar `JAVA_HOME`. Se usar Android Studio com o local padrão, a SDK fica em `~/Library/Android/sdk`. Use a arquitetura de imagem apropriada ao Mac ao criar um AVD.

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$HOME/opt/gradle-8.14.2/bin:$PATH"
java -version
gradle --version
adb version
sdkmanager --list_installed
```

De qualquer sistema Android, o equivalente no terminal ao SDK Manager é o comando abaixo. Execute-o após configurar Command-line Tools. Revise as licenças solicitadas no ambiente de desenvolvimento com `sdkmanager --licenses`.

```bash
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

[Voltar ao sumário](#sumário)

</details>

## 2. Preparação do repositório

<details>
<summary>Clonar, executar npm ci e preparar o Cordova</summary>

### 2.1 Clonar, selecionar a revisão e instalar

Em uma pasta nova, o exemplo obtém a branch de release. Se já houver um checkout com mudanças locais ou plataforma antiga, confira `git status` e `git worktree list` antes de trocar de branch. Um clone separado permite preparar a release sem sobrescrever trabalho existente. Guarde o SHA mostrado por `git rev-parse HEAD` junto da APK ou do relatório de build.

```bash
git clone --branch release/2.0.1 --single-branch https://github.com/suap-ava-suite/mobileapp-moodle.git
cd mobileapp-moodle
git branch --show-current
git rev-parse HEAD
git status --short --branch
git worktree list
node --version
npm --version
npm ci
npm run
npm ls --depth=0 @angular/core @angular/cli @ionic/angular @ionic/cli cordova cordova-android cordova-ios cross-env
npx --no-install cordova --version
```

- `npm ci` usa `package-lock.json` (formato 3) e falha se o manifesto divergir do lockfile. Substitui `node_modules` da raiz se ele existir. Por isso, use o comando em um clone preparado para compilar e preserve edições manuais de diagnóstico antes de executá-lo. `.npmrc` aplica `engine-strict=true`.
- `npm install` é apropriado para uma alteração de dependência planejada. Pode resolver versões e atualizar o lockfile. Uma falha de `npm ci` deve ser diagnosticada no Node, no registro npm e no par manifesto/lockfile da branch.
- O `postinstall` real executa `patch-package` para as correções em `patches/`, depois `npm install` em `cordova-plugin-moodleapp/`. Esse plugin tem manifesto e lockfile próprios. Confira seu resultado e revise o diff dos manifestos se houver mudanças inesperadas. As CLIs do Ionic, Angular e Cordova são locais. `npx --no-install` usa as ferramentas disponíveis e falha se estiverem ausentes.
- Nesta máquina, `du -sh node_modules cordova-plugin-moodleapp/node_modules platforms/android` mostrou `855M`, `50M` e `250M`, respectivamente, com Android 14.0.1 gerado. Reserve espaço também para `www/`, SDK, imagens e caches Gradle/Xcode. Esse inventário descreve pastas existentes. O tempo de uma instalação do zero não foi medido.

### 2.2 Scripts e hooks que entram no build

```text
TypeScript, HTML e SCSS + painel IFRN → Gulp e Angular/Ionic → www/
www/ + config.xml + plugins → Cordova prepare → plataforma nativa
Gradle no Android / Xcode no iOS → artefato da plataforma
```

| Entrada | Papel real |
|---|---|
| `npm run build:mobilemoodle` | `src/MoodleIFRN/mobilemoodle/build.mjs` recompila o painel web, o CSS e a folha de tema do Painel Angular, além de sincronizar assets Ionic e Ionicons. O Gulp padrão também executa esse builder. |
| `ionic:build:before` e `ionic.config.json` | O Ionic executa `gulp` para ambiente, idiomas, ícones e painel, e `scripts/copy-assets.js` para bibliotecas. A ordem exata dos dois ganchos é definida pela CLI. O Angular usa `app:ionic-cordova-build` e escreve em `www/`. |
| `npm run prod --prefix cordova-plugin-moodleapp` | Gera o JavaScript do plugin local Moodle usando esbuild. O hook `scripts/cordova-hooks/before_plugin_add.sh` também compila esse plugin quando ele é adicionado. |
| Cordova `prepare` | Restaura plataformas/plugins conforme o projeto, prepara a WebView, recursos e manifestos e roda os hooks `after_prepare`. `scripts/cordova-hooks/ifrn-course-sso.js` e `src/MoodleIFRN/scripts/cordova-inappbrowser-layout.js` ajustam a implementação Android de InAppBrowser quando a cópia existe. |
| `node src/MoodleIFRN/build-native.mjs --platform=android` ou `--platform=ios` | Alternativa de diagnóstico para o build **web de desenvolvimento** com dicionário IFRN em `www/assets/lang/pt-br.json`. Exige a plataforma já preparada, o módulo Moodle com `cordova.define`, a base oficial de sessão e os assets web já gerados. A chamada direta ao Angular não dispara os hooks Ionic de Gulp/cópia de assets. Depois de gerar `www/`, o `cordova build` da plataforma gera o artefato nativo. A opção `--check` só valida o dicionário. |
| `npm run patch:ifrn` | Reaplica pontos de integração durante manutenção do Moodle. Pode escrever no núcleo e em configurações da raiz. No clone da release, as integrações já estão versionadas. Se a tarefa pedir reaplicação, confira o manifesto, use um checkout dedicado e revise `git diff`. O patch experimental P0.4 não é habilitado pelo fluxo normal. |

Os plugins são declarados em `package.json` e restaurados pelo Cordova. Entre os que afetam este roteiro estão `cordova-plugin-moodleapp` (plugin local), `cordova-plugin-ifrn-customtabs` 1.0.0 (local), InAppBrowser 6.0.0-moodle.1, Ionic WebView 5.0.0-moodle.5, SQLite 7.0.0, push 4.0.0-moodle.13 e Android Insets 0.3.2. Após preparar a plataforma, `npx --no-install cordova plugin ls` mostra o que foi registrado. No Android confirme também `platforms/android/platform_www/cordova.js` e o módulo do plugin Moodle em `platforms/android/platform_www/plugins/cordova-plugin-moodleapp/www/index.js`. No iOS, os equivalentes ficam em `platforms/ios/platform_www/`.

Para reaplicar a integração em uma atualização autorizada do Moodle, use `npm run patch:ifrn` em um checkout dedicado e inspecione `git diff --stat`, `git diff` e `git diff --check` antes de compilar. Use os hooks Cordova da etapa normal para preparar a plataforma. `npm ci` já executa `patch-package` para os patches de dependências, que são outra etapa.

### 2.3 Preparação inicial do Android

Use a versão do manifesto/lockfile. Se `platform ls` já mostrar 15.1.0, pule o `platform add`. Se mostrar 14.0.1 ou outra versão, confira primeiro a origem da plataforma e prepare um clone separado com o lockfile correto. As etapas abaixo escrevem `www/`, `plugins/`, `platforms/` e outros arquivos gerados ao longo do build. No clone, a SDK e o JDK já devem estar configurados.

```bash
npx --no-install cordova platform ls
npm run prod --prefix cordova-plugin-moodleapp
# Apenas se Android ainda estiver ausente:
npx --no-install cordova platform add android@15.1.0 --nosave
npx --no-install cordova prepare android
npx --no-install cordova platform ls
npx --no-install cordova requirements android
npx --no-install cordova plugin ls
```

`config.xml` inclui o `google-services.json` versionado como recurso Android. Confira sua presença e a associação com o Package ID se o Gradle reclamar de `google-services`. Não edite o arquivo gerado do Android Studio como fonte permanente. Para iOS, veja a preparação equivalente no capítulo 6.

[Voltar ao sumário](#sumário)

</details>

## 3. Métodos Android

<details>
<summary>Gerar APK, executar pelo npm ou instalar pelo ADB</summary>

| Método | Compila código? | Gera APK? | Instala automaticamente? | Usa USB? | Atualiza alterações recentes? | Melhor utilização |
|---|---|---|---|---|---|---|
| A. Gerar APK com `ionic cordova build android` | Sim, web e nativo. | Sim, no modo APK. | Não. | Não. | Sim, recompila a árvore de trabalho atual. | Conferir, compartilhar ou instalar posteriormente um artefato específico. |
| B. `npm run prod:android` | Sim, plugin Moodle, web e nativo. | Sim, APK debug normalmente, com web de produção. | Sim, com destino disponível. | USB para celular conectado dessa forma. Emulador dispensa cabo. | Sim, recompila e instala o resultado no destino escolhido. | Ciclo de teste com dispositivo de desenvolvimento. |
| C. `adb -d install -r` | Não. | Não. | Sim, instala o arquivo indicado. | `-d` seleciona o dispositivo USB. | Só se a APK indicada já foi recompilada. | Atualizar uma instalação com um arquivo previamente conferido. |

Uma APK é o artefato instalável. Uma mudança em SCSS, HTML ou TypeScript precisa passar pelo build web e pelo empacotamento Android. Reinstalar a APK antiga reaplica o conteúdo antigo, mesmo que o código fonte tenha mudado.

### Método A — Gerar APK sem instalar

Após a preparação, faça um build com a mesma configuração web de produção usada pelo script npm, mantendo assinatura debug nativa para desenvolvimento. `cross-env` define `NODE_ENV`, `--prod` seleciona `app:ionic-cordova-build:production` e `--debug` escolhe o tipo nativo. O build executa os hooks Ionic e o `prepare`/`compile` do Cordova. Não precisa ter celular ou emulador aberto.

```bash
npm run prod --prefix cordova-plugin-moodleapp
npx --no-install cross-env NODE_ENV=production ionic cordova build android --prod --debug
```

A saída usual fica em `platforms/android/app/build/outputs/apk/debug/app-debug.apk`. Em Android Studio, abra `platforms/android` **depois** de preparar os assets com Ionic/Cordova e selecione JDK 17 para o Gradle. O Gradle `assembleDebug` apenas empacota o projeto preparado. Para mudanças no Angular ou nos assets do Painel, rode novamente o comando Ionic acima.

Para gerar APK **release**, peça explicitamente o formato APK. Com `ionic cordova`, o primeiro `--` encaminha argumentos ao Cordova, e o segundo ao builder Android. O arquivo aparece em `platforms/android/app/build/outputs/apk/release/`, frequentemente como `app-release-unsigned.apk` quando não há assinatura configurada. Verifique a saída real.

```bash
npm run prod --prefix cordova-plugin-moodleapp
npx --no-install cross-env NODE_ENV=production ionic cordova build android --prod --release -- -- --packageType=apk
```

Assine uma variante release no assistente **Build → Generate Signed Bundle / APK** do Android Studio, com a chave autorizada, ou use a configuração institucional de assinatura fora do Git. Digite senhas no assistente ou use o mecanismo seguro aprovado pela equipe. Confirme com `apksigner` antes de usar a APK. O **AAB** é um bundle usado para distribuição pelo Google Play, que produz APKs para os dispositivos. Ele fica normalmente em `platforms/android/app/build/outputs/bundle/release/` quando se escolhe `--packageType=bundle`. A instalação direta com `adb install` usa APK. [Build Android no Cordova](https://cordova.apache.org/docs/en/latest/guide/platforms/android/#building-android-apps) · [Android App Bundle](https://developer.android.com/guide/app-bundle)

### Verificar a APK, o certificado e a revisão

O `config.xml` define `com.moodle.moodlemobile`, Android `versionName` 5.2.1, `versionCode` 52100, `minSdk` 24 e `targetSdk` 36. Confira no binário, porque configurações locais de distribuição podem divergir. No Manifest gerado, `MainActivity` é a Activity com `MAIN`/`LAUNCHER`. O Java declara o pacote `com.moodle.moodlemobile`.

```bash
APK=platforms/android/app/build/outputs/apk/debug/app-debug.apk
# Linux
sha256sum "$APK"
# macOS
shasum -a 256 "$APK"
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging "$APK"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs "$APK"
```

```powershell
$apk = 'platforms\android\app\build\outputs\apk\debug\app-debug.apk'
Get-FileHash -Algorithm SHA256 -Path $apk
& "$env:ANDROID_HOME\build-tools\36.0.0\aapt.exe" dump badging $apk
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs $apk
```

Procure `package` e `launchable-activity` na saída de `aapt`. Guarde o SHA-256 da APK e o digest SHA-256 do certificado como campos separados. O prefixo histórico `7B7E050A` identifica uma APK anterior. Compare os hashes completos para saber se dois arquivos têm os mesmos bytes. A versão `5.2.1` e o código `52100` podem ser compartilhados por várias compilações.

Para rastrear mudanças recentes, registre `git rev-parse HEAD`, `git status --short` e, se aplicável, quais fontes locais entraram na build. Confira se o arquivo foi gerado pelo comando que acabou de concluir. O Android Studio **Build → Analyze APK** permite verificar `assets/www`, `cordova.js`, `cordova_plugins.js` e recursos IFRN empacotados. Ao compartilhar com a equipe, use a data, o commit, o status de alterações locais e o hash da APK. O APK pode não conter um identificador Git embutido.

### Método B — Compilar, instalar e abrir pelo npm

O `package.json` contém exatamente este encadeamento:

```bash
npm run prod --prefix cordova-plugin-moodleapp && cross-env NODE_ENV=production ionic cordova run android --prod
```

1. O plugin Moodle compila primeiro. Se falhar, o `&&` impede a etapa do Ionic.
2. A CLI Ionic 7.2.1 verifica `native-run`, plataforma e destinos. Sem seleção explícita, prioriza dispositivo físico detectado. Para emulador, solicite `--emulator` explicitamente.
3. `NODE_ENV=production` ativa o ambiente dos hooks. Ionic roda Gulp/cópia de assets e o alvo Angular de produção. O `www/` incorpora a WebView e os recursos do checkout em execução.
4. No fluxo padrão, Ionic chama `cordova build`; Cordova faz `prepare`, hooks IFRN `after_prepare` e compilação Gradle. `--prod` é o modo web. O comando não passa `--release`, portanto a variante Android usual é debug.
5. Ionic resolve a APK da variante produzida em `platforms/android/app/build/outputs/apk/`. `native-run` instala e inicia o aplicativo no alvo. Com `--no-native-run`, a CLI delega a etapa nativa a `cordova run`.

> **Operação no dispositivo.** `npm run prod:android` pode substituir e abrir o app instalado. Confira o destino, a assinatura e o estado da sessão antes de executar. Para apenas compilar, use o Método A.

```bash
# Lista os destinos sem instalar:
npx --no-install ionic cordova run android --list
# Compila, instala e abre no celular escolhido:
npm run prod:android -- --device
# Alternativa para um AVD ligado:
npm run prod:android -- --emulator
```

Se houver mais de um alvo, acrescente `--target="ID_DA_LISTA_DO_IONIC"` depois de `--device` ou `--emulator`. Use o identificador do `--list` do Ionic. O ADB usa seu próprio serial mostrado em `adb devices -l`. Rode novamente o script após alterar SCSS, HTML ou TypeScript. Arquivos locais salvos e não commitados também podem entrar na compilação. Compare a APK pelo hash quando o app instalado ainda parecer antigo.

### Método C — Instalar APK existente pelo ADB

O ADB é a ferramenta de comunicação com o Android. `-d` seleciona um único dispositivo físico conectado por USB. `install` instala a APK local indicada. `-r` solicita a substituição mantendo os dados do app instalado. Se houver vários dispositivos, troque `-d` por `-s` seguido do serial de `adb devices -l`.

Antes de atualizar, confirme **mesmo Package ID**, certificado de assinatura compatível, código de versão aceito e suporte do Android/ABI. APKs debug de computadores diferentes podem ter certificados diferentes. Para comparar com a versão instalada, `pm path` mostra os caminhos estáticos dos APKs. Se o ADB permitir, use `adb pull` com o caminho retornado que termina em `base.apk` e execute `apksigner verify --print-certs` no arquivo copiado. Compare o certificado com o da candidata. Uma APK da Play pode ter a assinatura da Play App Signing e vários splits. Se a assinatura ou versão não bater, preserve a instalação e obtenha o artefato correto com a equipe.

```bash
adb devices -l
adb -d shell pm path com.moodle.moodlemobile
adb -d shell dumpsys package com.moodle.moodlemobile
adb -d shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.moodle.moodlemobile
```

O resultado de `resolve-activity` deve identificar `com.moodle.moodlemobile/.MainActivity` nesta variante. Em `dumpsys package`, procure `versionCode`, `versionName` e `lastUpdateTime`. Depois de conferir a APK e autorizar a atualização, instale o arquivo recém compilado e espere `Success` antes de abrir o app.

```bash
adb -d install -r "platforms/android/app/build/outputs/apk/debug/app-debug.apk"
adb -d shell am start -n "com.moodle.moodlemobile/.MainActivity"
```

A opção `-r` mantém os dados quando o Android aceita a atualização. O funcionamento da sessão depende também da validade e das migrações do app. Em instalação manual de uma APK única, comparar o SHA-256 do `base.apk` retornado com o da candidata distingue duas builds com a mesma versão. Se houver splits, use também metadados da variante/assinatura e o histórico de instalação. Limpar armazenamento, desinstalar ou forçar downgrade pode perder a sessão e exige decisão separada. [Android Debug Bridge](https://developer.android.com/tools/adb) · [apksigner](https://developer.android.com/tools/apksigner)

[Voltar ao sumário](#sumário)

</details>

## 4. Android físico

<details>
<summary>Configurar o USB, testar no celular e ler os logs</summary>

1. No Android, abra **Configurações → Sobre o telefone** e toque no número da versão até habilitar as opções do desenvolvedor. O caminho varia conforme o fabricante. Ative **Depuração USB**. Use um cabo que transfira dados, desbloqueie a tela e aceite a chave RSA apenas para o computador confiável.
2. Em `adb devices -l`, confirme o estado `device`. `unauthorized` indica que falta a autorização na tela do telefone. `offline` indica que o transporte ainda não está operacional. Confirme a versão do Android antes de comparar resultados de dois aparelhos.
3. Prepare as dependências da seção 2. Com o app já instalado, confira pacote, versão e assinatura antes de optar pelo Método B. Para maior controle do arquivo instalado, gere a APK pelo Método A e só depois aplique o Método C.
4. Em Android Studio **View → Tool Windows → Logcat**, selecione o dispositivo e filtre pelo package `com.moodle.moodlemobile`. Leia a primeira falha Java/Gradle/Cordova relevante. Para erros JS, abra `chrome://inspect/#devices` em Chrome com a WebView de uma build que permita inspeção. Identifique a WebView pelo pacote e use Console/Network para verificar erros e tempos.

```bash
adb devices -l
adb -d shell getprop ro.build.version.release
adb -d shell getprop ro.build.version.sdk
adb -d shell dumpsys webviewupdate
adb -d shell pidof com.moodle.moodlemobile
```

Com o app já aberto, copie um PID devolvido por `pidof` e use `adb -d logcat --pid=PID_DO_APP`. Se ele reiniciar, obtenha o PID novamente. Remova credenciais, identificadores pessoais, cookies, cabeçalhos e parâmetros de autenticação antes de exportar logs ou capturas. [Logcat](https://developer.android.com/studio/debug/logcat) · [Depuração remota de WebViews](https://developer.chrome.com/docs/devtools/remote-debugging/webviews/)

[Voltar ao sumário](#sumário)

</details>

## 5. Emulador Android

<details>
<summary>Criar e usar um emulador com Android 11 ou 16</summary>

1. Em Android Studio, instale **Android Emulator** e uma imagem API 30 e outra API 36 no **SDK Manager**. Em **Device Manager → Create Virtual Device**, escolha um perfil de telefone e a imagem adequada ao host (x86_64 ou arm64). Escolha Google APIs ou Google Play se o cenário exigir serviços Google. Confira se a imagem e a APK têm ABI compatível com as bibliotecas nativas empacotadas.
2. Inicie um AVD por vez para comparar as versões com a mesma APK. Espere a inicialização. Execute `adb devices -l` e confira o serial do emulador.
3. Use o Método A e depois os comandos abaixo, ou `npm run prod:android -- --emulator` com o `--target` apropriado. O exemplo usa `emulator-5554`, que deve ser substituído pelo serial exibido se for diferente.

```bash
adb devices -l
adb -s emulator-5554 shell getprop ro.build.version.sdk
adb -s emulator-5554 shell dumpsys webviewupdate
adb -s emulator-5554 install -r "platforms/android/app/build/outputs/apk/debug/app-debug.apk"
adb -s emulator-5554 shell am start -n "com.moodle.moodlemobile/.MainActivity"
```

4. Use o mesmo Logcat do Android Studio apontado para o AVD. Registre API, versão da WebView, ABI, commit e SHA-256. API 30 e API 36 ajudam a testar WebView, navegação e insets. O resultado no AVD deve ser reportado separadamente do aparelho físico, inclusive para USB, biometria, câmera, desempenho e fluxo autenticado completo. [Criar e gerenciar AVDs](https://developer.android.com/studio/run/managing-avds)

[Voltar ao sumário](#sumário)

</details>

## 6. iOS no Mac

<details>
<summary>Preparar o Xcode, usar o simulador e executar no iPhone</summary>

### 6.1 O que existe no projeto

`package.json` e `package-lock.json` fixam Cordova iOS 7.1.1. `config.xml` declara WKWebView, `deployment-target` 16.0, Swift 5.0, `moodleappfs` como esquema interno do conteúdo, bundle ID `com.moodle.moodlemobile`, `CFBundleVersion` e versão `5.2.1`. `moodlemobile` é o esquema de callback registrado pelo plugin `cordova-plugin-customurlscheme`. O `GoogleService-Info.plist` referenciado pelo `config.xml` existe no repositório. Antes de distribuir, verifique se o time Apple, o identificador, os entitlements e a configuração Firebase estão autorizados para essa variante.

| Área | Android | iOS e o que validar |
|---|---|---|
| Gov.br | Plugin IFRN chama Custom Tabs via Java. | O mesmo plugin registra `IfrnSafariBrowser.m` com `SFSafariViewController`. Exercite abertura, cancelamento e callback SUAP/Gov.br, sem assumir compartilhamento de cookies ou retorno igual ao Android. |
| Navegadores e WebView | InAppBrowser e Ionic WebView têm código Android, com hooks IFRN que ajustam Java. | Os plugins declaram implementação iOS. Conferir WKWebView, janelas SUAP/Ajuda, cookies e retorno. Plugins WKUserScript e WKWebView Cookies têm blocos iOS. Os hooks Android não aplicam o patch em Objective-C. |
| Sessão e armazenamento | SQLite e plugin Moodle com implementação Android. | Ambos declaram código iOS. Testar armazenamento, app reiniciado, identidade e troca de contas no iPhone. |
| Insets, intents e barra de status | Insets e Intent têm implementação Android. | Conferir safe areas, teclado e StatusBar no iOS pelos componentes próprios dessa plataforma. Não use a presença do plugin Android como evidência. |
| Push e hardware | FCM e permissões Android, plugins de câmera, mídia e biometria. | Push tem bloco iOS com CocoaPods e integração Firebase/APNs. Validar entitlements e credenciais institucionais no iPhone. Câmera, biometria, permissões e anexos exigem ensaios específicos. |

O projeto está **configurado para preparar iOS**, mas `platforms/ios` não estava gerada no ambiente Linux da revisão. Faltam a primeira preparação/compilação no Mac com Pods, confirmação de compatibilidade do Xcode escolhido, teste de simulador e homologação no iPhone. O bundle ID atual usa o namespace do Moodle. Um time que não controla esse identificador pode ficar bloqueado para assinar no iPhone. Encaminhe a identidade e o provisionamento à equipe responsável antes de qualquer mudança.

### 6.2 Preparar e compilar

Use um Mac com Xcode completo. Instale o componente iOS e um runtime de simulador em **Xcode → Settings → Components** (ou **Platforms**, conforme a versão). Abra o projeto no Mac na mesma revisão. Faça o `npm ci` no próprio Mac para obter os binários nativos da arquitetura correta.

```bash
xcode-select -p
xcodebuild -version
xcrun simctl list devices available
pod --version
npm ci
npm run prod --prefix cordova-plugin-moodleapp
npx --no-install cordova platform ls
# Apenas se iOS ainda estiver ausente:
npx --no-install cordova platform add ios@7.1.1 --nosave
npx --no-install cordova prepare ios
npx --no-install cordova requirements ios
```

Gere os assets web e sincronize a plataforma para uso no Xcode. O `ionic cordova prepare ios` roda a etapa Angular/Gulp e chama Cordova `prepare`. Examine o primeiro erro de plugin/Pod, caso apareça. Use o `.xcworkspace` gerado, que inclui a integração do CocoaPods.

```bash
npx --no-install cross-env NODE_ENV=production ionic cordova prepare ios --prod
find platforms/ios -maxdepth 1 -name '*.xcworkspace'
open platforms/ios/Moodle.xcworkspace
```

O nome esperado `Moodle.xcworkspace` vem de `<name>Moodle</name>` e do template Cordova iOS. Se o `find` listar outro nome, abra o workspace que ele mostrar. Depois de editar arquivos Angular/IFRN, repita `ionic cordova prepare ios --prod` antes de **Run**. O Xcode sozinho compila a plataforma já preparada.

### 6.3 Executar no simulador

1. Abra o workspace, selecione o scheme **Moodle** e escolha um iPhone simulado com runtime compatível com iOS 16.0 ou superior. Execute **Product → Run**. Confira o Console e o Issue Navigator no Xcode. Para apenas compilar, use **Product → Build**.
2. Para compilar pela CLI com os assets preparados, o Cordova 7.1.1 usa `platforms/ios/build/Debug-iphonesimulator/` como diretório de saída de referência. Resolva o nome/caminho do `.app` na saída do build. Para instalar e iniciar no simulador, use Xcode Run ou `cordova run ios --emulator`.

```bash
npx --no-install cordova build ios --debug --emulator
find platforms/ios/build -name '*.app' -type d
# Alternativa ao Xcode Run. Instala e abre no simulador:
npx --no-install cordova run ios --emulator
```

3. Para inspecionar a parte web, habilite as ferramentas de desenvolvedor no Safari do Mac e use o menu **Develop** para selecionar a WebView, se a build a expuser. No iPhone, habilitar Web Inspector é uma configuração manual. Em um runtime recente, a WebView precisa estar configurada como inspecionável. Use a inspeção para Console, layout e rede da interface local, evitando exportar dados de sessão. O simulador permite revisar tela, tema, layout e parte das integrações. Registre hardware, push, biometria e autenticação real como pendentes até o teste físico. [Executar pelo Xcode](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices) · [Web Inspector](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios)

Os scripts `npm run dev:ios -- --emulator` e `npm run prod:ios -- --emulator` também estão disponíveis depois da preparação. Ambos chamam `ionic cordova run ios`, portanto instalam e abrem. O segundo define `NODE_ENV=production` e seleciona a configuração web de produção. Para escolher um iPhone conectado, use o Xcode ou um destino explícito em vez de depender da seleção automática.

### 6.4 Executar num iPhone físico

1. Ligue o iPhone ao Mac por USB, desbloqueie-o, confie no computador e emparelhe no Xcode. Habilite **Developer Mode** no iPhone quando solicitado, conforme a política de testes da equipe. O dispositivo deve rodar iOS 16 ou superior e ser suportado pela edição do Xcode.
2. No Xcode, entre com a conta Apple de desenvolvimento, selecione o target e abra **Signing & Capabilities**. Escolha o time aprovado. O certificado de desenvolvimento assina a build e o perfil de provisionamento autoriza identificador, dispositivo e capacidades. O gerenciamento automático pode criar o perfil se o time tiver as permissões necessárias. Algumas capacidades exigem um time do Apple Developer Program.
3. Selecione o iPhone na barra do Xcode e use **Product → Run** para compilar, instalar e abrir. Observe a área de debug do Xcode e o Console. A alternativa CLI requer assinatura compatível e `ios-deploy` quando exigido pela plataforma. `npx --no-install cordova run ios --device` também instala. Escolha explicitamente um aparelho de teste e preserve a instalação em uso.
4. Teste a autenticação manualmente com conta autorizada, a volta do navegador, o Painel, um curso e o retorno. Repita as verificações de sessão somente em dispositivo e conta dedicados.

Para **TestFlight/App Store**, a equipe precisa de conta no Apple Developer Program, App Store Connect, bundle ID autorizado, capacidades e assinatura de distribuição. Use **Product → Archive** e o Organizer para validar e enviar. `.app` de simulador e `.ipa` assinado para dispositivo servem a destinos diferentes. Em 24/11/2026, a Apple exige Xcode 26 ou posterior e SDK iOS 26 para uploads. A compilação com Cordova iOS 7.1.1 e os Pods deste projeto ainda precisa ser verificada nesse toolchain. [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) · [Requisitos de SDK e macOS do Xcode](https://developer.apple.com/xcode/system-requirements/) · [Requisitos App Store Connect](https://developer.apple.com/news/upcoming-requirements/)

### 6.5 Quando o computador principal é Windows ou Linux

Desenvolva Angular, SCSS, testes locais e Android no seu sistema. Para desenvolvimento no navegador, confirme os hooks de Bash e use `npm start` no ambiente Unix com `MOODLE_APP_BROWSER` ajustado ao navegador. Para o binário iOS, sincronize a revisão em um Mac próprio ou remoto autorizado. Obtenha o código via Git ou transfira apenas os arquivos de trabalho aprovados. Gere as dependências, o workspace e os Pods no Mac. Um Mac remoto pode compilar pela CLI se tiver Xcode completo e SDK. Para operar o iOS Simulator ou depurar visualmente, use acesso gráfico autorizado, ou uma solução de testes que exponha os recursos do Mac. Para iPhone por USB, normalmente ele precisa estar conectado ao Mac usado pelo Xcode. Guarde materiais de assinatura no local aprovado pela equipe.

[Voltar ao sumário](#sumário)

</details>

## 7. Checklist funcional

<details>
<summary>Conferir navegação, login, cursos e sessão</summary>

**Sem autenticação real**, em cada plataforma:

- [ ] Confirmar versão, variante, WebView, commit e hash do artefato, quando aplicável.
- [ ] Abrir Marketplace e tela de entrada. Verificar layout, tema, rolagem, teclado, legibilidade e barras do sistema.
- [ ] Em instalação de teste, abrir a navegação institucional e cancelar na tela de autenticação. Confirmar retorno recuperável e ausência de tela presa.
- [ ] Conferir que a interface IFRN oferece as opções de acessibilidade esperadas. O VLibras foi removido na revisão de referência. A ausência do botão e do widget é o comportamento esperado nela.

**Com operador e conta de teste autorizada**, no Android 11, Android 16 e iOS onde houver binário validado:

- [ ] Login SUAP e Gov.br, quando ofertado. Confirmar callback e Painel da conta correta sem salvar logs com dados pessoais.
- [ ] Conferir Perfil, seis destinos da Ajuda e retorno de cada navegador, verificando se não há janela ou carregamento preso.
- [ ] Conferir listagem e filtros de disciplinas. Abrir um curso, voltar ao Painel, reabrir e trocar de curso.
- [ ] Cancelar durante o carregamento e selecionar outra disciplina para confirmar que a tentativa anterior foi encerrada. Confirmar Voltar do sistema e Voltar da interface.
- [ ] Verificar a barra de progresso acadêmico em modo de leitura com dados existentes. Compare com o Moodle da mesma conta. Use um curso de teste autorizado para qualquer escrita acadêmica.
- [ ] Reabrir o app e conferir persistência da sessão. Testar logout/troca de conta apenas em um ambiente de teste permitido, confirmando isolamento dos dados.
- [ ] Conferir tema claro/escuro, gestos, rede intermitente, retorno de segundo plano e ausência de crashes. No iPhone, incluir permissão de câmera, arquivo e push quando fizerem parte da homologação.

As regressões Node do IFRN podem ser executadas com dados simulados após instalar as dependências. Por exemplo, estes arquivos testam preferências de acessibilidade e progresso acadêmico. A suíte Jest da raiz é uma execução distinta (`npm test` roda Gulp antes do Jest). Testes locais complementam o checklist em aparelho.

```bash
node --test src/MoodleIFRN/tests/accessibility-settings.test.cjs src/MoodleIFRN/tests/academic-progress.test.cjs
```

[Voltar ao sumário](#sumário)

</details>

## 8. Solução de problemas

<details>
<summary>Diagnosticar erros de dependências, Android e iOS</summary>

### Dependências e preparação

| Sintoma | Causa provável | Como diagnosticar | Solução segura |
|---|---|---|---|
| `EBADENGINE`, Node incompatível | Terminal usa uma versão fora de Node 22.17 a 22.x. | `node --version`, `npm --version`, `where.exe node` ou `command -v node`, `node -p "require('./package.json').engines.node"`. | Selecione um Node 22 compatível e reabra o terminal. Preserve `engine-strict`. |
| `NVM4306` no Windows | O proxy do NVM rejeitou a confiança na entrada delegada. | Leia o caminho e o motivo emitidos pelo NVM. Confira `nvm version`, `where.exe node`, `where.exe npm` e a origem da instalação. | Use Node e npm oficiais e corrija o caminho ou a instalação conforme a política da máquina. Para uma entrada confiável confirmada, consulte o procedimento específico do mantenedor. [Códigos NVM](https://docs.nvm-windows.com/troubleshooting/error-codes/) |
| `ng: command not found` | CLI local ausente, comando global ou diretório incorreto. | `npm ls --depth=0 @angular/cli`, confira a raiz e o `npm ci`. | Use `npm run ng -- version` ou `npx --no-install ng version` a partir da raiz com as dependências do lockfile. |
| `cross-env-shell` ou `cross-env` ausente | Dependências de desenvolvimento omitidas, instalação interrompida ou falha no subprojeto do plugin. | `npm ls --depth=0 cross-env`, `npm --prefix cordova-plugin-moodleapp ls cross-env`, `npm config get omit` e log do postinstall. | Num clone de build com Node correto, faça `npm ci --include=dev` se o ambiente omitiu `devDependencies`. Confirme também a instalação do plugin. |
| Script npm não reconhecido | Diretório ou revisão diferente da esperada. | `npm run`, `git rev-parse HEAD`, `git status --short --branch`. | Execute na raiz selecionada. Confira o `package.json` dessa revisão antes de reutilizar comandos de outra branch. |
| `npm ci` falha, dependências divergentes | Lockfile incompatível, falha de rede no registro ou postinstall falhou. | Confira a primeira mensagem, Node/npm, `npm config get registry` e `git diff -- package.json package-lock.json cordova-plugin-moodleapp/package-lock.json`. | Corrija o ambiente ou use o par manifesto/lockfile aprovado em clone limpo. Preserve alterações e diagnósticos existentes. |
| Hook `.sh` falha no Windows | Bash ausente ou shell incompatível. | `bash --version`, `npm config get script-shell` e saída de `before_plugin_add.sh`. | Use Git Bash disponível no `PATH`. Configure o shell para a sessão se necessário. |
| `cordova.js` ou plugin Moodle ausente | Plataforma ainda não preparada, preparo incompleto ou uso de assets gerados em outro checkout. | `cordova platform ls`, `cordova plugin ls` e conteúdo de `platform_www`. Use as CLIs locais. | Prepare a plataforma certa e reexecute o build Ionic. O módulo Moodle preparado precisa do wrapper `cordova.define`. |

### Android e ADB

| Sintoma | Causa provável | Como diagnosticar | Solução segura |
|---|---|---|---|
| `JAVA_HOME` incorreto | Caminho inexistente, aponta para `bin`/JRE ou outro JDK tem prioridade. | `java -version`, `javac -version`, `npx --no-install cordova requirements android`, confira também `CORDOVA_JAVA_HOME`. | Aponte para a raiz de um JDK 17 e alinhe o Gradle JDK do Android Studio. |
| SDK ausente ou variáveis conflitantes | `ANDROID_HOME` aponta para outra SDK, `ANDROID_SDK_ROOT` difere ou faltam pacotes. | SDK Manager, `sdkmanager --list_installed`, confira Platform 36 e `build-tools/36.0.0`. | Alinhe os caminhos e instale os componentes faltantes pelo SDK Manager. |
| Gradle ou AGP incompatível | `gradle` falta no `PATH`, wrapper antigo ou plataforma gerada divergente. | `gradle --version`, `cordova platform ls` e `gradle-wrapper.properties`. | Prepare a plataforma 15.1.0 em clone separado. O wrapper esperado é 8.14.2 com AGP 8.10.1. |
| Build Android falha ou fica sem APK | Erro em Gulp/Angular/plugin antes do Gradle, SDK incompleta, falha de rede ou assinatura release ausente. | Leia a primeira falha. Separe a saída de `ionic-cordova-build` dos erros Gradle. Verifique SDK, Manifest e `output-metadata.json` da variante. | Isole a etapa com `ionic cordova build android --prod --debug`, após preparar a plataforma. Resolva a primeira causa antes de tentar instalar. |
| `adb` não reconhecido | Platform Tools ausentes do `PATH`. | `adb version`, `where.exe adb` ou `command -v adb`. | Instale Platform Tools e selecione uma única SDK nesta sessão. |
| `unauthorized` | Chave RSA ainda não confirmada. | `adb devices -l`. Confira a notificação e a tela desbloqueada. | Autorize aquele computador no aparelho. No Windows, confira o driver do fabricante. |
| `offline` ou aparelho não lista | Cabo sem dados, driver, regra USB ou servidor ADB inconsistente. | Troque porta/cabo e compare a versão do `adb` em uso. No Linux, confira udev e grupo. | Reconecte com a tela desbloqueada. Se precisar reiniciar o servidor ADB, coordene com quem usa os outros dispositivos conectados. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Certificado da APK difere da instalação com mesmo pacote. | `aapt dump badging` e `apksigner verify --print-certs` para os dois artefatos. | Consiga a APK assinada com identidade compatível. Preserve a instalação com a sessão. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | Código da candidata é inferior ao instalado. | Compare `versionCode` de `aapt` com `dumpsys package`. | Obtenha a build atual autorizada com código aceito. Preserve dados. |
| `INSTALL_FAILED_OLDER_SDK`, `NO_MATCHING_ABIS` ou APK inválida | API do aparelho abaixo do mínimo, ABI incompatível ou arquivo errado/incompleto. | Compare `aapt dump badging`, SHA-256, `ro.build.version.sdk`, `ro.product.cpu.abilist` e assinatura. | Use uma imagem/aparelho compatível e a APK da variante apropriada. AAB deve virar APKs antes de instalar. |
| APK abre, mas parece antiga | Arquivo de outra pasta/branch, mesma versão numérica ou `www/` antigo. | Confira o hash de `base.apk`, data de instalação e assets empacotados. | Recompile o web e o nativo com o Método A ou B, guarde o novo hash e só então atualize. |

### iOS

| Sintoma | Causa provável | Como diagnosticar | Solução segura |
|---|---|---|---|
| `xcodebuild` ausente ou SDK não encontrado | Mac sem Xcode completo ou ferramentas selecionadas em outro caminho. | `xcode-select -p`, `xcodebuild -version`, `xcrun --sdk iphoneos --show-sdk-version`. | Instale Xcode e a plataforma iOS. Selecione o diretório `Contents/Developer` da versão desejada. |
| Simulador indisponível | Runtime ou modelo virtual ausente. | `xcrun simctl list runtimes` e `xcrun simctl list devices available`. | Baixe o runtime por Xcode e crie/selecione um dispositivo simulado compatível. |
| `pod` não encontrado ou conflito de Pods | CocoaPods fora do `PATH`, versão incompatível ou resolução de dependência falhou. | `pod --version`, `cordova requirements ios` e a primeira falha de Pod na preparação. | Use CocoaPods compatível com Xcode e com as versões declaradas. Abra o `.xcworkspace`. Trate mudanças de dependência separadamente. |
| Erro de assinatura, perfil ou entitlement | Time não controla o bundle ID, perfil não inclui aparelho ou capacidades divergentes. | Veja **Signing & Capabilities**, destino escolhido e mensagem do Xcode. | Use o time, o identificador e o perfil institucionais autorizados. Enquanto isso, teste a interface no simulador. |
| Plugin iOS falha na compilação ou execução | Falta de implementação iOS, Pod/SDK incompatível, permissão ou recurso de hardware. | Confira o bloco iOS de `plugin.xml`, log Cordova/Xcode, Console e configuração do dispositivo. | Isole o plugin e registre a matriz do ambiente. Valide no iPhone o que depende de hardware, push ou autenticação. |

[Voltar ao sumário](#sumário)

</details>

## 9. Referências e escopo da verificação

<details>
<summary>Consultar as fontes e as verificações realizadas</summary>

- No código consulte `package.json`, `package-lock.json`, `config.xml`, `angular.json`, `ionic.config.json`, `gulpfile.js`, `scripts/cordova-hooks/` e `src/MoodleIFRN/`. [Revisão de referência no GitHub](https://github.com/suap-ava-suite/mobileapp-moodle/tree/127167c87760412de8beeb2f610851aab6992b00).
- [npm ci](https://docs.npmjs.com/cli/v10/commands/npm-ci) e [npm install](https://docs.npmjs.com/cli/v10/commands/npm-install).
- [Ionic Cordova Build](https://ionicframework.com/docs/cli/commands/cordova-build) e [Ionic Cordova Run](https://ionicframework.com/docs/cli/commands/cordova-run).
- [Apache Cordova CLI](https://cordova.apache.org/docs/en/latest/reference/cordova-cli/) · [Gradle Wrapper](https://docs.gradle.org/8.14.2/userguide/gradle_wrapper.html) · [Compatibilidade Android Studio e AGP](https://developer.android.com/studio/releases/android_gradle_plugin_and_android_studio_compatibility).
- [Guia iOS do Cordova](https://cordova.apache.org/docs/en/latest/guide/platforms/ios/) · [TestFlight](https://developer.apple.com/testflight/).

Nesta revisão foram conferidos Git, versões do ambiente, manifestos, lockfiles, scripts e código dos hooks/browsers. `cordova --version` devolveu 13.0.0 e `cordova platform ls` confirmou somente Android 14.0.1 preparado. `build-native.mjs --check` validou 2.792 entradas do dicionário para cada plataforma. Também foram conferidos o bootstrap Cordova e os 12 alvos da guarda de sessão no checkout. Os comandos de instalação, compilação, execução, assinatura e atualização do aparelho formam o roteiro para o desenvolvedor. Não foram executados nesta revisão. Não há validação de funcionalidade Android ou iOS nova associada ao manual.

[Voltar ao sumário](#sumário)

</details>
