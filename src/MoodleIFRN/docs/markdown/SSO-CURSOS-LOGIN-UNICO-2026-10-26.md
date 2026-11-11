# Uma entrada manual: login principal e conexão automática dos cursos

## Requisito

Preservar o login principal SUAP e abrir cursos nativos sem solicitar uma segunda
senha e sem transferir a autenticação para Chrome, Safari ou outro app.

## O que a investigação confirmou

O app mantém sessões distintas: a entrada principal autentica o Painel/SUAP e
obtém seu perfil; o curso usa um token do serviço móvel do ambiente Moodle correto.
O perfil salvo do SUAP/Painel não é esse token e não deve ser apresentado como tal.

O caminho antigo dos cursos chamava `CoreLoginHelper.openBrowserForOAuthLogin()`.
No núcleo local esse método prepara o SSO e chama `CoreOpener.openInBrowser()`.
Portanto, mesmo que comentários mencionassem IAB, a autenticação saía do app.

Foram consultados os repositórios indicados pelo usuário:

- [Plugin auth_suap](https://github.com/suap-ava-suite/moodle-auth_suap): OAuth,
  criação de sessão Moodle e restauração do destino original.
- [Fluxo documentado do plugin](https://github.com/suap-ava-suite/moodle-auth_suap/blob/main/docs/pt-br/fluxo-autenticacao.rst):
  registra que o antigo `dispatch.php` não existe mais no código atual.
- [Painel AVA](https://github.com/suap-ava-suite/djangoapp-painel_ava): dashboard
  dos ambientes, não substitui a autenticação móvel do Moodle.
- [Integrador AVA](https://github.com/suap-ava-suite/djangoapp-integrador_ava):
  sincronização acadêmica; não foi tratado como sessão de aluno.
- [Moodle launch.php](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/admin/tool/mobile/launch.php):
  preserva parâmetros no cookie de lançamento e retorna o token vinculado ao
  passport para o esquema do app. O ramo consultado não comprova a versão instalada.
- [Depuração de autenticação Moodle](https://moodledev.io/general/app/development/network-debug):
  documenta o retorno SSO pelo esquema `moodlemobile://token=...`.
- [InAppBrowser](https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-inappbrowser/):
  navegação interna, modo oculto e interceptação de navegação.

Não foi encontrado um endpoint atual que permita simplesmente converter o perfil
salvo do Painel em token móvel Moodle. Não foram introduzidos client secrets,
tokens de integração, armazenamento de senha ou um broker fictício no app.

## Implementação

`services_mobile/course-sso-browser.ts` controla uma tentativa isolada:

1. O serviço Moodle continua reutilizando primeiro uma sessão móvel válida da
   mesma conta e ambiente.
2. Quando ela não existe, `CoreLoginHelper.prepareForSSOLogin()` prepara o launch
   oficial com passport e destino do curso; o login usa `auth/suap/login.php` e seu parâmetro `next`, sem misturar o provider OAuth2 do núcleo.
3. Uma instância nativa do InAppBrowser abre com `_blank`, `hidden=yes`, sem limpar
   cookies. Isso reutiliza a sessão SUAP do primeiro login no mesmo armazenamento
   de navegador interno. A janela não é mostrada e não possui fallback externo.
4. `beforeload=get` permite apenas HTTPS no ambiente solicitado e no SUAP oficial.
   Esquemas externos, HTTP e outros domínios são recusados.
5. O callback é consumido uma vez e passado a
   `CoreCustomURLSchemes.handleCustomURL()`. O núcleo valida o passport/site/token;
   as verificações existentes de identidade e matrícula continuam em vigor.
6. Se o plugin terminar na página inicial do Moodle, o launch original pode ser
   retomado uma vez. Não há loop de navegação.
7. Formulários de senha/OTP ou nova autorização não são preenchidos, enviados ou
   aceitos automaticamente. A tentativa oculta termina e a recuperação acontece
   pelo login principal ou pela configuração institucional do ambiente.

O IAB dos cursos não passa pelo dispatcher global de `CoreOpener`, pois este pode
encaminhar certos esquemas para apps externos. Isso não altera o helper global do
Moodle ou o navegador usado pelo login principal.

Timeout, cancelamento, erro de rede e retorno inválido fecham a janela e liberam
os listeners. O callback preserva o passport até o núcleo validá-lo.

Na ponte de cursos, a UI informa que está conectando automaticamente e oferece
retorno ao login principal em caso de erro; a opção de outro login manual dentro
do curso foi retirada. As saídas explícitas relacionadas ao fluxo IFRN também
deixam de chamar o navegador externo.

## Limites institucionais

Uma janela oculta não cria uma sessão SUAP inexistente e não evita consentimento
exigido pelo servidor. Se o SUAP tiver expirado, o usuário precisa renovar o login
principal. Se um cliente OAuth exigir autorização adicional, a instituição precisa
permitir o fluxo apropriado. O app não contorna essas decisões nem aceita uma
conta diferente para cumprir artificialmente o requisito.

Os serviços de credenciais/perfil do login principal (`auth.service.ts`,
`suap-entry.service.ts` e `suap-browser.service.ts`)
permanecem sem alterações nesta implementação. Em `painel-ava.service.ts` foi
necessário desativar explicitamente a interceptação herdada da janela dos cursos,
conforme a regressão descrita abaixo. Na página Marketplace só foi
substituída a abertura externa de logout da recuperação de conta.

## Verificações automatizadas

- TypeScript do aplicativo: `tsc -p tsconfig.app.json --noEmit` aprovado.
- A bateria anterior de cursos, sessões, navegação e recuperação passou (55 testes). Após a normalização do callback e o limite de ciclos, os dois arquivos diretamente afetados passaram novamente (16 testes).
- Casos novos: cookies preservados/modo oculto, callback delegado ao núcleo,
  parâmetros de redirect intactos, callback duplicado, link iOS, senha/OTP,
  consentimento, domínios indevidos, cancelamento, timeout, erro e retomada única.
- Não há teste de credenciais reais embutidas nem limpeza de dados do aparelho.

## Primeira rodada no Android — antes da correção de User-Agent

- Cursos com tokens nativos já válidos abriram no Acadêmico e no Presencial.
  Isso não comprova autenticação inicial em uma instalação sem sessão.
- O diagnóstico isolado do Presencial recebeu um callback móvel válido em
  janela oculta, sem nova senha. O token desse diagnóstico não foi ativado nem salvo.
- No Acadêmico, o diagnóstico ainda alternou entre SUAP, login do plugin e launch,
  terminando sem token. Não há confirmação da causa nem de correção completa.
- Foram observados cookies MoodleSession particionados e não particionados.
  Uma tentativa restrita de expirar apenas a variante particionada no Acadêmico
  não resolveu o ciclo. Essa hipótese não virou limpeza automática no produto.
- O helper agora encerra ciclos repetidos; não há fallback para navegador externo.
- O APK foi recompilado e instalado por cima do app após a correção do retorno
  ao login principal. A autenticação automática inicial do Acadêmico continua
  pendente; essa instalação não significa que esse outro problema foi resolvido.

O login principal, os perfis e os tokens nativos existentes foram preservados.
Não foi feita alteração no servidor institucional nem confirmada a necessidade
exata de configuração/publicação do backend para resolver o Acadêmico.

## Regressão ao sair e entrar novamente no Painel

O plugin Android mantém o campo `beforeload` entre aberturas de janelas e só o
substitui quando a nova chamada informa essa opção. O fluxo oculto dos cursos
usa `beforeload=get` e libera cada redirect no seu próprio listener. Ao abrir o
login principal depois, omitir a opção deixava os redirects pausados, sem esse
listener. Isso afetava também as consultas internas de perfil do Painel.

As opções compartilhadas do Painel agora enviam `beforeload=no` explicitamente.
A implementação Java instalada aceita esse valor, embora o wrapper TypeScript
liste apenas os modos que habilitam a interceptação. Não foram modificados os
endpoints, formulários SUAP, validação de identidade ou regras de cookies do login.

O teste `painel-login-after-course.test.cjs` inicia com o estado nativo `get`,
assina o login real do serviço com mocks de navegador e verifica o reset nos
modos de nova entrada e retomada. Verifica também cookies e descarte dos listeners.
A bateria diretamente afetada passou com 17 testes e o TypeScript passou.

O build web e `assembleDebug` concluíram. O APK foi instalado com `adb install -r`,
sem desinstalação nem limpeza de dados. No Android conectado foi aberta primeiro
uma janela inofensiva com `beforeload=get`, reproduzindo o estado residual do curso.
Em seguida foi acionada a entrada principal real: a abertura enviou `beforeload=no`
e recebeu `loadstart` e `loadstop` em `https://suap.ifrn.edu.br/accounts/login/`,
sem pausa em `beforeload`. A tela ficou disponível para o aluno autenticar.
Não foram lidas nem preenchidas credenciais e o login completo depende dessa
interação manual do usuário.

## Correção do timeout após limpar os dados e entrar novamente

A limpeza removeu os tokens nativos que permitiam abrir os cursos. Na primeira
conexão sem esses tokens, tanto Acadêmico como Presencial repetiam o OAuth até
expirar, embora a configuração pública respondesse normalmente. Trocar a branch
Git não modifica o APK instalado; os testes anteriores com tokens salvos não
validavam esse cenário.

No código oficial de `admin/tool/mobile/launch.php` consultado acima, o Moodle
acrescenta `Secure` e `Partitioned` ao cookie de sessão quando
`core_useragent::is_moodle_app()` reconhece o app. No Android conectado foram
observados dois cookies `MoodleSession` por ambiente, um particionado e outro
normal. No diagnóstico com o mesmo fluxo e os mesmos cookies, retirar apenas o
identificador `MoodleMobile` do User-Agent da janela fez o Presencial retornar o
token em vez de repetir o ciclo. O Acadêmico também retornou o token usando a
identificação normal do WebView.

A implementação usa `omitappuseragent=yes` somente na janela oculta dos cursos.
O hook `scripts/cordova-hooks/ifrn-course-sso.js`, registrado em `after_prepare`,
ajusta o plugin Android para omitir o sufixo `AppendUserAgent` apenas quando essa
opção estiver explícita. O comportamento padrão, o login principal, os cookies
SUAP, os perfis e os tokens nativos não são alterados. O hook é idempotente,
abrange as cópias do plugin e do projeto Android e recusa fonte incompatível.
É necessário compilar o APK: atualizar apenas o JavaScript não inclui esse ajuste.

O `auth_suap` do Acadêmico também chegou a redirecionar para a raiz do Painel.
Nesse retorno específico, o helper não carrega o Painel: retoma uma única vez o
launch original do ambiente solicitado. Caminhos arbitrários, parâmetros de
redirect e domínios semelhantes continuam recusados. A validação oficial do
passport e da identidade autenticada permanece sob responsabilidade do núcleo.

Validação desta correção:

- 41 testes de cursos, retorno ao Painel, recuperação, novo login e hook passaram.
- TypeScript, build web e `assembleDebug` passaram.
- APK instalado com `adb install -r`, preservando o login feito pelo usuário.
- Acadêmico abriu `/main/home/course/4022/contents` sem erro.
- Presencial concluiu a conexão automática e abriu
  `/main/home/course/2836/contents` sem erro.
- O Android permaneceu na `MainActivity` do app, sem navegador externo.
- Novas aberturas e troca entre os dois ambientes também foram verificadas.

Os tokens dos diagnósticos isolados não foram ativados nem registrados em logs.
O teste final passou pelo serviço real do app, que validou e salvou as sessões.
Não foi necessária alteração no servidor institucional para os dois ambientes
testados. A pendência da primeira rodada descrita acima foi resolvida nesta versão
Android; iOS não foi validado nesta rodada.
