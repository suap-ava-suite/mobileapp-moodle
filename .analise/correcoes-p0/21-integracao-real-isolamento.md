# P0.12 — Integração real do isolamento de sessões Moodle IFRN

Data: 2026-11-01. Branch: `fix/p0-release-2.0.1`. HEAD: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. Base da release confirmada: `0ba7bc2e71b1180418337bb85dca1e082c49c7b0` (`release/2.0.1`).

**Conclusão: BLOQUEADA; P0.4 permanece sem correção no fluxo de produção.** Não alterei fontes de produção, núcleo, plugins, testes anteriores nem a branch da release. A inspeção confirmou que o ledger P0.11 está isolado no harness e que o fluxo em produção continua sem uma fronteira transacional que coordene credenciais, banco, ativação, eventos e navegação. Aplicar apenas guards locais ou tratar o ledger experimental como autoridade deixaria uma janela capaz de gravar/ativar estado incorreto.

## 1. Preservação e baseline

Antes da análise, confirmei a branch, HEAD e estado Git. Havia 128 entradas locais não rastreadas, incluindo os relatórios/evidências `.analise/correcoes-p0/`, `.analise/qualidade-codigo/`, testes e fixtures P0.6–P0.11, o harness P0.11 e artefatos locais. Não havia diff rastreado nem staged. Todos foram preservados; não fiz reset, clean, checkout, merge ou escrita sobre eles. A única nova entrada é este relatório.

O baseline foi repetido com acesso completo ao workspace:

- `node --test --test-concurrency=2 src/MoodleIFRN/tests/*.test.cjs src/MoodleIFRN/tests/*.test.mjs`: **250 testes, 249 aprovados, 1 falha, 0 skipped/todo/cancelados**. A única falha é a expectativa P0.4 original: `P0 PENDENTE: core handler in flight must not activate A or navigate after cancellation and account B`. A tentativa inicial dentro do sandbox contou 239 e apresentou quatro erros esbuild por falta de acesso aos diretórios pais; fora do sandbox esses erros desapareceram, reproduzindo 250/249/1.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`: código 0, sem diagnósticos.
- `npx tsc ...` não executou por política PowerShell de scripts; executei o binário TypeScript via Node e obtive o resultado acima.
- A suíte inclui os testes desktop P0.6–P0.10 e os contratos CJS/ESM; eles passaram no baseline. Os sete checks Android P0.11 já documentados permanecem evidência do harness, não do fluxo Moodle.

O hash do APK P0.11 segue registrado em `p11-apk.json` e `p11-android-runtime.json`. Esta fase não gerou build, não instalou APK e não acessou o processo ou dados do Moodle no Android.

## 2. Fluxo atual e fronteiras de efeito

No caminho atual, `CoreCustomURLSchemesProvider.handleCustomURL(url)` não recebe uma tentativa IFRN e continua depois de qualquer cancelamento externo. Ele valida o callback por `getCustomURLTokenData()` e pelo verificador oficial do passport, chama `createSiteIfNeeded()`, e em caso de token chama `CoreSites.newSite()` (`src/core/services/urlschemes.ts:72,110,182`). Depois pode disparar `CoreNavigator.navigateToSiteHome()` sem aguardar o resultado (`urlschemes.ts:186`).

`CoreSitesProvider.newSite()` faz `fetchSiteInfo()`, resolve o site pelo id e, se já existir, altera o mesmo objeto compartilhado (`setToken`, `setPrivateToken`, `setInfo`, `setOAuthId`, `setLoggedOut`). Em seguida obtém config, chama `addSite()`, publica no cache (`sites[siteId]`), muda `currentSite`, chama `login()` e emite `SITE_UPDATED`/`SITE_ADDED` (`src/core/services/sites.ts:820–910`). `addSite()` grava a linha no banco Moodle e chama o armazenamento seguro em paralelo com `Promise.all` (`sites.ts:1115–1141`). `login()` persiste `current_site_id` e emite `LOGIN` (`sites.ts:1708–1711`). Cada await deixa a operação concorrente avançar; os eventos não carregam um lease/attempt que os observadores possam validar.

Um guard antes/depois da Promise de `handleCustomURL()` não intercepta esses efeitos internos. Guardar antes de `newSite()` também não evita que uma tentativa se torne obsoleta durante `fetchSiteInfo`, gravação ou atualização do SecureStorage. Repor snapshot depois não desfaz observadores e pode sobrescrever uma credencial válida mais recente da mesma conta.

## 3. Contratos nativos encontrados

O SecureStorage Android ativo (`cordova-plugin-moodleapp/src/android/SecureStorage.java`) mantém credenciais por coleção `siteId`, usa `EncryptionHandler.encrypt()` e encerra `store()` com `SharedPreferences.Editor.apply()` (`SecureStorage.java:109–125`). O callback Cordova reporta sucesso logo depois de `apply()`, sem ACK de falha de escrita em disco. O método legado `store` sobrescreve as chaves `token`/`privateToken` da coleção ativa; não oferece coleção candidata versionada, troca condicional de ponteiro ou reconciliação.

A implementação oficial de criptografia pesquisada é `@moodlehq/phonegap-plugin-push` `4.0.0-moodle.13`. `EncryptionHandler.getPublicKey()` cria a chave sodium e grava chave privada e pública em duas chamadas `apply()` separadas (`node_modules/@moodlehq/phonegap-plugin-push/src/android/com/adobe/phonegap/push/EncryptionHandler.kt:144–157`). O SecureStorage e o plugin push compartilham essa inicialização; não existe barreira coordenada entre consumidores. Alterar o plugin global sem verificar geração, migração e todos os consumidores pode tornar credenciais/payloads push ilegíveis. Não toquei nos arquivos originais de `node_modules`.

O plugin SQLite de produção permanece `cordova-sqlite-storage` `7.0.0`. O dispatcher e o ledger `ExperimentalSessionLedger` usados em P0.11 estão no fork sob `src/MoodleIFRN/tests/fixtures/p10-sqlite-extension/`; o APK foi outro package e o arquivo do ledger fica no diretório privado desse harness. Nada disso registra as ações no plugin do Moodle em produção. O ledger de teste contém fence/recibo, mas não está ligado a uma versão de credencial consumida por `CoreSites`, não guarda identidade/ambiente Moodle como parte do contrato publicado e não coordena `current_site_id`, metadados do site ou callbacks de observers.

O teste P0.11 executou `cordova.exec → dispatcher copiado → SQLite Android → callback WebView`, mas deliberadamente não cobriu a perda física do canal, o SecureStorage, a integração com `newSite`, o evento `LOGIN` ou a navegação real. Portanto não prova atomicidade entre os recursos usados pela aplicação.

## 4. Por que não emiti um patch parcial

A integração segura precisa conservar os tokens atuais até a confirmação. O armazenamento ativo não tem versão privada e um guard ao redor do `addSite()` não impede a escrita iniciada em paralelo. A solução depende de um novo armazenamento de candidatos criptografados com ACK explícito e um ponteiro para versão confirmado por tentativa; restauração, limpeza, logout, migração e consumidores do SecureStorage precisam seguir esse ponteiro.

Mesmo com o armazenamento versionado, o bridge P0.11 ainda teria de ser convertido num plugin Cordova realmente instalado no aplicativo e ampliar o ledger para registrar/verificar ao menos operação, sequence, owner SUAP confiável, epoch, generation, URL/ambiente Moodle exatos, identidade Moodle retornada pelo `fetchSiteInfo`, versão da credencial e resultado de publicação. O ponteiro não pode ser aceito do JavaScript como prova. Também é necessário definir a recuperação se o processo cair entre preparar credenciais, publicar recibo, materializar metadados do site e atualizar a seleção corrente. O arquivo de ledger separado não compartilha transação com `sitesTable`/`CoreConfig`; seu papel como fonte durável e as regras de materialização/recuperação ainda não foram implementados.

A validação do passport deve continuar sendo a implementação oficial (`validateBrowserSSOLogin`) e ocorrer antes da preparação. A autoridade SUAP/Painel deve fornecer uma identidade estável e validada; username lido de `sessionStorage` sozinho não é prova de proprietário. O registro do ledger precisa ligar essa identidade, domínio exato e identidade Moodle validada sem usar o nome exibido como chave.

Uma integração incompleta que apenas passasse um callback `isCurrent`, usasse `newSite(..., false)`, filtrasse `LOGIN` depois ou chamasse o ledger após `newSite()` deixaria efeitos irreversíveis anteriores à checagem. Isso contrariaria a prioridade de preservar sessões e o critério de corrigir a causa. Por esse motivo, não converti o teste vermelho em verde com fake, não alterei sua expectativa e não marquei o teste como skip/todo.

## 5. Arquivos alterados e patches

- Arquivo novo: `.analise/correcoes-p0/21-integracao-real-isolamento.md`.
- Fontes de produção modificadas: nenhuma.
- Arquivos originais em `node_modules`, `src/addons/` e `release/2.0.1`: nenhum foi modificado.
- Patch P0.12: nenhum foi emitido ou aplicado; manifesto de patch com operação vazia não seria uma implementação revisável.
- Reversão: remover somente este relatório se for necessário desfazer a documentação. Nenhuma outra reversão de código é necessária.

## 6. Arquitetura necessária para retomar a integração

1. Introduzir em `src/MoodleIFRN/` a autoridade de tentativas, com id único, generation/epoch duráveis, identidade estável SUAP validada, URL/ambiente exato e cancelamento/logout. A tentativa deve chegar explicitamente ao caminho de retorno do browser; nenhum estado global temporário/monkey-patch.
2. Preservar o parser e `validateBrowserSSOLogin()` do núcleo. Após passport, preparar um `CoreSite` candidato isolado e validar a identidade Moodle retornada e seu domínio antes de qualquer atualização de objeto/cache.
3. Construir versão de credenciais privada usando o algoritmo e as chaves oficiais. Exigir ACK explícito de persistência fora da UI thread, sem alterar a coleção `siteId` usada pelos consumidores legados. Coordenar a inicialização da chave sodium/Keystore para SecureStorage e push com lock/barreira compartilhados e migração comprovada.
4. Transformar o fork P0.11 num plugin da aplicação versionado e opt-in. Acrescentar recibo e ponteiro durável por operação/owner/epoch/generation/ambiente/identidade/version-id, sem banco Moodle e sem reutilizar `siteId` como versão. Fazer ações JS e Java conferirem no nativo os metadados e o fence; indisponibilidade ou ACK desconhecido permanece em quarentena.
5. Adicionar recuperação de inicialização que leia somente a publicação confirmada atual. Candidatos sem publicação são órfãos e não restauráveis; falha entre SQLite e secure storage nunca deve ativar uma sessão parcialmente escrita. Logout incrementa/invalida epoch antes de limpar versões pertencentes à conta e preserva outras contas/ambientes.
6. Alterar o mínimo do núcleo via manifesto de patch com hashes e âncoras: passar tentativa explicitamente de `handleCustomURL` a `createSiteIfNeeded/newSite`; preparar sem mutar o site existente; confirmar antes da persistência/materialização; validar lease imediatamente antes de cada efeito compartilhado; somente depois atualizar cache/currentSite/current_site_id, emitir eventos e navegar. Eventos e callbacks IFRN precisam carregar a referência da tentativa para observadores rejeitarem resultados tardios. Fluxos Moodle não IFRN permanecem no caminho oficial inalterado.
7. Bloquear ativação dessa capability em Web/iOS ou plataformas sem equivalentes transacionais demonstrados; manter fluxo legado padrão para operações sem attempt e não habilitar SSO Moodle IFRN experimental nesse backend.

## 7. Plano de validação antes de habilitar produção

- Unit/integration: núcleo real extraído do source por AST/compilação, sem substituir `handleCustomURL/newSite/login` por stubs; sucesso, falha, cancelamento em cada await, A→B, reentrada da mesma conta, timeout, logout, duplicidade, geração/epoch obsoletos, falha parcial e reconciliação desconhecida.
- Persistência Android: testes do plugin Cordova instalado no harness dedicado; armazenamento criptografado legacy e versionado, chave criada simultaneamente por SecureStorage e push, confirmação/erro/resultado desconhecido, reinício e coleta segura de candidatos. Não usar credenciais ou dados reais.
- Core: verificar que estado antigo não modifica tokens, registro, cache, site ativo, `current_site_id`, `LOGIN`, `SITE_ADDED`, `SITE_UPDATED`, observers ou navegação. Reutilizar sessão válida e confirmar ambientes Acadêmico/Presencial e retorno ao Painel.
- Regressão: executar os 250 casos CJS+ESM, TypeScript, lint comparado ao baseline, sintaxe dos patches, `--inspect`, hash/âncoras, idempotência, diff gerado e operações SQLite legadas.
- Android do aplicativo: após suíte aprovada, criar APK debug identificado por branch/commit/versão/hash/assinatura/permissões. Não instalar o app principal nesta fase sem apresentar esses dados e obter autorização específica. Validar fluxo no aparelho sem limpar dados nem executar logout.

## 8. Riscos e compatibilidade

O patch ainda não existe, então não há alteração a integrar na release e não se deve inferir compatibilidade apenas pelo fato de o source atual ser Moodle `release/2.0.1`. A extração futura deve falhar fechada em hashes/âncoras incompatíveis e deixar `release/2.0.1` intocada. O risco principal é a gravação parcial de credencial ativa ou a emissão de efeitos fora da autoridade da tentativa; por isso qualquer etapa sem transação/recibo e recuperação explícitos bloqueia a ativação.

**Status final:** integração P0.12 bloqueada por ausência de um contrato de credencial versionada consumido pelo Core, coordenação comum e comprovada da chave usada por SecureStorage/push, e recuperação durável que una publicação nativa a metadados/seleção de site. A P0.4 continua falhando no único teste original. Não foi preparada build nem instalada aplicação Moodle. Retomar quando essas três dependências estiverem desenhadas como APIs de produção e puderem ser testadas no fork Cordova sem modificar `node_modules` diretamente.
