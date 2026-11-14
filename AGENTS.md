# Orientações para agentes — Moodle IFRN Mobile

Este repositório é o Moodle Mobile oficial personalizado para o IFRN. A aplicação usa Angular, Ionic e Cordova; a maior parte do código institucional fica em `src/MoodleIFRN/`. O núcleo Moodle continua em `src/core/` e os módulos Moodle em `src/addons/`.

## Antes de trabalhar

1. Leia `src/MoodleIFRN/AGENTS.md` e o [manual local](src/MoodleIFRN/docs/index.html).
2. Consulte [progresso-projeto.html](src/MoodleIFRN/docs/progresso-projeto.html), [continuidade-ia.html](src/MoodleIFRN/docs/continuidade-ia.html) e [problemas-conhecidos.html](src/MoodleIFRN/docs/problemas-conhecidos.html).
3. Execute `git status --short --branch`, `git branch -vv`, `git worktree list` e `git log -10 --oneline`. Confirme branch, HEAD, worktrees e alterações locais antes de editar ou compilar.
4. Preserve arquivos modificados e não rastreados. Nunca use `git reset --hard`, `git clean`, `git add .` ou force push.

## Limites de alteração

- Faça mudanças pequenas e ligadas à solicitação. O código IFRN deve ficar em `src/MoodleIFRN/`, salvo autorização explícita para outro escopo.
- Não altere `src/core/`, `src/addons/`, plugins nativos, backend, OAuth, dependências principais, `package.json`, `package-lock.json`, `config.xml` ou configuração global sensível sem autorização explícita. Se o problema exigir o núcleo Moodle, identifique os arquivos, a razão, os riscos, os testes e a reversão antes de alterar.
- Não misture a sessão SUAP, os dados do Painel, a sessão Moodle e o estado de navegadores/WebViews. Não transporte cookies ou tokens entre contextos, não enfraqueça validações de identidade e preserve os testes P0.4.
- Scripts IFRN e hooks Cordova podem alterar arquivos fora de `src/MoodleIFRN/`. Confira o estado do Git e leia o script antes de executá-los; revise o diff completo depois.

## Testes e dispositivo

- Confira os comandos atuais em `package.json` e no manual. Os testes Jest do núcleo e os testes Node de `src/MoodleIFRN/tests/` são grupos diferentes; execute os relevantes e compare com a linha de base.
- Nunca apague, desabilite ou enfraqueça testes, mocks ou fixtures para obter uma aprovação. Um teste automatizado não comprova login ou abertura real de curso no celular.
- A validação de autenticação real é manual. Diagnósticos ADB de leitura são permitidos, mas instalar/substituir APK, desinstalar, limpar dados/cache, fazer logout, trocar conta ou mudar permissões exige autorização explícita. Preserve a sessão do usuário.
- `cordova build` compila; `cordova run` também instala/executa. Não confunda essas operações. Verifique package ID e certificado antes de instalar uma APK.

## Git, documentação e encerramento

- Não troque de branch, faça merge, push ou altere a release sem autorização explícita. Mesmo com autorização, confirme o estado do worktree e prepare commits contendo somente os arquivos da tarefa.
- Depois de uma correção validada, atualize o portal HTML em `src/MoodleIFRN/docs/`. Separe fatos comprovados, hipóteses e testes pendentes; não declare validação em aparelho que não ocorreu.
- Ao concluir, registre arquivos, comportamento, testes, build, validação no celular, commit, pendências e próxima ação em `progresso-projeto.html` e no registro de transferência da sessão.

## Continuidade registrada em 14/11/2026

- O candidato com Painel Angular e tema original recuperado está em `perf/ifrn-course-shell`, HEAD funcional `ee06ed1a3`; localize-o com `git worktree list`. Não presuma integração à release ou ao checkout atual.
- Antes de alterar a interface ou retomar testes, leia a [transferência mais recente](src/MoodleIFRN/docs/continuidade-ia.html#sessao-painel-angular-20261114) e o [progresso](src/MoodleIFRN/docs/progresso-projeto.html#sessao-painel-angular-20261114). O usuário avaliou o Painel como quase perfeito e relatará os ajustes depois; preservar esta referência.
- A retirada experimental P0.4 foi autorizada somente no candidato; os testes/histórico foram preservados e cinco contratos continuam falhando. Não reaplicar patches nem apagar esses testes automaticamente. A autorização anterior para limpar dados do celular já foi consumida; novas operações exigem autorização específica.
