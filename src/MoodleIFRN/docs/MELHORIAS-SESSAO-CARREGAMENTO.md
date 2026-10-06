# Sessão persistente e carregamento do curso

Alterações restritas à pasta MoodleIFRN enviada em 06/10/2026.

## Aplicar

Substitua `src/MoodleIFRN` pela pasta deste ZIP e execute o build habitual do projeto. O `mobilemoodle.js` incluído já contém as mudanças da SPA; o build habitual poderá regenerá-lo a partir dos TypeScript. Nenhuma nova dependência ou alteração de rota é necessária.

## Comportamento

- Marketplace permanece visível. Ao tocar em Entrar/Continuar, o login retoma os tokens e recupera os dados AVA antes de abrir o painel.
- Access token válido é reutilizado. Quando expira, o refresh token renova a sessão no SUAP; o refresh retornado também é atualizado.
- Senha não é salva. Tokens e matrícula ficam no localStorage da mesma origem do WebView; dados transitórios do curso e caches continuam no sessionStorage.
- Refresh rejeitado com 400/401 limpa a sessão. Falha de rede mantém o refresh para uma tentativa futura, sem conceder acesso com token expirado.
- Sair no painel elimina tokens persistidos, matrícula e ativação biométrica. Troca forçada de matrícula continua mostrando o formulário.
- O cache do dashboard não é usado como credencial persistente. Ao reabrir, a tela Ionic recupera os dados pelo InAppBrowser preservando os cookies da mesma conta, antes de abrir a SPA. Login novo continua limpando cookies. A sessão web/OAuth do Painel AVA e a sessão Moodle são independentes: servidores ainda podem exigir novo OAuth se suas sessões expirarem.
- Os anéis de carregamento da ponte e da passagem ao Moodle usam verde institucional, mantendo logo, fundo branco e redução de movimento.

## Papel das pastas

- `marketplace-ifrn`: entrada e recuperação da sessão.
- `ifrn-login`: login, verificação e biometria.
- `services_mobile`: autenticação SUAP, integração Painel AVA e ponte com CoreSites/CoreCourseHelper do núcleo Moodle.
- `navigation`: proteção das rotas e carregamento durante passagem ao curso nativo.
- `moodle-open-course`: tela intermediária que preserva o fluxo OAuth/abertura existente.
- `mobilemoodle`: painel em HTML/TypeScript e bundle JavaScript; compartilha a origem e storage com Ionic.
- Fora desta pasta, os módulos de login/mainmenu registram rotas; CoreSites gerencia a sessão Moodle e CoreCourseHelper abre conteúdos. Não foram alterados neste trabalho.

## Validação

Passaram: TypeScript estrito do painel, sintaxe do bundle, compilação Sass das duas telas e cenários simulados de reabertura, recuperação da matrícula, renovação/rotação, logout e falha de rede.

Não executados: build Angular completo, autenticação real SUAP/Painel/Moodle e teste em APK. O repositório remoto não pôde ser acessado neste ambiente; a base foi o ZIP anexado.

Teste no dispositivo: login → fechar completamente o app → reabrir → painel; repetir após expiração do access; abrir curso; sair → fechar/reabrir → marketplace/login; testar outra matrícula.

Os tokens persistidos usam localStorage, acessível ao JavaScript da origem, e não um cofre criptografado do sistema. A política de segurança de produção deve considerar esse armazenamento. A persistência vale para a mesma instalação/origem, até sair, limpar dados ou expirar o refresh do SUAP.

## Correção após teste no dispositivo

Removido o redirecionamento incondicional do marketplace por JWT SUAP. A SPA exige dashboard AVA em sessionStorage; JWT SUAP sozinho não satisfaz essa condição. Na retomada, authenticateWithBrowser({ reuseSession: true }) recupera esses dados com cookies preservados. Se o servidor expirou a sessão, o navegador pode pedir novo OAuth. A recuperação tem limite de 120 segundos e retorna erro ao formulário se falhar.

A sobreposição de passagem ao Moodle agora oferece Voltar ao Painel e é removida ao reconhecer a rota principal do curso. Esse ajuste não constitui validação do OAuth Moodle real.

mobilemoodle.js foi gerado pelo script mobilemoodle/build.mjs, usando esbuild, sem edição manual.

Testes adicionais: marketplace não navega automaticamente; painel sem dashboard recupera dados antes de abrir; dashboard atual não repete autenticação; falha/cancelamento da recuperação não navega.
