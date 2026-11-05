# Riscos, segurança e matriz de regressão

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

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
