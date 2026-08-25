# Tema visual IFRN

Tema visual inspirado no AVA IFRN (`theme_ifrn25`).

```text
ifrn/
├── css/
│   └── painel.css      ← CSS usado pelo index.html
├── scss/
│   ├── painel.scss     ← entrada (importa os partials)
│   ├── _variables.scss
│   ├── _global.scss
│   ├── _sidebar.scss   ← menu lateral (Painel AVA, perfil, filtros…)
│   ├── _cards.scss
│   └── _curso.scss
└── img/                ← ícones e imagens do tema
```

## Sidebar (espelho do AVA)

No `index.html`, o menu lateral segue o layout do site:

- **Painel AVA** + toggle
- Imagem/iniciais de perfil + nome
- Acessibilidade / Ajuda
- Adicionar filtros + **FILTRADO POR:** (chip do perfil, padrão `Todos os diários (lento)`)

## SCSS

| Partial | Uso |
|---------|-----|
| `_variables.scss` | Cores e tokens do tema IFRN |
| `_global.scss` | Base tipográfica e layout geral |
| `_sidebar.scss` | Menu lateral + modais (perfil/ajuda/a11y/filtros) |
| `_cards.scss` | Cards de curso no painel |
| `_curso.scss` | Página de detalhe do curso |
| `painel.scss` | Arquivo que agrega os partials |

O `index.html` referencia `css/painel.css`. Se o SCSS for alterado, regenere o CSS:

```bash
npx sass src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss \
  src/MoodleIFRN/mobilemoodle/static/theme/ifrn/css/painel.css --no-source-map
```
