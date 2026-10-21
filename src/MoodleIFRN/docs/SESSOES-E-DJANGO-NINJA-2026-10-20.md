# Sessões e integração dos cursos — 20/10/2026

## Caminho atual

`marketplace-ifrn` usa `services_mobile/suap-entry.service.ts` para a entrada oficial. O caminho atualmente chamado é `loginWithSuap()`, que autentica o Painel e salva perfil/dashboard; não cria por si só uma sessão nativa Moodle. Há também o método `login()` de entrada nativa configurado para o Acadêmico, com configuração pública, provedor SUAP e callback do núcleo. Nesse caminho alternativo, `complete()` verifica a conta Moodle, consulta o perfil e compara a identidade do Painel antes de persistir perfil/dashboard. A existência desse método não significa que seja usado na entrada atual nem que estabeleça sessões de todos os ambientes.

`mobilemoodle/core_mobile/app-views.ts` resolve o ambiente com `course-target.ts` e envia o ID Moodle ao bridge de `painel/painel.ts`. O bridge agora chama `MoodleSiteService.ensureSessionAndOpenCourse()` diretamente: com sessão válida, abre o curso sem navegar pela ponte de login. Quando não há sessão, segue para `moodle-open-course`, que também verifica a sessão antes de iniciar OAuth. Em falhas de recuperação, o bridge abre essa tela apenas em modo de erro (`identityOnly`), sem disparar autenticação automática.

O serviço verifica ambiente e identidade, tenta carregar conta salva com `CoreSites.loadSite()` e abre pelo `CoreCourseHelper.getAndOpenCourse`, após conferir os cursos da conta. Somente o resultado `need-connect` inicia automaticamente `startSuapOAuthLogin()` na página. Essa chamada usa `CoreLoginHelper.openBrowserForOAuthLogin`: o navegador é necessário para obter a sessão Moodle quando não há conta nativa utilizável. Retorno, curso pendente, cancelamento e observadores ficam no serviço e em `navigation/`.

Perfil/dashboard em sessionStorage/localStorage são dados em cache. Cookies do Painel/SUAP autenticam a consulta web. Token e conta de cada Moodle são gerenciados pelo CoreSites e persistidos pelo núcleo; não são o token do Painel. Reutilizar cookies pode evitar digitar senha, mas ainda abre o navegador.

O relatório de 19/10 registra ausência de sites nativos no aparelho naquela reprodução. Na primeira etapa desta intervenção não havia sido realizada nova leitura; não se conclui perda de sessão atual a partir daquele registro.

Atualização da leitura nesta continuação: o Android conectado iniciou na tela Marketplace com perfil/dashboard persistidos. A consulta SQLite encontrou uma entrada do Acadêmico, não marcada como logged-out e com username correspondente ao Painel. O campo de token no SQLite está vazio, mas o núcleo guarda tokens em armazenamento seguro separado; isso NÃO comprova ausência de token. A consulta adicional ao plugin seguro não concluiu via CDP, portanto a validade da sessão não foi confirmada e nenhum token foi exportado. Não houve limpeza de dados, reinstalação nem logout.

## Correções

Na seleção de contas salvas, o ID canônico servia como retorno antecipado. Agora todas as entradas elegíveis passam por verificação de URL, username e estado: uma entrada desconectada não esconde outra sessão válida histórica. O ID calculado sozinho não autoriza abrir a conta. Falhas de leitura e de recuperação propagam erro, sem serem convertidas em necessidade de abrir o navegador. Sessões e credenciais não são apagadas.

Também foi substituído o uso de `getSiteIdsFromUrl()` nessa seleção: esse método do núcleo lê tokens de todos os sites e retorna lista vazia em qualquer erro. A customização agora usa `getSites()` para filtrar metadados pelo ambiente e só então lê a conta relevante. Uma falha do armazenamento seguro de outro ambiente deixa de ocultar uma sessão existente. A consulta adicional usada apenas para preencher contagens de log foi removida.

O clique direto no bridge valida ambiente e ID inteiro positivo e bloqueia mensagens/cliques duplicados enquanto a abertura está em andamento. Os cinco testes de `painel-native-course.test.cjs` verificam abertura direta, ambientes distintos com mesmo ID, recuperação sem OAuth em erro, fallback oficial quando não há sessão e rejeição de ambiente não confirmado. Os testes de sessão incluem restauração após reinício e isolamento de falha em outro ambiente.

A abertura nativa existente continua exigindo identidade e ambiente correspondentes. Os IDs de curso são interpretados dentro do site selecionado. Erros ao buscar matrículas já propagavam erro; curso não matriculado já tinha recuperação própria, sem classificação como expiração. Não foram encontradas razões para mudar perfil, foto ou listas.

## Backend Django Ninja

Código consultado: Painel `10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8`; auth_suap `b9e54072729388f594d3d55690bda761ac4cb93e`.

- [v1/api.py](https://github.com/suap-ava-suite/djangoapp-painel_ava/blob/10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8/src/painel/v1/api.py): `NinjaAPI`, `/diarios/`, `/progresso/`, `/authenticate/`. Autenticação v1 devolve `data` e token do Painel, não par access/refresh Moodle.
- [middleware.py](https://github.com/suap-ava-suite/djangoapp-painel_ava/blob/10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8/src/painel/middleware.py): sessão Django ou token validado pelo Painel; também distingue tokens de ambiente. Isso não concede sessão Moodle ao aluno.
- [v1/services.py](https://github.com/suap-ava-suite/djangoapp-painel_ava/blob/10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8/src/painel/v1/services.py): consulta ambientes com credencial de serviço `Authentication: Token`, agrega cursos e acrescenta `ambiente.id/titulo`. Curso usa `id` e `viewurl`; identificador acadêmico SUAP é separado. Progresso inclui ambiente para evitar colisões.
- [v2/api.py](https://github.com/suap-ava-suite/djangoapp-painel_ava/blob/10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8/src/painel/v2/api.py): outra `NinjaAPI`, token SUAP ou usuário Django; há fallback literal `testuser` na resolução de usuário. Não adotar essa versão como identidade confiável sem revisão no servidor. `src/urls.py` registra v1/v2, sem comprovar publicação institucional.

O app já integra a API v1 em `painel-ava.service.ts` e `painel-courses.ts`, via fetch na origem autenticada do InAppBrowser. Preserva diários, coordenações, práticas, autoinscrições e reutilizáveis, paginação e progresso por ambiente+curso. Nesta intervenção, o cliente passou a recusar destinos fora de `/api/v1/diarios/` na mesma origem e a identificar HTTP 401/403/428 e redirecionamentos, sem confundi-los com lista vazia. A documentação da configuração foi corrigida para o contrato v1 real.

Não foi encontrada emissão de token Moodle Mobile nas rotas Python examinadas. A disponibilidade autenticada em produção não foi novamente testada. A integração mantém v1; não troca para v2 apenas porque existe no repositório.

## Primeiro acesso e expiração

[auth.php](https://github.com/suap-ava-suite/moodle-auth_suap/blob/b9e54072729388f594d3d55690bda761ac4cb93e/auth.php) estende `auth_oauth2`, troca código OAuth por token SUAP no servidor, sincroniza usuário/foto/campos e chama `complete_user_login`. Salva o destino em `next_after_next` e o restaura após autenticação. Não foi encontrado endpoint PHP de troca de token Painel por token mobile, nem implementação própria de emissão de wstoken. Restaurar destino web não equivale a emitir token nativo.

O mecanismo oficial já usado pelo núcleo local é `/admin/tool/mobile/launch.php`: parâmetros de lançamento e passport são persistidos, callback SSO é validado, e `handleSSOLoginAuthentication` registra/atualiza a conta com `CoreSites.newSite`. A integração SUAP deve preservar esse destino para que o Moodle conclua o retorno ao esquema do aplicativo. A configuração pública do ambiente determina o provedor; não se presume qual plugin está instalado no servidor pelo conteúdo do repositório.

Para primeiro acesso a cada ambiente ou sessão explicitamente expirada, manter esse fluxo oficial e conferir no servidor: serviço mobile habilitado, provedor correto, retorno ao launch preservado e esquema do app permitido. Cookies SUAP podem reduzir a interação, sem garantir autenticação silenciosa.

Eliminar também essa passagem inicial exigiria uma integração nova no servidor, não comprovada nos repositórios: autenticar o usuário por um fluxo aprovado, vincular explicitamente conta e ambiente, emitir código de uso único com validade curta e validar sua troca no Moodle para o serviço mobile. Exigiria revisão de segurança, proteção contra repetição, confirmação de identidade e provisionamento em cada Moodle. Não é seguro nem funcional simplesmente encaminhar JWT do Painel ou credencial de integração. Essa proposta não foi implementada nem apresentada como mecanismo oficial existente.

O Integrador não foi consultado: não apareceu evidência de problema de sincronização acadêmica.

## Validação

Testes automatizados cobrem seleção de sessão histórica, conta/ambiente incorretos, falha de leitura, conta desconectada, callback e timeout OAuth; consulta Ninja, paginação, progresso e mapeamento de cursos. O teste de mapeamento exigiu execução fora do sandbox por bloqueio de leitura do diretório pai pelo esbuild.

Resultado da continuação: 25 testes de sessão/OAuth/consulta/clique aprovados; os 3 testes de mapeamento já tinham passado separadamente. TypeScript `tsc --noEmit -p tsconfig.app.json` aprovado e `git diff --check` sem erros. ESLint dos arquivos completos ainda aponta problemas em trechos não alterados; não foi feita reformatação geral nesta tarefa.

As alterações servidor-servidor descritas abaixo continuam sendo proposta: não foram implementadas ou publicadas nos repositórios do Painel/plugin. Foram solicitados ao usuário os checkouts locais e o ambiente de destino para prosseguir; o workspace disponível é o aplicativo. Nenhum endpoint inexistente foi ativado no app.

Validação de aparelho ainda necessária: abrir curso com sessão existente, reiniciar o app e reabrir, alternar ambientes com IDs iguais, testar outra conta, primeiro acesso, expiração e falha de rede. Não foram gerados APK nem alterados servidores nesta intervenção.
