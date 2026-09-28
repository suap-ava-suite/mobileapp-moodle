# Templates HTML do painel

Partials HTML e o shell do painel.

## Shell

| Arquivo | Conteúdo |
|---------|----------|
| `mobilemoodle/index.html` | Página completa: `ion-app`, menu lateral, **header AVA**, `#page-content`, modais, `#page-templates` |

O header usa:

- `#page-title` — título (atualizado por `app-views` / `app-status`)
- `#page-subtitle` — subtítulo (IFRN / Painel AVA)
- `#toolbar-avatar` — avatar; abre modal de perfil

## Partials (`pages/`)

Carregados sob demanda por `app-router.ts` → `loadTemplates()` e injetados em `#page-templates`.

| Arquivo | Conteúdo |
|---------|----------|
| `painel.html` | Abas Diários/Autoinscrição, cards, estado vazio, refresher |
| `curso.html` | Cabeçalho do curso, visão geral, seções expansíveis e atividades |
| `erros.html` | Template de erro genérico + página “não encontrada” |

Os templates usam a tag `<template id="…">` e são clonados em `app-views.ts` / `app-status.ts` / `app-sidebar.ts`.

Isso evita misturar markup grande dentro do JavaScript e facilita ajustar o layout sem reescrever a lógica.

### IDs de template mais usados

| id | Usado em |
|----|----------|
| `tpl-painel` | Lista do painel |
| `tpl-painel-card` | Card de diário |
| `tpl-painel-card-autoinscricao` | Card de autoinscrição |
| `tpl-empty-cursos` | Lista vazia |
| `tpl-curso` | Detalhe do curso |
| `tpl-curso-section` | Seção / tópico |
| `tpl-curso-activity` | Atividade |
| `tpl-error-page` / `tpl-not-found` | Erros |
| `tpl-modal-profile` / `help` / `accessibility` / `filter` | Modais da sidebar |

## Relacionados

- Tema / header: [`TEMA-VISUAL.md`](./TEMA-VISUAL.md)
- Lógica de render: [`../mobilemoodle/core_mobile/SCRIPTS-TS.md`](../mobilemoodle/core_mobile/SCRIPTS-TS.md)
