# Contas, matrícula e recuperação de login — 05/10/2026

Esta versão mantém a correção de rota e o curso/tema nativos que foram
confirmados no celular. Acrescenta o tratamento de conta solicitado.

## Comportamento

- Conta Moodle diferente da conta solicitada no Painel: o curso não abre.
  A tela mostra as duas contas e orienta entrar com a matrícula correta.
  Isso acontece mesmo que a outra conta também tenha acesso ao curso.
- Conta correspondente, mas curso ausente da lista de cursos matriculados:
  a mensagem informa que essa matrícula/login não está vinculada à disciplina
  na lista recebida do Moodle; o curso não abre.
- A tela oferece “Entrar com outra conta SUAP”, “Voltar ao login IFRN” e
  “Voltar ao Painel AVA”. A mensagem permanece visível antes da escolha;
  não há redirecionamento automático que impeça sua leitura.
- “Entrar com outra conta SUAP” mantém o Painel e a disciplina pendente,
  usa o switch-account/OAuth oficial e volta à ponte para revalidar a conta.
- “Voltar ao login IFRN” encerra a autenticação local IFRN/Painel e mostra
  o formulário com a matrícula esperada preenchida. Não retoma a conta antiga
  automaticamente por token ou biometria nessa navegação explícita.
- Sem erro, continua a abertura silenciosa do curso nativo.

## Como a conta correta fica salva

Não há senha nova armazenada, token SUAP usado como token Moodle ou banco de
sessões paralelo. O CoreSites já persiste a sessão de cada conta Moodle.
A busca de sessão IFRN usa a matrícula/login do perfil do Painel para
identificar qual site/conta armazenada deve ser reutilizada. A validade e
correspondência são verificadas antes de abrir o curso. Uma sessão expirada
ou marcada como logged-out ainda exige OAuth.

A ordem de identificação é:

1. `perfil.matricula`;
2. `perfil.username`;
3. `perfil.identificacao`;
4. login IFRN digitado, quando o perfil não informa uma conta;
5. outros identificadores somente na ausência dos anteriores.

Quando o perfil informa a conta solicitada, outro vínculo que compartilhe
CPF ou um login digitado diferente não pode substituir essa identidade.
O comparador e a busca de sites armazenados usam a mesma regra.

Os identificadores apresentados na tela são os do próprio usuário. Os novos
campos de recuperação ficam na memória do serviço e não contêm senha/token.
O tema SCSS do curso nativo permanece idêntico à versão que funcionou.

## Limite do navegador SUAP

O app não controla os cookies do Chrome externo. Se o navegador continuar
retornando automaticamente a conta de estagiário, saia dessa conta no SUAP
pelo navegador e autentique com a matrícula usada no Painel. O app rejeita
novamente a identidade errada, sem ciclo automático de tentativas.

## Arquivos alterados no pacote, em relação ao ZIP original

1. `src/MoodleIFRN/services_mobile/moodle-site.service.ts`
2. `src/MoodleIFRN/moodle-open-course/moodle-open-course.ts`
3. `src/MoodleIFRN/moodle-open-course/moodle-open-course.html`
4. `src/MoodleIFRN/moodle-open-course/moodle-open-course.scss`
5. `src/MoodleIFRN/ifrn-login/ifrn-login.ts`
6. `src/MoodleIFRN/docs/CORRECAO-ABERTURA-CURSO.md` (novo)

Não foram alterados src/core, src/addons, patch-moodle-ifrn.js nem o SCSS
do curso nativo.

## Verificação

Passaram 20 verificações locais com TypeScript transpilado e dependências
simuladas, incluindo bloqueio de conta divergente antes de abrir o curso,
conta sem cursos, prioridade da identificação do Painel sobre outra conta,
reutilização da conta correta já armazenada e retorno explícito ao login.

Também passaram o teste de regressão da rota nativa, o teste do formulário
IFRN (forceLogin bloqueia a retomada, login comum preserva a retomada), o
parser de template Angular e a compilação do SCSS da ponte. Não equivalem
à execução completa do app no Android; é necessário revalidar no celular.

Copie a pasta MoodleIFRN sobre src/MoodleIFRN, recompile e instale o APK.
Teste conta divergente com e sem acesso ao curso, conta correta sem vínculo
na disciplina, troca de login e reentrada com a sessão correta salva.

---

## Histórico das correções de abertura

# Atualização após o log do celular — 05/10/2026

O log confirmou o erro real:

```text
NG04002: 'main/home/login/moodle-open-course'
```

A falha ocorreu depois de o OAuth criar a sessão e antes de chamar
`getAndOpenCourse()`. O `CoreMainMenuDeepLinkManager` interpreta
`redirectPath` como caminho de uma página do site. Ao receber
`/login/moodle-open-course`, chamava `navigateToSitePath()`, que empilhava
esse caminho em `/main/home`. Essa rota não existe.

A versão anterior ainda preservava esse redirectPath inválido; por isso a
correção anterior não resolveu esta falha concreta.

## Correção desta versão

Em `services_mobile/moodle-site.service.ts`, o retorno OAuth agora usa:

- `redirectPath: MAIN_MENU_HOME_PAGE_NAME` para concluir uma rota nativa válida;
- `redirectOptions.nextNavigation.path: '/login/moodle-open-course'`;
- `isSitePath: false`, para que o próximo passo use `CoreNavigator.navigate()`
  absoluto, sem prefixar `/main/home` e sem apagar a sessão Moodle.

O fluxo fica:

```text
OAuth → sessão Moodle → /main/home → /login/moodle-open-course
→ validar identidade → getAndOpenCourse → índice nativo do curso
```

Os objetos de diagnóstico dos dois arquivos TypeScript agora são serializados
com `JSON.stringify()`. No logcat, message, stack, courseId e caminhos passam a
aparecer por completo, em vez de `[object Object]`.

Os únicos arquivos alterados desde o ZIP original continuam sendo:

1. `src/MoodleIFRN/services_mobile/moodle-site.service.ts`
2. `src/MoodleIFRN/moodle-open-course/moodle-open-course.ts`
3. `src/MoodleIFRN/docs/CORRECAO-ABERTURA-CURSO.md` (novo)

Não há mudança em Core, addons, patch ou SCSS.

## Outra condição mostrada pelo log

O Painel apresenta `perfil.identificacao` numérico com 14 caracteres; o
username da sessão Moodle recém-criada é numérico com 7 caracteres.
O comparador registra `nova sessão corresponde = false`. Isso prova que os
identificadores comparados não coincidem; sozinho, não prova se a causa é
conta diferente no navegador ou um campo de identificação incompatível.

A validação foi preservada. Corrigida a rota, essa condição deve aparecer na
ponte como erro de identidade, em vez de deixar o app na rota inválida.
Se o SUAP no navegador estiver conectado a outra conta, autentique com a
mesma conta utilizada no Painel. Se já for a mesma, precisamos verificar os
campos do perfil antes de alterar o comparador; não usar nome de exibição
nem abrir um curso com uma identidade não confirmada.

## Verificações desta versão

Passaram 13 verificações com o serviço transpilado, incluindo o payload
real gerado por `startSuapOAuthLogin()`. Um teste adicional executou cinco
métodos extraídos da implementação nativa do Navigator e reproduziu:

- rota antiga: `/main/home/login/moodle-open-course`;
- rota corrigida: `/main/home` seguida de `/login/moodle-open-course`;
- nenhuma chamada de logout.

Não houve build Angular completo nem teste do OAuth no dispositivo.
A abertura final também depende de a identidade e a matrícula no curso
serem válidas.

Para capturar o próximo teste sem ruído do Chrome nem o retorno bruto de
OAuth registrado pelo Cordova:

```bash
adb logcat -c
adb logcat | grep --line-buffered -E 'IFRN|NG04002' | tee moodle-log.txt
```

Copie `MoodleIFRN/` sobre `src/MoodleIFRN/`, recompile o APK com o comando
habitual e instale-o no celular. Não basta recarregar o painel estático.

---

## Registro da primeira versão

# Abertura do curso nativo — 05/10/2026

## Arquivos alterados

1. `src/MoodleIFRN/services_mobile/moodle-site.service.ts`
2. `src/MoodleIFRN/moodle-open-course/moodle-open-course.ts`
3. `src/MoodleIFRN/docs/CORRECAO-ABERTURA-CURSO.md` (este documento, novo)

O ZIP mantém a pasta `MoodleIFRN/`, para copiar sobre `src/MoodleIFRN/`.
Nenhum arquivo do Core, dos addons, do tema SCSS ou do patch foi modificado.

## Falhas encontradas no código

O listener IFRN de LOGIN agendava `afterOAuthLogin()` em 800 ms. Ao mesmo
tempo, o retorno oficial do OAuth carregava `/main` com um `redirectPath`
para `/login/moodle-open-course`, cuja inicialização também abria o curso.
Havia dois responsáveis pela mesma abertura, sem exclusão mútua. O timer
também podia executar antes de a navegação oficial terminar.

Outra falha era considerar a resolução de `getAndOpenCourse()` como prova
de abertura. O handler nativo padrão chama `navigateToSitePath()` sem
aguardar sua Promise. Assim, o código IFRN podia registrar sucesso e apagar
o curso pendente enquanto ainda estava em `/main`.

A proteção que ignorava `/main` antes de reconhecer a rota do curso já
existia no ZIP. Não foi identificada evidência de que essa proteção, sozinha,
fosse a causa do erro vermelho relatado.

## Correção aplicada

- O listener LOGIN não abre mais o curso por timer. A ponte consome o retorno
  oficial do OAuth e mantém a validação de identidade existente.
- Chamadas simultâneas para o mesmo courseId compartilham a mesma Promise.
  Uma tentativa concorrente para outro curso é recusada.
- A camada IFRN continua chamando `CoreCourseHelper.getAndOpenCourse()`.
  Aguarda também o `NavigationEnd` do índice nativo do courseId solicitado.
  Não substitui handlers ou constrói seções/atividades manualmente.
- O observador não redireciona durante uma abertura em andamento. Mantém
  a exigência de índice reconhecido e transição índice → landing do Main Menu.
- Páginas curtas de plugins não são mais classificadas automaticamente como
  Dashboard. Rotas de atividades e module-preview do mesmo curso preservam
  a origem; outro curso não herda a origem do curso anterior.
- Um NavigationError relevante rejeita a espera com o erro original. Sem
  confirmação da rota em 45 segundos, a tentativa gera erro explícito, limpa
  a origem e permite recuperação. O timeout não dispara outra abertura.
- Em falha, a ponte mostra o erro e permite tentar novamente. Não anuncia
  sucesso nem redireciona silenciosamente ao Painel.

Os cursos abertos diretamente pelo Dashboard não chamam esta ponte nem
marcam `ifrn_course_origin=painel`; o observador IFRN permanece inativo.

## Validação realizada e limites

Passaram 12 verificações locais: sintaxe TypeScript dos dois arquivos;
abertura única; `/main` intermediário; confirmação da rota; limpeza do
listener temporário; atividade e Voltar; Dashboard sem origem IFRN;
NavigationError com a exceção original; retomada única do OAuth; outro
curso sem herdar a origem; module-preview e página curta de plugin.

Essas verificações usaram o serviço real transpilado com dependências
simuladas. Não equivalem a um build Angular completo ou teste no Android.
O ZIP fornecido contém apenas MoodleIFRN, sem o projeto e suas dependências.
As implementações nativas foram consultadas na branch
`feature/moodle-curso-ifrn`, apenas como referência, sem edição.

A disputa de abertura e a confirmação prematura são defeitos demonstráveis
no código. Sem a sessão Moodle do usuário e o erro vermelho original, não
é possível garantir que sejam a única causa do sintoma no aparelho. Os logs
adicionados permitem localizar uma falha restante sem adivinhação.

## Como aplicar e testar

Copie a pasta `MoodleIFRN` do ZIP sobre `src/MoodleIFRN` no projeto.
Como o patch e o SCSS não mudaram, não é necessária uma nova alteração de
rotas; se precisar reaplicar as integrações existentes, execute:

```bash
npm run patch:ifrn
npm run build:mobilemoodle
```

Depois recompile/inicie o app com o comando habitual do projeto. Um reload
apenas do painel estático não recompila o serviço Angular.

Teste com sessão Moodle já válida e depois com OAuth:

1. Painel → disciplina → índice nativo do curso.
2. Atividade → Voltar → curso, sem retorno prematuro ao Painel.
3. Índice do curso → Voltar → Painel AVA.
4. Dashboard nativo → curso → Voltar, mantendo o comportamento nativo.

No console, filtre `[IFRN-COURSE]`, `[IFRN-COURSE-NAV]` e `[IFRN-SITE]`.
`getAndOpenCourse retornou` ainda não significa que a rota terminou.
`curso nativo aberto` só é registrado depois da confirmação da rota.
Se falhar, envie a sequência desde `courseId recebido` até `FALHOU`,
incluindo message/stack e os caminhos de NavigationEnd.
