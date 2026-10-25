# Como trocar a imagem de abertura do Android

Atualizado em 25/10/2026.

## O que foi alterado

O splash nativo que aparece ao iniciar o aplicativo usava o “M” laranja do Moodle,
definido em `resources/android/android-splash.xml`.

Agora usa a logo principal do Moodle IFRN, escolhida a partir da proposta v6:

`src/MoodleIFRN/resources/logo-moodle-ifrn.png`

A imagem tem fundo transparente, “m” vermelho/verde e capelo azul-escuro com
pendão laranja. O fundo do splash e o fundo ao redor do ícone usam branco
(`#FFFFFF`). A escolha e a origem estão em `LOGO-MOODLE-IFRN.md`.

## Onde configurar

Na raiz do projeto, edite `config.xml`, dentro de `<platform name="android">`:

```xml
<preference name="AndroidWindowSplashScreenAnimatedIcon" value="src/MoodleIFRN/resources/android-splash.xml" />
<resource-file src="src/MoodleIFRN/resources/logo-moodle-ifrn.png" target="app/src/main/res/drawable-nodpi/ifrn_splash_logo.png" />
<preference name="AndroidWindowSplashScreenBackground" value="#FFFFFF" />
<preference name="AndroidWindowSplashScreenIconBackgroundColor" value="#FFFFFF" />
```

Apesar do nome `AnimatedIcon`, essa configuração aceita um PNG estático. O código
de preparação do Cordova Android instalado trata PNG e XML separadamente.
O sistema controla a apresentação do splash; essa configuração fornece o ícone
central e a cor de fundo, não uma fotografia esticada para ocupar toda a tela.

## Para trocar novamente

1. Coloque o novo PNG no repositório, preferencialmente em `src/MoodleIFRN/resources/`
   se ele for exclusivo da abertura. Use uma imagem quadrada com espaço ao redor
   do símbolo e confira no aparelho se há recortes.
2. Substitua a logo principal ou altere o `src` do `resource-file` acima para o
   novo PNG. O drawable `android-splash.xml` reserva margem interna de `32dp`
   nos quatro lados para acomodar a máscara do splash. A logo atual não contém
   mais o quadrado e o círculo laterais, permitindo exibição maior.
   Para usar diretamente um PNG,
   referencie-o em `AndroidWindowSplashScreenAnimatedIcon`.
3. Ajuste as duas cores de fundo conforme a arte.
4. Prepare, compile e instale usando os comandos abaixo.

Também é possível substituir o PNG principal mantendo o caminho. O favicon
Android/Chrome do painel web fica em outro arquivo e não é alterado por essa troca.

Não edite os arquivos gerados dentro de `platforms/android/`: o Cordova os
recria a partir do `config.xml` e da imagem original.

## Compilar e instalar no Windows

Para alterar apenas a imagem e as cores, execute na raiz:

```powershell
node node_modules/cordova/bin/cordova prepare android
Push-Location platforms/android
.\gradlew.bat assembleDebug
Pop-Location
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.moodle.moodlemobile
adb shell am start -n com.moodle.moodlemobile/.MainActivity
```

Esses comandos pressupõem o payload web já compilado, SDK/JDK configurados e
aparelho conectado. Se houver alterações no código web, compile-o antes do
`cordova prepare android`:

```powershell
node src/MoodleIFRN/mobilemoodle/build.mjs
node src/MoodleIFRN/scripts/build-android-web.cjs
```

`adb install -r` atualiza o app preservando os dados, desde que a assinatura seja
compatível. Não é necessário desinstalar ou limpar os dados para trocar o splash.
O `force-stop` permite testar uma abertura completa, sem apagar as sessões.

## Como conferir

Após `cordova prepare android`, confira:

- `platforms/android/app/src/main/res/values/themes.xml`: referência a
  `@drawable/ic_cdv_splashscreen` no tema de abertura;
- `platforms/android/app/src/main/res/drawable/ic_cdv_splashscreen.xml`: drawable
  de ampliação copiado pelo Cordova;
- `platforms/android/app/src/main/res/drawable-nodpi/ifrn_splash_logo.png`: logo
  copiada pelo `resource-file`;
- `platforms/android/app/src/main/res/values/colors.xml`: cores do splash.

Reabra o app completamente para conferir o resultado. Essa alteração configura
a tela de abertura Android; o ícone do lançador e a configuração do iOS são
recursos separados.

## Voltar ao splash anterior

O arquivo original foi mantido. Para voltar, configure:

```xml
<preference name="AndroidWindowSplashScreenAnimatedIcon" value="resources/android/android-splash.xml" />
<preference name="AndroidWindowSplashScreenBackground" value="#FFFFFF" />
<preference name="AndroidWindowSplashScreenIconBackgroundColor" value="#FFFFFF" />
```

Depois repita a preparação, compilação e instalação.

## Validação desta alteração

Em 25/10/2026, `cordova prepare android` e Gradle `assembleDebug` concluíram.
O PNG gerado em `drawable-nodpi` tem o mesmo SHA-256 da imagem original,
e as cores foram inicialmente verificadas como `#098E95`. Após avaliação visual
do usuário, as duas preferências foram ajustadas para branco (`#FFFFFF`), mantendo
a mesma imagem central.
O APK foi instalado no Android conectado com `adb install -r`, com sucesso,
preservando os dados do app. A captura pontual de tela não registrou o splash;
portanto, não foi usada como comprovação visual de tamanho ou recorte do símbolo.
