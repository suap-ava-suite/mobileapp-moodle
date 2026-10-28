# Documentação MoodleIFRN

Índice da customização **AVA IFRN** no app Moodle Mobile.

Tudo que é específico do IFRN vive em `src/MoodleIFRN/` (login, serviços, painel e tema), com o mínimo de alteração no núcleo do Moodle.

## Comece por aqui

| Documento | Conteúdo |
|-----------|----------|
| [VISAO-GERAL.md](./VISAO-GERAL.md) | Arquitetura, fluxo do usuário e status do projeto |
| [PONTE-PAINEL-MOODLE.md](./PONTE-PAINEL-MOODLE.md) | SUAP → Painel AVA → sessão Moodle Mobile |
| [PATCH-AO-ATUALIZAR.md](./PATCH-AO-ATUALIZAR.md) | Reaplicar o módulo após atualizar o Moodle Mobile |
| [PLAY-STORE-BETA.md](./PLAY-STORE-BETA.md) | Criar a ficha Moodle IFRN e publicar um teste beta na Google Play |
| [DESEMPENHO-PAINEL-2026-10-26.md](./DESEMPENHO-PAINEL-2026-10-26.md) | Reduzir gravações repetidas e recargas desnecessárias do Painel |

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
# Executar somente os testes Node da customização IFRN (sem ADB/aparelho)
npm run test:ifrn

# Suíte Jest e gulp do repositório
npm test

# Registrar / reparar rotas IFRN no Moodle Mobile
npm run patch:ifrn

# Compilar TypeScript e SCSS do painel → mobilemoodle.js (sem pasta css do tema)
npm run build:mobilemoodle
```

`npm run test:ifrn` executa os arquivos `*.test.cjs` e `*.test.mjs` em `src/MoodleIFRN/tests/` usando o runner nativo `node:test`. O probe `painel-first-paint.android.mjs` é excluído por não ter o sufixo `.test` e requer um alvo CDP Android. Os testes da suíte IFRN usam fakes/fixtures; esse comando não valida rede institucional nem substitui testes no aparelho. Jest segue configurado para `*.test.ts` e não coleta esses arquivos Node.

## Recursos nativos (ícone / splash)

Assets oficiais do Painel AVA para o build Cordova:

| Arquivo | Uso | Tamanho |
|---------|-----|---------|
| `../resources/icon.png` (se presente) / `resources/` na raiz | Ícone do app | 1024×1024 |
| Splash Cordova | Splash screen | ver `config.xml` |

Identidade: fundo teal `#098E95` + marca branca do Painel AVA (`theme_ifrn25`).

Favicons e splash **web** do painel:

`mobilemoodle/static/theme/ifrn/favicon/` e `…/img/splash-logo.png`.
