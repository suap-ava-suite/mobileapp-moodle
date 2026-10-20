# Integração de teste — 20/10/2026

## Estado da entrega

Branch do app: `teste/integracao-fastapi-isolada-20261020`. Sem commit, push, deploy, reset ou exclusões.
O relatório `/home/matheusluiz/relatorio-fastapi-moodleifrn.md` foi lido antes das alterações.
Não foram encontrados AGENTS.md aplicáveis nos dois projetos. O estado inicial do app tinha `.aws`,
`scripts/build-ifrn-theme.js` e `suap-auth-service-Teste-Mobile/` não rastreados; foram preservados.
Não foi lido nem copiado `.env`. A cópia aninhada do backend contém outro `.git` e não foi modificada.

**Backend entregue como patch, ainda não aplicado ao diretório externo.** Para atender ao pedido posterior de
uma única branch, todas as mudanças entregáveis estão no app, inclusive `fastapi-demo.patch`.
O patch foi preparado e executado em `/tmp/ifrn-backend-stage`, a partir do backend informado;
`git apply --check` passou contra `/home/matheusluiz/suap-auth-service-Teste-Mobile`.
A branch vazia criada inicialmente no backend foi removida após o pedido de uma única branch;
o backend voltou a `main`, sem alterações locais ou commits.

## Diagnóstico e correções

| Evidência no estado atual | Causa / correção |
|---|---|
| `marketplace-ifrn.ts`, `enterAva()` → `SuapEntryService.loginWithSuap()` → `PainelAvaService.authenticateWithBrowser()` | Sessão do Painel não equivale a sessão Moodle nativa. O fluxo institucional foi preservado; a entrada mock é separada por configuração explícita. |
| `app-views.ts`, `wireCourseCardOpen()` → ponte `PainelPage.handleOpenCourse()` → `/login/moodle-open-course` → `ensureSessionAndOpenCourse()` | Curso real precisa de origem, courseid e identidade compatíveis. Destino mock agora abre `#/curso/{id}` e usa apenas JSON local. |
| `resolveMoodleSiteUrl()` retornava Presencial para localhost, vazio ou erro | Agora rejeita destino inválido, HTTP, credenciais em URL, portas não padrão e hosts fora do domínio AVA. A página encerra loading e mostra erro recuperável. |
| `course-target.ts` inferia destino pelo rótulo | Removida a inferência; exige URL explícita dos dados oficiais. Não se deduz autoinscrição pelo nome “Aberto”. |
| Detalhes/cache usavam apenas ID | Chave dos cards contém fonte, ambiente e curso. Detalhes oficiais ambíguos são rejeitados; cache de detalhes é descartado entre consultas. Dashboard verifica proprietário antes de retornar resposta assíncrona. Preferências oficiais já tinham isolamento por conta e ambiente. |
| Categoria práticas/reutilizáveis era recebida e omitida | Normalização e abas próprias adicionadas. |
| Fallback de ambiente de autoinscrição `2` em vários chamadores | Removido no card, ponte, utilitário, página e serviço. Ambiente ausente gera erro; não foram feitas inscrições. |
| Estado pendente não guardava proprietário | Agora guarda e verifica o proprietário; estado legado sem proprietário é descartado e exige novo toque. Seleção de curso/origem permanece no callback. |
| FastAPI tinha páginas abertas e serviços que fabricavam qualquer ID | Patch centraliza autorização por curso, deriva IDs estáveis e verifica atividade/seção/curso. Ausente ou inacessível: 404. |
| Dashboard aceitava JWT na query, inclusive refresh | Patch troca páginas antigas por JSON autenticado por Bearer; query não autentica. |
| JWT duplicado e refresh reutilizável | Patch centraliza validação, exige demo/configuração explícita e aplica rotação/revogação em memória. Reinício revoga sessões; apenas um worker. |

`backend.config.ts` permanece `provider: 'official'`. Para build de teste, alterar deliberadamente para
`mock`, gerar novamente o painel e compilar o app. Retornar a `official` antes de distribuir produção.
Base mock: `http://127.0.0.1:8000`. O cliente rejeita outras portas e hosts não locais.
Tokens, proprietário e refresh da simulação usam `ifrn.mock.v1.*`, sem tocar os tokens SUAP/Moodle.
O iframe recebe dados pela ponte existente; o token permanece no cliente do host Ionic.
Mock não grava perfil oficial, matrícula ou foto; campos ausentes permanecem ausentes.
Não houve alteração na lógica oficial de enriquecimento de nome/foto/verificação de conta.
Não há cache persistente de conteúdo mock. Refresh compartilha uma operação em andamento e tenta a requisição uma vez.
Requests têm timeout de 15s, rejeitam redirects e HTML 200, e omitem cookies.

## Endpoints e resultados reais

Resultados de **código preparado em /tmp**, não de servidor institucional nem do diretório externo ainda sem patch.
TestClient: 5 testes aprovados. Smoke HTTP real: servidor temporário em 127.0.0.1:8000, encerrado ao final.

| Método / rota | Existia? | Resultado observado |
|---|---|---|
| GET `/` | sim | HTTP real 200, porta 8000 |
| POST `/auth/login` | sim | demo válida 200; senha inválida 401 |
| POST `/auth/refresh` | sim | refresh válido 200 e rotação; replay e access como refresh 401 |
| POST `/auth/logout` | criada | 204; access/refresh da sessão revogados: 401 |
| GET `/usuario/me` | sim | HTTP real 200 JSON com access |
| GET `/courses/` | sim | HTTP real 200 JSON com access |
| GET `/dashboard/` | sim | HTTP real 200 JSON com access |
| GET `/dashboard/view` | sim, HTML substituído | HTTP real 200 JSON com access; query token isolada ou refresh no Bearer: 401 |
| GET `/course/{id}` | sim, HTML substituído | 1 autorizado: 200 JSON; 4 privado e 999 inexistente: 404; sem access: 401 |
| GET `/section/{id}` | sim, HTML substituído | 101 autorizado: 200 JSON; usuário B ou 199 inexistente: 404; sem access: 401 |
| GET `/activity/{id}` | sim, HTML substituído | 10101 autorizado: 200 JSON; usuário B ou 10199 inexistente: 404; sem access: 401 |
| GET `/api/v1/me` | criada | 200 JSON; token expirado, ausente ou refresh: 401 |
| GET `/api/v1/dashboard` | criada | 200 JSON; sem access/refresh como access: 401 |
| GET `/api/v1/courses/{id}` | criada | 1 autorizado: 200 JSON, IDs das seções presentes, atividade sem link localhost genérico |
| GET `/api/v1/courses/{id}/sections` | criada | 1 autorizado: 200 JSON |
| GET `/api/v1/courses/{id}/sections/{section_id}/activities/{activity_id}` | criada | relação 1/101/10101: 200; 2/101/10101 e 1/102/10101: 404 |
| OPTIONS `/auth/login` | middleware | origem https://localhost: 200; origem não permitida: 400 |

Schemas preferidos são os de `/api/v1/`, definidos em `app/api/demo.py`, também publicados em OpenAPI.
Aliases antigos são mantidos por compatibilidade, mas seus HTMLs não são mais servidos.
Templates antigos foram preservados; não são um segundo fluxo de autenticação.
Não existe implementação de SUAP OAuth ou `/webservice/rest/server.php` neste simulador.

## Como executar

Da raiz do app, Linux ou Windows **Git Bash** com Node conforme `package.json` (>=22.17 e <23), JDK e SDK Android:

```bash
npm run build:mobilemoodle
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p src/MoodleIFRN/mobilemoodle/tsconfig.json --noEmit
node --test src/MoodleIFRN/tests/*.test.mjs src/MoodleIFRN/tests/*.test.cjs
node src/MoodleIFRN/docs/test-course-environments.cjs
node src/MoodleIFRN/build-native.mjs --platform=android
npx cordova build android --debug -- --offline
```

`build:mobilemoodle` é o script real da raiz. `build-native.mjs` usa `app:ionic-cordova-build`,
não substitui Cordova por build web comum. `dev:android` usa live reload/SSL e `prod:android`
inclui o plugin nativo e instalação; não foi usado para evitar instalação no aparelho e distribuição de produção.
Git Bash suporta os scripts com variáveis de ambiente da raiz; PowerShell exige adaptar essas atribuições.
No Windows, definir `ANDROID_HOME` e `JAVA_HOME` para os caminhos instalados e disponibilizar `adb` no PATH.

Aplicação **manual e revisável** do backend, a partir da raiz do backend externo (não feita nesta entrega):

```bash
git apply --check /c/caminho/mobileapp-moodle/src/MoodleIFRN/docs/fastapi-demo.patch
git apply /c/caminho/mobileapp-moodle/src/MoodleIFRN/docs/fastapi-demo.patch
```

Linux usa `/home/matheusluiz/mobileapp-moodle/src/MoodleIFRN/docs/fastapi-demo.patch`.
O README contido no patch documenta venv, Windows/Linux, geração de chave temporária, variáveis explícitas,
testes e `run.py` na porta 8000. Não use `.env` antigo nem credenciais institucionais.
Para testar sem alterar o diretório externo, copie somente `app`, `tests`, `run.py` e `requirements.txt`
para um diretório temporário e aplique o patch ali (incluindo arquivos README/.env.example vazios originais).

## Validação local

- Testes backend: 5/5, incluindo usuários A/B, IDs inexistentes, vínculo do conteúdo, expiração, ausência,
  refresh indevido, rotação, replay, logout e CORS. Dependências usadas: venv existente do backend; nenhum segredo foi carregado.
- Smoke HTTP real: 12 rotas autenticadas retornaram 200 application/json, além de GET / na porta 8000.
- Testes Node: seis arquivos de testes aprovados; incluem mocks sem upstream, HTML 200 rejeitado,
  fonte/destino isolados, IDs iguais em ambientes diferentes, favoritos por conta, categorias e recuperação OAuth.
- Resolução de ambientes/idioma: script `docs/test-course-environments.cjs` aprovado.
- TypeScript app e painel: aprovados. O `tsc --noEmit` genérico da raiz inclui cópias geradas em `www/`,
  `platforms/` e plugins e apresentou erros preexistentes; os alvos apropriados acima passaram.
- Painel e build web Cordova Android: aprovados. Gradle debug: aprovado. O APK precisa ser recompilado após qualquer alteração posterior de configuração/provedor.

## Android e cursos reais

Aparelho conectado: Android 11, app `com.moodle.moodlemobile` instalado, Android System WebView 155.0.8059.43.
APK debug gerado em `platforms/android/app/build/outputs/apk/debug/app-debug.apk`.
Não foi instalado sobre o app existente. Não foi realizado login institucional nem acesso ao conteúdo da conta.
Um teste TCP com `adb reverse tcp:8000 tcp:8000` e toybox nc não obteve resposta no aparelho;
**conectividade Android não confirmada**. Encaminhamento temporário removido; servidor temporário encerrado.
Isso não prova falha CORS: não foi uma requisição WebView. A origem real da WebView permanece não observada.
CORS foi testado apenas no backend; configure a lista explícita após observar o Origin no dispositivo.
A configuração Android existente contém cleartext global permitido; esta entrega não a ampliou.
Antes de distribuir, revisar a política existente com compatibilidade dos AVAs e exceção local restrita ao teste.
Não há evidência para mudar a porta para 8002 ou liberar todas as origens.

| Ambiente | Cursos acessíveis da conta | Primeira autenticação / reutilização / expiração / cancelamento / callback / voltar |
|---|---|---|
| Acadêmico | inventário indisponível sem conta autenticada | não testado no servidor/aparelho |
| Presencial | inventário indisponível sem conta autenticada | não testado no servidor/aparelho |
| EAD | inventário indisponível sem conta autenticada | não testado no servidor/aparelho |
| Outros destinos retornados pelo painel | não inferidos nem inventados | não testado |

Não é possível afirmar que todos os cursos funcionam. É necessário obter o inventário da conta autorizada,
validar origem canônica/courseid e observar sessão e callback em cada ambiente, sem alterar atividades,
notas ou inscrições. Os testes locais de recuperação não substituem essa homologação.

## Produção e autenticação upstream

O protótipo continua incapaz de criar sessão Moodle. Um intermediário não é demonstradamente necessário
para corrigir o retorno do navegador. Se adotado, depende de mecanismo institucional aprovado, escopos,
credenciais no servidor e implantação autorizada. Não foi implementada troca de JWT por wstoken,
compartilhamento de cookies ou login único. Client Secret não foi adicionado ao app.
Os timeouts/cancelamento/retomada única já existentes no serviço nativo foram preservados;
a homologação do callback e do botão voltar continua pendente no aparelho com conta autorizada.

Referências consultadas: [Painel AVA](https://github.com/suap-ava-suite/djangoapp-painel_ava),
que descreve a agregação dos cursos e distingue o integrador SUAP–Moodle;
[Suite](https://suap-ava-suite.github.io/) e [protótipo](https://github.com/MatheusLuizSoares/suap-auth-service-Teste-Mobile)
não ficaram acessíveis pela ferramenta de consulta. Nenhum contrato upstream foi inventado a partir disso.

## Manifesto exato da entrega

Arquivos alterados no app:

- `src/MoodleIFRN/docs/test-course-environments.cjs`
- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.html`
- `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/api-painel.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/api.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/app-router.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/app.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/global.d.ts`
- `src/MoodleIFRN/mobilemoodle/mobilemoodle.js`
- `src/MoodleIFRN/mobilemoodle/pages/painel.html`
- `src/MoodleIFRN/mobilemoodle/tsconfig.json`
- `src/MoodleIFRN/moodle-open-course/moodle-open-course.ts`
- `src/MoodleIFRN/painel-enrol/painel-enrol.ts`
- `src/MoodleIFRN/painel/painel.ts`
- `src/MoodleIFRN/services_mobile/moodle-site.service.ts`
- `src/MoodleIFRN/services_mobile/painel-ava.service.ts`
- `src/MoodleIFRN/tests/painel-course-mapping.test.mjs`

Arquivos criados no app:

- `src/MoodleIFRN/docs/INTEGRACAO-FASTAPI-2026-10-20.md`
- `src/MoodleIFRN/docs/fastapi-demo.patch`
- `src/MoodleIFRN/mobilemoodle/core_mobile/mock-provider.ts`
- `src/MoodleIFRN/services_mobile/backend.config.ts`
- `src/MoodleIFRN/services_mobile/mock-api.ts`
- `src/MoodleIFRN/tests/mock-provider.test.mjs`

Arquivos excluídos: nenhum.

Arquivos que o patch altera/cria no backend (ainda não aplicado):

- `alterado .env.example`
- `alterado README.md`
- `alterado app/api/activity.py`
- `alterado app/api/auth.py`
- `alterado app/api/course.py`
- `alterado app/api/dashboard.py`
- `criado app/api/demo.py`
- `alterado app/api/routes.py`
- `alterado app/api/section.py`
- `alterado app/core/config.py`
- `alterado app/core/dependencies.py`
- `alterado app/core/security.py`
- `alterado app/main.py`
- `alterado app/services/activity_service.py`
- `alterado app/services/auth_service.py`
- `alterado app/services/course_service.py`
- `criado app/services/demo_content.py`
- `alterado app/services/jwt_service.py`
- `alterado app/services/section_service.py`
- `alterado tests/test_auth.py`

Arquivos gerados de compilação em www/platforms não são código de entrega rastreado; nenhum arquivo local preexistente foi removido.
