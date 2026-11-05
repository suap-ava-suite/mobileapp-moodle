# P0.11 — Bridge Cordova experimental do ledger SQLite

Data: 2026-11-01. Branch `fix/p0-release-2.0.1`; HEAD inicial `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. A branch `release/2.0.1` continua em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

**Resultado: dispatcher e bridge Java/JavaScript integrados no fork e APK experimental compilado; execução Cordova no aparelho ainda pendente. A P0.4 permanece bloqueada.** O código permanece em fixtures e `.analise/correcoes-p0/`. Não alterei arquivos de produção, dependências instaladas, `src/core/`, `src/addons/` ou a release. Não instalei o APK.

## 1. Baseline, histórico e descoberta dos testes

Os hashes dos três arquivos originais do `cordova-sqlite-storage` 7.0.0 foram conferidos contra `plugin-baseline.json` e coincidem: `SQLitePlugin.java` `bd1f2e5c…b8546a`, `SQLiteConnectorDatabase.java` `310700c7…b013ab`, `www/SQLitePlugin.js` `945591dd…11cd9f8b`. A cópia `upstream-7.0.0/` preserva esses conteúdos para revisão. O fork contém cópias próprias; os arquivos de `node_modules` não foram tocados.

A divergência de contagem foi reproduzida e explicada pela descoberta:

- O relatório P0.9 registrou 234 testes: o conjunto pré-P0.10 continha 211 casos CJS e 23 casos em seis arquivos `*.test.mjs`.
- O comando P0.10 `node --test src/MoodleIFRN/tests/*.test.cjs` contou 227: 211 CJS anteriores + 16 novos testes P0.10; os seis módulos ESM ficaram fora do glob.
- A execução P0.11 usou CJS e ESM: `node --test --test-concurrency=2 src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs`, total **250**. O teste Android `painel-first-paint.android.mjs` não termina em `.test.mjs`; permanece um teste de dispositivo separado e não foi executado.

## 2. Arquitetura do fork e contrato

O fork está em `src/MoodleIFRN/tests/fixtures/p10-sqlite-extension/cordova-plugin/`, com fontes 7.0.0 copiadas, `plugin.xml`, JavaScript e dependências Android locais. O dispatcher copiado reconhece `sessionLedgerPublish` e `sessionLedgerReconcile`. A API JavaScript do serviço Cordova `SQLitePlugin` chama `cordova.exec` com essas ações. O serviço segue registrado sob o mesmo nome que o wrapper espera, exclusivamente no app experimental.

`sessionLedgerPublish` tem duas fases para que uma tentativa B possa avançar a geração antes de A publicar:

1. `phase: reserve` envia `operationId`, `attemptId`, owner SUAP sintético, epoch e generation. O Java incrementa a sequence no banco e retorna `prepared` e a sequence atribuída.
2. `phase: commit` envia a tentativa preparada. O Java compara todos os campos com o fence mais recente. Uma tentativa antiga recebe `rejected-stale`; uma tentativa atual grava ponteiro, recibo e intenção confirmada na mesma transação.

`sessionLedgerReconcile` recebe identificadores e metadados, nunca um recibo fornecido pelo JavaScript. A fila nativa fecha/reabre o ledger e consulta recibo, ponteiro, intenção e fence no próprio SQLite. A resposta `committed` só é gerada pelo código Java após essa verificação. Falhas de comunicação/SQLite retornam erro ou `unknown`; o bridge não repete a publicação.

As ações do ledger usam um `ExecutorService` de thread única pertencente à instância do plugin. Operações SQLite legadas continuam usando a fila original `DBRunner`. O ledger vive em `filesDir/ifrn-p11-session-ledger/ifrn-p10-p11-ledger.sqlite`, fora do diretório de bancos aberto pelo caminho legado, com nome fixo e privado. Não há acesso ao banco Moodle ou ao armazenamento SUAP.

## 3. Cenários e evidência

Os **16 testes P0.10** continuam passando sobre SQLite real desktop (`node:sqlite`): ACK normal, falha antes do COMMIT e rollback, ACK pós-COMMIT, transação ainda aberta, close/reopen, falha de reconciliação, operação antiga A e B mais nova, reentrada da mesma conta, chamadas concorrentes, callbacks atrasados, reinício, operação/epoch inválidos e quarentena sem prova. Isso valida o modelo desktop, não o runtime Android.

O app Cordova de teste executa ao iniciar, com identidades sintéticas, os fluxos de callback normal, reconciliação após o consumidor ignorar o ACK, callback JavaScript atrasado, A cercada por B, e reentrada com epoch/generation maiores. O JavaScript está empacotado junto do dispatcher e a classe Java compila na build Cordova. Esse cenário está preparado no APK, mas ainda **não foi executado em WebView/Android**; nenhum resultado de runtime é declarado.

Suíte IFRN completa: **250 testes, 249 aprovados, 1 falha; 0 cancelados, 0 skipped, 0 todo**. A única falha é a regressão P0.4 original no teste 51: `core handler in flight must not activate A or navigate after cancellation and account B`. Não surgiu nova falha em relação ao baseline já conhecido. Evidência integral: `p11-full-tests.tap`.

TypeScript `tsc --noEmit -p tsconfig.app.json`: código 0, sem erros. `node --check` passou no bridge, wrapper do fork e script do harness. O ESLint configurado não lintava os JavaScript experimentais (o flat config ignora `**/*.js`; CJS fora dos projetos TS dá erro de parser ao chamar ESLint diretamente). Nenhum arquivo TypeScript de produção foi alterado. A tentativa de lint global foi interrompida porque percorreu os muitos artefatos gerados pelo Gradle; portanto não há um novo resultado global de lint nesta fase. O diff lógico/produção não trouxe diagnóstico novo de lint conhecido.

## 4. Build Android preparada

O harness foi compilado com `cordova-android` 14.0.1, `cordova-sqlite-storage` fork local 7.0.0 e Android SDK/target 35. Gradle terminou com `BUILD SUCCESSFUL`; o dispatcher, plugin e classe ledger foram compilados e o JS incluído no APK. APK:

- Caminho: `src/MoodleIFRN/tests/fixtures/p10-sqlite-extension/harness/platforms/android/app/build/outputs/apk/debug/app-debug.apk`
- Package ID: `br.edu.ifrn.experimental.p11.sqlitebridge`
- Versão: `1.0.0`, versionCode `10000`
- SHA-256: `64432046f0ce73343e4c45a7ffddbe588da59ed975a587229120d9d86232f656`
- Assinatura: debug, verificada via APK Signature Scheme v2; certificado `C=US, O=Android, CN=Android Debug`, SHA-256 `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`
- Permissões declaradas: `android.permission.INTERNET` (padrão do template Cordova) e `br.edu.ifrn.experimental.p11.sqlitebridge.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (permissão interna do AndroidX para receiver não exportado).
- Estado: **não instalado e não executado no dispositivo**.

Metadados repetíveis: `p11-apk.json`. A build não tocou nem substituiu `com.moodle.moodlemobile`. Para a etapa de runtime, o procedimento será conferir `adb devices -l`, conferir novamente o SHA-256, instalar apenas esse package ID, abrir o harness e recolher o JSON sintético exibido na WebView. A autorização específica de instalação ainda é necessária.

## 5. Diferenças e limitações

O bridge end-to-end ainda precisa ser executado no aparelho para confirmar o ciclo Cordova `exec → dispatcher real → SQLite Android → CallbackContext → callback WebView`. A build comprova compilação/registro do dispatcher, não entrega real dos callbacks nem durabilidade sob interrupção.

O ledger usa `android.database.sqlite.SQLiteDatabase` numa pasta privada isolada. A fila e o serviço pertencem ao fork de `cordova-sqlite-storage`, mas o ledger não reutiliza o `SQLiteConnectorDatabase`/driver NDK legado: isso evita compartilhar DBRunner e conexões da aplicação, porém ainda deixa uma diferença de implementação SQLite a validar no dispositivo. O ACK perdido antes do COMMIT e a consulta permanentemente pendente foram exercitados pelo modelo desktop; o harness Android preparado ainda não injeta falhas de energia ou um COMMIT fisicamente travado. Nenhuma falha destrutiva será simulada.

O callback perdido no smoke Cordova ignora deliberadamente, em JavaScript, uma resposta de sucesso já entregue pelo plugin; isso valida que uma reconciliação nova pode encontrar a gravação. Não simula a perda física do canal Cordova entre Java e WebView. O bridge em runtime não prova ativação do site Moodle, eventos LOGIN ou navegação do núcleo.

## 6. Compatibilidade e riscos

O caminho de `open`, `close`, `delete` e `executeSqlBatch` no fork segue o código upstream sem alterações; somente as ações novas usam o executor e banco experimentais. Os hashes upstream foram preservados. A pasta própria do ledger evita colisão pelo nome convencional de banco, mas a futura integração precisa manter a instância e o executor exclusivos, validar callbacks tardios no consumidor e tratar falha de close/reopen como quarentena. Não habilitar no web; `node:sqlite` desktop não confere atomicidade ao backend web.

O fork pode divergir do plugin 7.0.0 e exige patch versionado com manifest/hashes, âncoras, aplicação idempotente e teste para cada atualização. O teste P0.4 exige ainda que o núcleo verifique a tentativa atual antes de persistência, ativação, evento e navegação; esta fase não altera esses pontos.

## 7. Próximos critérios

1. Obter autorização e executar o APK acima no dispositivo autorizado; conferir SHA-256 antes da instalação e não tocar no Moodle principal.
2. Exigir todos os cenários do harness Cordova real aprovados e inspecionar log/JSON sem tokens ou identidades reais.
3. Testar compatibilidade das operações legadas em SQLite e a ausência de acesso cruzado ao ledger.
4. Integrar o contrato ao núcleo apenas depois do teste Android, mantendo a validação oficial de passport e o proprietário SUAP.
5. Fazer o teste P0.4 original passar sem skip/todo, validar o fluxo completo no Android e só então preparar uma proposta para `release/2.0.1`.

## 8. Execução autorizada no Android — P0.11

Em 2026-11-01, confirmei exatamente um dispositivo ADB autorizado: moto g(20), Android 11. O package Moodle `com.moodle.moodlemobile` já estava instalado; não foi aberto, substituído nem modificado. O package do harness não estava instalado antes do teste.

Antes da instalação, o APK foi conferido: SHA-256 `64432046f0ce73343e4c45a7ffddbe588da59ed975a587229120d9d86232f656`, package `br.edu.ifrn.experimental.p11.sqlitebridge`, versão `1.0.0`/versionCode `10000`, target SDK 35, assinatura debug v2 com certificado SHA-256 `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`. `aapt` confirmou a identidade do APK; as permissões declaradas foram somente `android.permission.INTERNET` e `br.edu.ifrn.experimental.p11.sqlitebridge.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. O package instalado reportou os mesmos versão e código. O hash foi confirmado novamente depois da execução.

A primeira tentativa via `monkey` não trouxe a Activity ao topo; resolvi isso iniciando explicitamente apenas `br.edu.ifrn.experimental.p11.sqlitebridge/.MainActivity`. A janela exibiu `Harness concluído` e sete checks passaram: callback do caminho Cordova exec/dispatcher/SQLite, reconciliação após close/reopen, callback de ACK deliberadamente ignorado, callback JS atrasado, fence A→B, reentrada da mesma identidade com epoch/generation crescentes e agregação de sucesso. O banco sintético foi criado em `files/ifrn-p11-session-ledger/ifrn-p10-p11-ledger.sqlite` no armazenamento privado do harness. Nenhum dado Moodle ou SUAP foi acessado.

Os logs filtrados não mostraram erro do harness. O buffer de crash continha um erro antigo de outro package (`br.com.brainweb.ifood`, timestamp 10-29), sem relação com esta execução; não atribuo os tombstones reportados pelo `monkey` ao harness. A evidência estruturada da inspeção está em `p11-android-runtime.json`.

Isso comprova o smoke test Cordova/Java/SQLite no Android para os cenários incluídos no APK. Não injeta perda física do canal Cordova, não testa durabilidade sob falha de energia e não integra o ledger ao fluxo real Moodle. O harness permanece instalado conforme o escopo autorizado. A P0.4 continua bloqueada; o núcleo ainda precisa validar a tentativa antes de persistência, ativação, evento LOGIN e navegação.

Com esta execução, o primeiro critério da seção anterior foi atendido e os cenários presentes no harness foram aprovados. Compatibilidade completa das operações SQLite legadas e integração no núcleo continuam como pendências antes de qualquer integração de produção.
