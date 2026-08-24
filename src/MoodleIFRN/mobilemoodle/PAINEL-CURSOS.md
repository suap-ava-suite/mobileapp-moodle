# Painel de cursos (mobilemoodle)

Painel web do AVA IFRN embutido no app Moodle Mobile.

É uma SPA leve (HTML + JavaScript + Ionic via CDN), **não** é um módulo Angular.  
No build, a pasta é copiada para `mobilemoodle/` (configurado no `angular.json`).

URL típica após o login:

```text
…/mobilemoodle/index.html#/painel
```

---

## Estrutura

```text
mobilemoodle/
├── index.html          ← shell (menu, toolbar, área de conteúdo)
├── notfound.html       ← página estática auxiliar
├── pages/              ← templates HTML carregados sob demanda
│   ├── painel.html     ← lista de cursos
│   ├── curso.html      ← detalhe do curso
│   └── erros.html      ← telas de erro / not found
├── js/                 ← lógica (ver js/SCRIPTS-JS.md)
└── static/theme/ifrn/
    ├── css/painel.css  ← CSS compilado usado pelo index
    ├── scss/           ← fontes SCSS do tema
    └── img/            ← ícones e imagens do tema
```

---

## Rotas (hash)

| Hash | Tela |
|------|------|
| `#/painel` | Lista de cursos do estudante |
| `#/curso/{id}` | Detalhe do curso (`id` numérico) |
| qualquer outra | Página “não encontrada” |

O roteamento está em `js/app-router.js`.

---

## Telas e estados

| Estado | Quando aparece |
|--------|----------------|
| Loading | Enquanto busca dashboard/curso |
| Painel | Dashboard carregado |
| Curso | Curso carregado |
| Erro 401/403 | Sem token ou sessão inválida |
| Erro 5xx / rede / timeout | Falha na API |
| Not found | Rota inválida ou recurso 404 |

Há **pull-to-refresh** no painel (componente Ionic).

---

## Tema visual

O visual segue a identidade do AVA IFRN (cores, cards de curso, progresso, menu).

- Variáveis e partials: `static/theme/ifrn/scss/`
- CSS servido: `static/theme/ifrn/css/painel.css`

---

## Integração com o login

1. `AuthService` autentica e grava o JWT no `sessionStorage`
2. Navega para `mobilemoodle/index.html#/painel`
3. `api-auth.js` lê o token e as chamadas HTTP usam `Authorization: Bearer …`

Documentação dos scripts: [`js/SCRIPTS-JS.md`](./js/SCRIPTS-JS.md)

---

## API consumida pelo painel

| Recurso | Método | Path |
|---------|--------|------|
| Dashboard (usuário + cursos) | `GET` | `/dashboard/` |
| Detalhe do curso | `GET` | `/courses/{id}` |

Base em desenvolvimento (localhost): `http://localhost:8000`  
Fora do localhost: mesma origem da página.

Detalhes do contrato: [`../CONTRATO-API.md`](../CONTRATO-API.md)
