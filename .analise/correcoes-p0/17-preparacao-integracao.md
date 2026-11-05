# P0.9 — preparação da integração real Moodle IFRN

Data: 2026-11-01. Branch `fix/p0-release-2.0.1`, HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. Branch principal `release/2.0.1` continua em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

**Conclusão: BLOQUEADA para integração real.** Foram preparados um guard experimental que mantém commits desconhecidos em quarentena, testes do limite de recuperação atual e um runner de patch versionado. O plugin instalado não oferece recibo confirmado/barreira de recuperação nem forma de liberar apenas a transação JS presa. Não foi criado patch de produção nem alterado o APK. P0.4 continua falhando.

## 1. Baseline e correspondência

O HEAD e os hashes do manifest correspondem aos arquivos do checkout atual. `git status --short --branch` mostrou o conjunto de relatórios/evidências e testes P0 anteriores como **não rastreados**, já existentes nesta área de trabalho. Não foram removidos nem reescritos. Antes desta fase, `git diff --name-only HEAD` estava vazio; `src/core/`, `src/addons/`, plugins e `release/2.0.1` não tinham alterações rastreadas locais. As adições P0.9 estão limitadas a testes/fixtures e `.analise/correcoes-p0/`.

| Componente do checkout | Versão | SHA-256 do arquivo relevante |
|---|---:|---|
| MoodleIFRN app | 5.2.1 | HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e` |
| Moodle core URL schemes | checkout local | `src/core/services/urlschemes.ts`: `8dfaa56a0ca9f312774ed2767099695f2035bf70a257846ec48ade7c953332c4` |
| Moodle core sites | checkout local | `src/core/services/sites.ts`: `8a2d0d27df80ca48817348bce2113fa7a54b959231e598d5097692f2b53ab13d` |
| Moodle core SQLite wrapper | checkout local | `src/core/classes/sqlitedb.ts`: `5c0a833cd1796a246b3764350e7662630e4897e3999f8db627fa0d6a16b4d0e6` |
| `cordova-sqlite-storage` JS / Java | 7.0.0 | JS `945591ddaca157e3811db492ef0d8761d64576c4ada7aa936e72b26111cd9f8b`; Java `bd1f2e5c21598160e887879ec9031857653169c3d083b1cab2cc171c37b8546a` |
| Cordova Android | 14.0.1 | Versão instalada em `node_modules` |
| `cordova-plugin-moodleapp` | 0.0.0 local | `SecureStorage.java`: `7ea62589e3ba8363815057a6ead205898a829dbce5b446fa7939c452a6fb4be0`; TS `fca2798559066a796433beeb715a76660e51ca66ae433e90e102fc017f49c8d7` |
| Push / EncryptionHandler | 4.0.0-moodle.13 | `EncryptionHandler.kt`: `239c84da28f2b59352be0dd2dfe8a01fbff80a33a446bf79b7e149eced62deb7` |

O inventário completo com hashes de fonte, teste e artefato está em `p09-baseline.json`. O manifest `p09-core-session-manifest.json` fixa as dependências diretamente envolvidas e confere hashes mais âncoras únicas. O comando `node .analise/correcoes-p0/p09-patch.cjs --inspect .analise/correcoes-p0/p09-core-session-manifest.json --root .` confirmou os sete alvos como compatíveis.

## 2. Contrato opt-in para credenciais versionadas

A base experimental existente da P0.8 é `src/MoodleIFRN/tests/fixtures/p08-native/DurableVersions.java` com `AndroidPorts.java`. Ela grava em `ifrn-p08-<version>`, captura os valores antes do trabalho assíncrono, usa `ExecutorService`, mantém a criptografia `EncryptionHandler` e só reconhece sucesso após `SharedPreferences.Editor.commit()` retornar `true`. O harness Android já confirmou commit, ciphertext e leitura/decrypt depois de encerrar e iniciar novamente o processo. A API legada `store/get/deleteCollection` não foi substituída.

Protocolo de integração proposto:

1. Passport e identidade SUAP continuam validados pelo fluxo oficial antes de criar uma versão candidata.
2. Um `attemptId` aleatório e uma chave de coleção versionada isolam os tokens. O `siteId` não identifica a versão.
3. Gravação durável fora da UI captura token, privateToken e versão imutáveis. `false`, exceção ou resposta Cordova perdida significam **estado desconhecido**: não publicar no SQLite e não apagar por compensação.
4. A publicação do ponteiro no ledger só ocorre após a credencial ter ACK durável. Falha entre os armazenamentos deixa candidato órfão, invisível para restauração.
5. A recuperação valida owner/epoch/geração e ponteiro antes de devolver uma sessão; a limpeza só alcança uma versão terminal própria que não seja apontada.

Há uma dependência de segurança ainda aberta. `EncryptionHandler.getPublicKey()` cria private e public sodium keys com duas chamadas `apply()` e não compartilha o lock local do harness com os consumidores legados. O `synchronized` dentro de `AndroidPorts` protege somente o caminho experimental. Uma integração exige coordenação no helper comum, preservando bytes/codificação/Keystore, e testes de push, unregister e inicialização simultânea. Alterar apenas `SecureStorage.store()` não fecha a corrida de inicialização. Portanto o contrato durável da P0.8 é uma base testada, não uma implementação pronta para o app.

## 3. ACK SQLite desconhecido: investigação e resultado

No JS do `cordova-sqlite-storage` 7.0.0, `SQLitePluginTransaction.finish()` envia `COMMIT`; o callback de sucesso é quem limpa `txLocks[dbname].inProgress` e chama `startNextTransaction()`. Se o COMMIT chegar ao Android e o ACK não retornar, operações públicas ficam paradas nessa fila JS. A API atual não expõe identificador transacional, consulta de recibo, barreira FIFO de recuperação nem assentamento de uma transação específica.

No Java, cada banco tem um `DBRunner` com `LinkedBlockingQueue<DBQuery>`. Ele executa itens em ordem, mas `backgroundExecuteSqlBatch` não carrega um `operationId`, não grava um recibo de publicação e não oferece ação de reconciliar/reabrir. A ordem FIFO nativa, sozinha, não diz se um recibo lido pertence a um COMMIT concluído. Também não se deve zerar `txLocks` ou fechar a conexão Moodle compartilhada: isso pode deixar uma transação física ativa, invalidar trabalhos de terceiros e publicar estado obsoleto.

O novo teste `p09: a direct same-connection receipt read can see uncommitted rows before COMMIT` suspende deterministicamente o ACK do lote de statements **antes de o JS enviar COMMIT**. Ele executa o JS original do plugin sobre SQLite desktop com bridge Cordova simulado. Uma leitura direta pela ação nativa observa a linha `candidate` na conexão que ainda está dentro da transação. Logo, consultar um recibo pela conexão existente, sem uma barreira de encerramento, pode confundir estado não confirmado com commit durável. O teste demonstra o perigo e mantém esse caminho bloqueado; não é uma medição Android.

`UnknownCommitGuard` implementa a reação segura no lado experimental: `ack-unknown` põe o ledger em quarentena, impede nova tentativa no mesmo ledger, não repete gravações, não publica e só aceita terminalidade por um capability explícito `committed-receipt-barrier-v1` que vincule operationId, sequence, resultado e ponteiro. Resposta ausente/inválida mantém a quarentena; commit confirmado de epoch antigo não publica. Os testes dessa interface incluem um adapter falso **apenas para testar o contrato desejado**. Isso não implementa nem comprova tal capability no plugin real.

**Não há recuperação controlada completa com as APIs atuais.** Dependência necessária para a próxima implementação: um banco IFRN dedicado, fora do banco Moodle, e uma extensão Java/JS versionada do plugin que:

- execute uma transação do ledger com receipt imutável (operationId, owner, epoch, generation) na mesma transação do ponteiro;
- associe a operação a um handle JS por banco, sem liberar outras filas;
- enfileire uma ação nativa de reconciliação no `DBRunner` dedicado; depois de drenar pedidos anteriores, feche/reabra essa conexão isolada para fazer rollback de transação ainda aberta e leia o receipt confirmado numa conexão limpa;
- devolva prova terminal correlacionada ao operationId e sequência; só então assente o handle exato e libera o gate da sessão;
- nunca reenvie automaticamente o COMMIT. Ausência de receipt só é “abortado” após a barreira de close/reopen, não por leitura no mesmo contexto transacional.

Uma nova tentativa B fica bloqueada até A ter resultado terminal; após o recibo, B só pode publicar se sua geração/epoch forem atuais. Se a própria reconciliação não responder, a sessão permanece isolada em quarentena. Isso preserva segurança em troca de disponibilidade. O banco dedicado evita fechar ou reinicializar a conexão de dados que o Moodle usa.

## 4. Patch IFRN versionado

O runner `src/MoodleIFRN/tests/fixtures/p09/patch-runner.cjs` mais `p09-patch.cjs` oferece `--inspect`/`--apply`, hash do conteúdo UTF-8, âncoras exatas únicas, rejeição de caminhos fora da raiz e symlinks externos, preflight completo, postimage hash, idempotência e manifestos bloqueados que se recusam a escrever. A aplicação foi exercitada em arquivos descartáveis sob diretório temporário; não tocou nos alvos do Moodle.

Os quatro testes de `patch-manifest.test.cjs` cobrem aplicação repetida, hash incompatível sem escrita, traversal/âncora ambígua e bloqueio do manifest real. O manifest de sessão contém hashes e pontos de extensão do core/plugin, mas `status: blocked` e `operations: []`; portanto sua inspeção funciona e `--apply` falha fechado. Ele não contém um diff fictício ou uma alteração pronta para aplicar. Quando a solução nativa estiver aprovada, cada arquivo terá hunks revisáveis e hashes pré/pós; o diff aplicado será revisado com Git e revertido por Git. Não se executou `--apply` sobre arquivos de produção.

## 5. Testes e evidências

- Foco P0.6/P0.7, driver JS Cordova, JVM P0.8 e novos testes: **118/118 aprovados**, sem skip/todo/cancelamento (`p09-protocol-tests.json/.tap`). Inclui 53 testes P0.6, 46 P0.7 e wrappers/casos P0.8/P0.9; as contagens se sobrepõem a outras suítes e não devem ser somadas como casos independentes.
- Suíte IFRN completa: **234 testes, 233 aprovados, 1 falha**, zero skip/todo/cancelamento. A única falha é `P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B`, a regressão original P0.4. Não foi suprimida. O primeiro teste completo dentro do sandbox teve quatro erros de acesso do esbuild; repetido fora do sandbox, esses erros desapareceram e restou somente a falha P0.4 (`p09-final-tests.json/.tap`).
- TypeScript `tsconfig.app.json --noEmit`: **0 erros** (`p09-final-typescript.json`).
- Lint: **63 erros e 107 avisos**, mesmos diagnósticos do baseline P0.8; comparação `comparar-lint.cjs p09-final` retornou `[]`, nenhum diagnóstico novo. Lint global continua não aprovado.
- Hashes e âncoras do manifest de sessão: **7/7 compatíveis**.
- P0.8 Android real previamente executada no moto g(20), Android 11: **9 seed + 6 recover aprovados**, hash instalado correspondente. Nesta P0.9 não se instalou APK ou harness e não se tocou no aparelho.
- A leitura direta antes do COMMIT passou como teste de demonstração do estado não confirmado; não foi tratada como método de reconciliação.
- `git diff --check` não apresentou erro funcional (permanece o aviso CRLF conhecido do relatório 09).

Evidências principais: `p09-baseline.json`, `p09-resultados.json`, `p09-protocol-tests.json/.tap`, `p09-final-tests.json/.tap`, `p09-final-typescript.json`, `p09-final-lint.json`, `p09-core-session-manifest.json` e resultado Android P0.8 em `p08-android-result.json`.

## 6. Arquivos de integração futura

Mudanças necessárias quando a dependência estiver resolvida:

1. `src/core/services/urlschemes.ts` e a passagem do callback: carregar o contexto da tentativa sem duplicar validação passport.
2. `src/core/services/sites.ts`: separar preparação privada da mutação/reuso de objeto, persistência, ativação, eventos e navegação; verificar tentativa antes de cada fronteira compartilhada.
3. `src/core/services/config.ts`/tabela do site: ponteiro condicional por operação, owner, epoch e generation, sob API transacional testada.
4. `cordova-plugin-moodleapp/src/android/SecureStorage.java` e wrapper TS: ação versionada opt-in com commit, tratamento de ACK desconhecido e compatibilidade das ações legadas.
5. `EncryptionHandler.kt`: inicialização de chaves coordenada para todos os consumidores, sem mudar algoritmo, chaves existentes ou payload push.
6. `cordova-sqlite-storage/www/SQLitePlugin.js` e `src/android/io/sqlc/SQLitePlugin.java`: operação transacional/recibo, barreira de recuperação e settlement do handle correto em uma conexão de ledger dedicada. A alteração deve ser carregada por patch-package/integração versionada, não edição manual em `node_modules`.
7. `src/MoodleIFRN/services_mobile/moodle-site.service.ts` e `course-sso-browser.ts`: passar owner/epoch/cancelamento até a nova fronteira, preservar login único SUAP, seleção Acadêmico/Presencial e retorno ao Painel.

`src/core/`, `src/addons/`, plugins e arquivos de produção não foram modificados nesta fase.

## 7. Critérios para sair do bloqueio

1. Especificação e patch implementados no fork versionado do plugin/Core, com novo hash/base, e revisão independente de cada fronteira de persistência/ativação.
2. Teste nativo que injete ACK perdido antes e depois do COMMIT, prove close/reopen do ledger, valide receipt sem repetição e mantenha B bloqueado até terminalidade.
3. Testes de falha parcial SharedPreferences/SQLite, rollback, A→B, reentrada, logout, callbacks tardios, duplicados e callback de reconciliação desconhecido.
4. Barreira de chaves usada por SecureStorage e por push/unregister; credenciais sintéticas legadas continuam legíveis.
5. Web opt-in desabilitado antes de começar até oferecer transação/recuperação equivalente.
6. Teste P0.4 real fica verde sem skip/todo; suíte IFRN, TypeScript e lint sem regressões; login SUAP, Painel, Acadêmico, Presencial e retorno validados no Android com APK identificado pelo hash.
7. Somente depois de evidência revisável, preparar integração para `release/2.0.1` e pedir autorização. Não fazer merge/push automaticamente.

**Estado final P0.9: BLOQUEADA para integração real até haver capability nativa de reconciliação e coordenação comum da criptografia.** O protótipo demonstra quando é seguro permanecer parado e qual contrato precisa existir; não afirma que o fluxo real já consegue recuperar um ACK desconhecido. P0.4 não está corrigida.
