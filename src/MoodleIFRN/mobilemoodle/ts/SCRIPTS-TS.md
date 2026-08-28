# Scripts TypeScript do painel

Código-fonte em `ts/`; o navegador carrega o JavaScript compilado em `js/`.

Cada arquivo tem uma responsabilidade. Todos usam o namespace global `window.MobileMoodle` (e a fachada `window.MobileMoodleApi`).

## Compilar

```bash
npm run build:mobilemoodle
```

Também compila automaticamente ao rodar `ionic serve` ou `ionic build` (tarefa gulp `mobilemoodle-ts`).

A saída vai para `../js/`. **Não apague essa pasta** — o `index.html` carrega os `.js` no navegador; o TypeScript em `ts/` é só o código-fonte.

Ou diretamente:

```bash
npx tsc -p src/MoodleIFRN/mobilemoodle/tsconfig.json
```

## Ordem de carga no `index.html`

```text
api-errors.js → api-auth.js → api-http.js → api.js
app-utils.js  → app-status.js → app-views.js → app-router.js → app-accessibility.js → app-sidebar.js → app.js
```

## Camada de API

| Arquivo | Função |
|---------|--------|
| `api-errors.ts` | Classe `ApiError` + títulos/mensagens por status HTTP |
| `api-auth.ts` | JWT: ler, validar, salvar, limpar (`sessionStorage`) |
| `api-http.ts` | `fetch` autenticado, timeout 15s, base URL segura |
| `api.ts` | `getDashboard` / `getCourse` + cache em memória (TTL 1 min) |

Tipos compartilhados: `ts/global.d.ts`.

### Cache

- Dashboard: um payload por sessão, válido por **60 segundos**
- Cursos: até **40** entradas no `Map`, mesmo TTL
- `invalidateCache()` zera tudo (logout / refresh forçado)

Flag `DEMO_FORCE_500` em `api.ts`: quando `true`, força erro 500 no painel (só para demonstração). Deve ficar `false` no uso normal.

## Camada de UI / app

| Arquivo | Função |
|---------|--------|
| `app-utils.ts` | Base de assets, `escapeHtml`, templates, `fetchText` |
| `app-status.ts` | Loading, tela de erro, not found |
| `app-views.ts` | Render do painel e do curso |
| `app-router.ts` | Parse do hash + orquestra carregamento |
| `app-accessibility.ts` | Preferências AVA: zoom, contraste, VLibras, etc. |
| `app-sidebar.ts` | Sidebar AVA: perfil, acessibilidade, ajuda, filtros |
| `app.ts` | Bootstrap: DOM, menu, base da API, `hashchange` |

## API pública (`MobileMoodleApi`)

Exposta por `api.ts` para o restante do app:

| Método | Descrição |
|--------|-----------|
| `setApiBaseUrl(url)` | Define origem da API (só mesma origem ou localhost) |
| `getToken()` / `setToken()` / `clearToken()` | Sessão JWT |
| `getDashboard(force?)` | Dados do painel |
| `getCourse(id, force?)` | Detalhe do curso |
| `getCoursesList()` | Atalho: só a lista de cursos |
| `invalidateCache()` | Limpa caches |

## Segurança relevante nestes arquivos

- Token validado (formato + `exp` se existir)
- Token removido da query string se vier por `?token=`
- Paths da API precisam ser relativos seguros (`/…`)
- Base da API não aceita URL arbitrária via query
- Textos da API passam por `escapeHtml` / `textContent` na UI
- Headers de autenticação não são sobrescritos por opções externas

Mais detalhes: [`../../SEGURANCA.md`](../../SEGURANCA.md)
