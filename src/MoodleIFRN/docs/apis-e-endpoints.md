# APIs e endpoints — Painel AVA IFRN

Levantamento em 19/10/2026, a partir da cópia local do backend `djangoapp-painel_ava` e das referências do aplicativo em `src/MoodleIFRN`.

As rotas listadas existem no código consultado. A disponibilidade de todas em produção não foi confirmada. Nenhuma alteração no login foi feita para produzir este levantamento.

## Cursos dos ambientes Presencial, Acadêmico e AVA Aberto

Base do Painel: `https://ava.ifrn.edu.br`.

Os ambientes usam a mesma rota de consulta: `GET /api/v1/diarios/`. O campo `ambiente` de cada curso identifica seu ambiente, e `viewurl`, quando fornecido, indica a URL do curso no Moodle.

O filtro `ambiente` recebe o **ID numérico cadastrado no backend**, e não o nome do ambiente. Sem esse filtro, o backend consulta os ambientes cadastrados. Os IDs reais devem ser obtidos da resposta; não foram presumidos neste documento.

## API v1

Acrescente as rotas abaixo à base `https://ava.ifrn.edu.br`.

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/v1/diarios/` | Lista cursos, diários e salas dos ambientes |
| GET | `/api/v1/progresso/` | Consulta progresso dos cursos |
| GET | `/api/v1/atualizacoes_counts/` | Retorna contadores de atualizações; a implementação consultada retorna valores vazios/zero |
| GET | `/api/v1/set_favourite/` | Altera favorito |
| GET | `/api/v1/set_visible/` | Altera visibilidade |
| GET | `/api/v1/set_user_preference/` | Salva preferência |
| POST | `/api/v1/authenticate/` | Autenticação |
| POST | `/api/v1/verify/` | Verifica token |
| GET | `/api/v1/backup/baixar/{arquivo_id}/` | Redireciona para download de backup do usuário |

Algumas rotas também declaram suporte a OPTIONS para negociação HTTP/CORS.

### Parâmetros de GET /api/v1/diarios/

| Parâmetro | Uso |
|---|---|
| `ambiente` | ID numérico do ambiente; omitido ou vazio consulta todos |
| `situacao` | Situação, como `inprogress`, `future`, `past`, `favourites` ou `allincludinghidden` |
| `semestre` | Filtra semestre |
| `disciplina` | Filtra disciplina |
| `curso` | Filtra curso |
| `q` | Pesquisa por texto |
| `page` | Número da página; padrão da rota: 1 |
| `page_size` | Quantidade por página; padrão da rota: 9 |

A assinatura da rota também recebe `ordenacao`, mas a implementação consultada não encaminha esse parâmetro ao serviço de consulta.

Exemplo para cursos em andamento de todos os ambientes:

```text
https://ava.ifrn.edu.br/api/v1/diarios/?situacao=inprogress&page=1&page_size=100
```

A resposta contém listas como `diarios`, `coordenacoes`, `praticas`, `autoinscricoes` e `reutilizaveis`, além de opções de filtros. É necessário considerar a paginação para carregar a listagem completa. `autoinscricoes` é uma vitrine de cursos disponíveis para inscrição, não necessariamente cursos em que o usuário já está matriculado.

### Parâmetros de GET /api/v1/progresso/

- `ambiente`: ID numérico do ambiente, opcional.
- `cursos`: IDs Moodle separados por vírgula, opcional.

Exemplo com valores ilustrativos:

```text
https://ava.ifrn.edu.br/api/v1/progresso/?ambiente={id_ambiente}&cursos=123,456
```

A resposta usa o envelope `progresso`. Cada item recebe `ambiente_id`. Para associar progresso a curso, deve-se considerar ambiente + ID do curso: o mesmo ID pode existir em Moodles diferentes.

### Outras entradas da API v1

| Endpoint | Entradas |
|---|---|
| `/api/v1/set_favourite/` | Query: `ava`, `courseid`, `favourite` |
| `/api/v1/set_visible/` | Query: `ava`, `courseid`, `visible` |
| `/api/v1/set_user_preference/` | Query: `category`, `key`, `value`; `username` opcional |
| `/api/v1/authenticate/` | JSON: `username`, `password` |
| `/api/v1/verify/` | JSON: `token` |

## API v2 — presente no código

Base: `https://ava.ifrn.edu.br/api/v2`.

A presença destas rotas no código não garante que a versão implantada no servidor já as disponibilize.

| Método | Endpoint relativo à base v2 | Função |
|---|---|---|
| POST | `/token/pair/` | Obtém tokens |
| POST | `/token/refresh/` | Renova token |
| POST | `/token/verify/` | Verifica token |
| POST | `/token/revoke/` | Revoga token |
| GET | `/usuario/info/` | Dados do usuário |
| GET | `/usuario/preferencia/` | Consulta preferências |
| PATCH | `/usuario/preferencia/` | Atualiza preferências |
| GET | `/sala/tipo/` | Lista tipos de sala |
| GET | `/sala/tipo/quantidades/` | Quantidades por tipo |
| GET | `/sala/tipo/{ava_ou_tipo}/` | Consulta tipo ou ambiente |
| GET | `/sala/tipo/{tipo}/{ava}/` | Lista salas por tipo e ambiente |
| GET | `/sala/progresso/{ava}/{ids}/` | Progresso das salas |
| PATCH | `/sala/favorito/{ava}/{id_sala}/` | Altera favorito |
| PATCH | `/sala/visivel/{ava}/{id_sala}/` | Altera visibilidade |
| GET | `/notificacao/` | Resumo de notificações |
| GET | `/notificacao/{ava}/` | Notificações do ambiente |
| GET | `/notificacao/{ava}/{ids}/` | Consulta notificações específicas |
| PATCH | `/notificacao/{ava}/{ids}/` | Altera estado de leitura |
| GET | `/conversa/` | Resumo de conversas |
| GET | `/conversa/{ava}/` | Conversas do ambiente |
| GET | `/conversa/{ava}/{ids}/` | Consulta conversas específicas |
| PATCH | `/conversa/{ava}/{ids}/` | Altera estado de leitura |

### Corpos JSON da API v2

| Operação | Campos |
|---|---|
| POST `/token/pair/` | `username`, `password` |
| POST `/token/refresh/` | `refresh` |
| POST `/token/verify/` | `token` |
| POST `/token/revoke/` | `token` |
| PATCH `/usuario/preferencia/` | `zoom`, `configuracao` |
| PATCH `/sala/favorito/{ava}/{id_sala}/` | `favorite` (booleano) |
| PATCH `/sala/visivel/{ava}/{id_sala}/` | `visible` (booleano) |
| PATCH `/notificacao/{ava}/{ids}/` | `is_read` (booleano) |
| PATCH `/conversa/{ava}/{ids}/` | `is_read` (booleano) |

Os tipos reconhecidos pela rota `/sala/tipo/{ava_ou_tipo}/` são `inicio`, `diario`, `coordenacao`, `laboratorio`, `autoinscricoes` e `backup`. Os parâmetros da v2 não devem ser confundidos automaticamente com os IDs numéricos do filtro `ambiente` da v1.

## Rotas web do Painel

Base: `https://ava.ifrn.edu.br`.

Estas são rotas web, não necessariamente APIs que retornam JSON.

| Método usado | Rota | Função |
|---|---|---|
| GET | `/` | Painel principal |
| GET | `/curso/{id_ambiente}/{id_curso}/` | Detalhes do curso |
| POST | `/curso/{id_ambiente}/{id_curso}/enrol/` | Autoinscrição |
| POST | `/curso/{id_ambiente}/{id_curso}/unenrol/` | Cancela inscrição |
| GET | `/diario/{id_ambiente}/{id_diario}/checkgrades/` | Conferência de notas |
| GET | `/change_theme/{theme}/` | Troca tema |
| POST | `/settings/menu-position/` | Altera posição do menu |
| GET | `/set_tour_completed/` | Marca apresentação como concluída |
| GET | `/get_tour_status/` | Consulta estado da apresentação |

As operações web dependem da sessão e, conforme a operação, de proteção CSRF. As rotas de inscrição, cancelamento de inscrição e posição do menu exigem POST no código consultado.

## API do SUAP referenciada pelo app

Base: `https://suap.ifrn.edu.br`.

Esta seção lista referências encontradas no aplicativo, incluindo tentativas de compatibilidade. Não representa toda a API do SUAP nem confirmação de que todas as rotas estão disponíveis.

| Método | Endpoint |
|---|---|
| POST | `/api/token/pair` |
| POST | `/api/token/refresh` |
| GET | `/api/rh/eu/` |
| GET | `/api/ensino/meus-periodos-letivos/` |
| GET | `/api/ensino/diarios/{semestre}/` |
| GET | `/api/ensino/meus-diarios/{ano_letivo}/{periodo_letivo}/` |
| GET | `/api/ensino/meus-diarios/` |
| GET | `/api/ensino/minha-turma-virtual/{id}/` |
| GET | `/api/ensino/diarios/{id}/aulas/` |
| GET | `/api/ensino/diarios/{id}/materiais/` |
| GET | `/api/ensino/diarios/{id}/topicos/` |
| GET | `/api/ensino/diarios/{id}/trabalhos/` |
| GET | `/api/ensino/diarios/{id}/professores/` |

Referência de documentação indicada no código do app: https://suap.ifrn.edu.br/api/docs/

## Fontes e limites do levantamento

Backend local consultado:

- `src/painel/v1/api.py`
- `src/painel/v1/services.py`
- `src/painel/v2/api.py`
- `src/painel/v2/schemas.py`
- `src/backup/api.py`
- `src/painel/urls.py`
- `src/painel/views.py`
- `src/urls.py`

Aplicativo local consultado:

- `src/MoodleIFRN/services_mobile/painel-ava.config.ts`
- `src/MoodleIFRN/services_mobile/auth.service.ts`
- `src/MoodleIFRN/mobilemoodle/core_mobile/api-suap.ts`

Repositório informado: https://github.com/suap-ava-suite/djangoapp-painel_ava

O escopo é o inventário de rotas apresentado na conversa: API do Painel v1/v2, rotas web do Painel e referências SUAP do aplicativo. Não é um inventário de todas as APIs de todos os repositórios da organização, de todas as funções de webservice do Moodle ou de rotas administrativas, de infraestrutura e de dependências Django.
