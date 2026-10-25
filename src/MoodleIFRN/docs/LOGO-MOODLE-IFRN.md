# Logo principal do Moodle IFRN

## Configuração atual: ampliada, sem símbolos laterais

A pedido do usuário, o quadrado verde e o círculo vermelho à direita foram
removidos. O “m” vermelho/verde, capelo azul e pendão laranja foram mantidos.
A imagem principal continua em `src/MoodleIFRN/resources/logo-moodle-ifrn.png`.
O drawable agora usa margem de `32dp`, menor que os `48dp` anteriores, para
exibir o símbolo maior. Os registros abaixo descrevem as etapas anteriores.

Edição feita com a ferramenta integrada de imagens. Prompt:

```text
Edit this exact approved logo with ONE content change: REMOVE the two small trailing shapes to the right, the green square and red circle. Keep ONLY the red-and-green lowercase m and its original navy blue graduation cap with orange tassel. Preserve the m silhouette, red LEFT half, green RIGHT half, diagonal boundary, vivid colors, cap position/angle, and all internal proportions exactly. Recenter the remaining m-and-cap emblem horizontally and vertically on the transparent canvas, balanced margins, same overall scale. Do not add any text, punctuation, new symbols, shadows, outlines, gradients or background. Genuine transparent alpha. This is a production asset for a white Android splash screen; keep entire cap and m visible.
```

## Histórico da escolha e ajustes

Escolhida pelo usuário em 25/10/2026: proposta v6.

Arquivo oficial do projeto: `src/MoodleIFRN/resources/logo-moodle-ifrn.png`.

A arte tem o “m” vermelho à esquerda e verde à direita, com divisão diagonal,
capelo azul-escuro e pendão laranja. O PNG mantém fundo transparente.
O arquivo foi inicialmente movido da proposta v6. Depois, a pedido do usuário,
foi ampliado discretamente dentro da tela e recebeu cores mais vivas, mantendo
o conceito, a divisão diagonal e as cores do capelo. As demais propostas
presentes no repositório foram excluídas a pedido do usuário.

## Uso principal

O `config.xml` referencia `src/MoodleIFRN/resources/android-splash.xml` em
`AndroidWindowSplashScreenAnimatedIcon`. Esse drawable usa a logo principal,
copiada como `drawable-nodpi/ifrn_splash_logo.png` por um `resource-file`.
O XML reserva margem interna de `48dp` nos quatro lados para manter a composição
na área visível da máscara do splash Android. Apenas remover os recuos negativos
não resolveu o recorte relatado pelo usuário; essa margem reduz a área ocupada
para incluir o quadrado e o círculo à direita. Para futuros ajustes, preserve
essa área de segurança e confira no aparelho. As cores do PNG não mudam pelo XML.

Validação no aparelho: com `24dp` a captura ainda mostrou recorte; com `48dp`,
após compilar e instalar sem limpar dados, a captura confirmou o quadrado verde
e o círculo vermelho completos à direita. A composição ficou menor para caber
inteira na máscara do sistema.
O fundo da abertura Android permanece branco. O ícone do lançador, os favicons
do painel e os recursos iOS têm configuração separada.

Validação inicial: `cordova prepare android` e Gradle `assembleDebug` concluíram
com a v6. Seu SHA-256 antes do ajuste de tamanho/cor era
`0EE515A06B065B40592992C044722E8D48E6C6668E5964E89385F6053CD30AEA`.

## Ajuste de tamanho e intensidade

Foi usada a ferramenta integrada de imagens com a v6 como referência. O ajuste
solicitou cerca de 10% de ampliação e um reforço discreto de saturação, com fundo
transparente e sem novos elementos. Esses percentuais são orientações visuais ao
gerador, não medidas determinísticas sobre cada pixel.

Prompt do ajuste:

```text
Perform a minimal production adjustment to this approved logo, NOT a redesign. Two changes ONLY: (1) uniformly enlarge the whole existing logo by approximately 10 percent within the same transparent canvas, reducing empty padding evenly while keeping all elements fully visible and centered; (2) modestly increase color saturation by about 10 percent for a slightly more vivid result. Preserve the SAME existing hues and brightness: red remains the same red on the LEFT of m, green remains the same green on the RIGHT, cap stays dark NAVY BLUE and tassel stays ORANGE. Do not change hue or brighten the navy. Preserve EXACTLY the m outline, original diagonal color division, cap silhouette and angle, tassel, small green square and red circle, and all relative positions/proportions. No new details, no extra shapes, no shadows, no redesign, no gradients added, no text. Preserve genuine transparent alpha background. The user approved this exact v6 design and wants just a little larger and slightly more vivid.
```

Para trocar a arte, substitua esse PNG ou atualize o caminho no `config.xml`.
Prepare e compile novamente o Android. O procedimento completo está em
[TROCAR-IMAGEM-ABERTURA-ANDROID.md](TROCAR-IMAGEM-ABERTURA-ANDROID.md).

## Origem

Criada e editada com a ferramenta integrada de geração de imagens. A v6 foi uma
edição da proposta com “m” azul, preservando seu capelo e trocando as cores da letra.

Prompt da versão escolhida:

```text
Edit the provided exact logo. Preserve the original graduation cap EXACTLY as shown: dark navy blue upper mortarboard and dark navy blue lower band, orange/gold tassel, unchanged position and proportions. The user's correction is that ONLY the lowercase m should combine the IFRN colors RED and GREEN instead of blue. Recolor the m with an elegant clear two-tone treatment: the left arch and left stem in institutional red #D52B30, the right arch and right stem in institutional green #2F9E41, meeting cleanly at the middle stem with a crisp subtly diagonal color division. Both red and green must be visible across meaningful portions of the m itself, roughly 40 percent red and 60 percent green. No blue anywhere on the m; blue belongs only to the original cap. Preserve the same rounded m silhouette, thickness, proportions and alignment. Keep the small green square and red circle at the lower right unchanged. Flat solid color, no gradient transitions. Preserve actual transparent alpha background and outer margins. No extra symbols, no text, no mockup. One logo only.
```
