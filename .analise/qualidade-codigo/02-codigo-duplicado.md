# Duplicações e oportunidades de unificação

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

## Duplicação comprovada e seu limite

| ID | Localização | Evidência | Recomendação | Risco |
|---|---|---|---|---|
| D01 | `services_mobile/auth.service.ts:72` e `painel-ava.service.ts:172` | Janela exata de 81 tokens da decodificação JWT | Primeiro verificar o ramo morto do Painel; eliminar o ramo sem uso antes de criar novo helper | Baixo para código morto comprovado; alto se alterar validação ativa |
| D02 | `auth.service.ts:85` e `painel-ava.service.ts:184` | Janela de 83 tokens de validação de formato/expiração | Mesma estratégia; o validador do Painel não tem chamadores no checkout | Baixo após testes e checagem de alcance |
| D03 | `mobilemoodle/static/theme/ifrn/scss/painel.scss:1` e `theme/dsgov-auditoria/rodada-fluxo-20261018/painel-verificacao.css:1` | Arquivos byte a byte iguais: 52.009 bytes/2.214 linhas | Manter a evidência histórica fora de métricas de produção; eventual arquivamento separado | Baixo para organização; não apagar prova histórica sem aprovação |
| D04 | `AuthService.logout:343`, `api-auth.ts:125` e `SuapEntryService.commit:346` | Inventários de chaves de sessão escritos à mão; alguns nomes divergem dos usados no serviço Moodle | Um catálogo puro de chaves atuais/legadas e operações explícitas de limpeza, com testes de migração | Alto: logout e isolamento de contas |
| D05 | `build-native.mjs:16` e `scripts/build-android-web.cjs:32` | Duas leituras AST do catálogo e publicação de `pt-br.json`; os scripts diferem em `gulp env`, validações e plataformas | Extrair só leitura/validação do catálogo e definir um ponto documentado de build | Médio; não tratar como scripts equivalentes hoje |
| D06 | `navigation/handoff-loading.ts:13` e `:22` | Ambos removem o mesmo elemento/classe; `hide` ainda remove chave persistida | Explicitar intenção de compatibilidade; não unir ignorando a limpeza adicional | Médio |

As janelas TS/JS cobrem 328 tokens, contando as duas ocorrências de cada bloco. **Isso não é uma taxa geral de duplicação do projeto**: o detector ignora strings de scripts injetados, HTML/SCSS e cópias com nomes/formatos diferentes. As linhas exatas dos blocos estão em `evidencias/metricas.json`.

## Semelhança que não autoriza unificação automática

- `course-target.ts:2` rejeita origem não confirmada e pode retornar `undefined`; `moodle-site.service.ts:164` tem fallback para o Presencial. Trocar um pelo outro muda contrato e pode selecionar o ambiente errado.
- `profileIdentity`, `panelIdentity`, comparadores SUAP/Moodle e seleção de conta salva lidam com fontes e prioridades diferentes. Um nome igual não prova identidade. Unificar só após uma tabela de equivalência com casos de matrícula, CPF, usuário, ausência de campos e conflito de ambiente.
- `CoreNavigator`, Angular Router e o bridge iframe têm responsabilidades distintas. Chamadas parecidas de navegação não são automaticamente repetição desnecessária.
- `MM`/`App` e interfaces em `global.d.ts` viabilizam registro por efeitos colaterais. Uma função atribuída a esses objetos pode ser usada sem import nominal.

## Estilos

Na fonte ativa `painel.scss` há **59 cabeçalhos de seletor repetidos**, por exemplo `.ava-toolbar` nas linhas 272/1757/1959, `.ava-toolbar-inner` em 283/1760/1962 e `:root` em 49/135/231/264. Isso indica camadas de overrides, não 59 regras descartáveis.

Uma segunda análise PostCSS comparou seletor, contexto de at-rule e lista ordenada de declarações. Encontrou **zero blocos inteiros idênticos no `painel.scss`**. Consolidar requer respeitar cascata, media queries, dark mode e acessibilidade; não foi estimada redução de bytes sem recompor essas regras.

Fontes Rawline e tokens são definidos na shell Angular e no iframe. As duas árvores documentais não compartilham CSS automaticamente: preservar a disponibilidade nas duas. É possível gerar ambos a partir de tokens comuns, sem remover uma das aplicações.

Os parciais `_cards.scss`, `_sidebar.scss`, `_global.scss` e outros coexistem com `painel.scss` achatado. O build atual compila diretamente `painel.scss`; ausência de `@use` nele indica risco de duas fontes editoriais divergentes. Antes de arquivar parciais, rastrear scripts históricos e definir qual fonte deve ser editada. A inspeção não prova que todos sejam lixo.

## Ordem sugerida

### Qualidade SCSS, escopo e responsividade

- As fontes autorais somam **136 ocorrências de `!important`**: 51 em `painel.scss`, 43 em `moodle-course.scss`, 40 em `_accessibility.scss` e duas em outros arquivos. Nem todas vão para o mesmo bundle. As regras de acessibilidade/inline de terceiros justificam parte delas; retirar em lote é arriscado.
- `moodle-course.scss:229–282` depende de `core-tabs-outlet`, `.core-tabs-bar`, `swiper-slide.selected` e `aria-selected`. Mudança interna do Moodle pode invalidar esses seletores sem erro de compilação. Preferir tokens e partes públicas quando houver equivalente; preservar fallback até validar no dispositivo.
- Seletores globais como `page-core-course-index` não exigem origem IFRN. Confirmar a intenção de aplicar o tema a todo curso antes de restringir escopo; não fazer isso silenciosamente.
- Há media queries no curso (`:492`, até 767px), no Painel (até 480px) e no Marketplace (`:354`, 360px; `:375`, tablet/landscape; `:494/499`, mobile e landscape). Sua presença não certifica responsividade. Testar texto ampliado, teclado, orientação, telas estreitas, claro/escuro e safe-area.
- `MarketplaceIfrnPage:17` já reutiliza o SCSS da ponte além do próprio. Não propor componente/abstração adicional só para repetir essa reutilização já existente.
- O catálogo de tokens Angular e o do iframe usam prefixos diferentes e têm cores sobrepostas. Uma geração compartilhada pode reduzir divergência editorial; cada documento ainda precisa receber suas variáveis. Nenhuma cor, espaçamento ou identidade visual foi alterada.

1. Eliminar apenas os ramos mortos locais certificados, evitando abstração JWT sem consumidor.
2. Caracterizar inventários de sessão antes de centralizá-los.
3. Unificar utilitários puros de build com saídas comparadas.
4. Consolidar estilos por família de componentes com diff visual e de CSS compilado.
5. Revisar contratos de domínio/identidade apenas na fase de risco alto.

Evidências: `metricas.json`, `artefatos-estilos.json`, `typescript.json`, `provas-isoladas.json`. Nenhuma dessas sugestões foi aplicada.
