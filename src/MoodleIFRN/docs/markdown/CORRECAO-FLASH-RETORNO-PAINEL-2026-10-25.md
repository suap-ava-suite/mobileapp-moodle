# Flash das logos ao voltar do curso para o painel

## Problema

Ao retornar de um curso nativo, o painel era recriado e aparecia brevemente com
a logo do IFRN muito grande, antes de assumir o layout correto.

O HTML inicial tinha as imagens do cabeçalho e do carregamento, mas o CSS completo
do tema só era inserido pelo banner de `mobilemoodle.js`. Como esse script é
`defer`, o navegador podia exibir o HTML antes de receber as regras de tamanho,
inclusive `.ava-header-logo`. A navegação de retorno já desabilita a animação;
o intervalo sem o tema era uma etapa diferente da transição nativa.

## Correção

- `mobilemoodle/build.mjs` compila o Sass para `mobilemoodle/mobilemoodle.css`.
- `mobilemoodle/index.html` carrega essa folha no `<head>`, após o CSS do Ionic.
  Ela participa da renderização inicial e mantém a ordem dos estilos.
- O bundle deixa de inserir o tema dinamicamente. Os caminhos das fontes foram
  ajustados para resolver a partir do novo arquivo CSS.

Assim, o tamanho e o layout das logos não dependem da execução do JavaScript.
Não foram alterados cursos, sessões, autenticação nem a logo nativa sem pontos.

## Validação

Os 24 testes de regressão executados para perfil, cursos e listagem passaram.

O script `tests/painel-first-paint.android.mjs` inspeciona o WebView real por CDP.
Ele abre duas cópias isoladas do HTML com scripts bloqueados por sandbox:
uma sem o tema, para reproduzir a imagem grande, e outra com o CSS inicial.
Compara o tamanho real das imagens nos dois casos e remove os iframes ao terminar.
Não altera os perfis ou as sessões do aplicativo.

Resultado no Android conectado: sem a folha inicial, a logo do cabeçalho mediu
aproximadamente **360px** de altura; com a folha, **32px**, mesmo com o JavaScript
do painel bloqueado. A imagem de carregamento permaneceu em aproximadamente
103px de largura. Isso reproduziu o estado sem tema e confirmou sua correção.

Build web/Cordova e Gradle `assembleDebug` concluíram. O APK foi instalado com
`adb install -r`, preservando os dados. A tentativa adicional de abrir o primeiro
curso disponível chegou à rota de conexão `/login/moodle-open-course`; não foi
iniciado outro OAuth. Portanto, esta rodada não comprova uma navegação completa
por um curso nativo autenticado; a verificação do primeiro desenho do iframe e
os testes automatizados são as evidências da correção.

Após conectar o ADB e encaminhar o socket de depuração do WebView para a porta
9222, execute na raiz:

```powershell
node src/MoodleIFRN/tests/painel-first-paint.android.mjs
```

Para gerar novamente os arquivos do painel:

```powershell
node src/MoodleIFRN/mobilemoodle/build.mjs
```

Distribua `mobilemoodle.css` junto com o HTML e o JavaScript atualizados. O build
Android copia esses arquivos como assets do painel.
