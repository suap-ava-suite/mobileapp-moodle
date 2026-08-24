# Segurança do MoodleIFRN

Medidas **simples no cliente** aplicadas na pasta `MoodleIFRN`.  
Não substituem segurança de backend (assinatura JWT, rate limit, HTTPS, etc.).

---

## Autenticação e token

| Medida | Onde |
|--------|------|
| Access token em `sessionStorage` (não `localStorage`) | `auth.service.ts`, `api-auth.js` |
| Token **não** vai na URL ao abrir o painel | `auth.service.ts` → `openMobileMoodle()` |
| Se ainda existir `?token=`, remove da barra de endereço | `api-auth.js` |
| Valida formato JWT e tamanho máximo | login + painel |
| Rejeita token com `exp` vencido | login + painel |
| Logout limpa token e cache | `app.js`, `api-auth.js` |

---

## Chamadas HTTP

| Medida | Onde |
|--------|------|
| `Authorization: Bearer` fixo (não sobrescrito) | `api-http.js` |
| `credentials: "omit"` | `api-http.js` |
| Timeout de 15s | `api-http.js`, `auth.service.ts` |
| Só paths relativos seguros (`/dashboard/`, etc.) | `api-http.js` |
| Base da API: mesma origem ou localhost | `app.js`, `api-http.js` |
| Removido o override perigoso `?api=https://…` | `app.js` |
| ID de curso só numérico | `api.js`, `app-router.js` |

---

## Interface (XSS e conteúdo)

| Medida | Onde |
|--------|------|
| `escapeHtml` / `textContent` para dados da API | `app-utils.js`, `app-views.js`, `app-status.js` |
| Mensagens de erro limitadas em tamanho | `api-http.js` |
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
