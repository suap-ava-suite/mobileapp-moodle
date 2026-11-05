# Verificação de OAuth do SUAP de produção

Data: 2026-11-02

## Resultado

O fluxo Gov.br real ainda não pode ser homologado com a configuração local disponível. O clone Django não tem um cliente OAuth SUAP válido configurado nem um host HTTPS de homologação. O handoff mobile também não está implantado no AVA de produção. Não foram iniciados logins, não foram usados dados de alunos e nenhum APK foi instalado ou substituído nesta verificação.

## Configuração efetiva, sem segredos

Inspecionei as configurações Django após `django.setup()` no clone `C:\Users\T-GAMER\djangoapp_painel_ava-govbr`, branch `feature/govbr-mobile-handoff`, HEAD `8f293ed2ba92672b2fd12874472899bea367a71f`.

| Item | Valor/estado observado |
|---|---|
| `django-suap-auth` | 1.8.13 |
| `SUAP_AUTH.CLIENT_ID` | `#warning: changeme` (placeholder, não é client ID utilizável) |
| `SUAP_AUTH.CLIENT_SECRET` | placeholder; nenhum segredo foi impresso |
| `SUAP_AUTH.BASE_URL` | `https://suap.ifrn.edu.br` |
| `SUAP_AUTH.REDIRECT_URI` | `/auth/suap/callback/` (caminho relativo, não URL HTTPS registrada) |
| Callback móvel | vazio por padrão (`MOBILE_AUTH_CALLBACK_URI` não configurado) |
| Esquema móvel permitido | `moodlemobile` |
| `JWT_SECRET` | não configurado |
| `ALLOWED_HOSTS` | `painel` |
| Proxy HTTPS confiável | não configurado |
| Cache | Redis configurado, mas não foi validado contra servidor de homologação |

O pacote `django-suap-auth` envia o valor de `REDIRECT_URI` diretamente nos parâmetros `redirect_uri` da autorização e da troca de código. A versão local usa o host base de produção e define os endpoints `/o/authorize/`, `/o/token/` e `/api/rh/eu/`. Assim, o callback OAuth pretendido pelo código é o endpoint Django `/auth/suap/callback/`, mas o callback absoluto registrado no SUAP **não é conhecido nem comprovado**. Com a configuração atual, o sistema envia apenas o caminho relativo, e o cliente e segredo são placeholders.

O Django registra `/auth/suap/callback/` com `MobileAwareSuapCallbackView`, que delega a autenticação OAuth, validação de state, troca do código e resolução do usuário à biblioteca oficial. A ponte cria então um código mobile temporário, com state/PKCE, em vez de transportar cookie ou token Gov.br na URL. O destino mobile esperado é `moodlemobile://ifrn-auth/callback`, mas o ambiente local não o configurou.

## O que foi confirmado sobre produção

Uma requisição pública GET, sem autenticação, para `https://ava.ifrn.edu.br/auth/mobile/capability/` respondeu **HTTP 404**. Portanto, o backend implantado nesse host não anuncia atualmente a capacidade do novo handoff. O aplicativo usa `https://ava.ifrn.edu.br` como `PAINEL_AVA_CONFIG.baseUrl`; quando a capacidade não está disponível, o código segue o fluxo legado. Não há configuração local que direcione a build para um host de homologação.

Não foi possível verificar no cadastro administrativo do SUAP se existe outro cliente OAuth autorizado para `https://ava.ifrn.edu.br` ou para este backend. Essa informação não está no repositório e requer acesso ao cadastro do SUAP ou confirmação do responsável institucional. Não reutilizei qualquer credencial do AVA.

A documentação pública consultada do SUAP descreve registros de autenticação externa OAuth, mas não revela as URIs de callback autorizadas de uma aplicação específica nem concede acesso ao cadastro desse cliente: [Central de Ajuda do SUAP](https://ajuda.suap.ifrn.edu.br/comum/comum/).

## Respostas objetivas

1. **Qual callback OAuth está registrado atualmente?** Não foi possível provar um callback registrado. No clone, o callback pretendido é `/auth/suap/callback/`, mas o valor efetivamente configurado é relativo e não corresponde a uma URL registrada verificável.
2. **Podemos usar o callback com o Django?** O endpoint Django existe, mas só pode ser usado após publicar o backend sob um host HTTPS estável e registrar exatamente `https://<host-de-homologacao>/auth/suap/callback/` no cliente OAuth SUAP. Se o cliente existente aceitar somente `https://ava.ifrn.edu.br/auth/suap/callback/`, não se deve reutilizar suas credenciais para outro host.
3. **O que falta?** Aprovação/registro do client OAuth e callback no SUAP; client ID e segredo próprios em secret manager/variáveis de ambiente; host HTTPS e proxy/TLS para o clone; `ALLOWED_HOSTS`, origem HTTPS confiável e Redis de homologação; `JWT_SECRET` próprio para o ambiente isolado; `MOBILE_AUTH_CALLBACK_URI=moodlemobile://ifrn-auth/callback`; e configuração de build diagnóstica apontando para esse host. O segredo JWT de produção não deve ser copiado para homologação.
4. **Foi gerada APK?** Não. Sem host e cliente autorizados, compilar ou instalar a APK não validaria Gov.br real e poderia apenas recair silenciosamente no caminho legado. Nenhum APK foi substituído.

## Android Studio / emulador

Inspeção ADB somente de leitura:

- Um dispositivo ADB autorizado: `emulator-5554` (sem dispositivo físico listado).
- Android: 11.
- WebView: `com.google.android.webview` 139.0.7258.158.
- Pacote instalado: `com.moodle.moodlemobile`, versionName `5.2.1`, versionCode `52100`.
- Nenhuma instalação, limpeza, logout, abertura de login ou troca de conta foi executada nesta etapa.

O emulador está disponível para homologação depois que o backend HTTPS e o callback OAuth forem autorizados. O usuário deverá concluir manualmente SUAP/Gov.br e a seleção de vínculo. Até lá, os cenários de autenticação Gov.br, troca PKCE, Painel e cursos por meio da ponte permanecem pendentes, sem alegação de sucesso.

## Estado dos repositórios

- Mobile: branch `fix/p0-release-2.0.1`, HEAD `5f88fd805653d0bc6d8d816332bdf06df14ec41e`. Mantive as alterações locais preexistentes; não alterei `release/2.0.1`, não fiz merge nem push. Este relatório é a única alteração criada nesta verificação.
- Backend isolado: branch `feature/govbr-mobile-handoff`, HEAD `8f293ed2ba92672b2fd12874472899bea367a71f`; o clone local mantém os commits de desenvolvimento e o arquivo não rastreado `uv.lock`. Nenhuma configuração de segredo foi escrita.
- A P0.4 sobre efeitos tardios na sessão Moodle continua uma pendência separada e não foi validada/corrigida aqui.

## Próximo passo seguro

O responsável institucional deve confirmar ou registrar uma aplicação OAuth SUAP dedicada para homologação, com callback HTTPS do backend de teste e os escopos mínimos usados pelo projeto. Depois, o operador configura as credenciais diretamente no secret manager do ambiente, sem enviá-las no chat nem gravá-las no Git. Com o domínio HTTPS e endpoint de capacidade respondendo no clone implantado, pode-se criar uma build diagnóstica direcionada explicitamente ao host de homologação e executar no `emulator-5554`; o login SUAP/Gov.br e a escolha do vínculo serão feitos manualmente pelo usuário.
