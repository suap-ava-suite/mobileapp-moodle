# Segurança do MoodleIFRN

Medidas **simples no cliente** aplicadas na pasta `MoodleIFRN`.  
Não substituem segurança de backend (assinatura JWT, rate limit, HTTPS, etc.).

---

## Autenticação e token

| Medida | Onde |
|--------|------|
| Access token em `sessionStorage` (não `localStorage`) | `auth.service.ts`, `api-auth.ts` |
| Token **não** vai na URL ao abrir o painel | `auth.service.ts` → `openMobileMoodle()` |
| Se ainda existir `?token=`, remove da barra de endereço | `api-auth.ts` |
| Valida formato JWT e tamanho máximo | login + painel |
| Rejeita token com `exp` vencido | login + painel |
| Logout limpa token e cache | `app.ts`, `api-auth.ts` |

---

## Chamadas HTTP

| Medida | Onde |
|--------|------|
| `Authorization: Bearer` fixo (não sobrescrito) | `api-http.ts` |
| `credentials: "omit"` | `api-http.ts` |
| Timeout de 15s | `api-http.ts`, `auth.service.ts` |
| Só paths relativos seguros (`/dashboard/`, etc.) | `api-http.ts` |
| Base da API: mesma origem ou localhost | `app.ts`, `api-http.ts` |
| Removido o override perigoso `?api=https://…` | `app.ts` |
| ID de curso só numérico | `api.ts`, `app-router.ts` |

---

## Interface (XSS e conteúdo)

| Medida | Onde |
|--------|------|
| `escapeHtml` / `textContent` para dados da API | `app-utils.ts`, `app-views.ts`, `app-status.ts` |
| Mensagens de erro limitadas em tamanho | `api-http.ts` |
| CSP básica no painel | `mobilemoodle/index.html` |
| `referrer: no-referrer` e `X-Content-Type-Options: nosniff` | `index.html` |
| Links externos com `noopener noreferrer` | menu / login |

---

## Login e biometria

| Medida | Onde |
|--------|------|
| Limite de tamanho de usuário/senha | `ifrn-login.ts` |
| Intervalo mínimo entre tentativas de login | `ifrn-login.ts` |
| Remove caracteres de controle do IFRN-id | `ifrn-login.ts` |
| Senha limpa da página após login | `ifrn-login.ts` |
| Biometria forte, sem backup de PIN | `biometric.service.ts` |
| Refresh token validado antes de guardar/usar | `biometric.service.ts` |

---

## O que o backend ainda precisa garantir (produção)

Estas partes **não** são responsabilidade só do app:

1. Verificar assinatura do JWT
2. HTTPS em todos os ambientes públicos
3. Rate limiting / bloqueio após tentativas
4. CORS restrito às origens do app
5. Rotação e revogação de refresh tokens
6. Auditoria de login

---

## Resumo para o coordenador

O cliente já evita erros clássicos (token na URL, API apontando para domínio estranho, XSS básico, biometria frágil).  
A segurança completa depende da **API de produção** e da infraestrutura do IFRN.
