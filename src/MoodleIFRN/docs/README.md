# Documentação MoodleIFRN

**Versão HTML offline deste índice:** [README.html](./README.html).

Índice da customização **AVA IFRN** no app Moodle Mobile.

**Manual prático de desenvolvimento:** [abrir o guia HTML offline](./index.html).
**Classificação do acervo:** [inventário em HTML](./INVENTARIO-DOCUMENTACAO.html) · fonte Markdown: `INVENTARIO-DOCUMENTACAO.md`.

Tudo que é específico do IFRN vive em `src/MoodleIFRN/` (login, serviços, painel e tema), com o mínimo de alteração no núcleo do Moodle.

## Comece por aqui

Para passos de instalação e compilação, use o [manual HTML offline](./index.html). O script de reaplicação IFRN modifica pontos de integração do núcleo; consulte o escopo e revise o diff em [PATCH-AO-ATUALIZAR.md](./PATCH-AO-ATUALIZAR.md) antes de executá-lo.

| Documento | Conteúdo |
|-----------|----------|
| [VISAO-GERAL.md](./VISAO-GERAL.md) | Arquitetura, fluxo do usuário e status do projeto |
| [Ponte Painel AVA → Moodle](./PONTE-PAINEL-MOODLE.html) | SUAP → Painel AVA → sessão Moodle Mobile |
| [Atualização e patches](./PATCH-AO-ATUALIZAR.html) | Reaplicar o módulo após atualizar o Moodle Mobile |
| [Publicação beta na Google Play](./PLAY-STORE-BETA.html) | Criar a ficha Moodle IFRN e publicar um teste beta na Google Play |
| [DESEMPENHO-PAINEL-2026-10-26.md](./DESEMPENHO-PAINEL-2026-10-26.md) | Reduzir gravações repetidas e recargas desnecessárias do Painel |

## Login e autenticação

| Documento | Conteúdo |
|-----------|----------|
| [Login IFRN](./LOGIN-IFRN.html) | Tela de login IFRN |
| [Autenticação e biometria](./SERVICOS-AUTH-BIOMETRIA.html) | `AuthService` + biometria |
| [Contrato da API](./CONTRATO-API.html) | Endpoints e payloads esperados |
| [Segurança](./SEGURANCA.html) | Medidas de segurança no cliente |

## Painel de cursos (mobilemoodle)

| Documento | Conteúdo |
|-----------|----------|
| [Painel de cursos](./PAINEL-CURSOS.html) | SPA do painel, rotas e integração |
| [../mobilemoodle/core_mobile/SCRIPTS-TS.md](../mobilemoodle/core_mobile/SCRIPTS-TS.md) | Módulos TypeScript (`core_mobile/`) |
| [Templates HTML](./TEMPLATES-HTML.html) | Partials HTML e shell do `index.html` |
| [Tema visual](./TEMA-VISUAL.html) | SCSS/CSS, header AVA, safe-area, responsividade |

## Páginas HTML locais disponíveis

As páginas abaixo compartilham o CSS e JavaScript do manual e funcionam abertas diretamente em `file://`:

| Página HTML | Fonte Markdown preservada |
|-------------|---------------------------|
| [INVENTARIO-DOCUMENTACAO.html](./INVENTARIO-DOCUMENTACAO.html) | [INVENTARIO-DOCUMENTACAO.md](./INVENTARIO-DOCUMENTACAO.md) |
| [PONTE-PAINEL-MOODLE.html](./PONTE-PAINEL-MOODLE.html) | [PONTE-PAINEL-MOODLE.md](./PONTE-PAINEL-MOODLE.md) |
| [LOGIN-IFRN.html](./LOGIN-IFRN.html) | [LOGIN-IFRN.md](./LOGIN-IFRN.md) |
| [PAINEL-CURSOS.html](./PAINEL-CURSOS.html) | [PAINEL-CURSOS.md](./PAINEL-CURSOS.md) |
| [SEGURANCA.html](./SEGURANCA.html) | [SEGURANCA.md](./SEGURANCA.md) |
| [PATCH-AO-ATUALIZAR.html](./PATCH-AO-ATUALIZAR.html) | [PATCH-AO-ATUALIZAR.md](./PATCH-AO-ATUALIZAR.md) |
| [README.html](./README.html) | [README.md](./README.md) |
| [ENTRADA-DIRETA-SUAP.html](./ENTRADA-DIRETA-SUAP.html) | [ENTRADA-DIRETA-SUAP.md](./ENTRADA-DIRETA-SUAP.md) |
| [SERVICOS-AUTH-BIOMETRIA.html](./SERVICOS-AUTH-BIOMETRIA.html) | [SERVICOS-AUTH-BIOMETRIA.md](./SERVICOS-AUTH-BIOMETRIA.md) |
| [TEMA-VISUAL.html](./TEMA-VISUAL.html) | [TEMA-VISUAL.md](./TEMA-VISUAL.md) |
| [TEMPLATES-HTML.html](./TEMPLATES-HTML.html) | [TEMPLATES-HTML.md](./TEMPLATES-HTML.md) |
| [TROCAR-IMAGEM-ABERTURA-ANDROID.html](./TROCAR-IMAGEM-ABERTURA-ANDROID.html) | [TROCAR-IMAGEM-ABERTURA-ANDROID.md](./TROCAR-IMAGEM-ABERTURA-ANDROID.md) |
| [LOGO-MOODLE-IFRN.html](./LOGO-MOODLE-IFRN.html) | [LOGO-MOODLE-IFRN.md](./LOGO-MOODLE-IFRN.md) |
| [CONTRATO-API.html](./CONTRATO-API.html) | [CONTRATO-API.md](./CONTRATO-API.md) |
| [apis-e-endpoints.html](./apis-e-endpoints.html) | [apis-e-endpoints.md](./apis-e-endpoints.md) |
| [PLAY-STORE-BETA.html](./PLAY-STORE-BETA.html) | [PLAY-STORE-BETA.md](./PLAY-STORE-BETA.md) |

Os relatórios de execução e documentos históricos permanecem apenas em Markdown por enquanto.

## Scripts úteis

Ferramentas CJS de diagnóstico e verificações simuladas: [`../diagnosticos/README.md`](../diagnosticos/README.md).

```bash
# Registrar / reparar rotas IFRN no Moodle Mobile
npm run patch:ifrn

# Compilar TypeScript e SCSS do painel → mobilemoodle.js (sem pasta css do tema)
npm run build:mobilemoodle
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
