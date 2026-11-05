# Resumo executivo e respostas objetivas

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

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
