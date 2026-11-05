# P0.10 — Reconciliação experimental de ACK SQLite

Data: 2026-11-01. Branch `fix/p0-release-2.0.1`, HEAD inicial `5f88fd805653d0bc6d8d816332bdf06df14ec41e`; `release/2.0.1` permanece em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

**Resultado: protocolo experimental aprovado nos testes desktop; integração no plugin e resolução da P0.4 continuam bloqueadas.** O código novo está somente em `src/MoodleIFRN/tests/fixtures/p10-sqlite-extension/` e no teste P0.10. Não alterei `node_modules`, `src/core/`, `src/addons/`, `src/MoodleIFRN/` de produção nem a branch release. Os relatórios e evidências anteriores foram preservados.

## 1. Causa raiz e baseline do plugin

O `cordova-sqlite-storage` instalado é 7.0.0. O `SQLitePlugin.execute` aceita ações conhecidas; `executeSqlBatch` converte cada lote em `DBQuery` e o adiciona à fila `DBRunner`. O `SQLiteConnectorDatabase.executeSqlBatch` percorre as instruções e devolve callbacks do lote. O wrapper JavaScript mantém sua própria fila/lock de transação enquanto aguarda o callback de `COMMIT`. Não há `operationId`, recibo de COMMIT, endpoint de consulta de recibo nem uma ação que feche e reabra somente o banco de uma tentativa. Assim, um callback ausente não prova se o COMMIT foi aplicado e zerar o lock ou reenviar o COMMIT pode liberar uma operação errada ou duplicar efeitos.

Hashes SHA-256 da base instalada, também registrados em `plugin-baseline.json`:

| Arquivo do plugin 7.0.0 | SHA-256 |
|---|---|
| `src/android/io/sqlc/SQLitePlugin.java` | `bd1f2e5c21598160e887879ec9031857653169c3d083b1cab2cc171c37b8546a` |
| `src/android/io/sqlc/SQLiteConnectorDatabase.java` | `310700c7c93ec430f4e638fcba2cc372dbf310de818a401921ad9aab65b013ab` |
| `www/SQLitePlugin.js` | `945591ddaca157e3811db492ef0d8761d64576c4ada7aa936e72b26111cd9f8b` |

Os três hashes foram conferidos novamente após os testes: nenhuma fonte instalada do plugin foi modificada.

## 2. Contrato experimental do recibo

O fixture reserva uma sequência monotônica e persiste uma intenção antes de publicar. Cada recibo contém `operationId`, `sequence`, `attemptId`, `owner`, `epoch`, `generation`, resultado `published` e confirmação `committed`. IDs são sintéticos nos testes; `siteId` não participa da identidade da versão.

A publicação abre uma transação SQLite e verifica o fence atual. Dentro da mesma transação grava/atualiza o ponteiro, insere o recibo imutável e marca a intenção como confirmada. Só considera sucesso depois de `COMMIT` retornar. Falha antes do COMMIT tenta rollback; falha ao estabelecer terminalidade permanece `unknown`. Um `operationId` repetido não repete a escrita: apenas pode retornar resultado se recibo, ponteiro e fence ainda corresponderem à tentativa atual.

Uma reserva mais nova — inclusive do mesmo owner após logout/reentrada, com epoch maior — invalida a tentativa antiga. Um recibo antigo por si só não autoriza a publicação nem os efeitos subsequentes.

## 3. Sequência de COMMIT e reconciliação

1. A operação reserva e confirma sua intenção/sequence no ledger isolado.
2. A publicação confere owner/epoch/generation/sequence e grava ponteiro, recibo e confirmação da intenção em uma transação atômica.
3. Se a resposta se perde, o resultado fica `unknown`; não há repetição automática nem desbloqueio geral.
4. A reconciliação fecha e reabre apenas a conexão do arquivo isolado. Falha de close/open/consulta continua `unknown`.
5. Após essa barreira, recibo e ponteiro exatos com fence atual provam `committed`; intenção válida sem recibo prova `rolled-back`. Recibo inválido, operação diferente ou geração superada é rejeitada.

A ausência de recibo em uma conexão que ainda pode estar dentro da transação não é considerada rollback. Os testes desktop mantêm uma transação realmente aberta na conexão `node:sqlite`; antes da reabertura o estado é desconhecido, e depois de fechar/reabrir o SQLite remove as gravações não confirmadas. Também foi simulado ACK perdido depois do COMMIT: sem barreira permanece desconhecido; depois de reabrir, o recibo durável correspondente é encontrado, sem repetir a publicação. O teste preexistente da fila JS real do plugin continua confirmando que um callback COMMIT desconhecido mantém a fila antiga bloqueada; o protótipo novo não reinicializa nem libera esse lock global.

## 4. Código experimental

- `ExperimentalSessionLedger.java`: implementação Android isolada, com arquivo cujo nome deve ser privado e prefixado `ifrn-p10-`; transação do ponteiro/recibo/intenção e reconciliação por close/reopen.
- `SQLiteSessionLedgerBridge.js`: contrato opt-in para as futuras ações Cordova `sessionLedgerPublish` e `sessionLedgerReconcile`; valida metadados e mantém estado desconhecido em quarentena, sem retry.
- `ledger.cjs`: ledger desktop sobre `node:sqlite`, com SQLite real em arquivos temporários e injeção determinística dos pontos de falha.
- `upstream-7.0.0/`: cópia local controlada de `SQLitePlugin.java`, `SQLiteConnectorDatabase.java` e `SQLitePlugin.js`, com hashes idênticos à instalação.
- `p10-sqlite-reconciliation.test.cjs`: 16 testes determinísticos.
- `plugin-baseline.json`: hashes da versão upstream, ações pretendidas e política para um patch futuro. Não aplica patch.

O Java foi compilado com `javac -Xlint:all` contra `android-36/android.jar`, sem erros. Não foi empacotado nem executado em Android nesta fase. A cópia upstream é uma base de fork controlada, ainda sem hunks de integração: o bridge JS não está conectado ao plugin atual e as ações indicadas ainda não existem nele. A implementação transacional foi mantida como classe experimental lateral para que não se alegue uma extensão Cordova concluída sem o dispatcher Java/JS real.

## 5. Testes e resultados

Os 16 testes focados passaram, sem skip/todo: ACK normal; falha pré-COMMIT e rollback; ACK perdido pós-COMMIT; transação fisicamente aberta; close/reopen; falha de I/O durante reconciliação; A→B; reentrada da mesma identidade em epoch/generation novos; fence mais recente antes de publicar; chamadas simultâneas ordenadas pelo fence; operações consecutivas; reinício com conexão nova; recibo/epoch inválidos; e contrato do bridge sem retry. SQLite real foi usado via SQLite embutido no Node 22.17.0 (SQLite 3.50.0); o Java não foi executado, apenas compilado. Não se usou SQLite desktop como alegação de teste Android.

A suíte CJS completa executada com `node --test src/MoodleIFRN/tests/*.test.cjs` contou **227 testes: 226 aprovados, 1 falha, 0 cancelados, 0 skipped e 0 todo**. A única falha continua sendo o teste original `P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B` (teste 51); não foi alterado nem suprimido. Evidência integral: `p10-final-tests.tap`. A suíte focada P0.10: **16/16 aprovados**. `node --check` nos arquivos JS experimentais passou. O `git diff --check` não apontou erro de patch; exibiu apenas aviso preexistente de conversão LF/CRLF em `09-isolamento-nativo.md`.

O teste de ACK atrasado usa uma resposta JS retida após a operação síncrona já ter terminado no SQLite desktop; ele não mede uma fila Java real. A concorrência de tentativas é testada deterministicamente pelo fence e pelas transações serializadas do SQLite, mas não substitui stress test de threads Android.

## 6. Limitações e riscos

- O plugin 7.0.0 continua sem as novas ações; não existe ainda a integração JavaScript/Cordova que as despache para a classe experimental. Portanto, o fluxo Moodle ainda não pode reconciliar ACK desconhecido.
- O desktop comprova atomicidade e recuperação do SQLite que acompanha o Node, não o comportamento de `SQLiteConnectorDatabase`/SQLite Android, do filesystem do dispositivo ou de interrupção do processo Android.
- A classe Android requer um executor serial por ledger e um arquivo privado realmente exclusivo. A classe não deve ser instanciada por vários owners para o mesmo arquivo; a integração deve impor essa propriedade e tratar close/reopen como operação que pode falhar.
- O protocolo protege somente ponteiro/recibo no mesmo banco SQLite. Não torna SQLite e SecureStorage uma transação distribuída, não valida passport, não ativa `CoreSitesProvider`, não emite `LOGIN` e não protege callbacks/navegação do núcleo.
- A resposta de recibo deve ser autenticada pelo próprio código nativo e correlacionada a todos os campos; não aceitar objeto fornecido livremente pelo JavaScript como prova de close/reopen.
- Não houve APK, instalação, acesso ao banco Moodle ou alteração de sessão no celular. A execução Android do P0.8 anterior não cobre este código.

Por isso, **P0.4 permanece bloqueada e não resolvida**.

## 7. Impacto no plugin e integração futura

Impacto nesta fase: nenhum nos arquivos originais. A alteração futura deverá ser um patch versionado do fork do `cordova-sqlite-storage`, com preflight de hash/âncoras, inspeção sem escrita, aplicação idempotente, falha fechada e diff revisável. O patch terá de adicionar as duas ações ao JavaScript e ao `SQLitePlugin.execute`, despachar ambas por uma fila/worker de um banco IFRN dedicado, e implementar a transação e o close/reopen isolados sem tocar em locks globais ou no banco Moodle. Cada conexão/ledger precisa ter uma identidade fixa; a resposta de reconciliação deve carregar o recibo nativo integral.

Antes da ligação ao `CoreSessionAttempt`, falta validar em harness Android isolado: COMMIT/rollback real usando a mesma versão SQLite do plugin, perda de callback antes e depois de COMMIT, conexão presa e close/reopen, recuperação após encerramento do processo, competição entre gerações, erro na reconciliação e filas consecutivas. Qualquer instalação no moto g(20) requer pacote experimental, SHA-256 e permissões apresentados e nova autorização explícita. Depois disso, ainda será necessária a integração cooperativa no núcleo antes de alegar isolamento das ativações, eventos LOGIN e navegação.

## 8. Critérios para integração

1. Ações JS/Java reais no fork versionado, com banco dedicado e worker serial; manifest de patch verificado contra hashes da dependência efetivamente instalada.
2. Testes Android instrumentados que comprovem recibo durável, rollback, recuperação close/reopen e ACK desconhecido sem repetir COMMIT.
3. Falha de reconciliação permanece em quarentena sem destravar publicação obsoleta; A→B e reentrada passam em execuções concorrentes.
4. Bridge Cordova autenticado e testado; suporte web permanece explicitamente desabilitado até oferecer semântica equivalente.
5. Integração posterior com `CoreSessionAttempt` valida a tentativa na fronteira anterior a qualquer ativação/evento/navegação; teste P0.4 original fica verde sem skip/todo.
6. Somente então compilar APK isolado para revisão do package/hash/permissões e solicitar autorização antes de instalação. Não fazer push, merge ou modificar `release/2.0.1` nesta fase.
