# Painel de cursos (mobilemoodle)

Painel web do AVA IFRN embutido no app Moodle Mobile.

É uma SPA leve (HTML + TypeScript compilado + Ionic via CDN), **não** é um módulo Angular.  
No build, a pasta é copiada para `mobilemoodle/` (configurado no `angular.json`).

URL típica após o login:

```text
…/mobilemoodle/index.html#/painel
```

---

## Estrutura

```text
mobilemoodle/
├── index.html          ← shell (menu, header AVA, área de conteúdo)
├── mobilemoodle.ts     ← entrada TypeScript
├── mobilemoodle.js     ← bundle compilado (carregado pelo index.html)
├── build.mjs           ← esbuild: TS → mobilemoodle.js
├── core_mobile/        ← módulos TypeScript (ver SCRIPTS-TS.md)
├── pages/              ← templates HTML carregados sob demanda
│   ├── painel.html     ← lista de cursos
│   ├── curso.html      ← detalhe do curso
│   └── erros.html      ← telas de erro / not found
└── static/theme/ifrn/
    ├── css/painel.css  ← CSS compilado usado pelo index
    ├── scss/           ← fontes SCSS do tema
    └── img/            ← ícones e imagens do tema
```

---

## Shell (`index.html`)

| Região | Descrição |
|--------|-----------|
| `ion-menu.ava-menu` | Sidebar estilo AVA (perfil, a11y, ajuda, filtros) |
| `ion-header.ava-header` | Menu + título/subtítulo + avatar (ver [TEMA-VISUAL.md](./TEMA-VISUAL.md)) |
| `#page-content` | Conteúdo da rota (painel, curso, erro, loading) |
| `#page-templates` | Host onde `pages/*.html` é injetado |
| `#sidebar-modal` | Modal lateral (perfil / ajuda / a11y / filtros) |

IDs usados pelo JS no header: `#page-title`, `#page-subtitle`, `#toolbar-avatar`.

---

## Rotas (hash)

| Hash | Tela |
|------|------|
| `#/painel` | Lista de cursos do estudante |
| `#/curso/{id}` | Detalhe do curso (`id` numérico) |
| qualquer outra | Página “não encontrada” |

O roteamento está em `core_mobile/app-router.ts` (compilado para `mobilemoodle.js`).

---

## Telas e estados

| Estado | Quando aparece |
|--------|----------------|
| Loading | Enquanto busca dashboard/curso (splash ~3s na 1ª carga) |
| Painel | Dashboard carregado (abas Diários / Autoinscrição) |
| Curso | Curso carregado (seções + atividades) |
| Erro 401/403 | Sem token ou sessão inválida |
| Erro 5xx / rede / timeout | Falha na API |
| Not found | Rota inválida ou recurso 404 |

Há **pull-to-refresh** no painel (componente Ionic `ion-refresher`).

---

## Módulos relevantes

| Módulo | Função |
|--------|--------|
| `app-router.ts` | Parse do hash + orquestra carregamento |
| `app-views.ts` | `renderPainel` / `renderCurso` |
| `app-status.ts` | Loading, erro, not found |
| `app-sidebar.ts` | Menu + modais |
| `app-accessibility.ts` | Preferências AVA (`localStorage`) |
| `app-keyboard.ts` | Safe-area (status bar) + teclado virtual |
| `api*.ts` | JWT, HTTP, cache |

Documentação dos scripts: [`../mobilemoodle/core_mobile/SCRIPTS-TS.md`](../mobilemoodle/core_mobile/SCRIPTS-TS.md)

---

## Tema visual

O visual segue a identidade do AVA IFRN (header, cores, cards, progresso, menu).

- Variáveis e partials: `static/theme/ifrn/scss/`
- CSS servido: `static/theme/ifrn/css/painel.css`
- Detalhes de header / safe-area / mobile: [`TEMA-VISUAL.md`](./TEMA-VISUAL.md)

---

## Integração com o login

1. `AuthService` autentica e grava o JWT no `sessionStorage`
2. Navega para `mobilemoodle/index.html#/painel` (**sem** token na URL)
3. `api-auth.ts` lê o token e as chamadas HTTP usam `Authorization: Bearer …`

---

## API consumida pelo painel

| Recurso | Método | Path |
|---------|--------|------|
| Dashboard (usuário + cursos) | `GET` | `/dashboard/` |
| Detalhe do curso | `GET` | `/courses/{id}` |

Base em desenvolvimento (localhost): `http://localhost:8000`  
Fora do localhost: mesma origem da página.

Detalhes do contrato: [`./CONTRATO-API.md`](./CONTRATO-API.md)

---

## Compilar

```bash
npm run build:mobilemoodle
```

CSS (se alterar SCSS):

```bash
npx sass src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss \
  src/MoodleIFRN/mobilemoodle/static/theme/ifrn/css/painel.css --no-source-map
```
