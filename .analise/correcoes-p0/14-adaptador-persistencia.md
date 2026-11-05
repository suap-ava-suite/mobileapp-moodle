# P0.7 — adaptador transacional e persistência versionada

Data: 2026-11-01. Diretório original `mobileapp-moodle`; branch `fix/p0-release-2.0.1`, HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. Release preservada em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`.

**Resultado:** implementação experimental com **SQLite real no desktop** e armazenamento seguro **simulado**, sem integração ao aplicativo. Os 46 testes novos passaram; os 53 testes P0.6 foram preservados e passaram novamente. A suíte completa ficou em **214/215**, com o mesmo teste nativo vermelho. **P0.4 continua aberta.**

A publicação condicional e sua referência durável foram demonstradas em SQLite de arquivo, inclusive entre conexões e processos. A confirmação durável de credenciais **não pode ser afirmada com o contrato Android atual**: o plugin responde depois de `apply()`, sem informar falha de gravação em disco. O adaptador experimental recusa esse contrato, em vez de fingir que um readback resolveu a ausência de ACK durável.

Nenhum arquivo de produção, login SUAP, tela, estilo, `src/core/`, `src/addons/` ou plugin foi modificado. Não houve build, APK, ADB, logout no celular, instalação, dependência instalada, troca de branch, commit, push ou merge. A pasta `.analise/` e os arquivos anteriores foram preservados.

## 1. APIs reais investigadas

| Fonte atual | API e comportamento observado |
|---|---|
| `src/core/classes/sqlitedb.ts:445` | `execute(sql, params)` delega a `SQLiteObject.executeSql`; recebe resultado com `rows.length/item`, `rowsAffected` etc. A chamada é assíncrona. |
| `src/core/classes/sqlitedb.ts:456` | `executeBatch(statements)` delega a `SQLiteObject.sqlBatch`, retorna `Promise<void>` e documenta operação atômica. Não retorna resultados intermediários nem oferece callback de transação neste wrapper. |
| `node_modules/cordova-sqlite-storage/www/SQLitePlugin.js:265` | `sqlBatch` enfileira `SQLitePluginTransaction` com `txlock=true`; o construtor acrescenta `BEGIN`. Há finalização/rollback no driver. Os callbacks JS da transação não devem conter awaits arbitrários. Não foi executado o driver Cordova/Android nesta fase. |
| `src/core/features/emulator/classes/wa-sqlite-object.ts:215` | **Diferença importante:** `sqlBatch` faz um `for` com `await executeSql` por statement, sem transação envolvendo o conjunto. `transaction/readTransaction` não são implementados. A fila protege reentrância do WASM, mas não transforma vários statements em uma transação SQL. |
| `cordova-plugin-moodleapp/src/ts/plugins/SecureStorage.ts:27/43` | `get(names, collection)` e `store(data, collection)` usam `cordova.exec`. A coleção é uma string, viabilizando chave de versão. Os valores são strings. Não há API de transação com SQLite, compare-and-swap, cancelamento físico ou ACK específico de persistência durável. |
| `cordova-plugin-moodleapp/src/android/SecureStorage.java:109–125` | Criptografa valores com `EncryptionHandler` e chama `SharedPreferences.Editor.apply()`. O ramo `store`, linhas 47–48, responde sucesso em seguida. `delete` e `deleteCollection` também usam `apply()`. Não foi executada criptografia/Keystore Android. |
| `src/core/services/sites.ts:1115` | `addSite` inicia insert de `sites_2` e escrita segura por `siteId` em paralelo. Não existe transação conjunta entre os dois armazenamentos. |
| `src/core/services/sites.ts:2370/2385/2402` | Token é lido/gravado usando coleção `siteId`; plugin é opcional por `?.`. A leitura pode produzir token vazio na ausência do plugin. `loadSiteTokens` também aceita token já presente no registro legado. |
| `src/core/services/config.ts:76/181` | Configuração global usa tabela proxy com cache Eager; `set` faz insert assíncrono. Não fornece publicação condicional vinculada ao proprietário de uma tentativa. |
| `src/core/services/sites.ts:1708` | `login` aguarda `CoreConfig.set(current_site_id, siteId)` e emite LOGIN. É separado do insert do site e da escrita segura. |
| `src/core/services/sites.ts:443/1406/1502` | Tabela de sites tem cache Eager; `getSite` pode retornar `currentSite` ou `this.sites` sem reler o banco. Criação a partir de registro migra schemas e preenche cache. |
| `src/core/classes/database/{eager,inmemory}-database-table.ts` | Getter Eager consulta os objetos lembrados em memória. SQL direto não atualiza esse cache automaticamente. |
| `src/core/services/db.ts:208/234` | Conexões SQLiteDB são cacheadas; conexão nativa é obtida assincronamente por `SQLite.create`. Um `BEGIN` seguido de awaits e queries independentes no wrapper não oferece exclusividade para código externo. |
| `src/core/services/database/sites.ts` e `CoreSitesDB` em `sites.ts:132–214` | Há schema global de sites e schemas por site, com instalação/migração e registro de versão. A migração de banco do site, a configuração global e o secure storage não formam uma transação única. |

Os métodos reais `SQLiteDB.execute`, `SQLiteDB.executeBatch`, `WaSQLiteObject.sqlBatch` e o getter Eager foram extraídos por AST e executados nos testes com dependências isoladas. Não foram alterados ou substituídos no app. O algoritmo de autenticação `newSite` não foi duplicado.

## 2. Garantias disponíveis e ausentes

### SQLite

O experimento usou **Node v22.17.0, módulo embutido experimental `node:sqlite`, SQLite 3.50.0, Windows**, com arquivo temporário exclusivo por teste. `DesktopSQLitePort` implementa o formato de resultados do `SQLiteObject` e passa pelos métodos reais do wrapper Moodle.

No modo transacional do fixture, o port executa o lote entre `BEGIN/COMMIT`, faz `ROLLBACK` em erro e usa `PRAGMA synchronous=FULL`. O driver por baixo é Node, **não o Cordova SQLite**. Portanto a execução prova o SQL/rollback/visibilidade no SQLite desktop, não certifica os flags nativos, sistema de arquivos ou versão SQLite do telefone.

O teste em duas conexões mostra que o predicado de confirmação é decidido no banco, não apenas por um contador JS. O teste com segundo processo mostra rollback ao sair sem COMMIT e leitura da publicação após COMMIT. Não foi feito teste de corte de energia, falha de disco ou crash do Android. As garantias de atomicidade do SQLite dependem das condições documentadas pelo motor e do armazenamento/plataforma. [Referência oficial SQLite](https://www.sqlite.org/atomiccommit.html).

O contrato do wrapper `executeBatch` não é suficiente sozinho: o método real do adaptador web foi executado sobre SQLite desktop, com duas inserções e erro na segunda. A primeira permaneceu. Não foi executado o WASM/IndexedDB real; a sondagem isola a implementação do lote e demonstra a ausência de transação nesse método. O adaptador experimental recusa um port sem lote atômico.

### Armazenamento seguro

`apply()` atualiza a memória antes de concluir a escrita assíncrona em disco e não oferece notificação de falha ao chamador. `commit()` possui outro contrato, com resultado de sucesso, mas sua adoção precisa de implementação nativa e avaliação de threading; não foi aplicada. [Referência oficial Android](https://developer.android.com/reference/android/content/SharedPreferences.Editor).

Um `get()` depois de `store()` pode ler apenas a memória atualizada. Assim, readback não é prova de durabilidade. O controle negativo simula ACK com readback bem-sucedido seguido de perda da escrita ainda não persistida. **Isso não é uma medição no Android nem uma afirmação de que encerramentos normais sempre perdem `apply()`.** É a reprodução da capacidade que o contrato não permite verificar, incluindo falhas de I/O não reportadas.

Nos testes positivos, `SecureStorageFixture({durableAck:true})` fornece um contrato deliberadamente mais forte, em mapas de memória/disco simulados. Não há criptografia, Keystore, arquivo seguro real ou API nativa executada. O plugin real não tem a propriedade `durableAck`; plugado diretamente neste experimento, ele seria recusado. A propriedade é uma precondição do fixture, não um mecanismo confiável de negociação de capacidades para produção.

Não existe atomicidade conjunta SQLite/secure storage. O protocolo elimina a necessidade de sobrescrever uma credencial ativa durante preparação, mas ainda precisa de uma barreira segura antes de confirmar que a versão está durável. É possível falhar fechado na restauração quando falta credencial; isso não autoriza afirmar a garantia mais forte de confirmação completa durável da P0.6.

## 3. Limitações encontradas

1. **ACK seguro insuficiente no Android atual.** Não há como criar uma barreira de durabilidade apenas com o JavaScript `store/get` disponível.
2. **Lote web sem transação.** Não se pode habilitar o mesmo caminho por assumir que a documentação de `SQLiteDB` vale para todos os backends.
3. **Caches independentes do SQL.** Atualizar ponteiro ou configuração por SQL não sincroniza `CoreConfig`, tabela Eager, `this.sites` e `currentSite`.
4. **Epoch SUAP não participa hoje da transação nativa.** O experimento possui sua própria autoridade; não modifica o login ou o armazenamento SUAP real. Integrar o epoch exige um coordenador cooperativo e política para ACK incerto.
5. **Leitura de sessão não é ativação.** O snapshot retornado pode ficar obsoleto depois do retorno; o chamador precisa da lease até sua mutação/navegação efetiva.
6. **Clock do teste é controlado.** `p07_test_clock` permite testar prazo avaliado dentro do SQL quando ele realmente executa. Não é uma API de relógio nativo proposta. Uma fonte de tempo para produção, comportamento após restart e alterações do relógio ainda precisam ser definidos/testados.
7. **Migração/catálogo não integrados.** Não há migração de `sites_2`, credenciais por `siteId`, offline data ou schemas Moodle. O schema experimental v1 é idempotente e recusa versões desconhecidas; não importa registros legados como autenticados.

## 4. Arquitetura experimental

### Dados e propriedade

Todos os dados ficam em tabelas **experimentais próprias**, no banco temporário do teste:

- `p07_authority`: owner SUAP confiável, epoch, geração, tentativa mais recente e ponteiro publicado.
- `p07_attempt`: UUID opaco, owner/epoch/geração imutáveis, origem HTTPS, siteId, disciplina, prazo, estado, chave segura exclusiva e flags de preparação.
- `stage_claim`: propriedade exclusiva da gravação de um candidato; somente um preparador pode escrever aquela versão, inclusive com duas instâncias do adaptador.
- `p07_schema`: versão do schema experimental. `p07_test_clock` existe somente para tornar os testes determinísticos.

Credenciais não são armazenadas no SQLite. A coleção segura é `ifrn-p07-<attemptId>`, nunca só `siteId`. Valores seguros incluem token, privateToken e o identificador da versão. O identificador não contém matrícula ou nome. O UUID tem restrição de unicidade no banco; tentativa de reutilizar o id reverte o lote inteiro e não altera geração/publicação.

Geração e epoch são incrementados no SQLite. A geração permanece monotônica ao reabrir o arquivo. Logout/troca/reentrada SUAP usam uma transação de invalidação; reentrada na mesma conta também muda o epoch. Isso não demonstra proteção contra restauração de backup antigo do banco, limpeza/recriação da instalação ou rollback externo do armazenamento.

### Preparação privada

`stageValidatedCandidate` é uma **fronteira interna de persistência**, cujo chamador deverá ter concluído o passport oficial, `fetchSiteInfo`, políticas Moodle, identidade IFRN e autorização da disciplina. A função não autentica o estudante e não substitui essas validações.

Ela verifica correspondência de owner/site/siteId/curso com a tentativa, captura uma cópia imutável dos valores antes dos awaits e adquire `stage_claim` por UPDATE condicional. Não grava no objeto compartilhado `CoreSite`.

Metadados e credenciais são preparados em paralelo. Flags `metadata_ready/secure_ready` só são marcadas condicionalmente para a tentativa ainda atual. O readback verifica versão e valores completos; a capacidade durável do secure port também é obrigatória. Falha em qualquer parte rejeita o candidato sem publicá-lo. O estado preparada depende dos dois lados completos, prazo e predicado de proprietário vigentes.

Uma repetição que não ganhou a claim não pode sobrescrever a coleção. Uma tentativa que já terminou não é reaberta por nova resposta. O teste de preparadores concorrentes usa duas instâncias e duas conexões, sem depender de um lock JS compartilhado.

### Confirmação condicional

O predicado é avaliado **dentro de cada UPDATE do lote transacional**:

```text
state = preparada
metadata_ready = 1 e secure_ready = 1
deadline ainda não atingido
attempt.id = authority.latest
owner, epoch e generation da tentativa = autoridade atual
```

O lote muda o estado para confirmada e atualiza o ponteiro publicado na mesma transação. Um erro artificial colocado entre essas duas alterações provoca rollback de ambas no SQLite real. Não há `SELECT` JS seguido de insert incondicional como mecanismo de proteção.

Como `executeBatch` retorna void, o recibo é consultado depois. ACK atrasado/perdido é separado da confirmação física: em erro o adaptador consulta o registro, não desfaz uma confirmação por inferência. Se outra tentativa venceu, `current=false`. Se não for possível consultar o resultado por indisponibilidade real do banco, não há autorização segura para ativar; essa exceção não pode ser convertida em sucesso pelo futuro chamador.

O cancelamento é assíncrono e altera apenas estados anteriores à confirmação. Se o commit já venceu, retorna confirmada; não finge rollback. Diferentemente da entrega simples da P0.6, o adaptador também invalida imediatamente sua fence local ao pedir cancelamento: um ACK posterior pode confirmar a durabilidade histórica, mas não autoriza entrega nesse coordenador. Nenhum evento ou navegação é disparado pelo adaptador.

### Intenção de logout, recuperação e leitura

`setSuap` bloqueia imediatamente novas tentativas e restore locais enquanto a alteração durável está pendente. Se o ACK for incerto, o bloqueio local permanece até uma operação explícita válida de reconciliação. O teste segura a transação nativa antes de executar e demonstra que a memória ainda pode conter A, mas restore/begin locais já são recusados. Essa fence local não é uma garantia entre processos independentes; a revogação compartilhada é decidida no SQLite.

`recover` cancela tentativas inacabadas. `restore` exige owner/epoch de uma fonte SUAP confiável externa, registro confirmado e ambos os flags, lê apenas a coleção referenciada e verifica token/version/privateToken. Depois do await da leitura segura, consulta novamente publicação e fence. Uma troca para B ou logout durante essa leitura impede o retorno de A.

O retorno é um snapshot congelado com versão/ambiente/curso/credenciais, **não uma mutação de currentSite ou lease perpétua**. A P0.4 continua exigindo validação na ativação e nos efeitos posteriores. O adapter não reproduz LOGIN/navegação na recuperação.

Um candidato novo pendente não apaga uma publicação anterior legítima da mesma identidade. Ao recuperar, essa publicação anterior pode ser restaurada e a tentativa incompleta é cancelada. Acadêmico e Presencial possuem versões distintas, preservadas no histórico confirmado; o ponteiro único representa a seleção atual. A busca/reutilização do catálogo de outros ambientes ainda dependerá do núcleo, com contexto e validações próprios.

### Coleta e gravação tardia

Só são recolhidas coleções de tentativas canceladas, expiradas ou rejeitadas. O tombstone permanece no banco, com a chave necessária para repetir a coleta. Se um writer físico termina depois da coleta, recria apenas seu resíduo privado. Nova coleta remove esse resíduo sem tocar B. Versões confirmadas não são removidas por esse mecanismo.

O `deleteCollection` real também não possui ACK durável, portanto a eliminação física definitiva de resíduos precisará de política nativa/GC. A garantia demonstrada é que o resíduo não é elegível para publicação ou restauração e não sobrescreve outra versão.

## 5. Arquivos de testes, fixtures e evidências

Novos arquivos de código, todos fora de produção:

- `src/MoodleIFRN/tests/fixtures/session-persistence-adapter.cjs`: port SQLite desktop, portas controladas, secure storage simulado e adaptador experimental.
- `src/MoodleIFRN/tests/fixtures/session-sqlite-worker.cjs`: sondagem em processo filho. Sai com código 23, sem COMMIT, no cenário de interrupção; no outro cenário apenas consulta estado/ponteiro sintéticos.
- `src/MoodleIFRN/tests/session-persistence-adapter.test.cjs`: 46 testes novos.
- `.analise/correcoes-p0/p07-evidencias.cjs`: inventário e comparação de evidências, sem mutação de código/Git.

Evidências novas: `p07-before-tests.{json,tap}`, `p07-adapter-first-tests.{json,tap}` (36 testes), `p07-adapter-expanded-tests.{json,tap}` (40), `p07-final-tests.{json,tap}` (212 no total), **`p07-acceptance-tests.{json,tap}` (215 no total)**, `p07-final-typescript.json`, `p07-final-lint.json`, `p07-final-metrics.json`, `p07-fontes.json` e este relatório.

`p07-fontes.json` registra ambiente, hashes SHA-256 dos fontes/relatórios, branch/commits, ausência de diff rastreado, contagens da aceitação final e comparação com P0.6. Os dois arquivos P0.6 e seu relatório 13 permanecem com os mesmos hashes; seus 53 testes não foram reescritos para tornar a suíte verde.

Os bancos são arquivos reais em diretórios temporários exclusivos, contêm somente identidades sintéticas e são eliminados pelo teardown depois de fechar conexões. Não foram persistidas credenciais reais, logs brutos do app ou cópias de banco do celular.

## 6. Resultados dos testes

| Propriedade pedida | Evidência executada | Limite |
|---|---|---|
| A cancelada não assume B | Holds em metadados, secure apply, secure ACK e publish; contas diferentes e mesma conta; restore retorna B | Não executa `currentSite`, LOGIN ou navegação reais |
| A antiga não sobrescreve credencial recente da mesma conta | Coleções distintas; conteúdo B preservado; concorrência entre conexões e claim exclusiva | Secure storage é fixture |
| Writer tardio não publica A | SQL condicional rejeita versão obsoleta; coleta antes/depois do writer conserva B | Não cancela fisicamente o plugin |
| Falha parcial não autentica candidato incompleto | Falhas em SQL, store, ACK e readback parcial; estado rejeitado, sem ponteiro restaurável | Backend seguro forte é hipótese explícita |
| Restart não restaura não confirmado | Quatro fronteiras com conexão nova: criada, preparada, commit enfileirado, confirmada sem ACK; processo filho sem COMMIT reverte | Não é restart do Android nem corte de energia |
| ACK incerto não provoca rollback incorreto | Confirmada continua confirmada; A não passa a current após B; consulta de outro processo vê o commit | Falha permanente de consulta exige bloqueio/reconciliação |
| Logout SUAP invalida A | Epoch diferente na mesma conta; writer antigo impedido; intenção/ACK de logout controlados | Autoridade SUAP do experimento não está conectada à real |
| Só versão confirmada do owner atual restaura | Owner/epoch errados, plugin/credencial ausentes e versão divergente retornam null; leitura segura revalida ponteiro após await | Chamador ainda precisa guardar a ativação posterior |

Outros cenários que passaram: atomicidade/rollback do lote SQLite, lote web parcial recusado, bloqueio real entre duas conexões, erro entre confirmação e publicação, ID duplicado revertido sem regredir geração, schema idempotente/versão desconhecida recusada, snapshots imutáveis, getter Eager obsoleto após SQL direto, versões Acadêmico/Presencial separadas e preservação de uma sessão anterior válida durante recuperação.

### Contagens verificadas

| Verificação | Resultado |
|---|---|
| Baseline desta fase | 169 testes: 168 aprovados, 1 falha |
| Aceitação final | **215 testes: 214 aprovados, 1 falha**, zero skip/todo/testes cancelados |
| Testes P0.7 | **46/46 aprovados** |
| Testes P0.6 | **53/53 aprovados**, com as 92 ordenações já enumeradas na fase anterior |
| Testes anteriores à P0.6 | 115/116, sem falha adicional observada |
| TypeScript `tsconfig.app.json`, noEmit | Zero erros; não valida tipos de uma futura API TS a partir destas fixtures CJS |
| Lint dos cinco arquivos P0 | 63 erros / 107 avisos, JSON idêntico ao P0.6; permanece reprovado por dívida existente |
| Código/complexidade de produção | Métricas idênticas ao P0.6; nenhum ganho de tamanho/desempenho declarado |

Único teste reprovado, preservado integralmente:

```text
P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B
```

Comandos relevantes executados, além das leituras e buscas dos fontes listados:

```text
git status --short --branch
git rev-parse HEAD release/2.0.1
node .analise/correcoes-p0/validar.cjs p07-before tests
node .analise/correcoes-p0/validar.cjs p07-adapter-first tests session-persistence-adapter.test.cjs
node .analise/correcoes-p0/validar.cjs p07-adapter-expanded tests session-persistence-adapter.test.cjs
node .analise/correcoes-p0/validar.cjs p07-final tests
node .analise/correcoes-p0/validar.cjs p07-acceptance tests
node .analise/correcoes-p0/validar.cjs p07-final typescript
node .analise/correcoes-p0/validar.cjs p07-final lint
node .analise/correcoes-p0/comparar-lint.cjs p07-final
node .analise/correcoes-p0/validar.cjs p07-final metrics
node --check src/MoodleIFRN/tests/fixtures/session-persistence-adapter.cjs
node --check src/MoodleIFRN/tests/fixtures/session-sqlite-worker.cjs
node --check src/MoodleIFRN/tests/session-persistence-adapter.test.cjs
node .analise/correcoes-p0/p07-evidencias.cjs
git diff --check
```

O runner registra argumentos, status, TAP, totais e duração. Suítes completas usaram o acesso local já necessário ao esbuild. `node:sqlite` emite aviso de API experimental, registrado nas saídas, sem skip ou dependência instalada. As sondagens em processo filho são executadas pela suíte, com comandos e parâmetros constantes/sintéticos e sem shell intermediário.

## 7. Comparação com P0.6

| Aspecto | P0.6 | P0.7 |
|---|---|---|
| Autoridade transacional | Mapas síncronos idealizados | Tabelas e UPDATEs condicionais em SQLite desktop real, por API assíncrona |
| Confirmação | Operação atômica assumida | Lote SQL com estado+ponteiro; rollback e concorrência entre conexões executados |
| Crash/restore do SQL | Imagem serializada | Arquivo SQLite, conexão nova e processo filho sem COMMIT |
| Escritor de uma versão | Namespace por tentativa | Namespace mais claim exclusiva para impedir preparadores concorrentes |
| Cancelamento após confirmação durável | Não desfaz a confirmação | Também revoga entrega local, mesmo com ACK ainda pendente |
| Secure storage | Mapas com garantia ideal | Simulação distingue memória/disco; contrato atual fraco é recusado; positivo ainda exige contrato forte simulado |
| Backend web | Não investigado pelo modelo | Método real de lote demonstra parcialidade, bloqueada pelo adaptador |
| Cache | Efeito abstrato | Getter Eager real mantém snapshot obsoleto depois do SQL |
| Logout em andamento | Transação síncrona assumida | Intenção local, transação e ACK separados e testados |
| Integração nativa | Ausente, teste vermelho | Continua ausente, mesmo teste vermelho |

Executar os 53 testes originais novamente não significa que todos foram convertidos em testes SQLite: são duas camadas complementares. A P0.7 acrescenta 46 testes específicos das diferenças do armazenamento e mantém o protocolo P0.6 como regressão.

## 8. Riscos de integração

- **Habilitar este experimento diretamente quebraria o SSO atual**, pois o secure storage real não satisfaz a capacidade durável exigida. Ele permanece exclusivamente em fixtures.
- Não basta substituir uma flag por `true`: é necessário implementar e testar o contrato nativo que essa flag representa. Uma proposta é escrita durável fora da UI thread, com retorno explícito de sucesso/falha e binding à versão; detalhes e custo precisam ser validados.
- Atualizar as tabelas globais por SQL sem sincronizar caches pode deixar o banco em B e memória em A. Atualizar caches depois de awaits sem lease pode recriar o problema original.
- Uma resposta de restore/commit não protege automaticamente a navegação ou observers de LOGIN depois que foi retornada.
- Outros caminhos de login, loadSite, restauração e callbacks globais precisam cooperar; um caminho legado sem contexto pode ignorar o ponteiro versionado.
- Importar credenciais antigas por `siteId` sem validar identidade/ambiente/epoch pode misturar proprietário e revisão. Recriar dados offline ou apagar sessões válidas não é uma migração aceitável.
- O schema temporal/namespace de testes não deve ser copiado para o banco de produção sem plano de instalação, upgrades, rollback, GC e tratamento de espaço/backup.
- Foram testadas falhas escolhidas de I/O, SQL e ACK. Corrupção arbitrária, perda de chaves, rollback de backup, mudança de relógio e condições reais Android permanecem pendentes.

## 9. Pontos necessários para o futuro patch do núcleo

1. **Plugin seguro:** API versionada de gravação durável e tratamento de erro, implementada em `cordova-plugin-moodleapp/src/android/SecureStorage.java` e contrato TS correspondente. Manter criptografia e coleções privadas, evitar bloqueio da UI e definir coleta. Avaliar também plataformas fora do Android antes de habilitar um caminho comum.
2. **Port SQLite/capacidades:** confirmar atomicidade/configuração no Cordova instalado. Para web, fornecer lote realmente transacional com exclusão adequada, ou recusar explicitamente a nova funcionalidade nesse backend; não usar awaits soltos entre BEGIN/COMMIT num wrapper sem exclusividade.
3. **Schema global de sessão:** autoridade, tentativas, versões e ponteiro na mesma transação/DB; predicados executados no SQL, versão de schema e migração segura das referências legadas. Definir relógio e recuperação sem depender da tabela de teste.
4. **SUAP/coordenador:** transportar a identidade principal confiável, epoch e intenção de revogação para a autoridade, inclusive ACK desconhecido e reentrada na mesma conta. Não derivar owner de LOGIN Moodle.
5. **CoreSites:** separar preparação da publicação de `newSite`; impedir setters em site compartilhado antes do commit; integrar `addSite/login/loadSite/getSite/loadSiteTokens`, memória e caches com a referência confirmada. Não substituir a lógica oficial por uma cópia no IFRN.
6. **SSO/passport:** manter algoritmo oficial e controles por tentativa da proposta 13; o storage adapter não implementa ou dispensa essas verificações. Tratar callback global, consumo do lançamento e replay.
7. **Efeitos:** lease até `currentSite`, LOGIN, observers e Router/NavController/nextNavigation. O recibo SQL é necessário, mas não suficiente para a segurança desses efeitos.
8. **Patch versionado:** proposta mínima com manifesto de hashes/anchors, pré-validação, idempotência e falha fechada. Alterações no core/plugin exigirão escopo aprovado; o script de patch existente não foi executado.

## 10. Recomendação de continuidade

**Aprovado como experimento de SQL/persistência versionada, com precondições explícitas. Não aprovado como integração segura no aplicativo.** A propriedade central de publicação condicional é implementável com transação SQLite e namespaces privados. Com os contratos atuais não foi demonstrada a confirmação durável conjunta exigida: o secure storage precisa de uma barreira verificável e o backend web não pode ser tratado como transacional.

A próxima etapa mais segura é propor e validar isoladamente o contrato nativo de durabilidade e o port transacional, antes de ligar qualquer caminho ao login. Depois, levar os mesmos casos de falha/ACK/crash ao backend Android real em ambiente autorizado e preparar o patch cooperativo dos pontos acima. Preservar SUAP como autoridade e todos os fluxos Moodle/Painel existentes.

Até haver uma correção real e todos os testes críticos verdes, manter o teste nativo vermelho e a release intacta. Não há build P0.7 para instalar, nenhum funcionamento no telefone foi declarado e nenhuma integração à `release/2.0.1` está pronta para aprovação nesta fase.
