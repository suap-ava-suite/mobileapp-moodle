# Gov.br SUAP e desempenho — validação desta etapa

## Estado

- Branch: `fix/p0-release-2.0.1`.
- HEAD inicial: `5f88fd805653d0bc6d8d816332bdf06df14ec41e`.
- `release/2.0.1` não foi alterada; nenhum commit, push, merge ou instalação foi feito.
- Alterações locais preexistentes e relatórios foram preservados.

## Causa do loading Gov.br

O fluxo atual abre `ava.ifrn.edu.br` em um InAppBrowser oculto. Ele só mostra páginas cuja origem é `suap.ifrn.edu.br`. Depois do clique Gov.br, a navegação sai para `sso.acesso.gov.br`; o observador esconde o browser e não o mostra novamente nesse domínio. O aplicativo permanece aguardando uma resposta do Painel até o timeout global de 120 segundos.

O botão Gov.br publicado pelo SUAP IFRN redireciona ao Login Único com `client_id=suap.ifrn.edu.br` e `redirect_uri=https://suap.ifrn.edu.br/accounts/login/`. Portanto, o callback atual termina numa página web do SUAP, não num callback do Moodle IFRN Mobile. A página de seleção de vínculo também está no domínio SUAP e o código atual já a torna visível; ela não é, por si só, o callback OAuth do app.

A documentação oficial do Login Único orienta que aplicações móveis usem navegador nativo, sem WebView. Abrir Gov.br dentro do InAppBrowser para mascarar a falha violaria essa orientação. Abrir no navegador do sistema, por si só, também não devolve a sessão web ao InAppBrowser nem cria um retorno ao app. A conclusão segura do fluxo requer que a integração institucional SUAP/Login Único forneça e registre um callback móvel oficial.

## Alterações feitas

- `src/MoodleIFRN/services_mobile/painel-ava.config.ts`: reconhece apenas URLs HTTPS em hosts `gov.br` ou subdomínios verdadeiros de `gov.br`.
- `src/MoodleIFRN/services_mobile/painel-ava.service.ts`: após detectar que o SUAP iniciou a autenticação, encerra imediatamente o fluxo quando ele redireciona ao Gov.br. A tela recebe explicação sobre o callback móvel ausente, em vez de ficar carregando por até dois minutos. URLs, códigos, cookies e credenciais não são registrados.
- No mesmo serviço, a resposta de perfil da API passou a encerrar o probe sem aguardar uma requisição HTML secundária. O GET `/` continua como fallback quando os endpoints de perfil não identificam a conta.
- `src/MoodleIFRN/tests/suap-govbr-routing.test.cjs`: testes de detecção segura de domínio, erro rápido e caminho de perfil sem GET HTML redundante.

O fluxo SUAP tradicional não foi reescrito. A validação de proprietário/identidade e o cache de perfil fresco de uso único continuam ativos.

## Testes e build

- Testes focados: 18/18 aprovados, cobrindo login tradicional existente, Painel/cursos, telemetria, retorno após curso, detecção de Gov.br e fast path do perfil.
- Suíte CJS + ESM: 253 casos, 248 aprovados e 5 falhos. Um é a regressão P0.4 conhecida. Quatro testes ESM (`painel-course-mapping`, `painel-favourites-isolation`, `painel-ios-layout`, `profile-refresh`) falharam porque o esbuild não consegue ler caminhos relativos fora da raiz de sandbox. O teste P0.4 não foi alterado nem ignorado.
- Builder web Android `node src/MoodleIFRN/scripts/build-android-web.cjs`: aprovado após as alterações. `www/main.js` contém a mensagem de erro Gov.br e `www/index.html` contém uma única referência a `cordova.js`.
- `cordova prepare android`: concluído.
- Gradle `assembleDebug`: não concluído. Online, a JVM não conseguiu acessar os repositórios Maven; offline, a resolução parou em `androidx.core:core:1.6.+` por ausência de metadados de versão dinâmica. A APK prévia permaneceu inalterada, e não foi instalada.
- O emulador `emulator-5556` permaneceu com o pacote instalado `com.moodle.moodlemobile` versão `5.2.1`, `versionCode=52100`, `minSdk=24`, `targetSdk=36`; nenhum fluxo de login foi iniciado.

## Desempenho

O sucesso da API de perfil agora evita o GET HTML secundário no caminho comum. O teste sintético confirmou que, com resposta válida da API, nenhum GET `/` é iniciado. A telemetria atual continua registrando apenas etapas permitidas e durações numéricas.

Não há medição real depois da alteração: o login exige ação manual e a APK nova não pôde ser montada/instalada. Os dados anteriores reportados pelo projeto — cerca de 21,9 s até dados validados, 14,4 s de espera visível e 105 ms para a API de perfil — não são comparáveis a um resultado novo. Nenhum ganho percentual foi declarado.

## Pendências para release

1. Solicitar à equipe SUAP/IFRN a configuração e homologação de um callback móvel oficial para autenticação Gov.br, com retorno seguro à sessão do app. Não inventar nem alterar `redirect_uri` pelo cliente.
2. Depois da configuração institucional, validar manualmente Gov.br, seleção de vínculo, cancelamento e retorno no Pixel_4 / `emulator-5556` / Android 11 / WebView 139.
3. Resolver ou aceitar explicitamente o risco P0.4. O teste ainda demonstra que uma operação nativa Moodle tardia consegue ativar/navegar com o site A.
4. Corrigir/autorizar o ambiente de build (acesso aos repositórios e metadados Gradle), gerar APK candidata, comparar hash e executar os testes funcionais completos.

**Conclusão:** foi corrigida a falha de loading infinito e reduzida uma requisição redundante no caminho de perfil bem-sucedido. O login Gov.br completo ainda está bloqueado por ausência de callback móvel institucional; a versão não está pronta para promoção à release.
