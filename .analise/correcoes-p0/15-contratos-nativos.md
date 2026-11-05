# P0.8 — contratos nativos de persistência

**Atualização:** a autorização foi concedida e os testes no Android foram executados. Os resultados atuais estão em [16-validacao-android-nativo.md](16-validacao-android-nativo.md); as referências abaixo a instalação e execução pendentes descrevem o estado anterior à autorização. P0.4 continua aberta.

Data: 2026-11-01. Branch `fix/p0-release-2.0.1`; HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. Release preservada em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

**Estado: validação local concluída; validação de armazenamento no Android ainda pendente de autorização de instalação. P0.4 permanece aberta.** O APK experimental está pronto para revisão, sem instalação realizada nesta etapa. Não há alegação de segurança comprovada do app ou de seus contratos nativos só porque os testes locais passaram.

Foram lidos integralmente os relatórios 09 a 14. Todos os fontes/relatórios anteriores foram preservados. Nenhum arquivo de produção, plugin original, `src/core/`, `src/addons/`, login SUAP ou interface foi modificado. Nenhum patch Moodle, build do APK principal, push, merge, limpeza, logout, abertura de curso ou alteração de sessão no celular foi executado.

## 1. APIs, versões e ambiente investigados

| Componente | Versão / constatação |
|---|---|
| `cordova-sqlite-storage` | 7.0.0; JS de transações em `www/SQLitePlugin.js`; Java em `src/android/io/sqlc` |
| `cordova-sqlite-storage-dependencies` | 5.0.0; jars connector e driver NDK presentes localmente |
| Cordova Android | 14.0.1, instalado no repositório |
| Awesome Cordova SQLite | 9.1.2 |
| `cordova-plugin-moodleapp` | 0.0.0 local; `SecureStorage.java` usa `apply()` e responde sucesso depois |
| Push / criptografia existente | `@moodlehq/phonegap-plugin-push` 4.0.0-moodle.13, `EncryptionHandler.kt` |
| Backend web | `wa-sqlite` 1.0.0, `IDBBatchAtomicVFS`, fila global do adaptador Moodle com paralelismo 1 |
| Testes locais | Windows, Node v22.17.0, SQLite desktop 3.50.0 da P0.7 |
| Java | Temurin/OpenJDK e javac 17.0.20.1; fontes experimentais compilados com `--release 8` |
| SDK do harness | Android API 36, build-tools 36.0.0; minSdk 26, targetSdk 36 |
| Dependências offline do harness | lazysodium-android 5.2.0, JNA Android 5.17.0, Kotlin stdlib 1.9.24 e jars SQLite existentes |
| USB, inspeção somente leitura | Exatamente um aparelho autorizado, moto g(20), Android 11; Moodle instalado 5.2.1 / 52100 |

O APK principal instalado não foi revalidado como correspondente às correções; a versão continua sem identificar commit, conforme a baseline 11. A inspeção não leu tokens, cookies, perfil ou banco do Moodle. O número de série não foi gravado nas evidências.

## 2. Armazenamento seguro: contrato real e alternativa isolada

### O que o código atual oferece

`SecureStorage.java` criptografa com `EncryptionHandler`, usa coleções `moodlemobile_shared_prefs_<collection>` e chama `Editor.apply()` para store/delete/deleteCollection. A API TS expõe Promises de `cordova.exec`, mas não acrescenta confirmação de escrita em disco.

`apply()` inicia persistência assíncrona e não informa falhas ao chamador; `commit()` devolve resultado de escrita síncrona. O retorno false deve ser tratado como persistência não confirmada, sem inferir que nada foi escrito. Readback pode observar memória e não substitui a confirmação. [Android: Editor](https://developer.android.com/reference/android/content/SharedPreferences.Editor), [limites de SharedPreferences](https://developer.android.com/reference/android/content/SharedPreferences).

**Nova fronteira identificada:** `EncryptionHandler.getPublicKey()` salva a chave privada sodium encapsulada por RSA e a chave pública em duas chamadas `apply()` separadas. Portanto trocar somente o último `apply()` de `SecureStorage` por `commit()` não cobre a primeira inicialização do material criptográfico.

O helper usa RSA/AndroidKeyStore para encapsular a chave privada e sealed boxes sodium para os valores. A alternativa não reimplementa esse algoritmo. Os consumidores existentes incluem sessões Moodle, pendências de unregister push, obtenção da chave pública para push e descriptografia de mensagens recebidas. Uma substituição global do store ou da inicialização de chaves exigiria regressão desses caminhos, não apenas SSO.

### Alternativa implementada somente no harness

`DurableVersions` é um contrato Java sem dependência Android, compartilhado pelos testes JVM e pelo harness. `AndroidPorts` implementa as portas Android:

1. Captura valores imutáveis antes de iniciar trabalho assíncrono; aceita apenas token/privateToken.
2. Executa em `ExecutorService`, sem bloquear a UI com espera por commit.
3. Usa o `EncryptionHandler` existente. Na preparação de chaves, chama a inicialização oficial, exige ambas as entradas e confirma seus mesmos bytes com `commit()` no arquivo auxiliar. Falha impede gravar credenciais.
4. Criptografa os campos e o marcador de versão e confirma a coleção exclusiva `ifrn-p08-<version>` com `commit()`.
5. Só devolve sucesso depois de retorno true. Falha/ACK desconhecido não aciona exclusão compensatória nem publicação no SQLite.
6. A leitura exige token, privateToken e versão coerente, sem usá-la como prova de durabilidade. A coleta tem namespace restrito e commit confirmado para remoção.

O arquivo, nomes e codificação legados são mantidos; uma coleção sintética no formato antigo é preparada para validar leitura/decrypt sem conversão destrutiva. Não se acessa a coleção ou o Keystore do Moodle instalado: o harness tem outro package/UID.

**Precondições e limites:** a exclusividade de gravação de uma versão vem da claim SQL da P0.7. A checagem read-before-write Java não é CAS entre processos. O chamador só pode autorizar GC de tentativas terminais não confirmadas. A sincronização de inicialização usada por `AndroidPorts` abrange apenas o caminho novo; os outros consumidores do helper ainda não usam esse lock. Uma integração futura precisa coordenação comum da criação de chaves, ou precondição comprovada de chaves estáveis, para não esconder uma corrida com o caminho legado.

O harness incorpora bytecode oficial já existente no build local, com hashes registrados; não houve recompilação Kotlin fresca nem prova de vínculo desse bytecode a um commit de origem. Esse limite impede apresentar o APK como build de produção identificada. Nenhuma chave/algoritmo novo foi inventado para fazer os testes Android passarem.

## 3. SQLite Cordova: contratos e resultados locais

O JavaScript do plugin 7.0.0 foi executado **integralmente e sem modificações** numa VM de teste, usando um `cordova.exec` simulado sobre SQLite desktop real. É uma evidência mais próxima que o port da P0.7: os métodos reais `sqlBatch`, `SQLitePluginTransaction`, fila, abort e finish agora foram exercitados, não reimplementados no teste.

Resultados comprovados:

- Lote solicita BEGIN e COMMIT; erro de constraint provoca ROLLBACK pela implementação JS real; nenhum insert parcial permanece.
- Dois lotes concorrentes seguem a fila JS, sem intercalar BEGIN/COMMIT.
- O adaptador P0.7 publica B e recusa A cancelada ao passar por esse driver JS real; reentrada da mesma identidade muda epoch.
- O schema sintético `sites_2` com os oito campos existentes e seus valores permanece igual, inclusive `PRAGMA table_info`, depois da instalação das tabelas experimentais e de uma publicação que falha.

**Nova limitação comprovada:** ao executar fisicamente COMMIT e reter seu callback, a fila JS continua ocupada. O lote B não inicia até liberar o ACK. Se o ACK nunca chegar, consultar o recibo pela mesma fila não constitui recuperação: a consulta também fica enfileirada. Isso restringe a leitura pós-erro assumida pelo port desktop da P0.7.

O teste não provoca hang indefinido: retém o ACK por uma porta determinística, verifica a fila e depois o libera. Ainda não há implementação de recuperação do plugin diante de ACK permanentemente perdido. Timer/Promise.race externos não liberam essa fila com segurança. O futuro contrato precisa poder inspecionar/reconciliar a decisão durável por um caminho de recuperação definido e cercado por geração, sem simplesmente zerar locks globais enquanto uma transação nativa pode estar viva.

### Java/NDK investigados

`SQLitePlugin.java` possui um DBRunner e BlockingQueue por banco. Na ausência de opções antigas, usa `SQLiteConnectorDatabase` e o connector NDK; o provedor de sistema Android é outra implementação. O helper executa statements e devolve resultados/erros; a transação completa depende também do controlador JS. Não se deve chamar um lote nativo cru de transação atômica apenas porque seu nome contém Batch.

O harness compila, sem alterar, `SQLiteConnectorDatabase.java` e `SQLiteAndroidDatabase.java` e inclui os jars/.so reais instalados. Seu `NativeSqliteProbe` usa o helper NDK diretamente. CallbackContext e a classe usada só para nome de log são shims explícitos, não o bridge Cordova real. A eventual execução desse APK não será teste de ponta a ponta do Cordova WebView ou do DBRunner.

As tabelas/dados de teste pertencem somente ao banco `p08-only.sqlite` do novo package. A futura sondagem fará BEGIN/erro/ROLLBACK, publicação condicional por geração/epoch, close/open e leitura em processo novo. **Essas operações Android ainda não foram executadas.** Os testes desktop P0.7 de conexão nova, processo filho e lock contention foram reexecutados na suíte; não foram reclassificados como Android.

## 4. SQLite web e ativação por capacidade

O backend atual mantém o método `sqlBatch` com await por statement e não implementa transaction/readTransaction. A fila de `wa-sqlite` evita reentrância de Asyncify; `IDBBatchAtomicVFS` não converte, por si só, aquela sequência de statements em uma transação SQL.

Não foi identificada uma API transacional pronta nesse adaptador. O motor possui primitivas SQL que permitiriam uma implementação futura, mas seria necessário manter BEGIN/statements/COMMIT/ROLLBACK sob uma única exclusão e usar execução interna sem reenfileirar a mesma fila. Envolver o método atual em `sqliteQueue.run()` e aguardar `executeSql()` por dentro pode bloquear a fila de paralelismo 1 contra si mesma.

Nenhuma modificação web foi aplicada ou testada com WASM/IndexedDB real nesta fase. O teste `protocolAvailable` exige opção explícita, plataforma Android, lote atômico e credenciais duráveis. Web/capacidade ausente deixam o **protocolo experimental desabilitado antes de começar**, preservando o caminho legado. Essa política é apenas fixture; não foi conectada à aplicação. Não há fallback automático para login legado depois de commit desconhecido, pois isso poderia criar duas operações concorrentes.

## 5. Código experimental e APK revisável

Arquivos novos em `src/MoodleIFRN/tests/`:

- `fixtures/p08-native/DurableVersions.java`: contrato assíncrono de versões/commit e cleanup.
- `DurableVersionsJvmTest.java`: 12 cenários de controle com mocks explícitos.
- `AndroidPorts.java`: SharedPreferences.commit e delegação à criptografia existente.
- `PersistenceInstrumentation.java`, `NativeSqliteProbe.java`, `CallbackContext.java`, `SQLitePlugin.java`, `AndroidManifest.xml`: harness Android isolado e shims delimitados.
- `fixtures/cordova-sqlite-js-port.cjs`, `cordova-storage-contract.test.cjs`: driver JS original sobre bridge desktop simulado, oito testes.
- `native-persistence-contract.test.cjs`: compila/executa os 12 cenários JVM, contado como um teste Node.

Scripts novos em `.analise/correcoes-p0/`: `p08-build-harness.py`, `p08-android.cjs`, `p08-evidencias.cjs`. Todos os resultados anteriores permanecem intactos.

| Artefato isolado | Valor |
|---|---|
| Package ID | **`br.edu.ifrn.experimental.p08.persistence`** |
| APK | `p08-harness-1793562393209824300/p08-persistence.apk` |
| Tamanho | 4.306.447 bytes |
| SHA-256 | `481e1e0da6e1991b43787ec386cdec12ebd8ca0cb572ed27177e1acf71fdfda4` |
| Manifest | Sem Activity, sem permissão de rede, backup desabilitado; self-instrumentation no próprio package |
| Assinatura | Debug experimental própria, verificada v2/v3; não é assinatura/publicação do Moodle |
| Build | Offline por javac/D8/aapt2/zipalign/apksigner, sem Gradle/Cordova prepare e sem tocar o build principal |
| Instalação | **Não realizada; autorização solicitada pela pergunta específica de instalação** |

O primeiro build encontrou acesso negado do sandbox ao fechar um JAR no javac, apesar de saída 0. Isso não foi ignorado: a compilação foi repetida com acesso autorizado em outro diretório, sem stderr, e os **13 arquivos .class ficaram byte a byte idênticos** aos do APK. O hash do APK apresentado não mudou. `p08-javac-verified.json` registra a verificação; `commands.json` conserva o diagnóstico original. A primeira descoberta de dependências também falhou por procurar jars numa pasta não hoisted; a localização correta foi usada sem instalar nada.

O runner Android aceita `--inspect` somente leitura ou `--install-authorized`. O segundo modo exige o hash acima, um único aparelho autorizado e ausência de instalação prévia do harness; não possui substituição, desinstalação ou clear-data. Usa apenas seu próprio package para force-stop entre as duas fases. Não foi executado o segundo modo.

## 6. Testes obrigatórios: execução e limites

| Cenário | Executado / evidência | Android real |
|---|---|---|
| 1. Store com sucesso confirmado | JVM: Future só completa após commit true; criptografia/preferências mockadas | Pendente; APK preparado para commit real + ciphertext |
| 2. Erro de persistência | JVM: commit false e falha da barreira de chaves impedem sucesso; memória pode já estar alterada | Falha física de disco não provocada |
| 3. Rollback SQLite | Driver JS original + SQLite desktop: constraint leva a ROLLBACK | Sondagem helper NDK preparada, não executada |
| 4. Falha parcial entre armazenamentos | 46 testes P0.7 reexecutados; driver JS adicional verifica publicação SQL falha sem alterar legado | Não executada; não existe transação distribuída |
| 5. Writer tardio cancelado | JVM: A retida, B termina na mesma store e mantém valor; P0.6/P0.7 verificam invisibilidade/coleta | Não executada |
| 6. Gerações concorrentes | Driver JS real serializa lotes; P0.7 compara geração/epoch no SQL real | Teste condicional preparado; concorrência Android ainda pendente |
| 7. Reentrada na mesma conta | Novo teste Cordova JS e suites anteriores invalidam epoch antigo | Não faz login/logout de aluno; futuro teste só usa identidade sintética |
| 8. Recuperação após encerramento | JVM com disco mockado; P0.7 com SQLite de arquivo/processo filho | Seed/recover em processos separados preparados, não executados |
| 9. ACK atrasado/desconhecido | JVM sem sucesso antecipado; JS original demonstra retenção da fila; P0.7 preserva decisão durável | Injeção de ACK nativo ainda não implementada/testada |
| 10. Compatibilidade legada | Sentinela sites_2 com schema/data preservados; cleanup JVM conserva coleção antiga | Crypto legado sintético preparado no sandbox, não executado |

Não houve teste em Robolectric ou emulador. Compilar contra `android.jar` não executa SharedPreferences/SQLite Android. O runner JVM não declara criptografia real: usa prefixo sintético e mapas de memória/disco. A fila do driver JS é real, mas `cordova.exec` e o plugin nativo desse teste são simulados, sobre SQLite desktop real.

### Resultado quantitativo

- Baseline: **215 testes Node, 214 passam / 1 falha**.
- Final: **224 testes Node, 223 passam / 1 falha**, sem skip, todo ou testes cancelados.
- Novos: oito casos Cordova JS + um wrapper JVM; o wrapper executou **12 cenários JVM, todos aprovados**. Esses 12 não foram somados como se fossem 12 testes Node adicionais.
- Os 53 testes P0.6 e 46 P0.7 continuam aprovados e seus arquivos não foram alterados.
- TypeScript `tsconfig.app.json` noEmit: zero erros. Não equivale a validar a API Java/Android em runtime.
- Lint: mesmos 63 erros/107 avisos existentes, nenhum diagnóstico novo; não está globalmente aprovado.
- Métricas de produção idênticas à P0.7. Não há ganho de desempenho, tamanho de bundle ou APK principal declarado.
- **Armazenamento Android real: zero testes executados nesta fase até a autorização.** A inspeção do dispositivo não é teste de persistência.

O teste `P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B` permanece vermelho, sem skip/todo ou mudança de expectativa.

## 7. Evidências e comandos

`p08-fontes.json` reúne branch/commits, versões, hashes, preservação dos fontes P0.7, contagens e distinção dos runtimes. `p08-jvm-<pid>.json` conserva compilações e saídas JVM; `p08-harness-build.json` e o `commands.json` do build registram o APK; `p08-javac-verified.json` demonstra a recompilação limpa. `p08-device.json` registra apenas inventário sanitizado.

```text
git status --short --branch
git rev-parse HEAD release/2.0.1
java -version / javac -version
node .analise/correcoes-p0/validar.cjs p08-before tests
python .analise/correcoes-p0/p08-build-harness.py
python .analise/correcoes-p0/p08-build-harness.py --verify-existing
node .analise/correcoes-p0/validar.cjs p08-experimental tests native-persistence-contract.test.cjs cordova-storage-contract.test.cjs
node .analise/correcoes-p0/p08-android.cjs --inspect
node .analise/correcoes-p0/validar.cjs p08-final tests
node .analise/correcoes-p0/validar.cjs p08-final typescript
node .analise/correcoes-p0/validar.cjs p08-final lint
node .analise/correcoes-p0/comparar-lint.cjs p08-final
node .analise/correcoes-p0/validar.cjs p08-final metrics
node .analise/correcoes-p0/p08-evidencias.cjs
git diff --check
```

A execução ADB restrita falhou; a repetição autorizada somente leitura funcionou. A permissão de executar ferramentas fora do sandbox **não foi tratada como autorização de instalar**. A pergunta assíncrona de instalação permanece dependente de resposta explícita; o aceite técnico de envio da pergunta não é aprovação do usuário.

Depois da autorização, o comando previsto é `node .analise/correcoes-p0/p08-android.cjs --install-authorized`. Ele verificará o hash instalado, executará seed, encerrará somente o harness e executará recover. Isso criará `p08-android-result.json`; a existência do APK ou do script não prova que esses comandos já tenham sido executados.

## 8. Alterações mínimas necessárias e compatibilidade

Proposta futura, **não aplicada**:

1. Adicionar ações opt-in `storeDurableVersion/deleteDurableVersion` e capability versionada no plugin, preservando `store/get/deleteCollection` existentes e todos os demais consumidores. Callback único e sanitizado, somente depois do resultado de persistência; falha é resultado desconhecido/não confirmado.
2. Definir uma barreira de inicialização durável de chaves no helper comum, com coordenação dos demais inicializadores; preservar RSA/Keystore, sodium, aliases, codificação e arquivos antigos. Testar push/unregister e cold start, não apenas credenciais de curso.
3. Integrar ponteiro/versão/epoch ao mesmo banco e transação; atualizar caches de site/config somente com lease atual. Não gravar novas credenciais na coleção ativa antiga antes da confirmação.
4. Acrescentar recuperação segura da fila JS diante de ACK permanentemente perdido. A consulta de recibo não pode depender exclusivamente da fila que está retida. Recusar ativação até decidir o resultado, sem replay cego, reset de lock ou rollback compensatório de B.
5. Manter o protocolo novo desabilitado no web até haver transação implementada/testada no WASM/IndexedDB; não alterar o fluxo legado só por causa deste experimento.
6. Definir importação de referências legadas, identidade SUAP confiável, geração/epoch, expiração, GC e lease até LOGIN/navegação no core. Sentinelas preservadas não demonstram migração completa de sessões reais.

Os controles Java não são novo login nem aceitam senha de aluno. Passport oficial e validações Moodle/IFRN continuam precondições do futuro caminho. Nenhum dado real foi utilizado.

## 9. Critérios objetivos para continuar

1. Obter autorização explícita para o package/hash apresentado e executar o harness Android isolado. Exigir zero falhas nas duas fases, hash instalado correspondente e recuperação de credenciais/ponteiro em processo novo. Se falhar, registrar o resultado sem limpar dados ou trocar o APK principal.
2. Acrescentar testes Android isolados de erro de persistência/ACK, falha parcial, disputa entre writers e descarte, sem simular que retorno de mock é falha física real. Não provocar disco cheio ou corrupção global no aparelho pessoal.
3. Recompilar a criptografia a partir da revisão fixada, validar a barreira de chaves com todos os consumidores e fixar capacidades dos drivers efetivamente usados.
4. Resolver o caso de ACK desconhecido que retém a fila JS, com testes do contrato de recuperação. O resultado atual impede aprovar a integração como completa.
5. Só então propor patch cooperativo mínimo, versionado e revisável para core/plugins. Exigir teste nativo original corrigido por mudança real, suíte toda verde, TypeScript limpo e nenhum diagnóstico novo de lint antes de qualquer integração à release.

**Conclusão:** existem uma alternativa Java de commit testada localmente e um harness Android revisável, mas a validação nativa continua pendente. Os resultados desktop/JVM não foram convertidos em aprovação Android. A P0.4 não está resolvida e a release permanece intacta.
