# Correção do nome exibido no Painel AVA Mobile

Data: 25/10/2026.

## Problema e causa confirmada

O menu do Android exibia **“Matheu Soare”**, enquanto o nome correto era
**“Matheus Soares”**. Os snapshots persistidos `ifrn_painel_profile` e
`ifrn_suap_oauth_profile_v1` continham o nome antigo. A origem registrada nesses
dados era `GET /api/v2/usuario/info/`.

Na investigação com o aparelho conectado, a API do ambiente usado pelo app já
retornava o nome correto para a mesma identidade. O cache local permanecia antigo
mesmo após atualizar o APK. Além disso, `PainelAvaService.saveProfile()` priorizava
o snapshot OAuth existente sobre o perfil novo recebido do Painel.

Portanto, a causa confirmada da exibição incorreta nesta execução foi a persistência
e reutilização do perfil desatualizado. Não foi possível determinar quando ou por
que o servidor havia fornecido o valor antigo originalmente.

## Comparação dos ambientes

As consultas no Android usaram os cookies existentes do navegador interno, sem
copiar tokens ou cookies para o relatório. As duas rotas responderam HTTP 200,
sem redirecionamento:

| Campo | `https://ava.ifrn.edu.br/api/v2/usuario/info/` | `https://painel.ead.ifrn.edu.br/api/v2/usuario/info/` |
| --- | --- | --- |
| `nome_usual` | `Matheus Soares` | `testuser` |
| `nome_social` | `Matheus Soares` | `testuser` |
| `nome_registro` | `Matheus Luiz Soares` | `testuser` |
| Corresponde à identidade salva no app | Sim | Não |
| Usuário real com `id > 0` | Sim | Não: `id = 0` |

Nenhum desses retornos continha `nome_exibicao` ou `show_name`.

Também foram feitas consultas GET sem autenticação pelo computador: ambos os
domínios retornaram HTTP 200 com o perfil sintético `testuser`. HTTP 200, sozinho,
não comprova uma sessão autenticada. A resposta do segundo domínio não permite
afirmar qual nome ele retornaria para uma sessão válida do mesmo aluno.

Os domínios não foram tratados como aliases nem tiveram seus perfis combinados.

## Investigação do backend

Foi consultado o repositório `suap-ava-suite/djangoapp-painel_ava`, revisão
`42b90e8c88faad506ac952537060ca9ab764dc92`, em uma cópia temporária.
Essa revisão consultada não comprova a versão implantada em cada domínio.

- `src/painel/v2/api.py`: `_get_current_username()` tenta verificar Bearer e depois
  a sessão Django/usuário ativo. Na ausência de usuário, retorna `testuser`.
- `src/painel/v2/services.py`: `UsuarioService.info()` lê o usuário Django e seu
  `suap_profile`; usa campos do perfil e, como fallback, `first_name`/`last_name`.
  Se o usuário não existe, produz o perfil sintético com `id = 0`.
- Os templates web consultados exibem `logged_user.suap_profile.show_name`.
  A API v2 consultada não expõe essa propriedade como campo próprio.

Como a API de `ava.ifrn.edu.br` já entregava os nomes corretos para a conta,
esta correção não exigiu alterar o backend, sincronizar o cadastro ou consultar
`moodle-auth_suap`/`djangoapp-integrador_ava`.

## Alterações no app

- `mobilemoodle/core_mobile/api-painel.ts` e `api-suap.ts`: priorizam
  `nome_exibicao` e `show_name` quando fornecidos, mantendo os campos de nome como
  fallback. Nenhum nome de pessoa foi fixado no código do aplicativo.
- `mobilemoodle/core_mobile/profile-refresh.ts`: valida a URL da resposta, o
  ambiente, `id > 0` e a identidade estável antes de atualizar os nomes.
  Identidades conflitantes, outro domínio e snapshots expirados são recusados.
- O perfil atualizado substitui os campos de nome nos dois snapshots, tanto em
  `sessionStorage` quanto em `localStorage`. Um nome oficial antigo ausente na nova
  resposta deixa de sombrear os nomes atuais.
- Foto e outros campos do perfil são preservados. Dashboard e listas não são
  regravados pela atualização de nome. O prazo original do snapshot não é renovado.
- Snapshots legados sem origem só são migrados mediante autorização explícita do
  chamador para o domínio configurado, sempre após conferir a mesma identidade.
  Snapshots que já registram outro domínio são recusados.
- `services_mobile/painel-ava.service.ts`: consulta apenas o perfil usando os
  cookies existentes em um navegador interno oculto. Falhas, redirecionamento,
  ausência de sessão e timeout mantêm o perfil anterior, sem abrir login visível.
  A gravação após nova captura também deixa de ignorar um perfil de API válido em
  favor do snapshot antigo.
- `painel/painel.ts`: inicia a revalidação ao criar a tela e recarrega o painel
  após atualizar o perfil. Cancela a consulta ao destruir a tela ou iniciar a
  abertura de um curso, liberando o navegador interno para esse fluxo.
- `mobilemoodle/mobilemoodle.js` foi regenerado.

O fluxo de autenticação nativa e abertura de cursos foi preservado; a atualização
de perfil não consulta nem modifica as listas de cursos.

## Validação

- **42 testes passaram**, abrangendo prioridade/fallback do nome, atualização
  dos snapshots, preservação de foto/listas/prazo, isolamento por identidade e
  domínio, expiração e regressões de cursos/favoritos.
- `node src/MoodleIFRN/docs/test-suap-entry-profile.cjs`: passou.
- `tsc -p tsconfig.app.json --noEmit`: passou. A execução genérica de `tsc`
  encontrou erros em cópias geradas/plugins fora do escopo; ela não foi considerada
  uma verificação aprovada.
- Build do painel mobile e build web Android/Cordova: concluídos.
- `cordova prepare android`: concluído.
- Gradle `assembleDebug`: concluído. O modo offline não tinha o índice de
  `androidx.core:core:1.6.+`; a execução com acesso aos repositórios concluiu.
- `adb install -r`: sucesso, sem desinstalar e sem limpar os dados do aplicativo.

Após abrir o app atualizado, a inspeção confirmou:

- ambos os perfis salvos passaram a conter `Matheus Soares`;
- origem registrada: `https://ava.ifrn.edu.br`;
- o texto correto estava presente no painel renderizado;
- o prazo de expiração permaneceu idêntico;
- os hashes SHA-256 do dashboard e dos campos de foto permaneceram idênticos aos
  coletados antes da instalação;
- o usuário confirmou visualmente que a correção funcionou.

A abertura de um curso no aparelho não foi repetida nesta rodada; sua regressão
foi coberta pelos testes automatizados.

## APK e publicação

APK: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`.

SHA-256: `A1FAA3958A07A29AC0DBFEA799A5BFE1A412067B0B0EAD998CBCB333468301DC`.

Para o caso confirmado em `ava.ifrn.edu.br`, basta distribuir uma versão do app
com esta correção; não é necessária publicação/configuração institucional no
backend para atualizar o nome. A correção já foi instalada no aparelho de teste.

O fallback anônimo `testuser` da API é um comportamento separado do backend,
documentado acima e rejeitado pelo atualizador do app. Nenhuma alteração foi
publicada nos servidores institucionais.
