# P0.5 — proposta de integração cooperativa com o núcleo

Data: 2026-11-01. Base analisada: `fix/p0-release-2.0.1`, `5f88fd805653d0bc6d8d816332bdf06df14ec41e`.

**Estado: proposta para revisão; não implementada. A P0.4 continua aberta.** Nenhuma alteração em `src/core/`, `src/addons/`, autenticação, interface ou scripts de produção foi aplicada nesta fase.

## Evidências que delimitam o problema

O SUAP define quem está autenticado no aplicativo. Uma sessão Moodle permite usar um ambiente/curso, mas não autoriza substituir a identidade SUAP/Painel. Coincidência de nome ou existência de um wstoken não comprova essa correspondência.

O fluxo nativo atual não recebe o proprietário IFRN da operação: `handleCustomURL → createSiteIfNeeded → newSite → addSite → login → navigateToSiteHome`. `newSite` modifica objetos existentes antes de terminar a configuração; banco e secureStorage são gravados antes da seleção do site e dos eventos. O controle só retorna ao IFRN depois desses efeitos. A análise detalhada e os pontos de await estão em `09-isolamento-nativo.md`.

As sondagens sintéticas foram reexecutadas nesta fase, preservando o resultado anterior: **11 sondagens, 3 expectativas atendidas e 8 não atendidas**. Sete falhas representam isolamento insuficiente; outra mostra que `newSite(login=false)` persiste dados e emite eventos, portanto não serve como preparação pura. Evidência nova: `p05-concorrencia.json`.

No aparelho, duas aberturas normais com sessões existentes funcionaram. O APK instalado é diferente do local e não contém os marcadores do epoch/generation desta branch. Não foi realizada concorrência real nem validada qualquer correção P0 no Android.

## Contrato mínimo necessário

A menor solução **adequada** precisa entrar na fronteira interna dos efeitos. Não é uma promessa de patch de poucas linhas. Apenas inserir `assertCurrent()` ao redor de uma Promise ou antes de `addSite()` continua insuficiente se houver escrita/ativação assíncrona em andamento.

Propor um contexto cooperativo opcional e genérico no núcleo, chamado aqui `CoreSessionAttempt`, associado pelo código IFRN a:

- identificador opaco da tentativa e geração monotônica;
- epoch da identidade SUAP/Painel atual, invalidado no logout, nova entrada ou troca de identidade;
- ambiente HTTPS exato e disciplina solicitada;
- verificador de identidade que compara a conta Moodle retornada pelo servidor com os identificadores canônicos da sessão SUAP/Painel;
- estado terminal e propriedade exclusiva do lançamento SSO.

Esse contexto não contém senha, client secret ou token SUAP. Não será colocado na URL, nos parâmetros serializados de rota ou nos logs. O Moodle continua validando o passport e o token pelo algoritmo oficial. O código IFRN fornece a política de proprietário/identidade; não copia a autenticação Moodle.

Os nomes abaixo são interfaces propostas, não APIs já disponíveis nem código a executar:

```text
handleCustomURL(url, attempt?)
  → validação oficial do callback ligada ao lançamento dessa tentativa
  → createSiteIfNeeded(..., attempt?)
  → newSite(..., attempt?)
      preparação isolada
      validação de proprietário + identidade
      publicação protegida
  → navegação vinculada ao resultado publicado
```

### 1. Preparar sem publicar autenticação

Usar os caminhos oficiais de validação e consulta. Antes de obter o proprietário válido e a identidade Moodle, não chamar setters no objeto de uma conta já armazenada nem substituir tokens, seleção global ou cache compartilhado de autenticação.

O estado candidato deve ser separado do site público, inclusive quando o siteId já existe. Se houver gravações de preparação, usar um espaço seguro exclusivo da tentativa, sem sobrescrever a coleção da sessão válida. Candidatos cancelados/expirados não podem ser restaurados como conta autenticada. Uma gravação física tardia de candidato precisa continuar invisível e ser coletada somente pelo seu próprio identificador.

Essa distinção deve ser explícita nos testes: staging interno não é publicação de sessão. Não se pode reclassificar uma escrita na coleção ativa como staging para fazer o teste passar. Cancelamento durante `fetchSiteInfo` deve continuar sem qualquer publicação.

### 2. Publicar com fencing e ponto de confirmação definido

O contrato precisa impedir uma revisão antiga de sobrescrever a revisão atual, tanto em memória quanto na persistência. Não basta conferir a geração uma vez e iniciar duas escritas independentes.

Antes de implementar, definir e testar o protocolo para:

1. Credenciais preparadas sob identificador/revisão exclusivos; nenhuma operação A escreve por cima da credencial ativa de B ou A_NEW.
2. Publicação condicionada ao proprietário, com revisão/fencing também na restauração de sessão. Uma escrita antiga que termina depois de cancelar não pode se tornar selecionável nem substituir a publicação mais nova.
3. Seleção de site, atualização do cache e eventos vinculados ao mesmo resultado publicado. Nenhum `LOGIN` para resultado recusado.
4. Descarte/limpeza somente dos candidatos da própria tentativa; nunca logout global, deleteSite compensatório ou restauração de snapshot que sobrescreva B.
5. Cancelamento, expiração e falha de processo entre secureStorage e banco. As APIs atuais não fornecem transação conjunta entre esses armazenamentos; a solução precisa de um protocolo de publicação/recuperação, e não presumir atomicidade de `Promise.all`.

**Decisão de projeto ainda necessária:** o ponto de linearização da publicação e o significado de cancelar quando ela já foi confirmada. Uma operação já confirmada não pode ser retroativamente chamada de cancelada para ocultar efeitos. Da mesma forma, entrar em uma gravação assíncrona não autoriza ignorar cancelamentos recebidos antes da confirmação. A especificação e as provas dessa fronteira precedem qualquer aprovação do patch como definitivo.

Não há, nesta fase, implementação demonstrada desse protocolo. Essa é uma dependência técnica real da proposta.

### 3. Preservar a propriedade do lançamento e da navegação

- `prepareForSSOLogin/validateBrowserSSOLogin`: vincular o lançamento à tentativa. A exclusão tardia de A não pode consumir a configuração de B. Preservar a validação oficial da assinatura; dados de lançamento precisam de consumo condicionado ao proprietário.
- `CoreSSO`: avaliar contexto por tentativa, preservando compatibilidade dos chamadores antigos. O estado global que expira após 10 s não interrompe A e pode impedir B temporariamente; não é o contrato de isolamento.
- Callback global: o evento `APP_LAUNCHED_URL` não é veto. Uma entrada global não pode contornar o contexto de uma tentativa IFRN nem entregar um callback antigo ao lançamento novo. Resolver a origem/propriedade sem copiar a validação criptográfica fora do núcleo.
- `loadSite/login`: também precisam respeitar o contexto durante a reutilização de uma sessão armazenada. O problema de ativação tardia não se limita a criar um site novo.
- `CoreNavigator`: proteger a navegação real e a continuação `nextNavigation`, inclusive quando a navegação fica em fila ou atravessa awaits. Um guard apenas antes de chamar `navigateToSiteHome()` não prova que uma rota velha será ignorada mais tarde.
- Alterações legítimas de conta/site por outros caminhos precisam invalidar os proprietários anteriores. A opção de contexto pode preservar a API antiga, mas não pode criar um desvio que permita a uma tentativa IFRN antiga continuar depois de uma ativação nova.

## Pontos candidatos de integração futura

| Unidade | Responsabilidade proposta |
|---|---|
| `services_mobile/moodle-site.service.ts` | Capturar o proprietário SUAP e passar o contexto à operação nativa; nunca reconstruir o perfil SUAP a partir de LOGIN Moodle. |
| Helper IFRN de propriedade da tentativa | Geração/epoch, identidade esperada, ambiente e cancelamento; sem algoritmo de autenticação duplicado. |
| `core/services/urlschemes.ts` | Propagar contexto e impedir criação/navegação obsoletas dentro da cadeia. |
| `core/services/sites.ts` | Separar preparação e publicação e aplicar fencing em sites existentes, persistência, currentSite e eventos. |
| `core/features/login/services/login-helper.ts` e `core/static/sso.ts` | Propriedade e consumo do lançamento, controle de callbacks e conclusão da tentativa correta. |
| Entrada global de callback | Encaminhar contexto correto ou recusar callback obsoleto, sem depender de um observador como veto. |
| `core/services/navigator.ts` | Contexto transitório até a efetivação da navegação/nextNavigation, sem serializar identidade ou funções em rota. |

Esses arquivos do núcleo **não foram modificados**. Os pontos listados são candidatos à integração futura e dependem da especificação de publicação. Não constituem autorização presumida para execução do patch.

## Avaliação do mecanismo de patches

`src/MoodleIFRN/patch-moodle-ifrn.js` já reaplica integrações em rotas, guards, estilos e build. Há transformações por marcadores e substituições de texto, algumas com validação de âncora. A implementação escreve arquivos durante a sequência; uma falha posterior não desfaz as escritas anteriores.

O script possui `--course-menus-only`. Não possui modo `--check`/`--dry-run` sem escrita: passar uma opção desconhecida cai no fluxo normal. **Não foi executado**, inclusive com uma suposta flag de verificação.

Proposta para uma integração SSO versionada, em módulo próprio chamado pelo executor existente:

1. Transformação pura de textos/AST, testável sem alterar a árvore original.
2. Manifesto `ifrn-session-isolation-v1` com arquivos e versões/hashes compatíveis, normalizados para LF. `p05-fontes.json` contém a base atual; antes de implementar, fixar a base aprovada e revisar mudanças upstream.
3. Pré-validação de todos os arquivos/âncoras antes de qualquer escrita. Recusar código desconhecido, patch parcial ou marcador incompatível.
4. Modo de verificação realmente sem escrita e geração de diff para revisão. Não criar uma flag que também execute as outras mutações do patch principal.
5. Marcadores de início/fim e versão. Idempotência exata: aplicar duas vezes gera os mesmos bytes normalizados; remover/reaplicar em fixture reproduz a mesma integração.
6. Build deve falhar se o contrato obrigatório estiver ausente ou parcialmente aplicado. Não seguir silenciosamente com uma mitigação IFRN desconectada do núcleo.
7. Reversibilidade por commit/diff revisado; nenhuma limpeza de dados do estudante para validar o patch.

Executar esse mecanismo no futuro também altera o núcleo. Guardar a transformação em `src/MoodleIFRN` não contorna a proibição de escrita desta fase.

## Plano de testes e aprovação

Primeiro implementar e testar o protocolo em fixtures, sem aparelho nem conta real. Reutilizar o teste vermelho atual e as portas de suspensão de `p04-fronteiras.cjs`. Exigir também:

- Cancelamento antes/depois de cada await: callback, validação, `fetchSiteInfo`, lookup de site, configuração, staging, confirmação de publicação e navegação.
- A cancelado, B iniciado/concluído, A tardio: zero substituição de credencial/seleção, LOGIN ou rota antiga.
- A_OLD e A_NEW na mesma matrícula/site, com conclusão invertida: preservação da revisão nova.
- Cancelamento durante escritas de banco e secureStorage; falha parcial entre elas; reinício antes/depois da confirmação. Candidato nunca restaurado como sessão ativa.
- Callback duplicado, timeout, erro de validação, lançamento de B preservado contra consumo/limpeza tardia de A.
- Caminhos antigos sem contexto, convidados/links, políticas de site e recursos Moodle usados: compatibilidade, sem bypass das validações existentes.
- Migração de sessões já armazenadas: ler o formato legado com segurança e não exigir segundo login manual para uma sessão válida da mesma identidade.
- Patch idempotente, verificação sem escrita, âncora incompatível e aplicação parcial recusada.
- Suíte regular 116/116 ou ampliada, sem skip/todo; TypeScript limpo; nenhum novo diagnóstico lint; testes das novas fronteiras efetivamente aprovados.

Somente após aprovação e implementação: build identificável por commit/hash, preservação do APK anterior, e autorização específica para instalar/testar no Android. Login SUAP, Painel, perfil/foto, Acadêmico/Presencial, cursos nativos e retorno devem ser revalidados. Concorrência destrutiva permanece em fixtures até existir ambiente de teste isolado apropriado.

## Conclusão

A integração com o núcleo é tecnicamente necessária para a garantia solicitada no desenho atual. A proposta mantém o SUAP como autoridade e exige publicação nativa cooperativa; não introduz segunda autenticação manual e não troca tokens SUAP por wstoken por suposição.

**Nenhuma correção adicional foi implementada.** O protocolo de publicação, recuperação e cancelamento durante escrita ainda precisa ser especificado e comprovado. O funcionamento normal observado no APK antigo não encerra a P0.4.
