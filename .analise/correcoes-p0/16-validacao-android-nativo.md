# P0.8 — validação nativa Android do harness

Data: 2026-11-01. Branch `fix/p0-release-2.0.1`; HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. A release `release/2.0.1` não foi alterada.

**Resultado: 15 verificações passaram no Android real (9 seed + 6 recover), sem falhas.** Isso valida os contratos exercitados pelo harness isolado. Não valida o fluxo Cordova/WebView de login, nem resolve a P0.4: o teste do handler Moodle nativo continua vermelho.

## Dispositivo, APK e limites de segurança

- Havia exatamente um dispositivo ADB autorizado: moto g(20), Android 11.
- Antes da instalação, o APK tinha SHA-256 `481e1e0da6e1991b43787ec386cdec12ebd8ca0cb572ed27177e1acf71fdfda4`.
- O package instalado e testado foi `br.edu.ifrn.experimental.p08.persistence`, versão `p08-1`, versionCode 1. O SHA-256 do APK encontrado no caminho instalado corresponde ao valor autorizado.
- O manifesto do APK declara **zero permissões solicitadas**, não tem Activity, desativa backup e não contém permissão de rede.
- A primeira execução instalou o harness aprovado e parou antes dos testes porque o runner não aceitava `~` no caminho padrão do Android. Após conferir o hash instalado, o runner foi ajustado para aceitar processo Moodle ausente e para retomar um harness já instalado somente se o hash corresponder ao aprovado. A retomada não reinstalou nem substituiu o pacote.
- O processo Moodle já estava fechado na baseline. Após os testes, sua versão (5.2.1 / 52100), data de atualização e condição de processo ausente permaneceram iguais. Nenhum comando abriu o Moodle ou leu seus dados.
- O harness usa banco e SharedPreferences privados de seu próprio UID, credenciais sintéticas e coleção legada sintética. Não houve logout, limpeza ou substituição de aplicativo.

## Execução no Android

`seed` executou em thread de instrumentação fora da UI e passou os nove casos:

1. `off-ui-thread`: execução fora da main thread.
2. `commit-ack-success`: `SharedPreferences.Editor.commit()` retornou sucesso antes da conclusão da operação assíncrona.
3. `ciphertext-not-plaintext`: o valor persistido não era o token sintético em claro.
4. `legacy-fixture-seeded`: gravação da coleção legada sintética.
5. `sqlite-rollback`: falha SQL dentro de `BEGIN` seguida de `ROLLBACK` manteve o valor confirmado anterior.
6. `conditional-generation`: uma escrita com geração antiga não substituiu a geração 2 publicada.
7. `conditional-epoch`: uma escrita com epoch antigo não substituiu o estado de epoch 2.
8. `sqlite-reopen`: estado SQLite sobreviveu ao fechamento e reabertura da conexão.
9. `legacy-sql-untouched`: a linha sentinela legada continuou intacta.

O runner encerrou somente o processo do harness entre `seed` e `recover`. A segunda instrumentação passou os seis casos:

1. `off-ui-thread`.
2. `secure-new-process`: os campos sintéticos foram lidos e descriptografados após reiniciar o processo.
3. `legacy-cipher-new-process`: a coleção sintética no formato legado permaneceu descriptografável após reiniciar.
4. `sqlite-new-process`: o ponteiro de teste persistiu entre processos.
5. `scoped-durable-cleanup`: a coleção candidata do próprio harness foi removida com confirmação.
6. `legacy-survives-cleanup`: a coleção antiga permaneceu acessível após a limpeza delimitada.

O registro ADB sanitizado está em `p08-android-result.json`. As fases devolveram `p08_failed=0`, `p08_passed=9` e `p08_passed=6`. O arquivo registra `installedHashMatches=true`, `ownProcessStoppedBetweenPhases=true`, `mainVersionUnchanged=true`, `mainPackageUpdateTimeUnchanged=true` e `mainProcessUnchanged=true`.

## O que foi exercitado

### Armazenamento seguro

O harness chamou `SharedPreferences.commit()` em uma coleção privada própria, exigindo retorno positivo. Usou o `EncryptionHandler` Android já incluído no APK, sem substituir seu algoritmo, e validou que os campos não estavam em claro e que uma nova instância do processo conseguia descriptografar os dados. A fixture legada sintética também foi lida e descriptografada após o reinício.

Isso comprova persistência observável entre processos no aparelho e compatibilidade do caminho de leitura sintético com o helper de criptografia embarcado. **Não é teste após reboot físico**, não injeta falha de disco/Keystore e não demonstra atomicidade distribuída com SQLite. O bytecode do `EncryptionHandler` veio de classes pré-compiladas disponíveis no build local; não foi recompilado Kotlin de uma revisão de origem identificada. O uso de `commit()` pelo harness não muda o comportamento do plugin em produção.

### SQLite Android

O harness usou o helper NDK `SQLiteConnectorDatabase` do `cordova-sqlite-storage` 7.0.0 e arquivos privados `p08-only.sqlite`. A transação foi conduzida com SQL explícito BEGIN/COMMIT/ROLLBACK. A falha de uma instrução no meio do lote sintético foi seguida por rollback; também foram observadas atualização protegida por valores de geração/epoch, fechamento/reabertura e recuperação em processo novo.

O probe chamou o helper diretamente e usa `CallbackContext` de teste. Ele **não executa** o `SQLitePlugin.java` completo, DBRunner, bridge JavaScript Cordova ou as tabelas reais Moodle. As condições de geração/epoch foram exercitadas em operações sequenciais controladas, não como disputa multi-thread simultânea entre conexões. O resultado não prova comportamento de lote e ACK no plugin completo. A investigação da implementação JavaScript original e do ACK retido sobre SQLite desktop continua registrada no relatório 15.

### Cobertura que continua pendente

| Contrato | Resultado nesta execução Android |
|---|---|
| Commit de credencial sintética e recuperação em processo novo | Aprovado |
| Criptografia existente e leitura de fixture legada sintética | Aprovado para o bytecode embarcado |
| Rollback SQLite no helper NDK | Aprovado no probe direto |
| Geração/epoch contra atualização antiga sequencial | Aprovado; disputa real concorrente não exercitada |
| Compatibilidade com tabelas e sessões reais do Moodle | Não testada; somente sentinela sintética |
| Falha física/retorno `commit=false` no Android | Não injetada; somente JVM/mock cobriu ACK negativo |
| Falha parcial SQLite × armazenamento seguro | Não exercitada no aparelho; não existe transação conjunta |
| ACK tardio/perdido do bridge Cordova e fila JS | Continua pendente; teste de fila real do JS do plugin ocorreu em desktop com bridge simulado |
| Reboot físico / morte abrupta durante I/O | Não testado |
| Integração de login, identidade SUAP ou sessão Moodle | Não testada |

## Evidências e alterações

- Resultado nativo: `.analise/correcoes-p0/p08-android-result.json`.
- Inspeção anterior do aparelho: `.analise/correcoes-p0/p08-device.json`.
- Hash, versão e build do APK: `.analise/correcoes-p0/p08-harness-build.json`.
- Fontes e comparação de hashes P0.7: `.analise/correcoes-p0/p08-fontes.json`.
- Código do harness: `src/MoodleIFRN/tests/fixtures/p08-native/`.
- Runner: `.analise/correcoes-p0/p08-android.cjs`. A mudança local ao runner somente tolera ausência do processo Moodle e permite retomar package existente após comparar SHA-256 exato; não instala uma segunda vez nessa situação.

`node --check .analise/correcoes-p0/p08-android.cjs` e `git diff --check` passaram. A validação funcional foram as duas instrumentações no dispositivo, com 15 casos aprovados e zero falhas. A suíte Node da P0.8 continua em 223/224, com a falha nativa P0.4 preservada; não foi necessário repetir a suíte porque o código de produção e os testes não mudaram nesta execução.

## Conclusão

O moto g(20) confirmou `commit()` bem-sucedido, leitura criptográfica em novo processo, rollback no helper SQLite NDK, condições sequenciais de geração/epoch e preservação de fixture legada. O teste separa adequadamente storage Android e SQLite de desktop/JVM, mas não cobre falha física, commit parcial entre dois armazenamentos, bridge Cordova completo nem concorrência nativa real.

**P0.4 permanece aberta.** Antes de integrar o contrato cooperativo, ainda são necessários: vínculo do código criptográfico a uma revisão reprodutível, coordenação segura da inicialização de chaves com consumidores atuais, resolução do ACK desconhecido que retém a fila do plugin, teste real da fronteira de persistência/ativação no core e cobertura de concorrência e falha parcial apropriada. Nenhuma alteração foi feita em produção, core/addons ou `release/2.0.1`; não houve push, merge ou build do APK principal.
