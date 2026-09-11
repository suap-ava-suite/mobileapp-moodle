# MoodleIFRN — visão geral

Documentação da customização **AVA IFRN** dentro do app Moodle Mobile.

Esta pasta concentra tudo que foi desenvolvido para o IFRN (login institucional, painel de cursos e serviços de autenticação), **sem alterar o núcleo do Moodle Mobile** além da rota de login e dos assets/scripts de build.

---

## Objetivo

Oferecer uma experiência mobile alinhada ao [AVA IFRN](https://ava.ifrn.edu.br/):

1. Login com **IFRN-id** e senha (e biometria, quando disponível)
2. Após autenticar, abrir o **painel de cursos** (Mobile Moodle)
3. Consumir uma API (FastAPI de teste hoje; produção depois) com **JWT**
4. UI no estilo AVA (header, sidebar, cards, acessibilidade) com responsividade mobile

---

## Visão geral da arquitetura

```text
App Moodle Mobile (Angular/Ionic)
 │
 ├── ifrn-login/              ← tela de login IFRN
 ├── marketplace-ifrn/        ← entrada / marketplace IFRN
 ├── services_mobile/         ← AuthService + BiometricService
 │
 └── mobilemoodle/           ← painel web (HTML/TS/Ionic CDN)
        ├── index.html       ← shell (menu, header AVA, conteúdo)
        ├── mobilemoodle.ts  ← entrada TypeScript
        ├── mobilemoodle.js  ← bundle compilado
        ├── core_mobile/     ← módulos TypeScript (comentado)
        ├── pages/           ← templates (painel, curso, erros)
        └── static/theme/ifrn/
```

### Fluxo do usuário

```text
Login IFRN  →  JWT no sessionStorage  →  Painel (#/painel)
                      │
                      ├── lista de cursos (GET /dashboard/)
                      └── detalhe do curso (GET /courses/{id})
```

### Camadas do painel (`core_mobile/`)

```text
API:     api-errors → api-auth → api-http → api
UI:      app-utils → app-status → app-views → app-router
         app-accessibility → app-sidebar → app-keyboard → app
```

Detalhes: [`../mobilemoodle/core_mobile/SCRIPTS-TS.md`](../mobilemoodle/core_mobile/SCRIPTS-TS.md).

---

## Documentação por assunto

| Tema | Documento |
|------|-----------|
| Índice da pasta docs | [`README.md`](./README.md) |
| Visão geral (este arquivo) | [`VISAO-GERAL.md`](./VISAO-GERAL.md) |
| Login IFRN | [`../ifrn-login/LOGIN-IFRN.md`](../ifrn-login/LOGIN-IFRN.md) |
| Auth + biometria | [`SERVICOS-AUTH-BIOMETRIA.md`](./SERVICOS-AUTH-BIOMETRIA.md) |
| Painel de cursos | [`PAINEL-CURSOS.md`](./PAINEL-CURSOS.md) |
| Scripts TS do painel | [`../mobilemoodle/core_mobile/SCRIPTS-TS.md`](../mobilemoodle/core_mobile/SCRIPTS-TS.md) |
| Templates HTML | [`TEMPLATES-HTML.md`](./TEMPLATES-HTML.md) |
| Tema visual / header / safe-area | [`TEMA-VISUAL.md`](./TEMA-VISUAL.md) |
| Segurança | [`SEGURANCA.md`](./SEGURANCA.md) |
| Contrato da API | [`CONTRATO-API.md`](./CONTRATO-API.md) |
| Patch após atualizar o Moodle | [`PATCH-AO-ATUALIZAR.md`](./PATCH-AO-ATUALIZAR.md) |

---

## Como isso entra no app

| Integração | Onde |
|------------|------|
| Rota de login | `src/core/features/login/login.module.ts` → `/login/marketplace-ifrn` e `/login/ifrn-login` |
| Assets do painel | `angular.json` copia `src/MoodleIFRN/mobilemoodle` → `mobilemoodle/` no build |
| Compilação TS do painel | gulp `mobilemoodle-ts` / `npm run build:mobilemoodle` |
| Script de apoio | `npm run patch:ifrn` (ver [`PATCH-AO-ATUALIZAR.md`](./PATCH-AO-ATUALIZAR.md)) |

---

## Ambiente de desenvolvimento

| Item | Valor atual |
|------|-------------|
| API de autenticação | `https://suap.ifrn.edu.br` (`/api/token/pair`, `/refresh`, `/verify`) |
| API de dados do painel | `https://suap.ifrn.edu.br` (`/api/rh/eu/`, diários de ensino) |
| Token | JWT SUAP (`access` / `refresh`, normalizado no cliente) |
| Chave no navegador | `sessionStorage.ifrn_access_token` |

> Login e painel usam o mesmo JWT do SUAP (IFRN-id + senha).

---

## O que já está pronto

- [x] Login com IFRN-id e senha
- [x] Login biométrico (quando o dispositivo permite)
- [x] Painel com abas **Diários** e **Autoinscrição** (estilo AVA)
- [x] Página de detalhe do curso (seções expansíveis + atividades)
- [x] Header estilo AVA (menu + título/subtítulo + avatar), responsivo
- [x] Safe-area / teclado (`app-keyboard.ts`) — inset nativo no Android; sem padding fantasma no browser
- [x] Sidebar + modais (perfil, ajuda, acessibilidade, filtros)
- [x] Ícone e splash do Painel AVA (web + assets nativos)
- [x] Tratamento de erros (401, 404, 500, 502, 503, rede, timeout)
- [x] Página “não encontrada”
- [x] Cache curto do dashboard/cursos
- [x] Comentários nos módulos `core_mobile/*.ts`
- [x] Medidas básicas de segurança no cliente

## Pendências / evolução

- [ ] Integração real com Gov.br (hoje só mensagem informativa)
- [ ] Trocar FastAPI de teste pela API de produção
- [ ] Endpoints reais de inscrever/cancelar na aba Autoinscrição
- [ ] Validação de assinatura JWT no backend (obrigatória em produção)

---

## Para o coordenador (resumo em 30 segundos)

A pasta `MoodleIFRN` é o **módulo IFRN** do app: login institucional + painel de cursos no estilo AVA.  
O restante do Moodle Mobile continua intacto. A autenticação fala com uma API via JWT; o painel é uma SPA leve (HTML/TS/Ionic) embutida no build do app.
