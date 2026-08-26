# Contrato da API

O app fala com um backend HTTP (hoje: FastAPI de teste em `localhost:8000`).  
Este documento descreve o que o **cliente espera**, para alinhar com o time/backend.

---

## Base URL

| Ambiente | Base |
|----------|------|
| Desenvolvimento (app em localhost) | `http://localhost:8000` |
| Demais ambientes | mesma origem da página do painel |

Autenticação Angular (`AuthService`) usa `http://localhost:8000` no código atual de desenvolvimento.

---

## Autenticação

### `POST /auth/login`

**Body**

```json
{
  "username": "matricula-ou-cpf",
  "password": "senha"
}
```

**Resposta 200**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Erros esperados pelo cliente**

| Status | Tratamento na UI |
|--------|------------------|
| 401 | Usuário ou senha inválidos |
| 429 | Muitas tentativas |
| 5xx | Serviço indisponível |
| timeout / offline | Mensagens específicas |

---

### `POST /auth/refresh`

**Body**

```json
{
  "refresh_token": "eyJ..."
}
```

**Resposta 200**: mesmo formato de `/auth/login`.

Usado após biometria. Se retornar **401**, o app desativa a biometria local e pede login com senha.

---

## Painel (Bearer obrigatório)

Header em todas as rotas abaixo:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

### `GET /dashboard/`

Retorno esperado (campos usados pela UI):

```json
{
  "nome": "Nome do estudante",
  "username": "matricula",
  "total_courses": 2,
  "courses": [
    {
      "id": 1,
      "name": "Nome do curso",
      "shortname": "CURSO1",
      "progress": 40,
      "moodle": "AVA"
    }
  ]
}
```

### `GET /courses/{id}`

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

## Observação

A FastAPI atual é de **teste**. Quando a API de produção chegar, o ideal é:

1. Manter os mesmos paths (ou adaptar só os serviços)
2. Trocar a base URL
3. Garantir CORS + HTTPS + JWT assinado
