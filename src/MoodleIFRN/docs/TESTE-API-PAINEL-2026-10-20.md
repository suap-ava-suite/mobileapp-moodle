# Teste de integração do Painel institucional

Consultas somente leitura no Android conectado, usando os cookies já existentes em InAppBrowser oculto, fechado ao terminar. Nenhuma senha, cookie, token ou resposta de perfil foi exportada. Nenhuma sessão foi apagada e nenhuma configuração de servidor foi alterada.

## Resultados observados

| Host / recurso | Resultado |
| --- | --- |
| `ava.ifrn.edu.br/api/v1/diarios/` sem sessão | HTTP 428 |
| Mesmo recurso com sessão existente, `situacao=inprogress&page_size=100` | HTTP 200; diarios, coordenacoes, praticas, autoinscricoes e reutilizaveis vazios |
| `ava.ifrn.edu.br/api/v1/openapi.json` com sessão | HTTP 200; rotas de cursos, progresso, preferências, autenticação, verify e backup |
| `ava.ifrn.edu.br/api/v2/openapi.json` | HTTP 200; API v2 publicada neste host |
| `ava.ifrn.edu.br/api/v2/usuario/info/` com sessão | HTTP 200; identificação corresponde ao perfil salvo, sem fallback testuser |
| `ava.ifrn.edu.br/api/v2/sala/tipo/diario/academico/` com sessão | HTTP 200; lista vazia |
| `ava.ifrn.edu.br/api/v2/sala/tipo/diario/presencial/` com sessão | HTTP 200; lista vazia |
| `painel.ead.ifrn.edu.br/api/v1/diarios/` no mesmo armazenamento de navegador | HTTP 428; sessão não disponível neste host |
| `painel.ead.ifrn.edu.br/api/v2/openapi.json` e `/api/v2/usuario/info/` | HTTP 404 |

O endpoint v2 de identidade também respondeu HTTP 200 à consulta sem cookies. Por isso, HTTP 200 isolado não comprova autenticação. O código público possui fallback `testuser`; a comparação com identidade esperada foi feita dentro do diagnóstico autenticado, sem imprimir valores.

Nenhum dos dois esquemas publicados anuncia troca de autorização do Painel por sessão/token Moodle Mobile. A rota v1 `/verify/` aparece no servidor, mas não no `api.py` do HEAD público consultado; seu corpo/semântica não foi presumido nem testado com credenciais inventadas. Os resultados evidenciam diferenças entre deploys e repositório.

## Código revisado

HEAD de `suap-ava-suite/djangoapp-painel_ava`: `10aadeb74dcc39b2f497c63c4ba37d7fe7c1d7e8`, confirmado por `git ls-remote` e checkout temporário.

- `src/painel/v2/services.py`: `SalaService.salas_by_tipo()` retorna `[]`; progresso usa valor fixo 50. A v2 não deve substituir a listagem real apenas por estar publicada.
- `src/painel/v2/brokers.py`: `generate_pair()` assina tokens próprios usando `JWT_SECRET`, não emite wstoken Moodle.
- `src/painel/models.py`: comunicação existente com `/admin/tool/painelava/api`; credencial de ambiente é de integração.

Os cursos vazios da v1 não foram classificados como inexistência de matrícula: o app já possui os cursos em cache e sessões nativas válidas. A causa da resposta vazia exige investigação de agregação/configuração no servidor.

## Estado preservado e conclusão

Após os testes, Acadêmico e Presencial continuam com token no armazenamento seguro, sem logout e com identidade correspondente ao Painel. Acessibilidade permanece visível em `/main/home/course/4022/contents`, com 14 elementos de conteúdo.

O teste confirma acesso à API com sessão existente por navegador oculto; não representa criação de uma nova sessão Moodle sem navegador. Nenhuma nova ponte de emissão mobile foi implementada ou publicada. O próximo requisito é examinar o plugin `tool_painelava` e implementar/autorizar uma troca de uso único entre Painel e Moodle antes de conectá-la ao app.

Diagnóstico reproduzível: `node src/MoodleIFRN/docs/trace-course-device.cjs src/MoodleIFRN/docs/probe-painel-integration.js`, com CDP local encaminhado na porta 9223. O script só retorna status, nomes de rotas, contagens e comparações booleanas.
