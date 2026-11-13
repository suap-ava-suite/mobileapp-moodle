# Instruções para o código MoodleIFRN

`src/MoodleIFRN/` contém a customização IFRN sobre o Moodle Mobile. Antes de editar, leia o `AGENTS.md` da raiz, o [manual](docs/index.html), [arquitetura e arquivos críticos](docs/estrutura-arquitetura.html) e o estado em [progresso do projeto](docs/progresso-projeto.html).

## Mapa rápido

- `marketplace-ifrn/`: entrada institucional e início da autenticação.
- `ifrn-login/`: rota de compatibilidade que redireciona para o Marketplace; não é um formulário paralelo de credenciais.
- `services_mobile/`: serviços SUAP, painel, navegador interno, seleção de ambiente Moodle, sessão, identidade e perfil.
- `painel/`: componente Angular que hospeda o Painel e recebe comandos do iframe.
- `moodle-open-course/`: ponte de entrada/recuperação antes de abrir um curso nativo.
- `navigation/`: guardas, políticas, estado de handoff, coordenação e rota nativa.
- `mobilemoodle/`: painel web leve, seus módulos TypeScript, SCSS e bundles gerados.
- `theme/`, `resources/` e `plugins/`: tema e integração Cordova local.
- `scripts/` e `patches/`: geração/build e patches versionados; alguns afetam arquivos do Moodle fora desta pasta.
- `tests/`: regressões Node/Jest, fixtures e harnesses. Fixtures podem ser lidas por caminho dinâmico ou subprocesso.
- `docs/`: portal HTML offline e registros de investigação.

O mapa é orientativo: confirme os arquivos presentes, imports, rotas, configurações e scripts na branch atual.

## Regras de segurança e manutenção

- Trate `services_mobile/moodle-site.service.ts`, `services_mobile/suap-entry.service.ts`, `navigation/`, a ponte de cursos e o patch P0.4 como áreas críticas de identidade/sessão.
- Uma abertura de curso deve validar o estudante ativo, o ambiente Moodle e o `courseId` exato antes de navegar para os componentes Moodle nativos. Não reutilize uma sessão de outra conta ou outro ambiente.
- Preserve a ordem e os contratos dos callbacks OAuth/PKCE, os eventos de login, a recuperação de conta e a separação entre SUAP, Painel, Moodle e navegador. Não copie cookies ou tokens entre WebViews.
- Não remova loaders, timeouts, estado de cancelamento ou verificações para esconder uma falha. Primeiro identifique a causa e mantenha erros reais visíveis.
- Não modifique `src/core/`, `src/addons/`, plugins nativos ou configurações globais sem autorização explícita. Um patch IFRN pode tocar essas áreas: inspecione seu manifesto e o diff antes e depois de aplicá-lo.
- Não exclua testes, fixtures, mocks, harnesses, patches ou scripts sem mapear imports, caminhos dinâmicos, referências de build e uso em outros worktrees.
- Preserve os testes de sessão P0.4. Se um teste falhar, registre a linha de base e corrija a implementação; não altere a expectativa apenas para deixá-lo verde.
- Build, substituição de APK e validação autenticada são ações diferentes. Respeite a autorização específica do usuário e preserve o estado do aparelho.

## Atualização de continuidade

Após correções relevantes, atualize as páginas HTML existentes em `docs/`: problema, causa comprovada, arquivos, commit, testes, build, estado de validação no aparelho e pendências. Para uma nova sessão, siga a ordem de leitura de `docs/continuidade-ia.html`. Não duplique os relatórios Markdown históricos; identifique-os como históricos quando não representarem o código atual.
