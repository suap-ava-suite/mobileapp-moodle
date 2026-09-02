# Tema visual IFRN

Tema visual inspirado no AVA IFRN (`theme_ifrn25`).

```text
ifrn/
├── css/
│   └── painel.css      ← CSS usado pelo index.html
├── favicon/            ← ícones do Painel AVA (PWA / aba)
├── scss/
│   ├── painel.scss     ← entrada (importa os partials)
│   ├── _variables.scss
│   ├── _global.scss
│   ├── _sidebar.scss   ← menu lateral (Painel AVA, perfil, filtros…)
│   ├── _accessibility.scss ← painel de acessibilidade (igual ao AVA)
│   ├── _splash.scss    ← load view (logo + spinner)
│   ├── _cards.scss
│   ├── _curso.scss     ← curso, seções e atividades
│   └── _mobile.scss    ← responsividade celular (≤768px)
└── img/                ← ícones e imagens do tema (splash-logo, app-icon…)
```

## Sidebar (espelho do AVA)

No `index.html`, o menu lateral segue o layout do site:

- **Painel AVA** + toggle
- Imagem/iniciais de perfil + nome
- Acessibilidade / Ajuda
- Adicionar filtros + **FILTRADO POR:** (chip do perfil, padrão `Todos os diários (lento)`)

## Acessibilidade (espelho do AVA)

Opções iguais ao modal do Painel AVA / `theme_suap`:

- Fonte amigável a disléxicos (OpenDyslexic)
- Alinhar texto à esquerda
- Destacar links
- Parar animações
- Ocultar imagens ilustrativas
- Cursor do mouse grande
- Habilitar VLibras
- Linhas mais distantes
- Zoom ciclável: 100% → 120% → 130% → 150% → 160%
- Modo de cor: Padrão → Alto contraste → Contraste reduzido → Amigável a daltônicos → Escala de cinza

Preferências ficam em `localStorage` (`ifrn_a11y_prefs`) e são reaplicadas ao abrir o painel.

## Pós-login (painel, curso, seções, atividades)

| Tela | Referência visual |
|------|-------------------|
| Lista de cursos | Abas **Diários** / **Autoinscrição** (pills do topbar AVA) + cards |
| Detalhe do curso | Cabeçalho estilo `enrol-header` + visão geral |
| Seções | Tópicos expansíveis com índice numerado |
| Atividades | Lista com ícone por `modname` e status de conclusão |
| Load view | Logo AVA + spinner teal (`_splash.scss`) |

Ícone/splash nativos (Cordova): ver [`../../../resources/README.md`](../../../resources/README.md).

## SCSS

| Partial | Uso |
|---------|-----|
| `_variables.scss` | Cores e tokens do tema IFRN |
| `_global.scss` | Base tipográfica e layout geral |
| `_sidebar.scss` | Menu lateral + modais (perfil/ajuda/filtros) |
| `_accessibility.scss` | Controles e efeitos de acessibilidade |
| `_splash.scss` | Splash / loading overlay |
| `_cards.scss` | Cards de curso no painel |
| `_curso.scss` | Curso, seções e atividades |
| `_mobile.scss` | Layout mobile / safe-areas / landscape |
| `painel.scss` | Arquivo que agrega os partials |

O `index.html` referencia `css/painel.css`. Se o SCSS for alterado, regenere o CSS:

```bash
npx sass src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss \
  src/MoodleIFRN/mobilemoodle/static/theme/ifrn/css/painel.css --no-source-map
```
