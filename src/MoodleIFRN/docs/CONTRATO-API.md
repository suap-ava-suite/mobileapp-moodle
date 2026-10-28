# Contratos legados de API (AuthService / FastAPI)

> **Referência de compatibilidade, não descrição do fluxo principal atual.** O
> Marketplace usa `SuapEntryService` e uma sessão web do Painel AVA. A lista de
> cursos é consultada same-origin pelo InAppBrowser; o acesso ao conteúdo usa a
> sessão Moodle nativa. Não trate `/api/token/pair`, Bearer SUAP, FastAPI local
> ou `/courses/{id}` como etapas necessárias do fluxo normal.

Esta página preserva contratos ainda presentes no repositório para manutenção
de `AuthService`, biometria e adaptadores antigos. Para o fluxo atual, consulte
[visão geral](./VISAO-GERAL.md), [ponte](./PONTE-PAINEL-MOODLE.md) e
[APIs observadas](./apis-e-endpoints.md).

---

## Base URL

| Ambiente | Autenticação | Diários (preferido) | Fallback |
|----------|--------------|---------------------|----------|
| Produção / app | `https://suap.ifrn.edu.br` | `https://painel.ead.ifrn.edu.br` | SUAP ensino |

Docs SUAP: https://suap.ifrn.edu.br/api/docs/  
OpenAPI: https://suap.ifrn.edu.br/api/openapi.json  
Painel AVA: https://github.com/suap-ava-suite/djangoapp-painel_ava

---

## Compatibilidade: autenticação por JWT SUAP

### `POST /api/token/pair`


**Body**

```json
{
  "username": "matricula-ou-cpf",
  "password": "senha"
}
```

**Resposta 200** (SimpleJWT)

```json
{
  "username": "matricula-ou-cpf",
  "refresh": "eyJ...",
  "access": "eyJ..."
}
```

O `AuthService` converte para o formato interno `access_token` / `refresh_token` / `token_type`.

**Erros esperados pelo cliente**

| Status | Tratamento na UI |
|--------|------------------|
| 400 / 401 | IFRN-id ou senha inválidos |
| 429 | Muitas tentativas |
| 5xx | SUAP indisponível |
| timeout / offline | Mensagens específicas |

---

### `POST /api/token/refresh`

**Body**

```json
{
  "refresh": "eyJ..."
}
```

**Resposta 200**

```json
{
  "refresh": "eyJ...",
  "access": "eyJ..."
}
```

Usado após biometria. Se retornar **401**, o app desativa a biometria local e pede login com senha.

---

### `POST /api/token/verify`

**Body**

```json
{
  "token": "eyJ..."
}
```

Confere se o access token ainda é aceito pelo SUAP.

---

## Compatibilidade: chamadas autenticadas por Bearer

Header em todas as rotas abaixo:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

Os endpoints abaixo pertencem aos adaptadores de compatibilidade. Eles não
substituem a consulta same-origin do Painel AVA no fluxo principal:

| Uso interno | Endpoint SUAP |
|-------------|----------------|
| Nome / foto / papel | `GET /api/rh/eu/` |
| Lista de diários | `GET /api/ensino/meus-periodos-letivos/` + `GET /api/ensino/diarios/{ano}.{periodo}/` (fallback: `GET /api/ensino/meus-diarios/`) |
| Detalhe do diário | `GET /api/ensino/minha-turma-virtual/{id}/` (fallback: aulas/materiais/tópicos do diário) |

Formato interno esperado pela UI (`DashboardData`):

```json
{
  "nome": "Nome do estudante",
  "username": "matricula",
  "papel": "estudante",
  "total_courses": 3,
  "courses": [
    {
      "id": 1,
      "name": "Nome da disciplina",
      "shortname": "SIGLA",
      "progress": 40,
      "moodle": "SUAP"
    }
  ],
  "diarios": [],
  "autoinscricoes": []
}
```

A aba **Diários** usa `diarios` se existir; senão cai em `courses`.  
A aba **Autoinscrição** usa `autoinscricoes` (hoje vazia no adaptador SUAP).

### Protótipo FastAPI (legado)

Os paths abaixo ficam documentados só como referência do protótipo antigo; o cliente atual não os chama:

### `GET /courses/{id}` (legado)

`id` numérico.

```json
{
  "id": 1,
  "name": "Nome do curso",
  "teacher": "Professor(a)",
  "workload": "60h",
  "progress": 40,
  "moodle": "AVA Acadêmico",
  "summary": "Texto opcional de visão geral",
  "sections": [
    {
      "name": "Tópico 1",
      "activities": [
        {
          "name": "Fórum de avisos",
          "modname": "forum",
          "completion": true
        },
        {
          "name": "Material da aula",
          "modname": "resource",
          "completion": false
        }
      ]
    }
  ]
}
```

Campos de atividade aceitos: `modname` (ou `module` / `type`), `name` (ou `title`), `completion` (boolean opcional).
Seções aceitam `activities`, `modules` ou `cms`.
---

## Status HTTP que o painel trata

| Status | Comportamento |
|--------|---------------|
| 401 / 403 | Limpa token e pede novo login |
| 404 | Tela “não encontrada” |
| 408 | Timeout (cliente) |
| 429 | Muitas tentativas |
| 500 / 502 / 503 / 504 | Telas de erro com retry quando aplicável |
| 0 | Falha de rede / servidor offline |

Resposta de sucesso deve ser `Content-Type: application/json`.

---

## Tokens

- Preferência: JWT com claim `exp`
- O cliente valida formato e expiração de forma **local** (não valida assinatura)
- Em produção, o backend **deve** validar assinatura e permissões

---

## Não use como instrução de implantação

As tabelas acima registram formatos e endpoints da implementação compatível e
do protótipo. Antes de alterar a integração, confirme o contrato do serviço no
checkout e no ambiente institucional. O app não deve enviar tokens SUAP ou do
Painel como token Moodle nem presumir que uma resposta HTML de login seja JSON.
