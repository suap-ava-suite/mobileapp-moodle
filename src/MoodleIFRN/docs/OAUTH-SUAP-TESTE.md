# Login SUAP — integração experimental

Foi acrescentado **Entrar pelo SUAP (teste)** à tela de login. O formulário atual
continua disponível. A opção nova abre a página oficial do SUAP e recebe o perfil
completo pelo backend local. Depois, o Painel AVA realiza a própria autenticação
usando os cookies SUAP recém-criados e carrega sua lista de cursos habitual.

O teste web já confirmou a identificação da conta do aluno e a presença dos
campos esperados. Isso não comprova ainda o funcionamento desta integração no APK.

## Instalar no Windows / Git Bash

1. Faça uma cópia da pasta atual `src/MoodleIFRN` para poder voltar à versão anterior.
2. Copie a pasta `MoodleIFRN` deste ZIP para `src/MoodleIFRN` no projeto, substituindo
   os arquivos existentes. Não copie a pasta do backend para dentro do aplicativo.
3. No pacote **SUAP-OAuth-local**, substitua `server.py`, `test_server.py`,
   `test_mobile.py` e `LEIA-ME.md` na pasta local `suap-oauth-teste`.
   **Mantenha seu `config.local.json` atual. Não copie o exemplo por cima dele.**
4. Pare somente o Python com Ctrl+C e reinicie:

   ```bash
   cd ~/Downloads/SUAP-OAuth-local/suap-oauth-teste
   py server.py
   ```

   Mantenha o terminal do Cloudflare aberto. Se ele ainda estiver rodando, não
   abra outro túnel. Se precisar iniciá-lo de novo, use em outro terminal:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8002
   ```

5. Confira o endereço em **três lugares**:

   | Local | Valor |
   | --- | --- |
   | `services_mobile/suap-oauth.config.ts` → `brokerBaseUrl` | Origem HTTPS do túnel |
   | Backend: `config.local.json` → `public_base_url` | A mesma origem HTTPS |
   | Cadastro SUAP → Redirect URIs | Essa origem + `/oauth/callback` |

   O app está preparado com a URL do seu último teste:
   `https://opponents-barnes-insert-taylor.trycloudflare.com`.
   Se o túnel mudar, atualize os três lugares, reinicie o Python e recompile o app.
   Client ID, Client Secret e escopos continuam somente no `config.local.json`.

6. Na **raiz do projeto mobileapp-moodle**, execute:

   ```bash
   node src/MoodleIFRN/patch-moodle-ifrn.js
   npm run build:mobilemoodle
   npx ionic cordova build android --debug
   ```

   O `mobilemoodle.js` deste pacote já foi recompilado. Os comandos acima recompilam
   o conjunto no seu projeto. Este ZIP contém a pasta customizada, não o projeto
   completo nem um APK pronto.

## Primeiro teste no celular

1. Abra a tela de login. Se uma sessão antiga levar direto ao painel, use **Sair**.
2. No campo IFRN-id, informe a matrícula do aluno se quiser exigir a comparação
   exata. Preserve zeros iniciais. Não precisa preencher a senha do formulário.
3. Toque em **Entrar pelo SUAP (teste)** e autentique na página oficial.
4. Confira nome, foto e matrícula; compare as listas de diários, coordenações e
   autoinscrições com as do login atual, incluindo os diferentes ambientes.
5. Abra um curso acadêmico e um presencial. Verifique também um curso com autoinscrição.
6. Teste cancelar a autenticação, entrar com uma matrícula diferente da informada
   e parar o backend antes de iniciar uma tentativa. O app deve mostrar erro e
   manter o acesso antigo disponível.

O app não escreve nem exclui dados acadêmicos. O perfil vem de `/api/rh/eu/`,
sem reduzir os campos recebidos. As consultas do Painel e a abertura dos cursos
continuam usando os serviços existentes. Os testes locais não substituem a
comparação real com a conta do aluno.

## Limites desta versão

- É uma opção experimental, não a migração definitiva do login.
- Cada **nova tentativa** limpa os cookies do navegador interno para evitar
  misturar contas antigas. Depois do login SUAP, o Painel reaproveita esse mesmo
  armazenamento de cookies. Essa continuidade precisa ser confirmada no aparelho.
- O retorno carrega uma cópia do perfil válida por **30 minutos**, apenas no
  `sessionStorage` da WebView. Não é um access token do SUAP. Não há renovação
  automática nem persistência garantida após encerrar o app. Ao expirar, entre de novo.
- A sessão do SUAP, do Painel e de cada Moodle tem duração própria. Este código
  não aumenta essas durações. O navegador do sistema usado pelos cursos pode
  pedir autenticação adicional: a unificação com ele ainda não foi implementada.
- O login por senha e sua biometria continuam existentes. Ao concluir OAuth,
  desativa-se a biometria vinculada ao refresh token anterior para não retomar
  uma conta errada. Ela pode ser ativada novamente pelo login atual.
- O backend precisa estar rodando para uma nova autenticação. Não guarda tokens
  SUAP, não renova tokens e não oferece uma API genérica de consulta ao SUAP.
  Os endpoints SUAP extras do fallback antigo, fora do perfil, não estão
  disponíveis pelo novo fluxo. O painel e os cursos Moodle mantêm suas fontes próprias.
- Android precisa de teste no APK. iOS ainda não foi compilado nem validado.

## Como funciona o retorno

1. O app gera um segredo aleatório por tentativa e envia apenas seu resumo SHA-256
   ao backend, junto de um estado aleatório do app.
2. O backend inicia Authorization Code com um estado próprio e cookie de vínculo.
3. No callback HTTPS, valida estado/cookie, troca o código e consulta o perfil SUAP.
4. Emite um ticket de uso único, válido por 60 segundos, ligado ao segredo do app.
5. O app intercepta somente `/mobile/complete` da origem configurada, confere o
   estado e troca o ticket por JSON, enviando o segredo no corpo da requisição.
6. Após carregar o Painel, grava o perfil na sessão local e abre a interface mobile.

O segredo de prova protege **a entrega backend → app**. Não significa que PKCE
foi habilitado no SUAP: o trecho backend → SUAP continua como cliente Confidential.
Client Secret e tokens SUAP não são enviados ao app nem colocados na URL.
Falhas restauram os dados locais anteriores; cookies que foram limpos no navegador
não podem ser restaurados, e podem exigir novo login web.

## Arquivos alterados/adicionados

- `ifrn-login/ifrn-login.ts` e `.html`: botão, retorno, comparação e rollback.
- `services_mobile/suap-oauth.config.ts` e `suap-oauth.service.ts`: configuração e ponte.
- `services_mobile/auth.service.ts`: separação entre perfil OAuth e JWT antigo.
- `services_mobile/painel-ava.service.ts`: preservar o perfil OAuth completo.
- `mobilemoodle/core_mobile/oauth-profile.ts`: cópia temporária e identidade.
- `mobilemoodle/core_mobile/api-auth.ts`, `api-painel.ts` e `app-router.ts`: consumo
  do perfil, logout e expiração.
- `mobilemoodle/mobilemoodle.js`: recompilado a partir dos fontes.
- `docs/OAUTH-SUAP-TESTE.md` e `docs/test-oauth.cjs`: instruções e testes isolados.

Não foram alterados `navigation`, `moodle-site.service.ts`, as rotas OAuth nativas
do Moodle nem o script de rotas.

## Verificações realizadas

- 31 testes Python: fluxo web anterior, estado/cookie, expiração, ticket de uso único,
  prova incorreta, CORS e entrega do perfil sem tokens.
- Testes isolados JavaScript: preservação do perfil completo/listas, rollback em
  cancelamento/erro de painel/conta diferente, zeros na matrícula, expiração,
  compatibilidade do JWT antigo e eventos simulados do navegador interno.
- TypeScript do painel (`mobilemoodle/tsconfig.json`) validado e bundle recompilado.
- Não houve build Angular/Cordova completo: o ZIP enviado contém somente a
  customização `MoodleIFRN`. Não houve autenticação real adicional nem teste em aparelho.

Para repetir os testes isolados na raiz do projeto, com suas dependências instaladas:

```bash
node src/MoodleIFRN/docs/test-oauth.cjs
npx tsc --project src/MoodleIFRN/mobilemoodle/tsconfig.json
```

Para desativar apenas a opção experimental, altere `enabled: false` em
`services_mobile/suap-oauth.config.ts` e recompile. Saia da sessão de teste antes
de voltar ao login atual. Para desfazer todos os ajustes, restaure sua cópia da
pasta `src/MoodleIFRN` e recompile.
