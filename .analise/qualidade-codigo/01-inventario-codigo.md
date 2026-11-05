# Inventário, baseline e métricas

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

## Estado real e preservação

- Árvore inicialmente limpa; nenhuma mudança de branch, fetch, merge, commit ou push foi executada.
- `origin/erro-fluxo` local aponta para `7925a4c6`, dez commits à frente. `release/2.0.1` local aponta para `0ba7bc2e7`. São referências locais; não foi consultado o estado atual do GitHub.
- A baseline atual é anterior às correções de desempenho e ao hook Android de User-Agent presentes nessas referências. O diagnóstico **não afirma que essas correções foram perdidas ou que faltam na release**.
- Não havia estes oito relatórios no checkout. Foram examinados `docs/README.md`, `VISAO-GERAL.md`, `SEGURANCA.md`, `PATCH-AO-ATUALIZAR.md`, `SESSOES-E-DJANGO-NINJA-2026-10-20.md`, `SSO-CURSOS-LOGIN-UNICO-2026-10-26.md` e inventário de estilos em `theme/dsgov-auditoria/`.
- Também foi lido, via `git show`, o relatório anterior `.analise/estrategia-testes-baseline.md` em `origin/erro-fluxo`. Ele pertence a outra revisão/ambiente. Seus 94 casos e números de build não foram reutilizados como resultados desta auditoria. Não foi sobrescrito.
- Arquivos novos desta execução ficam apenas nesta pasta. Nenhum fonte de produção, asset, configuração, dependência, `src/core/` ou `src/addons/` foi modificado. Não houve rebuild/instalação/limpeza de dados no aparelho.

## Universo e metodologia

Há **3.123 caminhos rastreados** sob `src/MoodleIFRN` e **3.161 arquivos físicos** no levantamento, incluindo entradas ocultas/ignoradas. Não confundir a saída padrão de `rg --files` com todos os arquivos físicos.
Foram contabilizadas extensões `.ts`, `.js`, `.cjs`, `.mjs`, `.html`, `.scss`, `.css`. LOC física inclui comentários e espaços; coluna não vazia elimina só linhas em branco. Binários não têm LOC. Documentação/diagnósticos têm métricas de código somente nessas extensões, não contagem de prosa Markdown.

| Categoria física | Arquivos | Bytes | Linhas de código físicas | Não vazias |
| --- | --- | --- | --- | --- |
| fonte-autoral | 84 | 883944 | 22779 | 20299 |
| documentacao-e-diagnosticos | 218 | 7719829 | 7345 | 6870 |
| recurso-ou-outro | 21 | 1291742 | 0 | 0 |
| bundle-gerado | 2 | 157975 | 5330 | 5059 |
| dsgov-copiado | 2 | 11198 | 324 | 284 |
| vendor | 2816 | 2654872 | 385 | 385 |
| testes | 18 | 76588 | 1455 | 1395 |

Total físico: **12.796.148 bytes**, **37.618 linhas** nas extensões acima. Código autoral candidato a manutenção: **84 arquivos, 22.779 linhas, 20.299 não vazias**. Dentro disso, **2.818 linhas de `ifrn-language.ts`** incluem um catálogo de tradução: não representam 2.818 linhas de lógica complexa. Inventários SCSS/CSS de auditoria, vendor e bundles gerados ficam separados; não são alvos automáticos de remoção.

| Diretório/arquivo raiz | Arquivos totais | Linhas nas extensões de código | Bytes totais |
| --- | --- | --- | --- |
| build-native.mjs | 1 | 44 | 2619 |
| docs | 60 | 1067 | 893479 |
| ifrn-login | 2 | 21 | 839 |
| marketplace-ifrn | 3 | 936 | 31376 |
| mobilemoodle | 2876 | 15596 | 3848367 |
| moodle-course | 7 | 2086 | 73158 |
| moodle-open-course | 3 | 1024 | 33279 |
| navigation | 9 | 314 | 12273 |
| painel | 3 | 283 | 10221 |
| painel-enrol | 3 | 78 | 3417 |
| patch-moodle-ifrn.js | 1 | 477 | 19467 |
| resources | 4 | 0 | 558349 |
| scripts | 1 | 48 | 2772 |
| services_mobile | 11 | 7794 | 399535 |
| tests | 18 | 1455 | 76588 |
| theme | 159 | 6395 | 6830409 |

## Arquivos maiores

| Arquivo autoral | LOC físicas | Bytes |
| --- | --- | --- |
| src/MoodleIFRN/services_mobile/ifrn-language.ts | 2818 | 196965 |
| src/MoodleIFRN/services_mobile/moodle-site.service.ts | 2337 | 91177 |
| src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/painel.scss | 2214 | 52009 |
| src/MoodleIFRN/services_mobile/painel-ava.service.ts | 1407 | 61179 |
| src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts | 898 | 32214 |
| src/MoodleIFRN/moodle-course/moodle-course.scss | 828 | 28026 |
| src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.scss | 536 | 13780 |
| src/MoodleIFRN/mobilemoodle/core_mobile/api-suap.ts | 485 | 13188 |
| src/MoodleIFRN/moodle-open-course/moodle-open-course.ts | 478 | 17097 |
| src/MoodleIFRN/patch-moodle-ifrn.js | 477 | 19467 |
| src/MoodleIFRN/moodle-open-course/moodle-open-course.scss | 427 | 10593 |
| src/MoodleIFRN/mobilemoodle/static/theme/ifrn/scss/_accessibility.scss | 416 | 10057 |

## Instrumentos e resultados

- AST TypeScript: **695 funções/callbacks**. CC aproximada = 1 + decisões `if`, loops, `case`, `catch`, ternário e operadores `&&`, `||`, `??`, sem contar funções aninhadas na função externa. **11 funções com CC aproximada ≥20**. Profundidade máxima de nós de controle: **5**. Isso não equivale à complexidade cognitiva Sonar.
- ESLint instalado, regra **`complexity` clássica**, análise adicional independente em 45 arquivos TS: **54 funções acima de 10**, **14 com complexidade ≥20**. Considera também detalhes de sintaxe que a aproximação AST não soma; a aproximação inclui JS dos scripts, enquanto esta medição está restrita a TS. Não misturar as contagens. Saída: `complexidade-eslint.json`.
- Dependências: imports estáticos e `import()` com string literal. Não incluem DI indireta, globais, templates, eventos e conteúdo injetado em IAB. Grafo estático está em `artefatos-estilos.json`.
- Complexidade cognitiva padronizada: **não medida**; ferramenta correspondente não instalada. Não foi inventado índice substituto.
- Duplicação exata TS/JS: **328 posições de tokens** em janelas repetidas, entre **50.260 tokens** analisados; dois blocos. Detector conservador, janela de 80 tokens, passo 1, sem comentários; sem normalização de nomes/literais. Detalhes em 02.
- TypeScript API com `noEmit`, `noUnusedLocals` e `noUnusedParameters`: **zero erros de compilação fora dos diagnósticos de não uso**; **12 diagnósticos de não uso no IFRN** e 541 fora do escopo, não tratados.
- ESLint existente, sem `--fix`: **45 arquivos TS**, **6.457 erros e 389 avisos**. **5.590 ocorrências são de aspas**, concentradas no catálogo. Não interpretar isso como 6.457 bugs. Há 12 achados de não uso, dois imports duplicados e dois `return` em `finally` que merecem análise funcional.
- **80 testes aprovados, zero falhas**, em 17 arquivos Node; não representam cobertura percentual nem aprovação de todos os fluxos reais.
- `build-native.mjs --platform=android --check`: catálogo com **2.795 entradas** validado; nenhum arquivo gerado.

## Evidências e limites

Métricas completas por arquivo/função: [metricas.json](evidencias/metricas.json). Lint: [eslint.json](evidencias/eslint.json). Diagnósticos sem emissão: [typescript.json](evidencias/typescript.json). Execução de testes: [testes.json](evidencias/testes.json), [TAP](evidencias/testes.tap). Comandos: [comandos.md](evidencias/comandos.md).
Não foi executado build de produção, Jest completo, cobertura de fontes, teste iOS real nem login/troca de conta no dispositivo. Esses itens continuam pendentes no plano de regressão.
