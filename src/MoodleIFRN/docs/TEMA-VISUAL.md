# Tema visual IFRN

Tema visual inspirado no AVA IFRN (`theme_ifrn25` / DS-GOV).

```text
ifrn/
├── css/
│   └── painel.css      ← CSS usado pelo index.html (gerado do SCSS)
├── favicon/            ← ícones do Painel AVA (PWA / aba)
├── scss/
│   ├── painel.scss     ← entrada (importa os partials)
│   ├── _variables.scss
│   ├── _global.scss    ← base + header AVA (.ava-header)
│   ├── _sidebar.scss   ← menu lateral (Painel AVA, perfil, filtros…)
│   ├── _accessibility.scss ← painel de acessibilidade (igual ao AVA)
│   ├── _splash.scss    ← load view (logo + spinner)
│   ├── _cards.scss
│   ├── _curso.scss     ← curso, seções e atividades
│   ├── _mobile.scss    ← responsividade celular (≤768px) + safe-area
│   ├── _dsgov-*.scss   ← tokens / componentes DS-GOV
│   └── dsgov/          ← partials herdados do tema web
└── img/                ← ícones e imagens do tema (splash-logo, app-icon…)
```

## Header (estilo AVA)

No `index.html`, o cabeçalho espelha o `br-header` do AVA, adaptado ao mobile:

```text
[ ☰ menu ]  Painel AVA / IFRN     [ avatar ]
            (título + subtítulo)
```

| Classe | Papel |
|--------|-------|
| `.ava-header` | `ion-header` com sombra DS-GOV |
| `.ava-toolbar` | Toolbar compacta (~48px) + `--padding-top` = safe-area |
| `.ava-toolbar-inner` | Flex: menu + marca + avatar |
| `.ava-header-title` (`#page-title`) | Título da tela (Painel AVA / nome do curso) |
| `.ava-header-subtitle` (`#page-subtitle`) | Subtítulo (IFRN / Painel AVA) |
| `.toolbar-avatar` | Iniciais do usuário; abre modal de perfil |

### Responsividade do header

- Tipografia com `clamp()` (acompanha a largura da tela)
- Em telas ≤360px e em landscape: subtítulo some para ganhar espaço
- Altura da barra: ~48px (44px em telas bem estreitas)

## Safe-area (status bar / notch)

O painel é uma página HTML separada (`mobilemoodle/index.html`). No Android o Moodle ativa **edge-to-edge** (`StatusBar.overlaysWebView(true)`), então o conteúdo precisa respeitar o inset superior.

| Ambiente | Comportamento |
|----------|----------------|
| **App nativo (Cordova)** | Preferência: `cordova-plugin-insets` (`window.totalpave.Inset`), igual ao core Moodle. Preenche `--ion-safe-area-*`. Se o plugin falhar no Android, fallback curto (~24px). |
| **Browser / DevTools** | **Não** força padding no topo (não há status bar sobrepondo). Evita o “espaço branco” artificial no console mobile. |

Implementação: `core_mobile/app-keyboard.ts`  
CSS: `.ava-toolbar { --padding-top: var(--ion-safe-area-top, 0px); }` em `_global.scss` / `_mobile.scss`.

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

Preferências ficam em `localStorage` (`ifrn_a11y_prefs`) e são reaplicadas ao abrir o painel (`app-accessibility.ts`).

## Pós-login (painel, curso, seções, atividades)

| Tela | Referência visual |
|------|-------------------|
| Lista de cursos | Abas **Diários** / **Autoinscrição** (pills do topbar AVA) + cards |
| Detalhe do curso | Cabeçalho estilo `enrol-header` + visão geral |
| Seções | Tópicos expansíveis com índice numerado |
| Atividades | Lista com ícone por `modname` e status de conclusão |
| Load view | Logo AVA + spinner (`_splash.scss`) |

Ícone/splash nativos (Cordova): ver [`README.md`](./README.md) (seção recursos) e `config.xml`.

## SCSS

| Partial | Uso |
|---------|-----|
| `_variables.scss` | Cores e tokens do tema IFRN |
| `_global.scss` | Base tipográfica, layout geral, **header AVA** |
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

Depois de mudar TypeScript do painel:

```bash
npm run build:mobilemoodle
```
