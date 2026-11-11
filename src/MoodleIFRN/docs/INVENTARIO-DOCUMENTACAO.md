# Inventário da documentação MoodleIFRN

**Revisado em:** 11/11/2026
**Escopo:** src/MoodleIFRN/docs/, referências em readme_ifrn.md e material local em .analise/.

Este inventário não remove nem move arquivos. A classificação é um ponto de partida para revisão por quem mantém o projeto; conteúdo histórico pode registrar decisões úteis mesmo quando não descreve mais o comportamento atual.

## Resumo

- src/MoodleIFRN/docs/: 59 arquivos rastreados: 25 Markdown, 15 scripts .cjs, 12 scripts .js, 3 JSON e 4 TXT.
- Também havia dois logs ignorados sob docs/auditoria-fluxo-2026-10-19/. Eles não são parte da documentação versionada.
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

Os outros 34 arquivos rastreados na pasta são scripts de diagnóstico/teste, JSON e TXT. São artefatos especializados, não páginas do manual geral. Os scripts com nomes course-*, test-*, audit-* e probe-* não são scripts npm registrados só por estarem nessa pasta. Consulte o conteúdo e seus argumentos antes de executar; alguns podem depender de aparelho conectado, credenciais de teste, serviços remotos ou gerar logs.

auditoria-fluxo-2026-10-19/ contém snapshots de endpoints, aparelho e cópias de fontes. Não os copie para documentação pública nem os compartilhe sem revisão de dados pessoais, URLs e informações operacionais. Os dois logs ignorados citados acima são locais e não estão versionados.

.analise/ contém evidências de tarefas e builds. Mantenha-a fora de commits de documentação. APKs, capturas e logs podem conter dados pessoais ou de sessão.

## Sobreposição e consolidação possível

- readme_ifrn.md e src/MoodleIFRN/docs/README.md funcionam como índices. O arquivo da raiz deve ser um atalho curto para o manual e índice dentro de src/MoodleIFRN/docs/, sem copiar as mesmas tabelas.
- VISAO-GERAL.md repete trechos de arquitetura do índice e contém fluxo obsoleto. Uma futura consolidação pode preservar decisões históricas numa seção datada e retirar instruções antigas após revisão.
- CONTRATO-API.md e apis-e-endpoints.md podem se sobrepor. Compare endpoint por endpoint e preserve diferenças antes de propor união.
- COURSE-OPENING-2026-10-19.md, DESEMPENHO-PAINEL-2026-10-26.md, SSO-CURSOS-LOGIN-UNICO-2026-10-26.md e os relatórios de correção são históricos por execução; não consolidar em um guia prescritivo sem identificar quais conclusões ainda valem.

## Candidatos a revisão futura — não excluídos

1. Scripts de diagnóstico de execução única sob docs/: decidir se devem permanecer como ferramentas versionadas, ser movidos para tests/scripts com instruções ou ser arquivados. Antes de qualquer remoção, pesquisar chamadas em CI, package scripts e documentação.
2. TXT/JSON da pasta auditoria-fluxo-2026-10-19/: revisar sensibilidade e necessidade de histórico; não publicar cópias de backend ou evidências de dispositivo sem aprovação.
3. Logs ignorados: podem ser removidos pelo responsável local depois de confirmar que não são necessários. Eles não foram alterados por esta tarefa.
4. Documentos históricos da lista acima: manter enquanto houver valor de decisão; arquivar ou remover somente após revisão de referências e aprovação do mantenedor.

## Links corrigidos nesta organização

O arquivo de login atualmente está em src/MoodleIFRN/docs/LOGIN-IFRN.md. Links antigos para src/MoodleIFRN/ifrn-login/LOGIN-IFRN.md foram apontados para a localização existente. O código da aplicação não foi alterado.
