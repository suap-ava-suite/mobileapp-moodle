# Tema visual IFRN

Tema visual inspirado no AVA IFRN.

```text
ifrn/
├── css/
│   └── painel.css      ← CSS usado pelo index.html
├── scss/
│   ├── painel.scss     ← entrada (importa os partials)
│   ├── _variables.scss
│   ├── _global.scss
│   ├── _sidebar.scss
│   ├── _cards.scss
│   └── _curso.scss
└── img/                ← ícones e imagens do tema
```

## SCSS

| Partial | Uso |
|---------|-----|
| `_variables.scss` | Cores e tokens do tema IFRN |
| `_global.scss` | Base tipográfica e layout geral |
| `_sidebar.scss` | Menu lateral |
| `_cards.scss` | Cards de curso no painel |
| `_curso.scss` | Página de detalhe do curso |
| `painel.scss` | Arquivo que agrega os partials |

O `index.html` referencia `css/painel.css`. Se o SCSS for alterado, é preciso regenerar/atualizar o CSS correspondente antes de publicar.
