# Painel de cursos (`mobilemoodle`)

O Painel é uma SPA local (HTML + TypeScript + CSS) incluída como asset do app.
Não é uma página Angular. A implementação e o fluxo de abertura nativa estão
descritos aqui; contratos antigos de JWT/FastAPI ficam em
[CONTRATO-API.md](./CONTRATO-API.md) e não representam o fluxo normal atual.

## Entrada e navegação

O shell é `mobilemoodle/index.html`; o bundle `mobilemoodle.js` é carregado com
`defer`. O roteador usa hash:

| Rota | Comportamento |
|---|---|
| `#/painel` | Lista as categorias de cursos recebidas do Painel AVA |
| `#/curso/{id}` | Fallback local de resumo; não substitui a página nativa do curso |
| outra rota | Estado de rota não encontrada |

No fluxo normal, o toque no card chama `App.openMoodleCourse()` e a ponte entrega
ID e ambiente a `PainelPage`. O app então usa `MoodleSiteService` e o roteador
nativo do Moodle Mobile. O Painel não monta as atividades reais dentro da view
local nem redireciona um curso mock para um AVA real.

## Dados e sessão

1. `SuapEntryService` obtém a sessão web do Painel por meio do InAppBrowser.
2. `PainelAvaService` consulta `/api/v1/diarios/` na própria origem do Painel,
   usando os cookies dessa sessão e exigindo JSON válido.
3. O perfil é associado à identidade confirmada. O dashboard é mantido em
   `sessionStorage` com verificação do proprietário da conta.
4. `api.ts` usa os dados do Painel para cartões e IDs Moodle. Sem sessão/dados do
   Painel, a função atual não substitui silenciosamente esses cursos por diários
   SUAP, pois os IDs podem representar recursos diferentes.
5. Ao abrir, a sessão nativa do Moodle precisa corresponder ao usuário e ao
   ambiente do curso; quando necessário, o curso fica pendente durante OAuth e
   é retomado pelo callback.

O Painel não recebe `wstoken` a partir do token SUAP ou de um token próprio do
Painel. A autenticação do Moodle e a sessão web do Painel são mecanismos
distintos. Consulte [Ponte Painel → curso nativo](./PONTE-PAINEL-MOODLE.md).

## Estrutura

```text
mobilemoodle/
├── index.html                 shell e templates
├── mobilemoodle.ts            entrada da SPA
├── build.mjs                  bundle esbuild e sincronização de vendor
├── core_mobile/               API, navegação, views, acessibilidade e estado
├── pages/                     templates do Painel e fallback local
└── static/theme/ifrn/         tema, imagens e ícones
```

O HTML carrega Ionic e Ionicons de `static/vendor/`; `build.mjs` copia os assets
das dependências para essa pasta. A pasta também é copiada pelo build Angular
para `www/mobilemoodle/`.

| Arquivo/módulo | Responsabilidade |
|---|---|
| `core_mobile/api-painel.ts` | Lê e normaliza dados do Painel e perfil |
| `core_mobile/api.ts` | Cache do dashboard/curso e fachada da UI |
| `core_mobile/app-router.ts` | Resolução das rotas hash e carregamento de views |
| `core_mobile/app-views.ts` | Renderização do Painel e fallback de resumo |
| `core_mobile/app-utils.ts` | Ponte para abertura de curso e utilitários |
| `core_mobile/app-accessibility.ts` / `app-keyboard.ts` | Preferências e viewport/teclado |

## Compilar e testar

```bash
npm run build:mobilemoodle
npm run test:ifrn
```

O primeiro comando recompila `mobilemoodle.js`, `mobilemoodle.css` e sincroniza
os assets locais. Os testes são simulados; não validam cookies institucionais,
curso real ou comportamento de um Android. Para o fluxo completo, consulte
[SSO de cursos](./SSO-CURSOS-LOGIN-UNICO-2026-10-26.md) e os relatórios
[históricos](./README.md#relatórios-históricos).
