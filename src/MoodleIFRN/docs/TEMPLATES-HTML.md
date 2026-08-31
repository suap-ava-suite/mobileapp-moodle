# Templates HTML do painel

Partials HTML (templates) carregados pelo painel em tempo de execução.

| Arquivo | Conteúdo |
|---------|----------|
| `painel.html` | Abas Diários/Autoinscrição, cards, estado vazio |
| `curso.html` | Cabeçalho do curso, visão geral, seções expansíveis e atividades |
| `erros.html` | Template de erro genérico + página “não encontrada” |

Os templates usam a tag `<template id="…">` e são clonados em `app-views.ts` / `app-status.ts`.

Isso evita misturar markup grande dentro do JavaScript e facilita ajustar o layout sem reescrever a lógica.
