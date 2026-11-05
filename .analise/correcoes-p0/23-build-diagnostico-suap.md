# P0.13 — Build de diagnóstico e preparação dos testes do login SUAP

Data: 2026-11-01  
Branch: `fix/p0-release-2.0.1`  
HEAD: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`  
`release/2.0.1`: `0ba7bc2e71b1180418337bb85dca1e082c49c7b0` (inalterada).

## Resultado

A otimização do perfil foi endurecida e a APK debug de diagnóstico foi compilada. A telemetria está presente na APK e só é emitida em builds que não sejam production/testing. O teste automatizado confirma que o perfil recém-validado e o dashboard são associados ao mesmo proprietário, e que a consulta redundante é dispensada uma única vez.

**A APK não está pronta para instalar por cima do aplicativo atual:** embora package ID, versão e version code coincidam, os certificados de assinatura são diferentes. Não houve instalação, abertura do app, logout, limpeza de dados ou autenticação no dispositivo.

## Revisão de segurança da otimização

- O fluxo de entrada só chama `commit()` após identidade válida, proprietário do Painel igual à identidade e dashboard com lista de disciplinas válida. O `commit()` salva perfil e dashboard sob o mesmo `ownerKey` e cria a dispensa com esse proprietário.
- A marca guarda proprietário normalizado e vencimento. O refresh lê primeiro o snapshot OAuth validado e consome a marca somente se o proprietário coincidir. Proprietário diferente, registro inválido ou vencido consome e rejeita a marca, seguindo o caminho normal de refresh.
- A marca é de uso único, dura no máximo 60 segundos e é removida ao iniciar/cancelar uma entrada, quando não há perfil válido e no logout. Entradas com falha começam depois de invalidar a marca anterior; falhas não deixam uma dispensa antiga disponível.
- O refresh subsequente após o uso único continua habilitado. Nenhum perfil, dashboard ou curso é criado a partir da marca; ela só evita a segunda consulta de perfil.
- O teste executa o método de produção `commit()` extraído do serviço e verifica o proprietário do snapshot, do dashboard e da marca, além da navegação para `/painel`. Outro teste executa `refreshSavedProfile()` e confirma que a marca válida não abre InAppBrowser.

## Revisão da telemetria

`[IFRN-SUAP-TIMING]` registra apenas nomes de etapa de uma allowlist e duração numérica. Valores arbitrários, incluindo uma matrícula em formato alfanumérico, são descartados. A instrumentação não executa chamadas de rede nem abre ou recarrega telas.

O logger usa `CoreLogger`; além disso, a telemetria retorna sem registrar quando `CoreConstants.BUILD.isProduction` ou `isTesting` for verdadeiro. O teste verifica a supressão nas duas configurações. A APK desta fase tem `isDevelopment=true`, então emite as medições sanitizadas para o teste diagnóstico.

Não são registrados tokens, cookies, credenciais, URLs, nomes, matrícula, perfil, respostas de API ou conteúdo de sessão. Os tempos de TTFB são aproximações do navegador, não medidas isoladas do servidor.

## Testes e verificações

- Suíte CJS + ESM: **257 testes; 256 passaram, 1 falhou; zero skip/todo**. A falha é a regressão P0.4 já existente (`core handler in flight must not activate A or navigate after cancellation and account B`), que ainda mostra A persistida, ativa, com LOGIN e navegação após cancelamento. Ela é da sessão nativa Moodle, não do login SUAP.
- Testes focados do perfil/telemetria: **7/7 passaram**, incluindo proprietário diferente, expiração, consumo único, bloqueio em produção/teste, fluxo de refresh e `commit()` real.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` passou.
- ESLint: **zero diagnósticos novos** nos seis arquivos TypeScript modificados, por comparação de contagens de regra/mensagem com `HEAD`. O helper novo também passou isoladamente.
- `git diff --check` nas alterações de código-fonte: passou. O bundle gerado `mobilemoodle.js` contém espaços finais em strings/template strings do runtime Angular; por isso o `git diff --check` sem exclusão desse artefato assinala essas linhas geradas. Não foi aplicado um trim pós-build, para não modificar manualmente o bundle usado pela APK.
- A regressão P0.4 continua sem skip, todo, alteração de expectativa ou supressão.

Arquivos desta etapa: `src/MoodleIFRN/services_mobile/suap-login-telemetry.ts` (helper novo); `services_mobile/painel-ava.service.ts`; `services_mobile/suap-entry.service.ts`; `services_mobile/auth.service.ts`; `marketplace-ifrn/marketplace-ifrn.ts`; `painel/painel.ts`; `mobilemoodle/core_mobile/app-router.ts`; `mobilemoodle/mobilemoodle.js` (gerado para a build); `tests/suap-login-telemetry.test.cjs` (novo/expandido); `tests/painel-login-after-course.test.cjs`; este relatório e a APK diagnóstica. `config.xml` foi normalizado pelo prepare do Cordova, mas seus bytes foram restaurados ao conteúdo de `HEAD` (hash Git idêntico); não há alteração semântica nele.

## Ambiente e processo de build

Versões usadas: Node 22.17.0, npm 10.9.2, Angular CLI 20.3.22 / Angular 20.3.18, Ionic CLI 7.2.1, Cordova 13.0.0, `cordova-android` 14.0.1, Java 17.0.20.1 e Android Build Tools 36.0.0. São as versões instaladas e declaradas no projeto; nenhuma dependência foi instalada ou atualizada.

O build Ionic padrão falhou antes do Gradle porque o Gulp inicia `env` e `mobilemoodle-ts` em paralelo: o esbuild leu `src/assets/env.json` enquanto ele estava vazio. Não modifiquei `gulpfile.js`. Executei sequencialmente as tarefas de geração de ambiente, ícones, idiomas e bundle mobilemoodle; depois rodei `ng run app:build:development` e `ionic cordova build android --no-build --debug`. A build Cordova terminou com `BUILD SUCCESSFUL`.

Avisos observados: Browserslist contém versões Android/Chrome fora do suporte Angular atual; AGP 8.7.3 recomenda suporte explícito para `compileSdk 36`; há depreciações Gradle/Java e bibliotecas nativas não stripáveis. Não impediram a build e não foram alterados nesta fase.

As rotas IFRN do núcleo e o ajuste de navegação do curso já estavam presentes no checkout. O hook Cordova do InAppBrowser estava idempotentemente aplicado nas cópias de `node_modules`, `plugins` e `platforms`. Nenhum arquivo-fonte de `src/core/`, `src/addons/` ou plugin foi alterado nesta etapa.

## Identificação da APK

- Caminho: `.analise/correcoes-p0/p13-suap-diagnostic-20261101.apk`
- SHA-256: `D09631055854BF5C849C652A9F7B448C39AF56E301F7515AA9685326E24A7025`
- Package ID: `com.moodle.moodlemobile`
- Version name / code: `5.2.1` / `52100`
- Build: debug, Angular `development`, min SDK 24, target SDK 36, compile SDK 36.
- Flags `env.json` empacotadas: `isProduction=false`, `isTesting=false`, `isDevelopment=true`, `lastCommitHash=5f88fd805653d0bc6d8d816332bdf06df14ec41e`.
- O bundle extraído da APK contém `[IFRN-SUAP-TIMING]`, `ifrn_panel_profile_fresh_until` e o código de associação por proprietário.
- Certificado debug: `C=US, O=Android, CN=Android Debug`; SHA-256 `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`.

O manifesto declara as permissões: `INTERNET`, `ACCESS_NETWORK_STATE`, `READ/WRITE_EXTERNAL_STORAGE` (até API 32), `RECORD_AUDIO`, `CAMERA` (opcional), `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `MODIFY_AUDIO_SETTINGS`, `READ_APP_BADGE`, `com.google.android.c2dm.permission.RECEIVE`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`, permissões de badge de fabricantes e permissões customizadas de push/background do próprio package. A comparação por `aapt dump permissions` encontrou as mesmas 40 linhas de permissões/declarações no APK instalado e na APK de diagnóstico; nenhuma permissão nova foi introduzida.

O `app-debug.apk` anterior, que já existia antes do build, foi preservado e restaurado no caminho padrão. SHA-256 anterior/restaurado: `F6B391D471200CAD777784A8CFBB96F72F2CB8EF340DE5D919F7318D968A93F4`.

## Comparação com o moto g(20)

ADB encontrou exatamente um dispositivo autorizado: moto g(20), Android 11. A inspeção foi somente leitura (`devices`, `dumpsys package`, `pm path`, propriedades do sistema e cópia do APK instalado para análise local). Aplicativo instalado:

- package ID `com.moodle.moodlemobile`
- version name/code `5.2.1` / `52100`
- certificado instalado: SHA-256 `ec5af1754b0f490cfe6a77d57d7dc6edcd31dadb9ae978703a86b2dc69c0c72e`

Esse certificado **não coincide** com o certificado da APK preparada (`a0e220…dbf62`). Portanto, uma atualização por cima seria recusada pelo Android como incompatibilidade de assinatura. Não desinstalei o app nem tentei forçar instalação. Também não há evidência de alteração na sessão existente.

Opções seguras para um teste futuro: usar a chave privada correspondente ao certificado instalado para assinar uma atualização; ou preparar um package de diagnóstico separado com identificador e esquema de retorno OAuth próprios, após validar a configuração institucional do callback. Não recomendo desinstalar ou limpar dados do aplicativo atual.

## Roteiro de medição no Android

Após resolver a assinatura e receber autorização específica para instalar:

1. Preservar a sessão existente; não fazer logout nem troca de conta. Se for necessário testar um login novo, decidir isso separadamente.
2. Abrir o app já autenticado no Painel e coletar logs filtrados apenas por `[IFRN-SUAP-TIMING]`; não coletar logs gerais do WebView.
3. Para a etapa de entrada, `marketplace-preflight` mede a preparação até antes da chamada de autenticação; `inappbrowser-open-call` mede apenas a chamada síncrona de abertura; `browser-load-suap` registra os intervalos de navegação observados.
4. `suap-visible-wait` cobre o período em que a autenticação está visível, incluindo interação humana e parte da espera de rede. Não separa automaticamente tempo de digitação humana e rede.
5. `courses-api-response`, `panel-profile-api-response`, `suap-profile-api-response` e os sufixos `-ttfb-approx` medem as respostas observadas dentro do navegador; os TTFB são aproximações.
6. `suap-entry-to-validated-data`, `panel-navigation-requested`, `panel-templates-ready`, `panel-dashboard-ready`, `panel-iframe-document-load` e `panel-render-to-frame` separam validação local, navegação e preparação/renderização do Painel.
7. Comparar execuções equivalentes e conservar somente linhas sanitizadas de tempo. O teste funcional da correção é confirmar que a entrada abre um único InAppBrowser e que o refresh pós-login não abre outro.

Não foram coletados tempos reais de login nesta fase e não se declara melhoria percentual. A APK comprova apenas que o bundle diagnóstico está compilado.

## Estado final e riscos

A build está pronta como artefato de diagnóstico, mas **não está pronta para ser instalada como atualização do app atual devido à assinatura incompatível**. A próxima ação segura é obter a chave correspondente ao app instalado ou preparar e revisar um package separado com callback OAuth adequado; nenhuma dessas opções foi aplicada.

A P0.4 continua pendente e vermelha. A P0.13 não modificou o fluxo de sessão Moodle para tentar resolvê-la.
