# Abertura de cursos — investigação de 19/10/2026

## Evidência reproduzida

O clique real no painel chega a `/login/moodle-open-course` com o ID Moodle e a origem corretos. Foi reproduzido com Acadêmico 4022/4024 e Presencial 2836. Os logs do aparelho mostram `hasSession=false`, `isLoggedIn=false` e nenhum site salvo para a URL solicitada. Perfil e dashboard do Painel permanecem disponíveis.

Sequência observada: `card-click → session-and-identity (ok) → need-oauth → oauth-public-config (ok) → oauth-provider (ok) → openBrowserForOAuthLogin (true)`. Não houve callback SSO nem `CoreEvents.LOGIN`, portanto a execução não chegou a `CoreCourseHelper.getAndOpenCourse`. Não é evidência de erro de matrícula no webservice: esse webservice ainda não foi chamado.

No Chrome, a barra permanece em `/admin/tool/mobile/launch.php`, com indicador de progresso e sem árvore de conteúdo web/formulário. O Android registra repetidamente `chrome ... sandboxed_process ... failed to attach` e encerra renderizadores por `start timeout`. Reiniciar apenas o processo do Chrome, sem apagar cookies/dados, não resolveu. O usuário confirmou a tela preta e voltou ao Painel. A causa dos timeouts internos do Chrome ainda exige investigação/validação após reiniciar o aparelho; não foi atribuída a uma configuração Moodle sem evidência.

Uma consulta HTTP anônima, fora do Android, à URL de lançamento visível no Chrome chegou a:

1. Acadêmico `/admin/tool/mobile/launch.php`: 302.
2. Acadêmico `/auth/oauth2/login.php`: 303.
3. SUAP `/o/authorize/`: 302.
4. SUAP `/accounts/login/`: 200, formulário de senha.

Essa consulta não copiou cookies do aparelho e não prova a saúde da conexão Android, nem acesso autenticado aos cursos. Consultas de diagnóstico não imprimem queries, cookies ou corpos de autenticação. O logcat bruto não foi salvo; uma coleta inicial ampla foi substituída por filtros que imprimem somente etapas/contagens.

## Contratos, documentação e produção

- [Documentação geral](https://suap-ava-suite.github.io/visao_geral.html): separa o plugin de autenticação Moodle `auth_suap` do plugin de leitura de cursos `tool_painelava`.
- [Documentação do Painel](https://suap-ava-suite.github.io/djangoapp-painel_ava/index.html): descreve a nova API v2. Isso não comprova publicação.
- [Backend v1](https://github.com/suap-ava-suite/djangoapp-painel_ava/blob/main/src/painel/v1/services.py): `get_diarios` seleciona `Ambiente.id` com filtro numérico; agrega os cursos dos ambientes e acrescenta `ambiente.id/titulo`. Não usar IDs de diário SUAP como IDs Moodle.
- Produção: `https://ava.ifrn.edu.br/api/v1/diarios/` redireciona ao host `painel.ead.ifrn.edu.br`; sem autenticação, retorna JSON HTTP 428. As consultas com `ambiente=2` e `ambiente=3` retornaram o mesmo contrato de autenticação. O teste público não valida o conteúdo filtrado autenticado.
- `/api/v2/usuario/info/` e `/api/v2/sala/tipo/diario/`: HTML HTTP 404 na produção consultada. Não foram adotadas como solução.
- Configuração pública Moodle (POST `tool_mobile_get_public_config`): Acadêmico e Presencial anunciam SUAP `id=1`, `enablemobilewebservice=1`; Aberto anuncia `SUAP do IFRN`, `id=4`, além de Google e Microsoft. O identificador OAuth não é o ID do ambiente no Painel.
- O repositório adicional de autenticação retornou HTTP 404 na consulta pública à API GitHub. Isso não permite concluir se é privado, removido ou qual framework utiliza.

## Ambientes e cursos da cópia autenticada do Painel

| Ambiente Painel | Domínio | Cursos matriculados retornados | Resultado no Android |
| --- | --- | --- | --- |
| 2 — Acadêmico (desde 2023) | `academico.ava.ifrn.edu.br` | 4022, 4024, 4025; vitrine também marca 4026 e 4027 matriculados | 4022/4024 chegam ao OAuth; retorno ausente. Demais aberturas pendentes. |
| 3 — Presencial | `presencial.ava.ifrn.edu.br` | 2836; coordenação 1753 | 2836 chega ao OAuth; retorno ausente. 1753 pendente. |
| 9 — Moodle Teste | `moodle.ead.ifrn.edu.br` | Nenhum: vitrine 2 e 4 com `is_enrolled=false` | Não houve tentativa de inscrição nem promessa de acesso. |
| AVA Aberto — ID Painel não retornado | `aberto.ava.ifrn.edu.br` (configuração pública confirmada) | Nenhum curso desse ambiente retornado para a conta | Sem validação autenticada. |

O ambiente 4 retornado pelo Painel se chama **Projetos**; não foi presumido como AVA Aberto. A cópia agregada possui quatro diários, uma coordenação, oito entradas de vitrine e listas vazias de práticas/reutilizáveis. Os links informados pelo usuário para 4024 e 2836 coincidem com `id` e `viewurl` retornados. A paginação está implementada em `painel-courses.ts`, com deduplicação por ambiente+curso e erro explícito em falha intermediária; seus testes passaram. A coleta autenticada completa anterior foi reaproveitada, não houve uma nova consulta autenticada ao servidor neste diagnóstico.

## Correções no aplicativo

- `moodle-open-course/moodle-open-course.ts`: espera pelo navegador limitada a três minutos, com mensagem e nova tentativa. Remove o timer ao sair, cancelar, destruir ou reentrar na página. Não reaplica estado de espera se a navegação do callback já saiu da ponte.
- `services_mobile/moodle-site.service.ts`: libera as flags de uma tentativa de navegador sem retorno, preservando o curso pendente e as sessões. Seleciona o provedor SUAP anunciado pelo Moodle.
- `services_mobile/suap-provider.ts`: seleção explícita de `suap`/`SUAP do IFRN`; não usa arbitrariamente o primeiro provedor nem supõe OAuth id=1.
- `tests/course-oauth-recovery.test.cjs`: testa timeout, nova tentativa, limpeza do timer, retomada oficial e preservação de curso, identidade e credenciais.

`CoreLoginHelper.openBrowserForOAuthLogin`, validações de identidade, foto/perfil e separação de sites por URL+conta foram preservados. Não houve alteração em `src/core` ou `src/addons`. Fontes de `mobilemoodle` não foram alteradas nesta intervenção; alterações locais anteriores foram mantidas.

Scripts `docs/course-*.cjs`, `docs/course-device-*.js` e `docs/trace-course-device.cjs` reproduzem as consultas e a inspeção sanitizada. São ferramentas locais de diagnóstico, não integram o bundle do app.

## Validação e limites

- Cinco testes novos de OAuth/recuperação aprovados; os três testes de mapeamento e cinco de consulta/paginação também aprovados.
- Scripts de regressão de entrada Marketplace, perfil/foto SUAP, ambientes e visibilidade do navegador aprovados.
- `tsc --noEmit -p tsconfig.app.json`: aprovado.
- O primeiro APK gerado nesta intervenção usou incorretamente o alvo web Angular development. Embora compilasse, ficou sem o bootstrap Cordova e sem `assets/lang/pt-br.json`; instalado no aparelho, parou em `/`, com Angular ainda não inicializado e 404 no idioma. Essa regressão foi identificada e comunicada ao usuário. Não é a causa do defeito original de cursos.
- `scripts/build-android-web.cjs` foi criado para usar o alvo `app:ionic-cordova-build --platform=android`, verificar Cordova no index e publicar o JSON de idioma derivado da tabela já existente em `ifrn-language.ts`. A saída é gerada em `www`, sem alterar fontes de core/addons. O script interrompe o processo se faltar o bootstrap; preparar o Cordova e empacotar o APK são etapas seguintes.
- O primeiro `cordova prepare android` e Gradle `assembleDebug` concluíram, mas isso não validou a inicialização do payload web. Na segunda compilação, o alvo Ionic/Cordova concluiu; o APK foi inspecionado como ZIP e contém Cordova no index, o arquivo Cordova e o idioma. Instalação com `adb install -r` aprovada pelo Android. SHA256 do APK corrigido: `1D32310FDA86F00C03C530E4361041EB2C1EC401027FFD69DAB08AD60CB32792`.
- Após instalar a compilação corrigida, a inspeção no Android confirmou `cordova.platformId=android`, Angular inicializado e rota `/login/marketplace-ifrn`. Perfil/dashboard estão presentes tanto em sessão quanto no armazenamento persistido. A regressão de inicialização foi recuperada no aparelho. Ainda há uma tentativa de fallback ao idioma `pt.json` com 404; não bloqueou essa inicialização.
- Primeira abertura com conteúdo, reabertura, atividade/retorno, expiração e rede offline **não validados no aparelho**, pois não foi criada a sessão Moodle durante a reprodução. Não apresentar os testes unitários como substitutos dessa validação.

## Backend/FastAPI

Os dois repositórios indicados novamente pelo usuário foram conferidos. No Integrador, [rotas reais](https://github.com/suap-ava-suite/djangoapp-integrador_ava/blob/main/src/integrador/urls.py) publicam `POST /api/enviar_diarios/` e `GET /api/baixar_notas/`; o [contrato do broker](https://github.com/suap-ava-suite/djangoapp-integrador_ava/blob/main/docs/suap2local_suap/index.md) exige `Authentication: Token <SUAP_INTEGRADOR_KEY>`. A primeira operação altera matrículas/papéis/coortes, enquanto a segunda consulta notas. Nenhuma foi executada. A resposta de sincronização contém `url`, `url_sala_coordenacao` e `ambiente`, e não um token de usuário Moodle Mobile. As rotas de login em `src/urls.py` autenticam o Integrador Django. O `api.py` do broker contém outra declaração de API em desenvolvimento; ela não foi presumida como rota publicada: o `urls.py` desse broker está vazio.

Isso confirma a diferença entre ID do diário SUAP recebido pelo Integrador e ID Moodle presente na URL de curso retornada. Chaves de sincronização institucionais não devem ser usadas pelo aplicativo. O host de produção do Integrador e suas permissões não foram inferidos a partir do repositório; nenhum endpoint administrativo institucional foi sondado.

Não foi demonstrada necessidade de backend adicional. Ele não corrige o renderizador do Chrome nem transforma uma sessão Painel/SUAP em token Moodle. Não foram criados endpoints, tokens ou Client Secrets, nem dependência de túnel. Não há falha institucional comprovada nesta reprodução; permanecem pendentes o retorno OAuth no Android e a validação de cada curso após esse retorno.

Na compilação corrigida, o Painel voltou a abrir no aparelho e o clique real em 4024 foi repetido. Novamente houve `need-oauth` e abertura oficial do browser, sem callback. O Android continuou registrando timeout dos renderizadores do Chrome. A lista de navegadores HTTPS disponíveis contém somente Chrome; o uptime consultado ainda era superior a quatro dias, portanto um reinício completo do Android não foi confirmado. O usuário voltou ao Painel e os caches de perfil/dashboard foram preservados. A verificação real do timeout de três minutos foi interrompida pela saída da ponte; seu comportamento está coberto pelos testes, sem declaração de aprovação no aparelho.
