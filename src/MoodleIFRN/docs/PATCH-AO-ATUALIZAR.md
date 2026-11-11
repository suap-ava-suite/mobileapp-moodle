# Reaplicar integrações MoodleIFRN após atualizar Moodle Mobile

Revisado em 11/11/2026. Este procedimento altera arquivos do projeto e pode modificar o núcleo Moodle. Faça-o numa branch de atualização, com o repositório limpo ou com alterações conhecidas, e revise cada diff antes de aceitar.

## Scripts envolvidos

O comando npm run patch:ifrn executa src/MoodleIFRN/patch-moodle-ifrn.js. O script é idempotente para os marcadores e transformações que reconhece, mas idempotência não significa que seja seguro para qualquer versão do Moodle: ele interrompe quando não encontra as estruturas esperadas. Ele também chama:

- moodle-course/patch-course-menu.cjs;
- moodle-course/patch-loading-animation.cjs;
- scripts/apply-versioned-core-patch.cjs, usando patches/p0.4-session-isolation.manifest.json e seu patch versionado.

## O que pode ser alterado

A implementação atual integra rotas e guards IFRN no módulo de login e inicialização/guard de navegação no menu principal. Também pode atualizar:

- src/core/features/login/login.module.ts;
- src/core/features/mainmenu/mainmenu.module.ts;
- src/core/features/course/pages/index/index.ts;
- src/core/features/course/components/course-format/course-format.ts;
- src/core/features/course/components/course-index/course-index.html;
- src/core/features/course/pages/contents/contents.ts e contents.html;
- src/core/components/loading/core-loading.html;
- src/core/services/urlschemes.ts;
- angular.json, gulpfile.js, package.json e src/index.html.

O script registra assets do painel e folhas de estilo IFRN, a tarefa Gulp mobilemoodle-ts e os comandos npm patch:ifrn/build:mobilemoodle. Os scripts auxiliares integram o menu e o botão Voltar do curso e ajustam a animação do componente de loading.

Além dessas edições por transformação textual, o manifesto P0.4 aplica um patch versionado em 12 destinos. Eles incluem classes de persistência SecureStorage Android/iOS/TypeScript, tabelas de banco de dados, armazenamento de sites e eventos do núcleo Moodle. O manifesto compara hashes-base e hashes finais; exige que todos os destinos estejam no estado-base ou todos no estado-final e interrompe sem escrever quando há estado parcial ou divergente. Não edite os hashes manualmente para forçar a aplicação.

## Fluxo recomendado após atualizar Moodle Mobile

1. Crie uma branch a partir da atualização upstream aprovada e registre o commit-base.
2. Preserve a pasta src/MoodleIFRN e instale dependências segundo o lockfile.
3. Antes de executar o patch, confirme que as alterações locais são conhecidas:

~~~sh
git status --short --branch
git diff --check
~~~

4. Execute o patch somente depois de revisar o escopo:

~~~sh
npm run patch:ifrn
~~~

5. Leia o diff completo. O patch toca src/core, plugin Cordova, angular.json, gulpfile.js, package.json e src/index.html; aceite somente as mudanças esperadas e compatíveis com a versão upstream.
6. Gere novamente o painel e a aplicação, depois execute os testes de navegação, persistência, autenticação e cursos. Registre falhas preexistentes separadamente.
7. Confirme que o manifesto P0.4 está íntegro e que a regressão de concorrência continua sendo executada. Não descreva P0.4 como resolvida sem validação da persistência real Android/iOS.

## Build do painel após o patch

~~~sh
npm run build:mobilemoodle
~~~

Esse comando compila o painel local TypeScript/SCSS e sincroniza assets. Ele não compila uma APK/AAB nem um binário iOS.

## Modos restritos

O script também reconhece --course-menus-only e --mobile-auth-callback-only. Esses modos mexem em trechos do núcleo e devem ser utilizados apenas em uma atualização em que o mantenedor confirmou que esse patch isolado é desejado.

## Reversão e manutenção

Não reverta arquivos inteiros cegamente: cada destino pode ter mudanças legítimas posteriores. Para desfazer uma integração, reverta seletivamente o commit que a introduziu, após revisar o diff e os testes. Nunca use git reset --hard ou git clean como estratégia de atualização.

A pasta patches não é descartável: o manifesto P0.4 usa o patch versionado para reproduzir alterações sensíveis ao núcleo e verificar integridade. Atualizar Moodle Mobile pode exigir rebase/recriação deliberada do patch, revisão de todos os destinos e execução da suíte específica.