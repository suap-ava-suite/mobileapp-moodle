# Gov.br/SUAP — preservação e preparação de homologação

Data: 02/11/2026. Nenhum push, merge ou alteração em `release/2.0.1` foi feito.

## Backend preservado

A cópia durável está em `C:\Users\T-GAMER\djangoapp-painel_ava-govbr`, derivada do repositório institucional `suap-ava-suite/djangoapp-painel_ava`. A branch local é `feature/govbr-mobile-handoff`, baseada no commit `c65812ca1525c766b95f49f73a4f6bc719e1f7d3`, com HEAD `8f293ed2ba92672b2fd12874472899bea367a71f`. A implementação está em quatro commits locais, sem publicação: `aa4b5eb` (handoff), `8f9335f` (limite e limpeza), `dff276a` (segredos e CORS) e `8f293ed` (testes HTTP de exchange/bootstrap).

Os commits contêm a view que subclassifica `SuapCallbackView` e delega a autenticação oficial a `super().get()`, o modelo/migração de tentativas, endpoints de capability/start/exchange/bootstrap, validação PKCE S256 e state, testes, configurações e o comando `cleanup_mobile_login_attempts`. O backend não recebe nem transfere cookies, senha, código OAuth do provedor ou token Gov.br. O código móvel contém somente `code` e `state`; o app envia o verifier à troca por HTTPS e valida a identidade retornada antes de carregar o perfil e os diários.

Foi acrescentado limite configurável de 10 inícios por endereço em 300 segundos, usando HMAC do `REMOTE_ADDR` no cache (o endereço bruto não é armazenado). O limite falha fechado com HTTP 503 se o cache estiver indisponível e responde 429 com `Retry-After` ao exceder a cota. Inícios também removem um lote limitado de tentativas expiradas; o comando Django remove lotes adicionais e deve ser agendado no ambiente de homologação/produção. O handoff também falha fechado se `DJANGO_SECRET_KEY` for curto ou placeholder; o CORS padrão foi reduzido a `https://localhost`, permitindo outros origins somente por configuração explícita.

O `.venv` isolado está na cópia durável, com CPython 3.14.8 e `django-suap-auth` 1.8.13. O `uv.lock` que já existia na cópia temporária permanece não rastreado; não foi incluído nos commits. `.venv` é local/ignorado. A primeira tentativa selecionou CPython 3.15, sem wheel compatível no lock; a instalação foi refeita com CPython 3.14.8.

## Validação local do Django

Resultado na cópia durável:

- `pytest --ds=test_settings_govbr src/painel/v2/tests.py -q`: **20 aprovados**. Inclui código de uso único, state/verifier incorretos, expiração, callback oficial delegado, tentativa de callback com usuário de sessão antigo, limite, cache indisponível, segredo Django fraco, limpeza, CORS, exchange HTTP com replay recusado, bootstrap autenticado e APIs privadas sem autenticação.
- Ruff nos arquivos do handoff e testes: **aprovado**.
- `manage.py check --settings=test_settings_govbr`: **sem problemas**.
- `makemigrations painel --check --dry-run --settings=test_settings_govbr`: **nenhuma alteração pendente**.

Esses testes usam SQLite em memória e cache local. O lock inclui `psycopg` para PostgreSQL, mas esta máquina não tem servidor/cliente PostgreSQL nem Docker disponível. Portanto, a migração **não foi aplicada nem validada em PostgreSQL**, e o rate limit não foi testado entre processos usando Redis. O repositório configura Redis como cache padrão (`redis://cache:6379/1`); a homologação deve fornecer esse cache compartilhado.

O `JWT_SECRET` padrão é vazio e `_jwt_secret()` recusa vazio e valores placeholder; nenhum segredo foi colocado no app ou no Git. A implantação deve configurar segredo aleatório e estável. Tokens existentes continuam verificáveis somente se o servidor preservar a mesma chave que os assinou. Se o ambiente legado usava o fallback conhecido, eles não serão compatíveis e será necessário planejar nova autenticação/rotação. O valor de produção não foi lido nem registrado.

O redirect OAuth do SUAP permanece no callback HTTPS do backend, configurado pelo `OAUTH_REDIRECT_URI` (default de código: `/auth/suap/callback/`). O callback móvel `moodlemobile://ifrn-auth/callback` só é usado depois que o Django conclui o callback OAuth. O valor móvel é vazio por padrão e a capability falha fechada até configuração institucional. O endpoint de callback OAuth exato registrado no SUAP precisa ser confirmado pelo responsável pelo ambiente; não foi inventado nem alterado.

## APK e emulador

O builder `node src/MoodleIFRN/scripts/build-android-web.cjs`, `cordova prepare android` e Gradle `assembleDebug` concluíram. A APK está em [p27-govbr-diagnostic-20261102.apk](p27-govbr-diagnostic-20261102.apk), SHA-256 `BE261E74F57AFF01355FD30B2D323E8B7CAAA576420B5869337770EF2C1C9F81`.

- Package ID `com.moodle.moodlemobile`; versão `5.2.1`, version code `52100`.
- Certificado debug SHA-256 `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`, igual ao APK instalado no AVD.
- `assets/www/index.html` empacotado tem exatamente uma referência a `cordova.js`, e o arquivo também está no APK. O bundle contém os endpoints mobile de capability e exchange.
- A lista de permissões é igual à do APK anterior; esta build não introduziu permissões.
- Android reconhece `moodlemobile://ifrn-auth/callback` e resolve a `MainActivity`.

O único dispositivo ADB era o AVD `Pixel_4`, Android 11, WebView `139.0.7258.158`, conectado como `emulator-5554` (não havia `emulator-5556`). Usei esse AVD já aberto; nenhum celular físico foi conectado ou alterado. A instalação `adb install -r` passou com certificado igual, preservando os dados do app. O processo iniciou na `MainActivity`; a checagem sanitizada de logcat não encontrou crash fatal, ANR, erro Angular JIT ou `Cordova is not available`.

Isso não comprova o fluxo visual completo: a árvore de acessibilidade não expôs rótulos do Marketplace, e não fiz login manual, retorno autenticado, carregamento de perfil/disciplina ou abertura de curso. Também não testei Gov.br real. O backend não está implantado/configurado no host que o app usa (`https://ava.ifrn.edu.br`), e o teste exige interação manual na página oficial.

O Gradle concluiu, mas avisou que Android Gradle Plugin 8.7.3 foi testado até `compileSdk 35`, enquanto o projeto usa 36; também houve aviso de versão do SDK XML. São avisos de compatibilidade da ferramenta, não falhas desta build.

## Configuração e passos para homologação

1. Criar banco PostgreSQL isolado de teste e rodar `migrate`; validar o modelo/índice, `select_for_update` e consumo único nesse backend.
2. Configurar `DJANGO_SECRET_KEY` e `JWT_SECRET` fortes, preservar a chave JWT atual quando houver tokens que precisem continuar válidos, e apontar cache compartilhado Redis. Configurar `MOBILE_AUTH_CALLBACK_URI=moodlemobile://ifrn-auth/callback`, `MOBILE_AUTH_CORS_ORIGINS` apenas para a origem real do WebView e agendar `cleanup_mobile_login_attempts`.
3. Publicar o backend em homologação HTTPS, configurar proxy para o Django reconhecer HTTPS, `ALLOWED_HOSTS`/origens confiáveis e registrar no SUAP somente o callback HTTPS autorizado do backend. O deep link do app não substitui esse redirect OAuth institucional.
4. Apontar uma build de diagnóstico separada para a base HTTPS de homologação. A configuração atual do app aponta para `https://ava.ifrn.edu.br`; não se deve testar Gov.br em produção nem inventar um redirect alternativo.
5. No emulador correto, fazer manualmente login tradicional e Gov.br, escolher vínculo, confirmar identidade no bootstrap, perfil/diários, e abrir/retornar de cursos. Se o teste exigir `emulator-5556`, iniciar essa instância e confirmar WebView antes da sessão manual.

A P0.4 de concorrência da sessão nativa Moodle continua pendente e é um bloqueio separado para release. A build de diagnóstico não constitui aprovação de release.
