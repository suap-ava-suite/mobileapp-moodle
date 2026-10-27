# Roteiro do coletor CDP Android

**Roteiro canônico atualizado:** [ROTEIRO.md](./ROTEIRO.md). Consulte-o para teste de fumaça, seis rodadas e modo de vazamento `GC=1 LEAK=1`.

## Arquivos

- `coletor-cdp-aparelho.mjs`: coletor sem dependências, para Node 22 e WebSocket nativo.
- Ao executar, cria o próximo par livre `medicao-NN.json` / `medicao-NN.md` neste diretório. Não executa sozinho neste momento.

## Pré-condições

1. Confirme que o Moto G20 aparece como `device` em `adb devices -l`, com depuração USB autorizada.
2. Deixe o AVA IFRN Mobile aberto, logado e na tela Marketplace antes de começar. Não faça logout, não limpe dados, não envie atividade, não se inscreva e não altere perfil/notas.
3. Use o mesmo curso já acessível para todas as rodadas. Se aparecer uma página de inscrição, envio ou alteração, não confirme: volte ao painel.
4. Feche qualquer outro coletor que esteja usando a porta local 9222. O script se recusa a reutilizar um forward existente.

## Iniciar gravação

Na raiz do repositório, execute:

```bash
node .analise/fase2/coletor-cdp-aparelho.mjs
```

O script localiza o processo `com.moodle.moodlemobile`, encontra seu socket WebView, encaminha a porta 9222 e escolhe o alvo da página do app. Se não encontrar uma página ativa, ele encerra e remove o forward que tiver criado. Durante a gravação, o terminal aceita:

- `u` + Enter: marca a transição mais recente como visualmente utilizável. Faça isso assim que a tela estiver pronta para uso. O tempo inclui a reação humana e será rotulado como marcação manual.
- Enter vazio: encerra a navegação, aguarda até 2 segundos para requests em andamento terminarem, grava o JSON/Markdown sanitizados e remove o forward. Não continue navegando durante essa espera.

Não digite credenciais, matrícula, nome ou qualquer dado pessoal no terminal.

## Seis rodadas

Faça exatamente seis ciclos. O primeiro é rotulado como a amostra fria do protocolo; o coletor não limpa cache nem dados do app, então isso **não** significa cache frio garantido.

Para cada rodada:

1. Comece no Marketplace.
2. Toque uma vez na entrada/botão que abre o Painel; quando o painel estiver utilizável, digite `u` e Enter.
3. Toque uma vez no mesmo cartão de curso já acessível; não interaja dentro do curso. Quando o conteúdo do curso estiver utilizável, digite `u` e Enter.
4. Pressione o botão Voltar do Android uma vez para retornar ao painel; marque com `u` quando estiver utilizável.
5. Para iniciar a próxima rodada, volte do painel ao Marketplace pelo fluxo normal e marque a tela com `u`. Não faça logout.

Assim, ao fim das seis rodadas, haverá seis aberturas do painel, seis aberturas do curso e seis retornos curso→painel; as cinco voltas intermediárias painel→Marketplace também ficam registradas. Na sexta rodada, encerre com Enter vazio depois do retorno ao painel (não precisa voltar ao Marketplace).

Se a navegação tomar um caminho inesperado, continue sem interagir com ações acadêmicas e encerre com Enter vazio. O relatório registrará somente transições observadas; não complete etapas por meio de inscrição ou envio.

## O que o script grava

- Timestamp, tipo de navegação, host e caminho sanitizado sem query/fragmento e rota hash separada, também sanitizada.
- Contagem de requests e `encodedDataLength` por host, falhas de carregamento, long tasks, métricas CDP, nós DOM e listeners adicionados/removidos depois da injeção.
- Contagem observada de requests a `jsdelivr.net` e `vlibras.gov.br` durante a janela gravada.

Ele não grava cabeçalhos, query strings, o fragmento bruto da URL, cookies, tokens, corpos de resposta ou texto/HTML da página. Para identificar mudança de hash da SPA, salva separadamente apenas a rota sanitizada extraída do fragmento, sem query e com segmentos dinâmicos mascarados. Segmentos de caminho desconhecidos, numéricos e identificadores prováveis são mascarados como `[segment]` ou `[redacted]`. A contagem de listeners começa após a injeção; listeners existentes antes disso ficam fora. A ausência de um host na saída só vale para o período gravado, não para recursos carregados antes do início.

## Buffer crash consultado nesta preparação

Comando executado: `adb logcat -b crash -d | tail -50`, com saída reduzida no pipe a contagens para evitar persistir/mostrar as linhas brutas. O buffer entregou 17 linhas; houve um marcador `FATAL EXCEPTION`/`Fatal signal`, mas nenhuma referência textual ao pacote `com.moodle.moodlemobile` nas linhas consultadas. Portanto, o resultado é **inconclusivo para atribuir esse crash ao app**. O coletor não lê nem salva logcat.

## Validação feita antes da entrega

`node --check .analise/fase2/coletor-cdp-aparelho.mjs` valida a sintaxe sem iniciar a coleta. O coletor não foi executado; medições A2–A8 continuam pendentes até o operador seguir o roteiro acima.
