# P0.6 — protótipo isolado do contrato de sessão

Data: 2026-11-01. Diretório original `mobileapp-moodle`. Branch `fix/p0-release-2.0.1`, HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. A release permanece em `0ba7bc2e71b1180418337bb85dca1e082c49c7b0`. Não houve troca de branch, commit, merge ou push nesta etapa.

**Resultado: os 53 testes do protocolo passaram no modelo determinístico, incluindo 92 ordenações enumeradas de concorrência. A P0.4 continua NÃO resolvida no aplicativo.** O teste que executa o fluxo real do núcleo continua vermelho. Este resultado aprova o protocolo somente dentro das premissas explícitas abaixo; não aprova integração, publicação ou funcionamento no Android.

## 1. Escopo, fontes e arquivos criados

Lidos integralmente os relatórios 09, 10, 11 e 12. Conferidos os métodos reais do núcleo, a persistência e a navegação. Os hashes SHA-256 dos quatro relatórios, dos métodos/arquivos do núcleo e dos dois arquivos de testes estão em `p06-fontes.json`. Os relatórios e evidências anteriores foram preservados.

Arquivos funcionais novos, exclusivamente de teste:

- `src/MoodleIFRN/tests/fixtures/core-session-attempt.cjs`: `CoreSessionAttempt`, autoridade transacional simulada, operações controladas, armazenamento versionado, recuperação e adaptação do validador oficial.
- `src/MoodleIFRN/tests/session-attempt-contract.test.cjs`: 53 casos, com dados exclusivamente sintéticos.

Documentação e evidências novas: este relatório, `p06-evidencias.cjs`, `p06-fontes.json` e saídas `p06-*-tests.{tap,json}`, `p06-final-typescript.json`, `p06-final-lint.json` e `p06-final-metrics.json`. O inventário escreve apenas seu JSON; não executa patches ou comandos de mutação do Git.

Nenhum arquivo de produção foi alterado. `git diff --name-only HEAD` permaneceu vazio para arquivos rastreados. Os únicos fontes novos estão dentro de `tests/`. Não foram executados build, instalação, ADB, logout, limpeza de dados ou uso das credenciais fornecidas anteriormente.

## 2. O que o protótipo representa

O modelo usa CommonJS para integrar a suíte Node existente. Não é um serviço Angular novo e não entra no fluxo do app. `AtomicAuthority` é **um adaptador de teste idealizado**, com transações duráveis e linearizáveis representadas por operações síncronas em mapas. Não é uma API existente do Moodle nem uma implementação de SQLite/Keystore.

O contrato de uma tentativa vincula:

```text
attemptId: identificador exclusivo e não reutilizado
generation: revisão monotônica, preservada na recuperação
owner + epoch: identidade principal SUAP e revisão da autenticação
site + course: origem HTTPS exata e disciplina da solicitação
deadline: limite para preparar e confirmar
state: um dos sete estados
launch: passport oficial, isolado por tentativa
candidateKey: namespace exclusivo para banco e credenciais preparadas
publication: ponteiro durável para uma versão confirmada
deliveryLease: autorização revogável pela geração/epoch/runtime atual
```

`owner` é uma identidade sintética nas fixtures. No produto, o adaptador deverá delegar ao comparador oficial IFRN já existente; a igualdade de strings da fixture não substitui matrícula, normalização ou validação real de identidade. Nome e foto não identificam proprietário. Token Moodle não autentica a identidade principal SUAP.

## 3. Estados formais

| Estado do contrato | Significado | Próximos estados permitidos |
|---|---|---|
| `created` / criada | Contexto e lançamento pertencem a uma geração e epoch | validando, cancelada, expirada, rejeitada |
| `validating` / validando | Passport, informações Moodle e preparação das duas gravações | preparada, cancelada, expirada, rejeitada |
| `prepared` / preparada | Identidade/ambiente/curso aceitos; ambas as gravações privadas terminaram | confirmada, cancelada, expirada, rejeitada |
| `confirmed` / confirmada | Publicação durável venceu a comparação de proprietário | Terminal para a autenticação; efeitos ainda dependem da lease atual |
| `cancelled` / cancelada | Cancelamento ou substituição venceu antes da confirmação | Terminal |
| `expired` / expirada | Prazo atingido antes da confirmação | Terminal |
| `rejected` / rejeitada | Validação ou persistência falhou antes da confirmação | Terminal |

A fixture recusa transições ilegais, confirmação de tentativa criada e expiração solicitada antes do prazo. Repetir cancelamento não reabre uma tentativa. Criar uma tentativa posterior invalida a anterior não terminal. Trocar/logout/reentrar no SUAP incrementa epoch, inclusive para o mesmo username.

O prazo é verificado novamente dentro da confirmação, não depende de o callback do timer já ter rodado. Depois da confirmação, o deadline não representa expiração da credencial Moodle: esse é outro contrato, do servidor. Uma confirmação histórica não dá licença para efeitos de uma geração antiga.

## 4. Protocolo e ponto exato de confirmação

1. A autoridade registra geração, epoch SUAP e lançamento exclusivo. O callback vinculado a A não pode ser redirecionado à tentativa mais recente por conveniência.
2. Valida-se o passport com o método oficial. O resultado só prossegue se a tentativa continuar atual.
3. Obtêm-se informações Moodle, identidade e autorização da disciplina sem modificar um site compartilhado. Cada retorno é verificado novamente.
4. Banco e armazenamento seguro recebem candidatos privados em chaves diferentes de qualquer sessão publicada. O estado só vira preparada depois de ambas as operações terminarem com sucesso.
5. Enfileira-se a confirmação. Enquanto ela estiver apenas enfileirada, cancelamento, expiração, nova geração ou novo epoch podem vencer.
6. **Ponto de linearização:** uma única transação da autoridade verifica tentativa mais recente, owner, epoch, deadline, estado preparada e existência dos dois candidatos; muda o estado para confirmada e grava o ponteiro de publicação com a geração. Esses dois resultados são indivisíveis no modelo.
7. A resposta dessa transação pode atrasar ou se perder. O ACK não é o ponto de confirmação. Depois de recebê-lo, a lease é conferida novamente.
8. Ativação, `LOGIN` e navegação são entregues em ordem e, individualmente, somente com a lease ainda atual. Uma navegação enfileirada tem nova verificação **na mutação efetiva**, não apenas antes de um await externo.

Formalmente, o núcleo futuro precisa oferecer o equivalente a uma transação condicional sobre autoridade/tentativa/publicação, e não duas chamadas independentes a `CoreConfig.set`:

```text
TRANSACTION
  exigir owner/epoch/generation/latest atuais e deadline ainda válido
  exigir attempt.state = prepared e candidatos completos
  attempt.state := confirmed
  publication := versão imutável dessa tentativa
COMMIT
```

Uma tentativa A cancelada antes dessa transação nunca publica. Se a transação já confirmou antes do cancelamento, `cancel()` retorna **confirmada**, sem alegar que desfez um commit. Essa distinção é testada com ACK pendente. Uma nova tentativa B, logout ou novo epoch bloqueia efeitos futuros de A mesmo nesse caso. Não se pode anunciar cancelamento definitivo enquanto o resultado autoritativo de uma transação em andamento for desconhecido.

Na fixture, cancelar é uma transação síncrona. No adaptador real, a operação será assíncrona e deverá retornar sua decisão autoritativa; parar o loader não será prova de rollback. A ordem de cancelamento/publicação deverá ser definida pelo mesmo sequenciador/armazenamento, com invalidação local imediata para entrega de efeitos. Isso ainda requer implementação e testes reais.

## 5. Persistência, resíduos e recuperação

### Preparação e gravação tardia

Banco e secure storage não precisam de uma transação distribuída: ambos escrevem candidatos exclusivos antes da publicação. Nenhum leitor de sessão pode enxergar um candidato como autenticado só porque a gravação terminou.

```text
candidate[attempt-A] -> metadados A, referência secure[attempt-A]
secure[attempt-A]    -> credenciais sintéticas A
publication         -> somente uma versão confirmada
```

O banco da fixture não contém tokens. O secure storage contém apenas credenciais sintéticas. A chave não é apenas `siteId`; duas tentativas da mesma conta também usam versões diferentes.

Se A é cancelada com gravação segura pendente, essa gravação pode terminar fisicamente. Ela cria somente `secure[attempt-A]`, sem ativar ou publicar A e sem sobrescrever B. A coleta remove apenas chaves da própria tentativa terminal não confirmada. Mantém-se o registro/tombstone: coletar antes de um writer terminar pode deixar um resíduo novo, que outra coleta precisa remover. O teste demonstra expressamente esse resíduo, em vez de alegar cancelamento físico do plugin.

Versões confirmadas não são removidas por essa coleta. O protocolo não limpa preferências, perfil, foto, listas ou todas as credenciais. Falha de uma das gravações rejeita a preparação, conserva apenas resíduos isolados e não publica uma sessão parcial.

### Interrupção e recuperação

`checkpoint()` serializa uma imagem sintética do estado durável; `fromCheckpoint()` constrói outra autoridade, sem reutilizar os objetos da anterior. Há também um cenário que conserva um writer físico pendente no mesmo backend simulado depois da recuperação. Nenhuma imagem contendo credenciais reais é criada.

O restore exige owner/epoch provenientes da autoridade SUAP confiável; não estabelece essa identidade lendo um site Moodle. Tentativas não confirmadas são canceladas na recuperação. Somente o ponteiro confirmado, com metadados e credenciais presentes e owner/epoch compatíveis, pode restaurar a sessão ativa. Ausência de credencial ou mudança de identidade falha fechada.

São testadas interrupções com só banco, só secure storage, preparação completa, commit enfileirado, commit durável sem ACK, ativação, `LOGIN` e navegação. ACK perdido depois do commit não provoca rollback de uma confirmação legítima. Uma tentativa nova pendente não destrói uma sessão anterior já confirmada da mesma identidade; a recuperação pode restaurar essa publicação legítima, sem reproduzir o callback antigo.

**Entrega é no máximo uma vez no modelo, não exatamente uma vez entre crashes.** O ledger impede duplicação no processo e a recuperação não repete `LOGIN` ou navegação. Uma interrupção entre registro e entrega pode perder um efeito. Recupera-se o estado confirmado; não se promete reexecutar efeitos externos sem duplicação. Os assinantes reais que exigirem retomada precisarão ser idempotentes e validar a lease em suas próprias mutações.

## 6. Passport oficial e roteamento de callbacks

A fixture extrai via AST e transpila o corpo real de `CoreLoginHelperProvider.validateBrowserSSOLogin` do fonte atual; não copia seu algoritmo. A assinatura de teste é construída com `node:crypto`; o método oficial efetua a validação. O contexto fornece um snapshot de lançamento por tentativa, parser e MD5 para dados ASCII sintéticos. Logs internos são descartados, pois o caminho oficial de erro pode registrar dados sensíveis.

O binding por snapshot é **parte da API futura**, não uma possibilidade já oferecida pelo `CoreConfig` global. Não há monkey-patching global ou alteração temporária de serviços do app: a VM existe somente no teste.

Descartar o logger na VM não sanitiza o logger de produção do validador oficial. Esse caminho deverá receber a mesma política de campos seguros na futura integração, sem registrar passport, assinatura ou credenciais; não foi corrigido indiretamente por este protótipo.

Para callbacks globais não vinculados, `routeCallback` primeiro usa o validador oficial com snapshot isolado e consumo sem efeito. Só uma correspondência atual é encaminhada à tentativa. Um callback tardio A que não corresponde a B não consome nem rejeita o lançamento B. A validação oficial é repetida no aceite vinculado; essa redundância é deliberada neste protótipo e não é proposta de implementação final.

O modelo também recusa reutilizar o mesmo passport no mesmo ambiente, inclusive após recuperação: sem unicidade, dois callbacks poderiam ser indistinguíveis. O núcleo atual usa `Math.random() * 1000`, do tipo `number`, sem reserva durável de unicidade por tentativa. Isso **não prova colisão observada nem significa apenas mil valores possíveis**; significa que não há a garantia exigida pelo modelo. A política futura precisa manter compatibilidade com o lançamento oficial e a representação numérica, tratar unicidade/replay e testar a aceitação do servidor. A fixture usa inteiros seguros determinísticos, não recomenda essa sequência como segredo ou implementação criptográfica.

Passport válido não dispensa a identidade SUAP, origem HTTPS exata e disciplina autorizada. O fallback HTTP aceito pelo algoritmo oficial é recusado pela política de ambiente HTTPS da fixture. Nenhuma senha é pedida ao Moodle e nenhum token SUAP é tratado como wstoken.

## 7. Matriz de testes efetivamente executados

| Cenário | Resultado no modelo |
|---|---|
| A normal, sete estados e ordenação dos efeitos | Passou; um commit, uma ativação, um LOGIN e uma navegação |
| Cancelamento/timeout em criada, fetch, banco, secure storage, preparada e commit enfileirado | 12 casos passaram; nenhuma publicação/ativação/evento/navegação |
| Cancelamento durante await da validação oficial | Passou; não chega ao fetch nem consome lançamento posterior |
| Deadline atingido dentro da confirmação sem timer | Passou; expirada, sem publicação |
| Commit durável antes de cancelamento, ACK pendente | Passou; retorna confirmada, não inventa rollback |
| B iniciada depois do commit A e antes do ACK A | Passou; resultado A não autoriza efeitos |
| A→B com A em fetch, banco, secure, commit, ativação, LOGIN ou navegação | 7 casos passaram; B conclui primeiro e A não acrescenta efeitos tardios |
| Logout/reentrada na mesma conta | Passou; epoch diferente impede sobrescrita pela credencial anterior |
| Callback, confirmação e entrega duplicados | Passou; compartilham trabalho e não duplicam efeitos |
| Falha parcial banco/secure e falha antes do commit | Passaram; nada parcial fica visível |
| Limpeza antes de gravação física tardia | Passou; resíduo próprio é recolhido sem remover B |
| Restore serializado nos oito pontos de interrupção | Passou; somente a confirmação completa é recuperável |
| Writer físico sobrevivente à recuperação, seguido de B | Passou; A não sobrescreve nem ativa |
| ACK perdido depois do commit | Passou; estado confirmado é recuperado sem replay de eventos |
| Secure ausente, outro owner, mesmo owner com novo epoch e SUAP ausente | Passaram; restore falha fechado |
| Sessão legítima existente com tentativa nova ainda pendente | Passou; não apaga a sessão confirmada anterior |
| Passport inválido, ausente, callback A global tardio, reutilização de passport | Passaram; não publicam ou consomem B indevidamente |
| Identidade, ambiente ou matrícula no curso incompatíveis | Passaram; nenhuma escrita preparada ou ativação |
| Observer de LOGIN assíncrono continuando após B | Passou; nova verificação impede mutação tardia |
| Destino da navegação Presencial B | Passou; ambiente e disciplina vêm do contexto B, não de A |

Além dos casos individuais, dois testes enumeram **80 interleavings** dos writers A/B e publicação B (40 para mesma conta + 40 para contas distintas) e **12 serializações** de cancelar A, confirmar A, iniciar B e confirmar B. A cada passo há verificações sobre publicação, eventos, armazenamento e sessão ativa. Não se trata de exploração exaustiva de todos os schedules possíveis do app.

## 8. Antes/depois e verificações

| Métrica | Antes desta etapa | Depois | Interpretação |
|---|---:|---:|---|
| Suíte IFRN | 116: 115 passam, 1 falha | 169: 168 passam, 1 falha | 53 casos novos passam; mesma falha nativa preservada |
| Protótipo | Não existia | 53 aprovados | Sem skip, todo ou cancelamento de teste |
| TypeScript `tsconfig.app.json`, noEmit | Zero nos relatórios anteriores | Zero nesta execução | Não transforma as fixtures CJS em validação de tipos de uma futura API TS |
| Lint dos cinco arquivos P0 | 63 erros / 107 avisos, evidência P0.4 | 63 erros / 107 avisos | JSON idêntico ao P0.4; lint continua reprovado por dívida existente |
| Métricas dos cinco arquivos de produção P0 | `final-metrics.json` | `p06-final-metrics.json` idêntico | Nenhuma redução de código ou complexidade de produção nesta fase |
| Bundle, APK, inicialização, RAM e tempo de curso | Baseline P0.5 com APK diferente | Não medidos nesta fase | Nenhum ganho de desempenho declarado |

Falha atual, sem skip/todo ou alteração do teste:

```text
P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B
```

Ela continua demonstrando que `handleCustomURL/newSite` atuais não participam do contrato. Os testes originais continuam 115/116; não houve regressão adicional observada na suíte.

Comandos e evidências relevantes, executados no diretório original:

```text
git status --short --branch
git rev-parse HEAD release/2.0.1
node .analise/correcoes-p0/validar.cjs p06-before tests
node .analise/correcoes-p0/validar.cjs p06-before-authorized tests
node .analise/correcoes-p0/validar.cjs p06-prototype tests session-attempt-contract.test.cjs
node .analise/correcoes-p0/validar.cjs p06-prototype-final tests session-attempt-contract.test.cjs
node .analise/correcoes-p0/validar.cjs p06-prototype-complete tests session-attempt-contract.test.cjs
node .analise/correcoes-p0/validar.cjs p06-final tests
node .analise/correcoes-p0/validar.cjs p06-prototype-verified tests session-attempt-contract.test.cjs
node .analise/correcoes-p0/validar.cjs p06-acceptance tests
node .analise/correcoes-p0/validar.cjs p06-final typescript
node .analise/correcoes-p0/validar.cjs p06-final lint
node .analise/correcoes-p0/comparar-lint.cjs p06-final
node .analise/correcoes-p0/validar.cjs p06-final metrics
node .analise/correcoes-p0/p06-evidencias.cjs
git diff --check
```

A primeira suíte restrita (`p06-before`) apresentou 105 testes / 100 aprovados / 5 falhas por restrições de acesso do esbuild, além da falha nativa. Ela não é a baseline funcional. Reexecutada com acesso local autorizado, resultou em 116 / 115 / 1. A aceitação final usou o mesmo acesso e resultou em 169 / 168 / 1. TAP/JSON registram status, comandos e duração de cada execução. Resultados intermediários de 43, 46, 50 e 51 casos pertencem a versões anteriores do protótipo; o inventário final confirma **53** casos na suíte final. `git diff --check` passou para os arquivos rastreados; o Git avisou sobre conversão LF/CRLF futura de um relatório anterior, que não foi regravado.

## 9. Compatibilidade com os contratos reais e alterações futuras exatas

| Fronteira real conferida | Incompatibilidade atual | Ponto de integração necessário, não implementado |
|---|---|---|
| `login-helper.ts:619`, `prepareForSSOLogin` | Singleton de lançamento; passport sem reserva de unicidade | Registro de lançamento por tentativa e consumo condicional; persistir geração/epoch e política de replay |
| `login-helper.ts:968`, `validateBrowserSSOLogin` | Lê singleton e inicia delete antes de saber se a assinatura é válida | Receber snapshot pertencente à tentativa; manter o algoritmo oficial e separar validação de consumo |
| `urlschemes.ts:110/399`, `handleCustomURL/getCustomURLTokenData` | Não recebem proprietário; chamam criação e navegação depois de awaits | Resolver/vincular callback e transportar contexto em cada fronteira; rejeitar callback desconhecido sem destruir o atual |
| `urlschemes.ts:72`, `createSiteIfNeeded` | Chama `newSite` com efeitos e pode reutilizar current sem lease | Preparação/commit cooperativos, inclusive ramo de reutilização |
| `sites.ts:820`, `newSite` | Muta `storedSite` em 849–855, migra/configura e grava em 889 antes do retorno | Candidato não compartilhado; manter validações reais de Moodle/app/config e publicar somente por commit condicional |
| `sites.ts:1115`, `addSite` | Banco e secure em paralelo, chave por site, sem transação comum ou fencing | Candidatos versionados e ponteiro transacional, incluindo migração e recuperação |
| `sites.ts:2385/2402`, secure storage | Escrita/leitura por `siteId`; `store` é opcional via plugin | Chave de versão; confirmação de disponibilidade/durabilidade; leitor segue somente referência publicada e falha fechado |
| `sites.ts:893`, `currentSite`; `login:1708` | Memória, configuração atual e LOGIN são efeitos separados | Lease vigente em cada efeito e seleção persistente ligada à publicação confirmada |
| `sites.ts:1252/1502`, `loadSite` e cache | Restauração também ativa e cacheia, fora do SSO | Restore verifica owner/epoch/publicação, não ressuscita candidato/conta obsoleta |
| `navigator.ts:155/222/241` | Router/NavController e nextNavigation têm awaits; podem carregar/logout de outro site | Lease até a navegação efetiva e encadeamentos; compatibilidade Angular/Ionic ainda precisa ser comprovada |
| `initialize-urlscheme.ts:45–46` e `prepare-inapp-browser.ts` | Entradas globais chamam handler; evento não é veto | Roteamento cooperativo por lançamento e política para callbacks sem vínculo |
| `static/sso.ts` | Deferred/timer global sem proprietário | Conclusão/timeout associados à tentativa, sem finalizar B pelo finally de A |
| Observers de LOGIN e outros eventos | Publicar LOGIN não controla trabalho assíncrono dos assinantes | Contexto/lease ou idempotência verificada na mutação de cada observer relevante |
| `src/MoodleIFRN/services_mobile/moodle-site.service.ts` e helper SSO | Chamam handler nativo que não aceita contexto | Passar tentativa SUAP/env/curso; continuar login único, identidade e retorno ao Painel |
| `src/MoodleIFRN/patch-moodle-ifrn.js` | Replacements escrevem arquivos durante execução; não há modo check geral seguro | Integração versionada, validação de anchors/hashes antes de escrever, idempotência e falha fechada |

Os números de linha e hashes dos métodos reais estão no inventário. `newSite(login=false)` não é preparação pura: continua persistindo, alterando objetos/cache e emitindo eventos. Não foi utilizado como solução.

O patch existente foi apenas lido, nunca executado. Não houve cópia do algoritmo `newSite`, monkey-patching de serviços, `Promise.race` como correção ou rollback por exclusão de site. Futuras modificações no núcleo exigirão o escopo aprovado de integração; este protótipo não é aplicado ao core por script.

## 10. Limitações, decisão e próxima etapa

O protocolo demonstrou, nos cenários finitos executados, que preparação isolada + confirmação condicional + lease na entrega impedem tentativas obsoletas de assumir B. Isso depende de contratos ainda ausentes:

- Autoridade durável que serialize início, cancelamento, logout SUAP, confirmação e restore. O modelo não prova atomicidade, isolamento ou durabilidade do SQLite/plugin Android real. Uma consulta seguida de insert assíncrono sem condição não satisfaz o contrato.
- Persistência da geração e publicação sem regressão após restart, e integração do epoch com a fonte confiável SUAP. A fixture não implementa atualização atômica de `localStorage` SUAP e SQLite.
- Secure storage realmente durável antes da publicação, leitura por versão e coleta sem apagar versão confirmada. Perda/corrupção do Keystore após um ACK não foi simulada além do cenário de registro ausente; restauração deve falhar fechada e pedir recuperação normal.
- Roteamento de callback/passport por proprietário e proteção contra replay/colisão compatíveis com o servidor. O snapshot isolado da VM não existe ainda no serviço oficial.
- Navegação e observers cooperativos até o efeito real. Guardar apenas a chamada externa ao Router ou apenas o emit de LOGIN continua insuficiente.
- Compatibilidade dos caminhos de sessão existentes, eventos SITE_ADDED/SITE_UPDATED/SESSION_EXPIRED, scripts permitidos, migrações e demais recursos nativos. A fixture não executa o app Angular nem todos os efeitos de infraestrutura de web services.

**Decisão P0.6:** protocolo aprovado nos limites do modelo e dos testes listados; adaptação ao núcleo ainda pendente de implementação/validação. **P0.4 permanece aberta e o critério de todos os testes críticos verdes não foi atendido.** Não há correção pronta para integrar na release.

Próximo passo técnico: implementar e testar primeiro o adaptador transacional/armazenamento versionado em ambiente isolado, incluindo ACK incerto e revogação SUAP durante transação nativa. Depois apresentar o patch cooperativo mínimo, com manifesto de compatibilidade, cobrindo os pontos acima. As restrições desta fase de não alterar produção prevaleceram; a instrução de evolução posterior não foi tratada como autorização para ultrapassar esta validação do protótipo.

Somente após a integração explicitamente autorizada na branch de trabalho: exigir suíte toda verde, TypeScript limpo, nenhum diagnóstico novo de lint e validação de todos os efeitos reais. A build deverá ser identificada por commit e SHA-256, e sua instalação dependerá de autorização específica. A baseline Android 11 continua sendo evidência de outro APK, não desta correção. Login novo, troca de conta e logout reais também precisam de autorização apropriada para não invalidar a sessão existente.

Quando login único SUAP, Painel, Acadêmico, Presencial, retorno e isolamento forem comprovados na build correspondente, preparar relatório de integração e solicitar autorização para incorporar à `release/2.0.1`. Nenhum merge ou push será automático.
