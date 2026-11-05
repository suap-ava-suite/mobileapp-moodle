import json
from pathlib import Path

out = Path('.analise/qualidade-codigo')
m = json.loads((out/'evidencias/metricas.json').read_text(encoding='utf8'))
a = json.loads((out/'evidencias/artefatos-estilos.json').read_text(encoding='utf8'))
classic = json.loads((out/'evidencias/complexidade-eslint.json').read_text(encoding='utf8'))['rows']
def table(headers, rows):
    return '\n'.join(['| '+' | '.join(headers)+' |', '| '+' | '.join(['---']*len(headers))+' |'] + ['| '+' | '.join(str(v) for v in row)+' |' for row in rows])
def write(name, title, body):
    (out/name).write_text(f'# {title}\n\nData: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.\n\n'+body.strip()+'\n', encoding='utf8')

inventory = table(['Categoria física', 'Arquivos', 'Bytes', 'Linhas de código físicas', 'Não vazias'],
                  [[r['name'],r['files'],r['bytes'],r['lines'],r['nonblank']] for r in m['categories']])
dirs = table(['Diretório/arquivo raiz', 'Arquivos totais', 'Linhas nas extensões de código', 'Bytes totais'],
             [[r['name'].replace('src/MoodleIFRN/',''),r['files'],r['lines'],r['bytes']] for r in m['directories']])
largest = table(['Arquivo autoral', 'LOC físicas', 'Bytes'],[[r['file'],r['lines'],r['bytes']] for r in sorted([r for r in m['files'] if r['category']=='fonte-autoral'],key=lambda r:r['lines'],reverse=True)[:12]])
write('01-inventario-codigo.md','Inventário, baseline e métricas',f'''
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

{inventory}

Total físico: **12.796.148 bytes**, **37.618 linhas** nas extensões acima. Código autoral candidato a manutenção: **84 arquivos, 22.779 linhas, 20.299 não vazias**. Dentro disso, **2.818 linhas de `ifrn-language.ts`** incluem um catálogo de tradução: não representam 2.818 linhas de lógica complexa. Inventários SCSS/CSS de auditoria, vendor e bundles gerados ficam separados; não são alvos automáticos de remoção.

{dirs}

## Arquivos maiores

{largest}

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
''')

write('02-codigo-duplicado.md','Duplicações e oportunidades de unificação','''
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
''')

write('03-codigo-desnecessario.md','Possíveis remoções, alcance e risco','''
## Remoções com evidência forte

O compilador e o ESLint concordam em 12 símbolos sem uso. A busca foi feita em `src`, nos testes, nas rotas e nos scripts relevantes; não apenas em um único arquivo.

| Item | Localização | Evidência | Quantidade/risco |
|---|---|---|---|
| Import `CoreLang` | `marketplace-ifrn.ts:8`, `auth.service.ts:17` | TS6133; nenhuma leitura nesses módulos | 2 bindings; baixo |
| Import `MM` | `app-accessibility.ts:10`, `app-status.ts:9`, `app-utils.ts:11`, `app-views.ts:11`, `app.ts:16` | TS6133; `App` permanece importado do mesmo módulo | 5 bindings; baixo; manter efeitos do módulo |
| `identityFingerprint` | `moodle-site.service.ts:259–274` | Função local não exportada; apenas declaração encontrada; TS6133 | 16 linhas físicas; baixo |
| `isValidPainelToken` | `painel-ava.service.ts:184–202` | Função local sem chamadas; TS6133 | 19 linhas; baixo |
| `describeHttpError` | `painel-ava.service.ts:204–258` | Função local sem chamadas; TS6133 | 55 linhas; baixo |
| `getSafeHttpErrorDiagnostic` | `painel-ava.service.ts:268–301` | Função local sem chamadas; TS6133 | 34 linhas; baixo; não confundir com logs ativos |
| Parâmetro `hash` | `auth.service.ts:371` | Valor ignorado; navegação fixa para `/login/painel` | 1 parâmetro; médio por contrato público e chamador `openMobileMoodle('/painel')` |

**Estimativa justificável:** 124 linhas dos corpos/declaradores das quatro funções locais, sem contar seus comentários externos. O helper `readJwtPayload` de `painel-ava.service.ts:172–182` tem 11 linhas e só alimenta o validador morto: a remoção transitiva chegaria a **135 linhas**, após refazer análise de referências. Sete bindings de import não equivalem a sete linhas inteiras porque alguns imports compartilham `App`. Não há fundamento para prometer milhares de linhas removíveis sem decisão funcional.

`moodle-site.service.ts:1676–1684` contém um segundo `if (!match.hasExpected)` depois do guard de `1668–1670` que já lança erro nessa condição. `match` não é reatribuído e não existe await entre os dois. São mais nove linhas de ramo de diagnóstico inalcançável, risco baixo, preservando o guard inicial. Não somar essa oportunidade a remoções de componentes ainda não comprovadas.

## Candidatos dependentes de contrato

| Item | Localização | Evidência atual | Risco/condição |
|---|---|---|---|
| `changeMoodleAccount`, `continueAccountSwitch` e estado associado | `moodle-open-course.ts:104`, `:113` e template atual | Nenhuma ligação no template atual; métodos públicos ainda existem | Médio; procurar chamadas programáticas, testes e compatibilidade antes de remover |
| `openCourseAccountLogout` | `moodle-site.service.ts:730` | Sem chamador estático encontrado; mantém browser/subscriptions próprios | Médio/alto; possível compatibilidade com integrações |
| `SuapEntryService.login()` | `suap-entry.service.ts:211` | Marketplace usa `loginWithSuap:167`; fluxo alternativo continua ligado a `complete`, estado nativo e guard | Alto; não declarar serviço inteiro obsoleto |
| Renderizador de curso web | `app-views.ts:729`, `app-router.ts:155`, `api.ts:169`, `api-suap.ts:436` | Cards atuais sempre usam curso nativo; rota `#/curso/:id` ainda existe e chama esses métodos dinamicamente | Alto; contrato de links legados e modo standalone precisa ser decidido |
| Handoff desativado | `handoff-loading.ts:9`, `early-course-handoff.js:6`, `moodle-site.service.ts:635` | Predicado retorna sempre false e script early é no-op | Médio; há compatibilidade para remover resíduos de versões anteriores |
| Parciais SCSS antigos | `mobilemoodle/static/theme/ifrn/scss/` | Entrada ativa está achatada; parciais ainda versionados/copied como assets | Médio; mapear autoria, build e referências antes de arquivar |

## O que não remover

- `ifrn-login` tem **rota lazy ativa** em `src/core/features/login/login.module.ts:50`, redireciona links antigos e é chamado pela recuperação Moodle. Não é componente órfão.
- `SuapBrowserService` está injetado; `cancelConnection`, caminhos alternativos e referências por eventos impedem classificá-lo como morto apenas pelo fluxo principal.
- `BiometricService.disable()` é chamado no commit da entrada para não herdar credencial de outra conta. A dependência nativa de biometria não está comprovadamente dispensável.
- `course-menu.html` participa de componente/patch nativo, mesmo sem rota própria. Catálogo de idioma grande não é lógica obsoleta e garante português offline.
- Guardas de identidade, matrícula, origem e isolamento de ambiente não são alvos de redução sem equivalência demonstrada.
- Não remover bibliotecas Moodle por ausência de uso no IFRN: `package.json` tem 83 dependências e 49 devDependencies para o app inteiro. **Zero pacotes foram certificados como removíveis.**

## Comentários e documentação

Há comentários desatualizados, por exemplo login com senha em `VISAO-GERAL.md`/`SEGURANCA.md` e “API ainda mockada” em `app-views.ts:306`, apesar do fluxo de autoinscrição pelo bridge. Isso deve ser atualizado após confirmar contratos, não apagado como código morto.
O link `docs/README.md` para `../ifrn-login/LOGIN-IFRN.md` não corresponde ao arquivo atual `docs/LOGIN-IFRN.md`. Corrigir documentação é uma fase pequena e reversível.

Não foram encontrados componentes certificados como descartáveis. Ausência de referência estática é apenas pista para os candidatos públicos/dinâmicos desta seção.
''')

funcrows = [[f['file'].replace('src/MoodleIFRN/',''),f['name'],f['line'],f['lines'],f['ccApprox'],next((r['complexity'] for r in classic if r['file']==f['file'] and r['line']==f['line']),'não medido neste escopo'),f['maxControlNesting']] for f in m['functions'][:12]]
write('04-complexidade-arquitetura.md','Complexidade, arquitetura e estados',f'''
## Classificação de manutenção

| Nível | Arquivo/módulo | Evidência e responsabilidade |
|---|---|---|
| Crítico | `services_mobile/moodle-site.service.ts` | 2.337 linhas, 31 imports distintos, 36 chamadas diretas a console; identidade, seleção de conta, OAuth, browser, pending course, roteamento, timers, navegação, retorno e recuperação |
| Crítico | `services_mobile/painel-ava.service.ts` | 1.407 linhas; `authenticateWithBrowser:493–1025` ocupa 533 linhas e contém callback de 531 linhas, HTML/scripts injetados, probes, perfil, listas, enrol e persistência |
| Crítico | `services_mobile/course-sso-browser.ts` | 130 linhas, mas ciclo de vida sensível; deadline encerrado antes da aceitação do callback e cancelamento ineficaz nessa fase |
| Alto | `moodle-open-course/moodle-open-course.ts` | 478 linhas; lifecycle Ionic, fallback microtask, estados, versionamento de tentativa, erros e navegação; dois returns em finally |
| Alto | `services_mobile/suap-entry.service.ts` | 399 linhas, 14 imports; entrada web e alternativa nativa, staging/commit/rollback e evento LOGIN |
| Alto | `mobilemoodle/core_mobile/app-views.ts` | 898 linhas; listas, perfil, favoritos, autoinscrição e conteúdo legado de curso no mesmo módulo |
| Alto | `mobilemoodle/static/theme/ifrn/scss/painel.scss` | 2.214 linhas, 59 cabeçalhos repetidos; fonte achatada e overrides posteriores |
| Alto | `patch-moodle-ifrn.js` | 477 linhas; altera rotas, core, assets, gulp e shell por substituição textual; grande superfície de compatibilidade |
| Médio | `services_mobile/auth.service.ts`, `api-auth.ts`, `oauth-profile.ts` | múltiplos modelos de sessão e inventários de limpeza; contratos devem ser explícitos |
| Médio | `painel/painel.ts`, `app-router.ts`, scripts de build | bridge, iframe, cache e pipelines; simplificar após caracterização |
| Baixo na lógica | `ifrn-language.ts` | 2.818 linhas predominantemente dados; avaliar distribuição, não dividir por meta de LOC |
| Baixo | `suap-provider.ts`, `course-target.ts`, `navigation-policy.ts` | unidades pequenas com responsabilidade reconhecível; não criar abstrações extras |

Classificação é julgamento técnico do risco/manutenção, não pontuação automática de vulnerabilidade. Os demais arquivos têm inventário completo no JSON; não há certificação individual de adequação visual.

## Funções com mais decisões

{table(['Arquivo','Função','Linha','LOC','CC aproximada AST','CC ESLint clássico','Profundidade'],funcrows)}

A medição adicional com a regra clássica do ESLint, nos 45 arquivos TS, encontrou 54 funções acima de 10 e 14 com valor ≥20. `renderCurso` e `complete` têm valor 38; `ionViewWillEnter`, 32; `performStartSuapOAuthLogin`, 31. A contagem considera a sintaxe conforme a implementação da ferramenta. Funções JS de scripts não foram avaliadas nessa rodada específica; seus valores AST continuam apenas aproximações.

O CC de `authenticateWithBrowser` aparece baixo na função externa porque as decisões estão nos callbacks e nas strings executadas no WebView; **não significa função simples**. Tamanho, dependências e scripts injetados complementam a medida. Funções aninhadas não foram somadas duas vezes. Complexidade cognitiva padronizada permanece não medida.

## Fluxo rastreado

1. Marketplace (`marketplace-ifrn.ts:169`) chama `SuapEntryService.loginWithSuap`, não a entrada nativa alternativa.
2. `PainelAvaService.authenticateWithBrowser` abre IAB oculto e mostra apenas a interação SUAP necessária; consulta listas/perfil no contexto autenticado.
3. `SuapEntryService` compara identidade, faz staging/commit e grava snapshot/dashboard com dono. Perfil não é token de curso.
4. `PainelPage` carrega iframe, bridge e revalidação de perfil; mensagens exigem origem e `event.source` corretos.
5. Card usa `resolveCourseSite` e bridge. `ensureSessionAndOpenCourse` reutiliza sessão do mesmo usuário/ambiente ou carrega conta armazenada; valida matrícula.
6. Sem sessão utilizável, a ponte inicia SSO e prepara passport via núcleo. O IAB dos cursos é separado do dispatcher global.
7. Callback passa ao núcleo; LOGIN e ponte retomam o curso pendente, conferindo identidade. Curso nativo usa componentes originais.
8. Guardas/observadores/back retornam ao Painel no limite do curso, preservando navegação de atividades.

## Fatos reproduzidos e suspeitas

**Comprovado em prova isolada:** `AuthService.logout:343` e `api-auth.ts:125` usam chaves `ifrn_moodle_poc_oauth_pending`/`ifrn_moodle_poc_resume_oauth`, enquanto o serviço usa `ifrn_moodle_oauth_pending`/`ifrn_moodle_resume_oauth` (`moodle-site.service.ts:55–56`). O corpo real de logout, executado com armazenamento sintético, deixa as duas flags atuais presentes. Isso prova limpeza inconsistente, não bypass de conta.

**Comprovado em prova isolada:** `course-sso-browser.ts:47–65` chama `dispose()` antes de aguardar `acceptToken`. `dispose` remove o timer, e `fail` ignora chamadas quando `accepting=true`. Com um handler que nunca resolve, a completion continua pendente após timeout e cancelamento. Tratar a fase “validando callback” como parte cancelável da tentativa; não reduzir timeout da interação manual principal.

**Comprovado por código:** `moodle-open-course.ts:359/457` retorna de `finally` em entradas obsoletas. Pode suprimir retorno/exceção; o propósito de não atualizar a tela antiga é válido. Reformular só depois de testar navegação e rejeição tardias. ESLint não prova um bug em toda execução desses ramos.

**Comprovado por código:** provider/id é buscado e exigido em `moodle-site.service.ts:2029–2048`, mas a chamada atual prepara o launch com provider `undefined` e usa `auth/suap/login.php:2107–2113`. O id é apenas logado. É candidato a simplificar preparo, mas o gate pode documentar capacidade institucional; medir requests reais antes de removê-lo.

**Suspeita, não leak confirmado:** dois observers de Router no serviço (`:640`, `:1039`) e listeners CoreEvents têm vida de singleton e flags de registro. Não chamar isso de vazamento só por não haver unsubscribe. O observer da página Painel é desligado em destroy, mas páginas Ionic podem ficar em cache; avaliar custo enquanto ocultas. O observer de teclado tem cleanup em `pagehide:268`. A espera por navegação libera sua subscription em `moodle-site.service.ts:1859`.

## Acoplamento e proposta

O namespace `MM/App` recebe 14 módulos; `oauth-profile` tem 7 consumidores estáticos; PainelAvaService, 5. Dependências por globais e eventos ampliam esse grafo. Não substituir tudo por uma arquitetura nova.

Ordem de extração proposta: (a) constantes/contratos puros e sanitização; (b) seleção/validação de conta pura preservando prioridades; (c) posse da tentativa e seus recursos; (d) adaptador de navegação com contrato de origem/destino; (e) separação dos scripts/probes do IAB mantendo payloads serializáveis. Cada extração deve manter API pública e testes antes/depois. Não mover nem editar o core/addons.
''')

write('05-performance-bundle.md','Desempenho, tamanho e distribuição','''
## Baselines que não devem ser misturadas

1. **Fonte:** checkout `c55d20fe4`; sem rebuild que sobrescreva artefatos.
2. **Artefatos locais preexistentes:** `www` e APK debug datados de 27/10. Não são prova de build reprodutível do checkout atual.
3. **Android instalado:** versão 5.2.1/code 52100, depurável, atualização em 28/10. Hash `09894084…442318`, diferente do APK local `f6b391d4…a93f4`. Testes no telefone não certificam esse checkout nem seu APK local.

Não foi feito build ou instalação para esta auditoria. Não existe AAB local no caminho examinado.

## Medições de tamanho

| Artefato | Bytes observados | Interpretação |
|---|---:|---|
| Bundle IFRN versionado `mobilemoodle.js` | 108.044 | JS sem minificação; gzip em memória 25.335 B |
| CSS IFRN versionado `mobilemoodle.css` | 49.931 | gzip em memória 9.246 B |
| `www` inteiro | 111.137.909 | 7.479 arquivos; diretório de build preexistente |
| JS em `www` | 52.317.247 | inclui código original Moodle e lazy chunks; não propor exclusão por não ser IFRN |
| Sourcemaps em `www` | 45.280.540 | revisar política do artefato de distribuição |
| `www/main.js` | 11.421.992 | build local de desenvolvimento |
| APK debug local | 52.588.337 | aproximadamente 50,15 MiB; não AAB/release |
| 616 sourcemaps dentro desse APK | 45.280.540 descomprimidos / 12.777.685 comprimidos | contribuição medida dos entries ZIP; não redução final já verificada de um novo APK |
| Fontes `.ts/.mjs/.md` do painel dentro do APK | 158.268 descomprimidos / 53.060 comprimidos, 23 arquivos | `angular.json:38` copia `mobilemoodle/**/*`, incluindo fontes/build/docs; avaliar allowlist de assets executáveis necessários |

O ZIP total possui 8.089 entries, 130.286.963 bytes descomprimidos. Tamanho total do APK inclui ZIP, alinhamento e assinatura. Excluir entries não é uma previsão exata do tamanho final assinado.

## Experimentos sem alteração de produção

- Minificação **em memória** do JS versionado: 108.044 → **60.118 B**; gzip 25.335 → **19.318 B**. Economia bruta observada 47.926 B, não promessa de melhora de tempo ou novo APK pronto. Não foram executados testes funcionais do bundle minificado.
- Rebuild **em memória** com os parâmetros do esbuild: 105.005 B. A diferença para o arquivo versionado são **3.039 CRLF**: após normalizar quebras de linha, os dois bundles são iguais. **Não foi encontrada desatualização lógica do JS por esse teste.**
- Prova sintética do checkout: 20 respostas idênticas de perfil produziram **100 gravações de storage** e **20 retornos true** que pedem reload do iframe. `profile-refresh.ts:41–47` não verifica igualdade, e `painel.ts:55–58` faz `location.reload()` se recebe true. Comportamento comprovado, não hipótese de rede.
- `oauth-profile.ts:45` e `:96–98` também regravam snapshots/listas em leituras. A correção idempotente já existe nas referências locais posteriores. Revisar/reaproveitar, não recriar automaticamente.

## Android USB — observações desta execução

| Observação | Resultado | Limite |
|---|---|---|
| `am start -W` com processo inicialmente ausente | `LaunchState COLD`, TotalTime **4.807 ms**, WaitTime 4.810 ms | Uma amostra; mede Activity, não Painel utilizável nem todo o login |
| Nova chamada com Activity já em primeiro plano | TotalTime **0 ms**, WaitTime **4 ms** | Intent entregue à Activity existente; não usar como “startup de 0 ms” |
| Memória do processo principal, PID 21082 | TOTAL PSS **99.437 KiB**, RSS **183.392 KiB**, swap PSS 26.325 KiB | Um snapshot; não soma isoladamente todos os renderers WebView, não prova leak |
| Objetos | 1 Activity, 2 WebViews | Parent/iframe/navegador não equivalem a duas telas vazadas |
| Abertura do bridge de curso Acadêmico | retorno em **1.707 ms** | Sessão existente; até retorno do bridge, não tempo total até conteúdo |
| Abertura do bridge Presencial | retorno em **1.045 ms** | Mesmo limite; sem percentis e sem comparação antes/depois |
| Conteúdo nativo | 11/14 elementos de módulo nos dois cursos, rota `course/:id/contents` | Somente leitura e navegação, sem validar todas as atividades |
| Retorno | Painel com cards novamente presente | App deixado no Painel, sessão preservada |

Login novo, primeira sessão Moodle sem token, troca de conta e offline real não foram medidos no dispositivo. Não foram lidos cookies, tokens, senhas, nomes ou matrícula nos probes. O caminho do curso é anonimizado nos arquivos de evidência.

## Propostas e ganhos que dependem de implementação

1. **Baixo risco relativo:** aproveitar a atualização idempotente existente em referência posterior, preservando reidratação e mudanças reais de nome. Esperado: menos gravações e ausência de reload sem mudança; novo resultado físico depende da branch aprovada.
2. **Médio:** pipeline explícito debug/release e remoção de sourcemaps do pacote de distribuição, conservando-os de forma privada para diagnóstico. A contribuição comprimida medida dá ordem de grandeza, mas novo tamanho/tempo permanece pendente.
3. **Médio/alto:** minificação e otimização de scripts. `angular.json:85` tem `scripts:false` até em production; avaliar motivo e código serializado antes de mudar. Scripts injetados em IAB precisam sobreviver a Babel/esbuild e não depender de variáveis renomeadas externas.
4. **Baixo/médio:** allowlist de assets do painel; manter HTML, CSS, JS, fontes, imagens, traduções, ícones e chunks dinâmicos reais. Não apagar recursos originais do Moodle para encolher APK.
5. **Médio:** entrada única de build, evitando dupla cópia de vendor e modos inconsistentes. `build-native.mjs` e `build-android-web.cjs` têm diferenças funcionais, não são duplicatas exatas.
6. **A medir:** custo do observador de aparência com Painel em cache e múltiplas verificações locais de identidade. Não retirar validações por suspeita de lentidão.

CPU sustentada, tráfego HTTP completo, retenção de heap e economia de RAM após refatorar: **não medidos**. Não houve “depois” funcional, pois esta fase não implementa propostas.
''')

write('06-riscos-regressao.md','Riscos, segurança e matriz de regressão','''
## Achado de segurança a tratar antes de simplificar logs

`moodle-site.service.ts:194–229` mascara `moodlemobile://token=...`, mas o caminho de um callback envolvido em HTTP, como `http://moodlemobile//token=...`, conserva o valor na propriedade `path`. A prova isolada usa **somente valor sintético** e confirmou: callback normal redigido, callback HTTP envolvido não redigido.

Há sinks globais que usam esse sanitizador em `:866`, `:887` e `:891`; o helper de cursos já reconhece esse formato envolvido em `course-sso-browser.ts:49–51`. **Falha do sanitizador comprovada; emissão real de segredo no fluxo atual não demonstrada.** Não foi coletado logcat bruto nem callback real para tentar comprovar exposição. `logSiteError:239–246` também registra mensagens/debugDetails do erro sem allowlist explícita: risco a testar com fixtures que simulem segredo ecoado, não vazamento confirmado.

Proposta: contratos de log por whitelist, mascaramento antes de interpretar esquema/caminho e teste negativo para HTTP/HTTPS envolvido, userinfo, query, fragmento e erro de backend. Preservar logs úteis de etapa/duração e nunca enfraquecer a validação oficial de passport.

## Regressões obrigatórias e o que realmente foi executado

| Cenário | Evidência nesta auditoria | Pendência para aprovar refatoração |
|---|---|---|
| 1. Inicialização | Abertura fria da Activity instalada e recuperação do Painel observadas | Repetir build identificado, splash, idioma, offline e tempo até UI utilizável |
| 2. Marketplace | Rotas/guards rastreados; testes de navegação locais passaram | Smoke visual/interação da tela de entrada em build identificado |
| 3. Login único SUAP | Caminho do código rastreado; testes com mocks | Login manual novo com conta de teste e somente uma senha; não executado no aparelho |
| 4. Persistência/recuperação segura | Testes de sessão salva e isolamento passaram; Painel restaurado no cold launch instalado | Repetir após morte de processo com hash do build auditado, token expirado e storage indisponível |
| 5. Identidade correta | Testes sintéticos de nome/conta/ambiente aprovados | Duas contas controladas, coincidência de nome e conflito de matrícula; sem PII em logs |
| 6. Troca de conta SUAP | Prova sintética expôs flags não removidas; testes existentes de isolamento passaram | Logout durante OAuth, callback tardio e login de outra conta; não executado com aluno real |
| 7. Painel AVA | App instalado exibiu Painel e cards | Comparar todas as listas, perfil/foto e revalidação sem reload inútil |
| 8. Disciplinas | Testes de mapping/favoritos/ambientes passaram; cards presentes | Lista completa versus fixture/servidor de teste, com mesmo courseid em ambientes diferentes |
| 9. Curso nativo Moodle | Dois ambientes abriram conteúdo com módulos no app instalado | Primeira autenticação sem token, reinício e abertura repetida no build identificado |
| 10. Retorno ao Painel | Back executado após cada curso, Painel restaurado | Atividades/arquivos/back interno antes do back no limite do curso |
| 11. Falha de conexão | Helpers testados com erros simulados | Offline real, intermitência e timeout durante cada fase; sem apagar sessão válida |
| 12. Reinicialização | Processo inicialmente ausente; abertura fria recuperou Painel | Ciclos controlados de kill/restart com captura de estado anonimizado; não foi feito force-stop |
| 13. Android | Aparelho USB real, app debug instalado | Mais de um Android/WebView, release assinado, teclado/safe-area/rotação/acessibilidade |
| 14. Recursos Moodle preservados | Navegação original e proteções de saída cobertas parcialmente por mocks | Fórum, tarefa, questionário de teste, PDF, downloads/offline, notificações e reconexão; não executados |

## Testes automatizados e cobertura

Foram executados **17 arquivos**, **80 testes aprovados**, zero falhas/skips. O runner Node foi invocado explicitamente; o script `test:ifrn` está ausente neste checkout e presente em referência posterior. `jest.config.js:7` seleciona só `*.test.ts`, portanto `npm test`/`test:coverage` não incluem esta bateria customizada como está hoje.

Não há pasta de cobertura preexistente. Os testes customizados transpilem/bundlam funções em `vm` frequentemente sem source maps/filename de origem. Cobertura de JavaScript de fixture/teste não equivale à cobertura dos fontes TypeScript. **Cobertura percentual de linhas, branches, funções e statements não foi calculada.** Antes de fixar meta, integrar runner/instrumentação com mapeamento e listar o denominador; não anunciar 100% a partir de 80 sucessos.

O Jest completo e o probe existente `painel-first-paint.android.mjs` não foram executados. O teste `painel-ios-layout.test.mjs` é DOM simulado, não teste de iPhone/WebKit. Não foram usados resultados históricos como testes aprovados agora.

## Riscos por tipo de alteração

| Mudança | Risco | Proteção mínima |
|---|---|---|
| Imports locais sem uso e documentação | Baixo | TypeScript, testes locais, nenhum efeito colateral removido |
| Funções locais certificadas sem uso | Baixo | Busca global/exports/scripts/templates, rebuild de teste e regressão local |
| Perfil idempotente | Médio | Expiração, owner, origem, persistência ausente, mudança real de nome, preservação de foto/listas |
| Chaves/logout/migração | Alto | Contas A/B, pending OAuth, callbacks tardios, rollback transacional; não limpar todo storage |
| Cancelamento/timeout do SSO | Alto | Handler pendente/rejeitado/tardio, cancelamento repetido, validação de passport e fechamento único |
| Extrair seleção de conta e navegação | Muito alto | Contratos de ambiente/identidade, corridas, lifecycle Ionic, back e atividades nativas |
| Remover login/curso web legado/biometria | Alto | Política explícita de compatibilidade e mapa de carregamentos dinâmicos |
| Consolidar CSS | Médio/alto | Diff visual, claro/escuro, fontes, acessibilidade, viewport e primeira pintura |
| Release/minificação/assets | Médio/alto | Testes em scripts injetados, idioma offline, lazy chunks, APK/AAB e dispositivo real |

## Critério de aceite e confidencialidade

Primeiro fixar SHA do fonte, lockfile, parâmetros do build e SHA do binário; repetir a mesma matriz antes/depois, separando frio/quente, sessão nova/salva e rede. Falhas prévias devem permanecer identificadas, não ser escondidas em novo baseline. Mudanças de autenticação exigem equivalência funcional/de segurança comprovada, não só menos linhas.

Nenhuma ação acadêmica foi enviada. Não houve logout, login digitado, troca de conta, limpeza de dados, instalação ou edição do aparelho nesta auditoria. Probes guardam apenas rota anonimizada, contagem de módulos/cards e durações. Testes futuros que exijam duas contas devem usar credenciais de teste, fornecidas por canal apropriado e nunca incluídas no relatório.
''')

write('07-plano-refatoracao.md','Plano de execução em fases, para aprovação','''
## Princípios

Este documento propõe trabalho futuro. Nada foi implementado. Não há meta artificial de redução de linhas; a redução deve vir de responsabilidades e contratos mais claros. Não modificar `src/core`/`src/addons`, não apagar dados nem alterar identidade visual. Toda fase termina em revisão e evidência antes/depois.

| Fase | Prioridade | Escopo e benefício | Risco / esforço | Dependência / reversão |
|---|---|---|---|---|
| 0 | P0 | Escolher a revisão aprovada; confrontar `erro-fluxo`, referência remota local e release; identificar APK/AAB pelo SHA | Baixo / pequeno | Sem merge automático. Guardar baseline, testes e artefatos antes de trabalhar |
| 1 | P0 | Acrescentar testes de sanitização, callback pendente/cancelado e limpeza de flags; integrar runner IFRN | Baixo nos testes / médio | Após fase 0; commits só de testes/harness, reversíveis isoladamente |
| 2 | P0 | Corrigir sanitização por whitelist e lifecycle do callback; limpar chaves atuais e legadas explicitamente | Alto funcional / médio | Testes novos primeiro, matriz A/B, no máximo um contrato sensível por commit |
| 3 | P1 | Sete bindings não usados, quatro funções locais, helper transitivo e ramo inalcançável; atualizar docs equivocadas | Baixo / pequeno | TypeScript/ESLint e 80 testes; preservar APIs públicas sem decisão prévia |
| 4 | P1 | Reaproveitar correção idempotente já presente em referência posterior, com rastreabilidade | Médio / pequeno | Casos perfil ausente/alterado/expirado, origem e owner; evitar reaplicar mudança já incorporada |
| 5 | P1 | Definir pipeline único debug/release; helper único de catálogo; allowlist de assets e mapas privados | Médio / médio | Builds em saída isolada, manifestos/hashes e teste offline/lazy loads; configuração anterior preservada |
| 6 | P2 | Extrair contratos puros de identidade/ambiente e posse dos recursos de uma tentativa; reduzir tamanho do serviço Moodle | Alto / grande | Equivalência de prioridades, callbacks/races e retomada. Não migrar tudo para nova arquitetura de uma vez |
| 7 | P2 | Separar scripts/probes do IAB e persistência da orquestração Painel; diminuir callback de 531 linhas | Alto / grande | Payloads serializáveis equivalentes, testes com build transformado e servidor de teste |
| 8 | P2 | Consolidar cascata e tokens, decidir fonte SCSS editável e arquivar cópias históricas fora do pacote | Médio/alto / médio | Diff visual por estado, modo escuro/acessibilidade; sem mudar marca/cores |
| 9 | P3 | Decidir depreciação de entradas alternativas, renderizador legado e métodos públicos sem chamador | Alto / variável | Inventário de links/consumidores e período de compatibilidade. Zero remoção automática de dependências |

## Como dividir sem criar abstrações em excesso

- Extrair uma função pura quando houver dois consumidores reais ou um contrato testável relevante. O validador JWT morto do Painel não justifica criar uma camada nova.
- Preferir contratos existentes e delegates pequenos; evitar um segundo serviço “central de tudo”. O namespace `MM/App` pode ganhar fronteiras tipadas gradualmente sem reescrever a SPA inteira.
- Remover flags duplicadas só quando houver estado substituto explícito e tabela de transições. Manter distinção de perfil em cache, cookie SUAP/Painel e token de cada Moodle.
- Mover a posse de timer/subscription/browser para a tentativa em um passo isolado. Não alterar a validação do núcleo nem os fluxos de cursos já válidos nessa extração.
- Um único adaptador de navegação pode coordenar as rotas IFRN, preservando helpers nativos. Não substituir o Router/CoreNavigator de todo o Moodle.

## Metas verificáveis, sem percentuais arbitrários

1. Funções locais sem uso e imports redundantes certificados não reaparecem nos diagnósticos; redução de LOC medida por diff do commit aprovado.
2. Callback pendente termina/cancela dentro do prazo configurado, cleanup roda uma vez, retorno tardio não troca a tela/conta.
3. Logout remove flags atuais/legadas, e callback antigo não autentica curso para nova conta.
4. Uma resposta idêntica de perfil não pede reload e não regrava cópias já sincronizadas; alteração válida ainda atualiza tudo.
5. Build gera manifesto com parâmetros/SHA, sem fontes e mapas públicos desnecessários; tamanho final e tempo real são medidos, não inferidos de LOC.
6. Mesmos cursos/atividades, listas, foto, idioma e back funcionam antes/depois em matriz controlada.

## Esforço, dependências e retorno

O maior benefício inicial vem de baseline confiável, testes executáveis e recuperação/logs, não de uma divisão cosmética de arquivos. Higiene local é pequena e reversível, com potencial comprovável de 124–135 linhas em funções; não é um alvo global de redução. Revisões de autenticação exigem aparelho e contas de teste, e podem requerer apoio institucional para validar contratos — nenhuma mudança de backend foi proposta como já necessária.

Cada fase deve ser um conjunto pequeno de commits revisáveis. Se falhar, reverter o commit específico aprovado, preservando trabalhos paralelos; não usar reset/clean nem reescrever branches remotas. Só depois de aprovar fonte e evidências promover o APK/AAB de teste para distribuição.
''')

write('08-resumo-executivo.md','Resumo executivo e respostas objetivas','''
## Resultado geral

O código mostra cuidado funcional com identidade, ambiente, sessão salva, clique duplicado e corrida de navegação. Os **80 testes locais passaram** e o código compila no exame TypeScript sem emissão. A qualidade de manutenção, porém, tem **dívida técnica alta**: responsabilidades concentradas, estados espalhados, contratos legados ativos, preparação de build divergente e integração incompleta dos testes. Não se trata de reescrever o app nem de eliminar validações.

A primeira decisão é de baseline: esta branch está dez commits atrás de sua referência local e difere da release; algumas melhorias já existem nessas referências. O APK do telefone também difere do artefato local. Um curso abrir no aparelho não certifica este checkout.

## Dez principais problemas

| # | Problema | Evidência principal | Prioridade |
|---|---|---|---|
| 1 | Proveniência de fonte/build/binário e documentação divergem | `c55d20fe4`, outras referências, APKs com hashes diferentes | P0 |
| 2 | Limpeza de estado com nomes antigos de flags | `AuthService.logout:362–363` versus constantes atuais `moodle-site.service.ts:55–56`; prova isolada | P0 |
| 3 | Callback SSO pode ficar sem timeout/cancelamento | `course-sso-browser.ts:47–65`; completion pendente na prova com handler que não resolve | P0 |
| 4 | Sanitização de logs incompleta | `moodle-site.service.ts:194`; callback HTTP envolvido conserva valor sintético no path; exposição real não comprovada | P0 |
| 5 | Serviços concentram responsabilidades demais | Moodle 2.337 linhas/31 imports; Painel 1.407 linhas/rotina de 533 | P1/P2 |
| 6 | Atualização idêntica do perfil pede reload e gravações | 20 respostas sintéticas → 100 gravações/20 pedidos de recarga; correção já existe em referência posterior | P1 |
| 7 | Código local morto e legado com contratos pouco claros | 7 imports, 4 funções locais sem uso; caminhos públicos/dinâmicos exigem decisão de compatibilidade | P1/P3 |
| 8 | Cascata de estilos e fontes editoriais concorrentes | `painel.scss` 2.214 linhas/59 cabeçalhos repetidos; 136 `!important` nas fontes autorais | P2 |
| 9 | Build de desenvolvimento pesado e pipelines sobrepostos | 616 mapas no APK local: 12.777.685 B comprimidos; dois helpers de build, assets amplos | P1 |
| 10 | Testes IFRN fora do runner Jest padrão e cobertura não demonstrada | 17 arquivos `.cjs/.mjs` executados separadamente; Jest só seleciona `.test.ts` | P0/P1 |

## Respostas às dez perguntas

1. **Qualidade geral:** funcionalmente protegida nos casos cobertos, manutenção com dívida alta; certificação global de produção não concluída.
2. **Dez principais problemas:** a tabela acima distingue evidência de suspeita. O sanitizador falha em fixture, mas não foi observado vazamento real.
3. **Maior complexidade:** `moodle-site.service.ts`, `painel-ava.service.ts`, `moodle-open-course.ts`, `suap-entry.service.ts`, `app-views.ts` e a cascata de `painel.scss`. Catálogo grande de idioma não é automaticamente lógica complexa.
4. **Quanto é realmente desnecessário:** quatro funções locais somam **124 linhas**, ou **135** com helper transitivo confirmado após removê-las; sete bindings de import e um parâmetro ignorado. Há também um ramo inalcançável de nove linhas. Não foi certificada a remoção de nenhum componente ou pacote inteiro.
5. **Duplicações elimináveis:** decodificação/validação JWT em ramo morto, catálogos de chaves de sessão, parsing/publicação de idioma dos scripts e cópias de diagnóstico. Detector estrito encontrou **328 tokens repetidos em 50.260**, não uma promessa de redução global.
6. **Refatorações de maior efeito:** separar seleção de conta, posse de tentativa/navegação e probes do browser mantendo APIs e contratos; retirar caminhos mortos locais; tornar build/revalidação previsíveis. Não criar uma arquitetura nova por contagem de linhas.
7. **Desempenho:** eliminar reload/gravações sem mudança, revisar distribuição de sourcemaps e assets, avaliar minificação. JS minificado em memória: **108.044 → 60.118 B**, funcionalidade desse bundle ainda não validada. Startup/memória antes/depois permanecem pendentes.
8. **Maior risco:** autenticação, identidade, migração/logout, cancelamento tardio, mudança de ambiente e navegação do curso; depois CSS global e minificação de scripts serializados. Não enfraquecer esses mecanismos para reduzir código.
9. **Ordem segura:** baseline → testes faltantes → recuperação/logs/flags → higiene local → reaproveitar idempotência → pipeline → extrações pequenas → estilos → decisão explícita sobre legado.
10. **Como demonstrar preservação:** matriz de 14 cenários do relatório 06, fonte/binário identificados por hash, mesmos testes/fixtures antes e depois, contas de teste A/B e aparelhos reais; comparar frio/quente e sessão nova/salva sem confundir resultados históricos.

## Quadro quantitativo solicitado

| Métrica | Situação atual medida | Proposta fundamentada | Resultado verificado da proposta |
|---|---|---|---|
| Linhas de código | 22.779 autorais/84 arquivos; 37.618 em todas as categorias de extensões de código | Revisar 124–135 linhas de funções sem uso; ramo de nove linhas e imports separadamente | Pendente: nenhum código removido |
| Código duplicado | 328 tokens em janelas exatas; cópia de diagnóstico de 52.009 B; zero regras completas idênticas no Painel pelo teste PostCSS | Remover ramo morto antes de abstrair JWT; unificar apenas contratos equivalentes | Pendente |
| Arquivos complexos | Moodle 2.337 linhas/31 imports; Painel 1.407/rotina de 533; ESLint clássico: 14 funções TS ≥20; AST: 11 aproximações ≥20 em outro escopo | Extrações pequenas de responsabilidades e contratos | Pendente |
| Imports desnecessários | 7 bindings confirmados; 2 ocorrências de imports de módulo duplicados no lint | Limpeza local sem retirar import por efeito colateral | Pendente |
| Complexidade cognitiva | Não medida; ferramenta padrão não disponível; profundidade AST máxima 5 | Adotar métrica padronizada quando autorizada/disponível, sem substituir segurança por score | Pendente |
| Tamanho do bundle | JS IFRN 108.044 B, CSS 49.931 B; APK debug local 52.588.337 B | Minificação em memória 60.118 B; revisar 12.777.685 B de mapas comprimidos no APK | Experimento de tamanho medido; novo bundle/APK funcional pendente |
| Inicialização | Uma abertura fria da Activity instalada: 4.807 ms | Medir Activity e Painel utilizável separadamente, várias rodadas e build identificado | Pendente; sem antes/depois |
| Memória | Uma amostra do processo: PSS 99.437 KiB, RSS 183.392 KiB; renderer não consolidado | Medir processos relevantes e retenção após ciclos | Pendente; nenhum leak demonstrado |
| Cobertura de testes | 80/80 testes; cobertura percentual de fontes não medida | Integrar runner e instrumentação mapeada a TS; ampliar cenários de risco | Pendente; aprovação de testes não equivale a cobertura |

## Entrega e evidências

1. [Inventário](01-inventario-codigo.md)
2. [Duplicações](02-codigo-duplicado.md)
3. [Possíveis remoções](03-codigo-desnecessario.md)
4. [Complexidade e arquitetura](04-complexidade-arquitetura.md)
5. [Desempenho e bundle](05-performance-bundle.md)
6. [Riscos e regressão](06-riscos-regressao.md)
7. [Plano de execução](07-plano-refatoracao.md)
8. Este resumo, com evidências em `evidencias/`.

Somente relatórios e ferramentas de medição foram criados. Nenhuma refatoração, mudança visual, instalação de dependência, modificação no core/addons, limpeza de dados ou atualização de branch foi feita. O telefone ficou no Painel com a sessão preservada. Implementação aguarda aprovação do plano e definição da revisão-base.
''')

print('8 relatórios gerados em', out)
