# MoodleIFRN — visão geral

Documentação da customização **AVA IFRN** dentro do app Moodle Mobile.

Esta pasta concentra tudo que foi desenvolvido para o IFRN (login institucional, painel de cursos e serviços de autenticação), **sem alterar o núcleo do Moodle Mobile** além da rota de login.

---

## Objetivo

Oferecer uma experiência mobile alinhada ao AVA IFRN:

1. Login com **IFRN-id** e senha (e biometria, quando disponível)
2. Após autenticar, abrir o **painel de cursos** (Mobile Moodle)
3. Consumir uma API (FastAPI de teste hoje; produção depois) com **JWT**

---

## Visão geral da arquitetura

```text
App Moodle Mobile (Angular/Ionic)
 │
 ├── ifrn-login/              ← tela de login IFRN
 ├── services_mobile/         ← AuthService + BiometricService
 │
 └── mobilemoodle/           ← painel web (HTML/JS/Ionic)
        ├── index.html
        ├── pages/           ← templates (painel, curso, erros)
        ├── js/              ← API + roteamento + UI
        └── static/theme/ifrn/
```

### Fluxo do usuário

```text
Login IFRN  →  JWT salvo no sessionStorage  →  Painel (#/painel)
                      │
                      ├── lista de cursos (GET /dashboard/)
                      └── detalhe do curso (GET /courses/{id})
```

---

## Documentação por assunto

| Pasta / tema | Documento |
|--------------|-----------|
| Visão geral (este arquivo) | [`VISAO-GERAL.md`](./VISAO-GERAL.md) |
| Login IFRN | [`ifrn-login/LOGIN-IFRN.md`](./ifrn-login/LOGIN-IFRN.md) |
| Auth + biometria | [`services_mobile/SERVICOS-AUTH-BIOMETRIA.md`](./services_mobile/SERVICOS-AUTH-BIOMETRIA.md) |
| Painel de cursos | [`mobilemoodle/PAINEL-CURSOS.md`](./mobilemoodle/PAINEL-CURSOS.md) |
| Scripts JS do painel | [`mobilemoodle/js/SCRIPTS-JS.md`](./mobilemoodle/js/SCRIPTS-JS.md) |
| Templates HTML | [`mobilemoodle/pages/TEMPLATES-HTML.md`](./mobilemoodle/pages/TEMPLATES-HTML.md) |
| Tema visual | [`mobilemoodle/static/theme/ifrn/TEMA-VISUAL.md`](./mobilemoodle/static/theme/ifrn/TEMA-VISUAL.md) |
| Segurança | [`SEGURANCA.md`](./SEGURANCA.md) |
| Contrato da API | [`CONTRATO-API.md`](./CONTRATO-API.md) |

---

## Como isso entra no app

| Integração | Onde |
|------------|------|
| Rota de login | `src/core/features/login/login.module.ts` → `/login/ifrn` |
| Assets do painel | `angular.json` copia `src/MoodleIFRN/mobilemoodle` → `mobilemoodle/` no build |
| Script de apoio | `npm run patch:login-route` (ver `readme_ifrn.md` na raiz) |

---

## Ambiente de desenvolvimento

| Item | Valor atual |
|------|-------------|
| API de autenticação / dados | `http://localhost:8000` (FastAPI de teste) |
| Token | JWT (`access_token` / `refresh_token`) |
| Chave no navegador | `sessionStorage.ifrn_access_token` |

> Em produção, a URL da API deve apontar para o backend oficial do IFRN. O painel, em ambiente que não é localhost, usa a **mesma origem** da página.

---

## O que já está pronto

- [x] Login com IFRN-id e senha
- [x] Login biométrico (quando o dispositivo permite)
- [x] Painel com lista de cursos e progresso
- [x] Página de detalhe do curso (seções expansíveis + atividades)
- [x] Ícone e splash do Painel AVA (web + assets nativos em `resources/`)
- [x] Tratamento de erros (401, 404, 500, 502, 503, rede, timeout)
- [x] Página “não encontrada”
- [x] Cache curto do dashboard/cursos
- [x] Medidas básicas de segurança no cliente

## Pendências / evolução

- [ ] Integração real com Gov.br (hoje só mensagem informativa)
- [ ] Trocar FastAPI de teste pela API de produção
- [ ] Abas “Diários” e “Autoinscrição” (hoje desabilitadas no layout)
- [ ] Validação de assinatura JWT no backend (obrigatória em produção)

---

## Para o coordenador (resumo em 30 segundos)

A pasta `MoodleIFRN` é o **módulo IFRN** do app: login institucional + painel de cursos no estilo AVA.  
O restante do Moodle Mobile continua intacto. A autenticação fala com uma API via JWT; o painel é uma SPA leve (HTML/JS/Ionic) embutida no build do app.
