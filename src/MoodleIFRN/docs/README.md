# Documentação MoodleIFRN

Índice da customização **AVA IFRN** no app Moodle Mobile.

Tudo que é específico do IFRN vive em `src/MoodleIFRN/` (login, serviços, painel e tema), com o mínimo de alteração no núcleo do Moodle.

## Comece por aqui

| Documento | Conteúdo |
|-----------|----------|
| [VISAO-GERAL.md](./VISAO-GERAL.md) | Arquitetura, fluxo do usuário e status do projeto |
| [PATCH-AO-ATUALIZAR.md](./PATCH-AO-ATUALIZAR.md) | Reaplicar o módulo após atualizar o Moodle Mobile |

## Login e autenticação

| Documento | Conteúdo |
|-----------|----------|
| [../ifrn-login/LOGIN-IFRN.md](../ifrn-login/LOGIN-IFRN.md) | Tela de login IFRN-id |
| [SERVICOS-AUTH-BIOMETRIA.md](./SERVICOS-AUTH-BIOMETRIA.md) | `AuthService` + biometria |
| [CONTRATO-API.md](./CONTRATO-API.md) | Endpoints e payloads esperados |
| [SEGURANCA.md](./SEGURANCA.md) | Medidas de segurança no cliente |

## Painel de cursos (mobilemoodle)

| Documento | Conteúdo |
|-----------|----------|
| [PAINEL-CURSOS.md](./PAINEL-CURSOS.md) | SPA do painel, rotas e integração |
| [../mobilemoodle/core_mobile/SCRIPTS-TS.md](../mobilemoodle/core_mobile/SCRIPTS-TS.md) | Módulos TypeScript (`core_mobile/`) |
| [TEMPLATES-HTML.md](./TEMPLATES-HTML.md) | Partials HTML e shell do `index.html` |
| [TEMA-VISUAL.md](./TEMA-VISUAL.md) | SCSS/CSS, header AVA, safe-area, responsividade |

## Scripts úteis

```bash
# Registrar / reparar rotas IFRN no Moodle Mobile
npm run patch:ifrn

# Compilar TypeScript do painel → mobilemoodle.js
npm run build:mobilemoodle

# Regenerar CSS do tema a partir do SCSS
npx sass src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss \
  src/MoodleIFRN/mobilemoodle/static/theme/ifrn/css/painel.css --no-source-map
```

## Recursos nativos (ícone / splash)

Assets oficiais do Painel AVA para o build Cordova:

| Arquivo | Uso | Tamanho |
|---------|-----|---------|
| `../resources/icon.png` (se presente) / `resources/` na raiz | Ícone do app | 1024×1024 |
| Splash Cordova | Splash screen | ver `config.xml` |

Identidade: fundo teal `#098E95` + marca branca do Painel AVA (`theme_ifrn25`).

Favicons e splash **web** do painel:

`mobilemoodle/static/theme/ifrn/favicon/` e `…/img/splash-logo.png`.
