# Scripts JS do painel

Scripts do painel. Cada arquivo tem uma responsabilidade.  
Todos usam o namespace global `window.MobileMoodle` (e a fachada `window.MobileMoodleApi`).

Ordem de carga no `index.html`:

```text
api-errors.js → api-auth.js → api-http.js → api.js
app-utils.js  → app-status.js → app-views.js → app-router.js → app.js
```

---

## Camada de API

| Arquivo | Função |
|---------|--------|
| `api-errors.js` | Classe `ApiError` + títulos/mensagens por status HTTP |
| `api-auth.js` | JWT: ler, validar, salvar, limpar (`sessionStorage`) |
| `api-http.js` | `fetch` autenticado, timeout 15s, base URL segura |
| `api.js` | `getDashboard` / `getCourse` + cache em memória (TTL 1 min) |

### Cache

- Dashboard: um payload por sessão, válido por **60 segundos**
- Cursos: até **40** entradas no `Map`, mesmo TTL
- `invalidateCache()` zera tudo (logout / refresh forçado)

Flag `DEMO_FORCE_500` em `api.js`: quando `true`, força erro 500 no painel (só para demonstração). Deve ficar `false` no uso normal.

---

## Camada de UI / app

| Arquivo | Função |
|---------|--------|
| `app-utils.js` | Base de assets, `escapeHtml`, templates, `fetchText` |
| `app-status.js` | Loading, tela de erro, not found |
| `app-views.js` | Render do painel e do curso |
| `app-router.js` | Parse do hash + orquestra carregamento |
| `app.js` | Bootstrap: DOM, menu, base da API, `hashchange` |

---

## API pública (`MobileMoodleApi`)

Exposta por `api.js` para o restante do app:

| Método | Descrição |
|--------|-----------|
| `setApiBaseUrl(url)` | Define origem da API (só mesma origem ou localhost) |
| `getToken()` / `setToken()` / `clearToken()` | Sessão JWT |
| `getDashboard(force?)` | Dados do painel |
| `getCourse(id, force?)` | Detalhe do curso |
| `getCoursesList()` | Atalho: só a lista de cursos |
| `invalidateCache()` | Limpa caches |

---

## Segurança relevante nestes arquivos

- Token validado (formato + `exp` se existir)
- Token removido da query string se vier por `?token=`
- Paths da API precisam ser relativos seguros (`/…`)
- Base da API não aceita URL arbitrária via query
- Textos da API passam por `escapeHtml` / `textContent` na UI
- Headers de autenticação não são sobrescritos por opções externas

Mais detalhes: [`../../SEGURANCA.md`](../../SEGURANCA.md)
