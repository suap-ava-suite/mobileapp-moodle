# Inventário da documentação MoodleIFRN

**Revisado em:** 11/11/2026
**Escopo:** src/MoodleIFRN/docs/, referências em readme_ifrn.md e material local em .analise/.

A classificação registra o estado deste checkout e distingue guias ativos de material histórico. Conteúdo histórico pode documentar decisões úteis sem descrever o comportamento atual.

## Resumo

- src/MoodleIFRN/docs/: 45 arquivos em `docs/`: 26 Markdown, 17 HTML (inclui o manual principal), `assets/manual.css` e `assets/manual.js`. Os 15 utilitários CJS foram movidos para `src/MoodleIFRN/diagnosticos/` (fora de `docs/` e sem pasta chamada `test`). Os 11 `course-*.js`, a sonda `probe-painel-integration.js` e os 7 snapshots da auditoria datada foram removidos.
- Não havia arquivos ignorados adicionais na pasta `auditoria-fluxo-2026-10-19/` quando ela foi removida.
- .analise/: 319 arquivos locais no momento da contagem. Há relatórios, evidências, capturas, APKs e logs; esse diretório não é a documentação pública do projeto e não deve ser adicionado em massa ao Git.
- Não foram encontrados documentos Markdown idênticos byte a byte pelo hash SHA-256. Há sobreposição de índice entre readme_ifrn.md e docs/README.md, mas cada um atende a um nível diferente.

## Classificação dos documentos Markdown

### Guias e referências para manutenção

São os primeiros documentos a conferir contra o código antes de alterar o fluxo:

- README.md — índice dos documentos desta pasta.
- LOGIN-IFRN.md — fluxo e tela de login IFRN.
- ENTRADA-DIRETA-SUAP.md — entrada pelo SUAP.
- SERVICOS-AUTH-BIOMETRIA.md — serviços de autenticação e biometria.
- CONTRATO-API.md e apis-e-endpoints.md — referência de APIs e endpoints; confirme sempre disponibilidade e autorização no backend.
- PONTE-PAINEL-MOODLE.md — integração do Painel AVA com cursos Moodle nativos.
- PAINEL-CURSOS.md — implementação do painel de cursos.
- TEMPLATES-HTML.md — shell e templates HTML.
- TEMA-VISUAL.md — SCSS, tema e safe areas.
- SEGURANCA.md — práticas de segurança do cliente.
- LOGO-MOODLE-IFRN.md — identidade visual e recursos.
- TROCAR-IMAGEM-ABERTURA-ANDROID.md — procedimento de splash/ícone Android.
- PATCH-AO-ATUALIZAR.md — script de integração após atualizar o Moodle Mobile; revisar os destinos antes de executar.
- SSO-CURSOS-LOGIN-UNICO-2026-10-26.md — decisão/estado documentado do SSO e abertura de cursos; validar se ainda corresponde ao código atual.

### Registros históricos ou ligados a uma execução específica

Preserve como histórico até que a equipe confirme que já não têm valor:

- TESTE-API-PAINEL-2026-10-20.md
- TESTE-ACESSIBILIDADE-METODOLOGIA-2026-10-20.md
- SESSOES-E-DJANGO-NINJA-2026-10-20.md
- RELATORIO-IOS.md
- DESEMPENHO-PAINEL-2026-10-26.md
- COURSE-OPENING-2026-10-19.md
- CORRECAO-NOME-PERFIL-2026-10-25.md
- CORRECAO-FLASH-RETORNO-PAINEL-2026-10-25.md
- PLAY-STORE-BETA.md

Esses registros não devem ser tratados automaticamente como estado atual. Em especial, RELATORIO-IOS.md é histórico: a configuração do Cordova não prova que a compilação foi validada em Xcode. PLAY-STORE-BETA.md não é fonte suficiente para requisitos atuais da Play Store.

### Documento desatualizado que precisa de revisão antes de orientar trabalho

- VISAO-GERAL.md contém descrição antiga de login IFRN-id/JWT e de um backend FastAPI de teste. Ela não representa com segurança o fluxo atual SUAP → Painel → Moodle. Foi mantida como registro, com aviso visível; use o manual index.html como introdução atual e confirme detalhes de autenticação no código.

## Scripts, snapshots e arquivos auxiliares

O portal HTML usa `assets/manual.css` e `assets/manual.js`. Os antigos onze `course-*.js` eram expressões de inspeção manual e foram removidos. Os auxiliares CJS, incluindo verificações simuladas e ferramentas que dependem de ADB/CDP/rede, estão em `../diagnosticos/`; consulte o README dessa pasta antes de executá-los. A sonda antiga `probe-painel-integration.js` também foi removida por depender da sessão existente no Painel.

Os snapshots versionados em `auditoria-fluxo-2026-10-19/` foram removidos: eram levantamentos datados de endpoints/fontes e uma leitura resumida de aparelho, sem referências em testes ou no app. `audit-device.cjs`, `audit-endpoints.cjs` e o script de build Android gravam saídas em `os.tmpdir()`, sem recriar essa pasta no repositório.

.analise/ contém evidências de tarefas e builds. Mantenha-a fora de commits de documentação. APKs, capturas e logs podem conter dados pessoais ou de sessão.

## Sobreposição e consolidação possível

- readme_ifrn.md e src/MoodleIFRN/docs/README.md funcionam como índices. O arquivo da raiz deve ser um atalho curto para o manual e índice dentro de src/MoodleIFRN/docs/, sem copiar as mesmas tabelas.
- VISAO-GERAL.md repete trechos de arquitetura do índice e contém fluxo obsoleto. Uma futura consolidação pode preservar decisões históricas numa seção datada e retirar instruções antigas após revisão.
- CONTRATO-API.md e apis-e-endpoints.md podem se sobrepor. Compare endpoint por endpoint e preserve diferenças antes de propor união.
- COURSE-OPENING-2026-10-19.md, DESEMPENHO-PAINEL-2026-10-26.md, SSO-CURSOS-LOGIN-UNICO-2026-10-26.md e os relatórios de correção são históricos por execução; não consolidar em um guia prescritivo sem identificar quais conclusões ainda valem.

## Candidatos a revisão futura

1. Os scripts CJS de diagnóstico ainda versionados em `docs/`: revisar individualmente se continuam úteis, pois alguns fazem leituras de rede/aparelho e produzem artefatos.
2. Documentos históricos da lista acima: manter enquanto houver valor de decisão; arquivar ou remover somente após revisão de referências e aprovação do mantenedor.

## Links corrigidos nesta organização

O arquivo de login atualmente está em src/MoodleIFRN/docs/LOGIN-IFRN.md. Links antigos para src/MoodleIFRN/ifrn-login/LOGIN-IFRN.md foram apontados para a localização existente. O app e os fluxos de autenticação não foram alterados. O helper de build Android passou a gravar logs em `os.tmpdir()` para não recriar snapshots dentro de `docs/`.

## Ferramentas auxiliares

Os scripts CJS foram organizados em [`../diagnosticos/README.md`](../diagnosticos/README.md); a pasta chama-se `diagnosticos`, não `test`.

## Conversão para HTML offline

Os arquivos Markdown originais foram mantidos. As páginas convertidas usam o layout compartilhado do `index.html`, arquivos locais (sem CDN e sem `fetch`) e navegação que funciona por caminhos relativos em `file://`.

| Markdown original | Página HTML | Situação |
|---|---|---|
| `INVENTARIO-DOCUMENTACAO.md` | [`INVENTARIO-DOCUMENTACAO.html`](./INVENTARIO-DOCUMENTACAO.html) | Convertido; fonte preservada |
| `PONTE-PAINEL-MOODLE.md` | [`PONTE-PAINEL-MOODLE.html`](./PONTE-PAINEL-MOODLE.html) | Convertido; fonte preservada |
| `LOGIN-IFRN.md` | [`LOGIN-IFRN.html`](./LOGIN-IFRN.html) | Convertido; fonte preservada |
| `PAINEL-CURSOS.md` | [`PAINEL-CURSOS.html`](./PAINEL-CURSOS.html) | Convertido; fonte preservada |
| `SEGURANCA.md` | [`SEGURANCA.html`](./SEGURANCA.html) | Convertido; fonte preservada |
| `PATCH-AO-ATUALIZAR.md` | [`PATCH-AO-ATUALIZAR.html`](./PATCH-AO-ATUALIZAR.html) | Convertido; fonte preservada |
| `README.md` | [`README.html`](./README.html) | Convertido; fonte preservada |
| `ENTRADA-DIRETA-SUAP.md` | [`ENTRADA-DIRETA-SUAP.html`](./ENTRADA-DIRETA-SUAP.html) | Convertido; fonte preservada |
| `SERVICOS-AUTH-BIOMETRIA.md` | [`SERVICOS-AUTH-BIOMETRIA.html`](./SERVICOS-AUTH-BIOMETRIA.html) | Convertido; fonte preservada |
| `TEMA-VISUAL.md` | [`TEMA-VISUAL.html`](./TEMA-VISUAL.html) | Convertido; fonte preservada |
| `TEMPLATES-HTML.md` | [`TEMPLATES-HTML.html`](./TEMPLATES-HTML.html) | Convertido; fonte preservada |
| `TROCAR-IMAGEM-ABERTURA-ANDROID.md` | [`TROCAR-IMAGEM-ABERTURA-ANDROID.html`](./TROCAR-IMAGEM-ABERTURA-ANDROID.html) | Convertido; fonte preservada |
| `LOGO-MOODLE-IFRN.md` | [`LOGO-MOODLE-IFRN.html`](./LOGO-MOODLE-IFRN.html) | Convertido; fonte preservada |
| `CONTRATO-API.md` | [`CONTRATO-API.html`](./CONTRATO-API.html) | Convertido; fonte preservada |
| `PLAY-STORE-BETA.md` | [`PLAY-STORE-BETA.html`](./PLAY-STORE-BETA.html) | Convertido; guia de referência, requisitos devem ser revalidados |
| `apis-e-endpoints.md` | [`apis-e-endpoints.html`](./apis-e-endpoints.html) | Convertido; fonte preservada |

`index.html` continua sendo a página inicial. Os relatórios históricos específicos por data permanecem em Markdown e não foram excluídos. O conteúdo legado identificado em páginas de visão geral, contrato, painel e segurança recebeu aviso na apresentação HTML; a conversão não certifica as afirmações técnicas.
