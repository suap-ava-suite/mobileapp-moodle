# Finalização de diagnóstico — Moodle IFRN 2.0.1

## Estado do Git

- Branch: `fix/p0-release-2.0.1`.
- HEAD: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`.
- A branch `release/2.0.1` não foi alterada; não houve commit, merge ou push.
- O diretório já continha muitas alterações e artefatos locais não rastreados. Foram preservados; nenhum reset, clean ou descarte foi executado.
- Nesta etapa não foram editados `src/core/`, `src/addons/` ou o backend Django.

## Alteração do fluxo Gov.br

Quando o InAppBrowser do fluxo SUAP detecta a saída para um host HTTPS oficial `gov.br`, o app encerra a tentativa incorporada com erro recuperável, em vez de ficar esperando o timeout. A mensagem informa que continuar no Gov.br ocorrerá no navegador e não autenticará a sessão mobile. A tela oferece:

- **Continuar no navegador:** abre `https://suap.ifrn.edu.br/accounts/login/` no navegador do sistema para o estudante iniciar ali o fluxo oficial e escolher Gov.br. A URL transitória, inclusive `authorization_id`, não é reutilizada.
- **Voltar ao login SUAP no app:** reinicia o caminho tradicional já existente.

O login tradicional não foi reimplementado. A identidade, o perfil e as disciplinas continuam sob o fluxo SUAP/Painel existente. O login Gov.br continua sem handoff ao app: não foi anunciado nem tratado como sessão autenticada no aplicativo.

Arquivos funcionais tocados nesta etapa:

- `src/MoodleIFRN/services_mobile/painel-ava.service.ts`
- `src/MoodleIFRN/services_mobile/painel-ava.config.ts`
- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts`
- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.html`
- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.scss`
- `src/MoodleIFRN/tests/suap-govbr-routing.test.cjs`

O caminho otimizado já presente, que encerra a consulta de perfil assim que a resposta válida da API é suficiente e evita o GET HTML secundário, foi revalidado pelo teste focado; não se fez uma nova mudança nesse caminho.

## Testes e build

- Testes focados SUAP/Gov.br e retorno pós-curso: **4/4 aprovados**.
- Suíte Node dos testes CJS + ESM de `src/MoodleIFRN/tests`: **257 casos, 252 aprovados, 5 falhas**. Falham a regressão P0.4 (uma falha) e quatro testes ESM que não conseguem carregar módulos pelo esbuild neste ambiente/sandbox. A expectativa P0.4 permaneceu intacta.
- Jest: **48 suítes; 40 passaram e 8 falharam. 240 testes: 229 passaram, 8 falharam e 3 já estavam marcados `todo`**. Foram observados testes de núcleo que falham por logger/ícone e traduções ausentes, além de dívida de testes do repositório. Não foram modificados testes do núcleo.
- TypeScript: `tsc --noEmit -p tsconfig.app.json` passou.
- ESLint: a execução nos arquivos de serviço existentes reporta dívida anterior extensa (54 erros e 26 avisos no conjunto examinado); não foi estabelecido baseline limpo antes dessas modificações. `painel-ava.config.ts` termina sem erro, com dois avisos JSDoc no detector que já existia.
- Builder Android correto: `node src/MoodleIFRN/scripts/build-android-web.cjs` passou e verificou Cordova e 2.795 strings pt-BR.
- `cordova prepare android` passou.
- `app:assembleDebug` passou em 56 segundos. O Gradle avisou que AGP 8.7.3 foi testado até SDK 35, enquanto a build usa SDK 36; houve também aviso de recursos Gradle depreciados.
- O APK empacotado contém exatamente uma referência a `cordova.js`, o texto de estado do Gov.br e as opções de navegador/SUAP nos bundles apropriados.

## APK e emulador

- APK: `.analise/correcoes-p0/p29-release-2.0.1-debug.apk`.
- SHA-256: `23CBF8E238A3BC41BFCE9C756871869F77783C3D8E2B8395988F9D182F7B2B31`.
- Package ID: `com.moodle.moodlemobile`; versão `5.2.1`, code `52100`; min SDK 24, target SDK 36.
- Assinatura debug Android: certificado SHA-256 `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`.
- Emulador detectado: AVD Pixel_4 no serial **`emulator-5554`**, Android 11 / API 30, WebView `139.0.7258.158`. Não havia outro dispositivo conectado.
- A assinatura foi comparada com a instalada e coincidiu. A APK foi atualizada somente nesse emulador com `adb install -r`, sem desinstalação ou limpeza de dados. O processo `MainActivity` abriu.
- O manifesto mantém permissões herdadas do Moodle e plugins (rede, notificações, câmera/áudio, armazenamento legado limitado a API 32, entre outras). A revisão de necessidade de cada permissão para Play ainda não foi feita.
- A APK inclui bibliotecas para ARM64 e outras ABIs. Alinhamento de páginas de memória de 16 KB não foi verificado.
- A memória medida após a abertura foi `TOTAL PSS 141578 kB`, `TOTAL RSS 239344 kB`. É uma única amostra inicial, sem comparação antes/depois ou após navegação por cursos.

**O teste funcional real aguarda a interação manual do responsável.** O app está aberto no emulador; Marketplace visível, login tradicional, autenticação, retorno, disciplinas e cursos ainda não foram confirmados nesta execução. Nenhuma credencial foi digitada ou coletada. Não há novas durações `[IFRN-SUAP-TIMING]` para relatar. A coleta em andamento filtrava exclusivamente esse marcador; não capturou tokens ou dados de perfil.

## Desempenho observado e limites

A referência histórica continua sendo cerca de 21,9 s até dados validados (inclui interação humana), 14,4 s de espera visível e 105 ms para a resposta da API de perfil. Não há medição pós-mudança comparável porque o login manual não foi executado. O teste determinístico confirma que uma resposta válida do perfil evita a consulta HTML secundária; não permite declarar redução de tempo percentual.

## P0.4 e recomendação

A regressão original continua vermelha: uma operação nativa Moodle em andamento pode ativar o site A ou navegar após cancelamento e entrada em B. Um guard apenas em `src/MoodleIFRN/` não pode impedir de forma demonstrada os efeitos internos do núcleo depois que o callback já foi entregue. Como esta etapa preservou `src/core/`, não foi introduzida proteção parcial. **P0.4 permanece pendente e a release fica bloqueada** até correção segura ou aceitação explícita do risco pelo responsável.

## Google Play

Esta é uma APK debug, não candidata de publicação. O `applicationId` continua `com.moodle.moodlemobile` e o nome nativo continua herdado do projeto; não foi escolhido um identificador institucional. Não foi gerado AAB nem usado certificado release. Para Play ainda são necessários: aprovação institucional de marca e `applicationId`, validação/atualização compatível de AGP para SDK 36, confirmação de alinhamento 16 KB das bibliotecas nativas, revisão das permissões, política e declarações de privacidade Play, chaves de assinatura em armazenamento seguro e build/teste release.

## Status

**NÃO APTO para integrar à `release/2.0.1`**: P0.4 continua falhando, o login e o percurso de cursos ainda aguardam teste manual, há falhas na suíte geral, e a preparação de publicação não está concluída. A APK serve para diagnóstico no emulador já selecionado, não para distribuição.
