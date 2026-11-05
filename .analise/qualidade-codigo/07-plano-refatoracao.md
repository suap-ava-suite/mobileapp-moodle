# Plano de execução em fases, para aprovação

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

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
