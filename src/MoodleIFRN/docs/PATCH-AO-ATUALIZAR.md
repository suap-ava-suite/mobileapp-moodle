# Reaplicar MoodleIFRN após atualizar o Moodle

Quando o Moodle Mobile é atualizado (a cada ~3 anos), arquivos do núcleo são sobrescritos.  
A pasta `MoodleIFRN` fica intacta — basta copiá-la para `src/` e rodar o script de patch.

## O que o script faz

Arquivo: [`patch-moodle-ifrn.js`](./patch-moodle-ifrn.js)

| Arquivo do Moodle | Alteração |
|-------------------|-----------|
| `src/core/features/login/login.module.ts` | Redirect para `marketplace-ifrn` + rotas `marketplace-ifrn` e `ifrn-login` |
| `angular.json` | Copia `mobilemoodle/` para o build |
| `gulpfile.js` | Compila TypeScript do painel (`mobilemoodle-ts`) |
| `package.json` | Scripts `patch:ifrn` e `build:mobilemoodle` |

O script é **idempotente**: pode rodar várias vezes sem duplicar rotas.

## Como usar

Depois de atualizar o Moodle e copiar a pasta `MoodleIFRN` para `src/`:

```bash
npm run patch:ifrn
npm run build:mobilemoodle
```

Ou diretamente:

```bash
node src/MoodleIFRN/patch-moodle-ifrn.js
```

## Rotas registradas em `login.module.ts`

O Moodle usa `loadChildren` com um array de rotas filhas em `login.module.ts`.  
O patch altera o redirect padrão e adiciona as páginas IFRN:

```text
/login                    → redirect para marketplace-ifrn
/login/marketplace-ifrn   → tela inicial IFRN (marketplace)
/login/ifrn-login         → login com IFRN-id
```

Componentes importados de `@/MoodleIFRN/...` (não alteram o core do Moodle).

### O que o script grava no arquivo

1. **Redirect** — troca `redirectTo: 'sites'` por `redirectTo: 'marketplace-ifrn'`
2. **Rotas** — insere logo após o redirect:

```typescript
// BEGIN MoodleIFRN login routes
{
    path: 'marketplace-ifrn',
    loadComponent: () =>
        import('@/MoodleIFRN/marketplace-ifrn/marketplace-ifrn')
            .then(m => m.MarketplaceIfrnPage),
},
{
    path: 'ifrn-login',
    loadComponent: () =>
        import('@/MoodleIFRN/ifrn-login/ifrn-login')
            .then(m => m.IfrnLoginPage),
},
// END MoodleIFRN login routes
```

## Marcadores no código

O patch insere comentários `// BEGIN MoodleIFRN login routes` e `// END MoodleIFRN login routes` em `login.module.ts` para facilitar reaplicação e revisão em futuras atualizações.
