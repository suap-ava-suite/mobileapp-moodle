# Teste no Android: Acessibilidade → Metodologia → Acessibilidade

Teste solicitado pelo usuário, executado em 20/10/2026 com cliques nos cards reais do Painel. Nenhuma matrícula, atividade ou dado acadêmico foi alterado. O app foi deixado no Painel ao final.

## Versão efetivamente testada

A tentativa de instalar o APK corrigido com `adb install -r` foi recusada por `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. A versão instalada usa certificado debug SHA256 `ec5af1754b0f490cfe6a77d57d7dc6edcd31dadb9ae978703a86b2dc69c0c72e`; a chave debug disponível assina com `a0e22064dcf5ff7eb40eba84f3c21a7324869eb59a1f34839687b32d1efdbf62`. Os certificados são públicos; nenhuma chave privada ou token foi exportado.

Portanto, a sequência foi executada na **versão já instalada**, não no novo APK. SHA256 do APK instalado, consultado por `adb pull`: `10A803F333B3BEE45CD8B2C78E8B3015DAEA042042919973702B360709836BD4`. Não houve desinstalação, limpeza de dados nem substituição forçada da assinatura. Foi solicitado o caminho da chave anterior para permitir atualização preservando as sessões.

## Resultado observado

| Etapa | Curso/ambiente | Resultado |
| --- | --- | --- |
| 1 — 21:33:45 | Acessibilidade Atitudinal na Instituição Educativa 2026.2, ID 4022, Acadêmico | Abriu navegador e recebeu callback. Ficou em `/main/home`, sem curso visível. Voltar no Android saiu do app; foi reaberto e o Painel recuperado pelo botão de continuar. |
| 2 — 21:34:49 | Metodologia Científica e Tecnológica (NCT), ID 2836, Presencial | Abriu navegador, recebeu callback e chegou a `/main/home/course/2836/contents`. Título correto e 18 elementos de formato/módulos/accordions na página. Voltar retornou ao Painel. |
| 3 — 21:35:17 | Acessibilidade, ID 4022, Acadêmico | Abriu navegador novamente; houve mais de uma tentativa/callback. Terminou na ponte com erro `NG0911`, sem curso visível. O botão Voltar ao Painel AVA foi utilizado ao final. |

Foi confirmada a existência das contas de ambos os ambientes, com username correspondente ao Painel e sem marca de logged-out. Porém, após Metodologia, somente o Presencial tinha token no armazenamento seguro. Depois de autenticar novamente no Acadêmico, somente o Acadêmico tinha token. Campo vazio de token no SQLite, isoladamente, não foi usado como prova: a presença foi consultada também pelo plugin seguro, retornando apenas booleanos.

## Causa da perda de tokens e correção preparada

`CoreSitePluginsInit.loadSitePlugins()` chama `CoreSites.deleteTokensFromOtherSites()`. O núcleo remove tokens de outros ambientes quando o aplicativo não possui lista de sites confiáveis. A configuração estava com `sites: []`. Assim, a alternância podia manter metadados da conta e apagar sua credencial nativa, levando ao novo OAuth.

Foi configurada a lista explícita dos ambientes institucionais em `moodle.config.json`. Isso usa o mecanismo oficial `CoreLoginHelper.hasSiteAllowlist()` e mantém a política de segurança do núcleo para apps sem lista confiável. Não foram desabilitados os plugins nem alterada a função que remove tokens. O ambiente Projetos também consta em [publicação oficial do IFRN](https://portal.ifrn.edu.br/eventos/6809/).

O teste `course-trusted-sites.test.cjs` executa os métodos reais extraídos do núcleo: reproduz a remoção com lista vazia e verifica preservação na sequência Acadêmico → Presencial → Acadêmico com a configuração institucional.

A seleção de sessões também passou a verificar a presença do token no CoreSite, além da marca logged-out. Isso permite recuperar as contas cujo token já foi apagado pela versão anterior: metadados sem token levam à oferta explícita de conexão, sem tentar ativar a conta nem gerar erro genérico de recuperação. Uma entrada histórica com token continua tendo preferência sobre uma entrada canônica sem token. Falha de leitura do armazenamento continua propagando erro, pois não comprova ausência de credencial.

O script de build Android foi corrigido para executar `gulp env` antes de `ng run`, já que esse comando não executa automaticamente o hook do Ionic. Sem isso, editar `moodle.config.json` podia deixar a lista antiga no `src/assets/env.json` efetivamente compilado. A configuração gerada foi conferida: cinco ambientes e modo development correspondente ao alvo do build.

## Erro Angular

A stack sanitizada do `NG0911` aponta para `CoreLoadingComponent_Conditional_0_Template`, `afterNextRender`, `scheduleAnimationQueue` e `storeLViewOnDestroy`: a animação tenta registrar uma ação numa view já destruída. Foi preparado um ajuste de compatibilidade que remove somente `animate.enter/animate.leave` do template de loading, preservando spinner, placeholders, conteúdo e o workaround CSS já existente no componente.

O ajuste está documentado e reaplicável em `MoodleIFRN/moodle-course/patch-loading-animation.cjs`, integrado ao `patch-moodle-ifrn.js`. O template correspondente em `src/core/components/loading/core-loading.html` contém a alteração mínima. Seu teste verifica preservação do conteúdo e idempotência. Esse ajuste ainda precisa de validação na nova versão instalada; a stack identifica o ponto de falha, mas o teste de transformação do template não substitui a reprodução Android.

## Limite da conclusão

40 testes de sessão, consulta, navegação, lista confiável e compatibilidade passaram. A nova versão ainda não foi validada no aparelho devido à assinatura incompatível. A sequência acima reproduz o defeito; não representa aprovação das correções posteriores.

TypeScript, build web Cordova, `cordova prepare android` e Gradle `assembleDebug` passaram. APK final em `platforms/android/app/build/outputs/apk/debug/app-debug.apk`, 50.148.193 bytes, SHA256 `71E13572275E7D5D233A39AA0FEEC3ACF8A07954A9A7C7A4807166CD5A51FBF1`. A inspeção ZIP confirmou lista confiável compilada, ausência dos hooks de animação no template de loading, Cordova e idioma pt-br. Este APK substitui os anteriores para novos testes, mas continua assinado com a chave debug disponível, incompatível com a versão instalada. Não foi feita nova tentativa de instalação sem a chave anterior, pois o certificado permanece diferente.

## Reinstalação autorizada e teste posterior

O usuário autorizou explicitamente desinstalar a versão incompatível e instalar o APK corrigido. Ambas as operações retornaram `Success`. A nova instalação executou com Cordova Android, Angular inicializado e Painel IFRN acessível. Antes do primeiro curso, a consulta de sessões Moodle retornou lista vazia.

No clique em Acessibilidade, foi exibida a opção **Conectar este ambiente**, sem abrir navegador automaticamente. O botão foi acionado para criar a primeira sessão do Acadêmico. O callback e o evento LOGIN ocorreram; o token do Acadêmico ficou presente no armazenamento seguro e a identidade correspondeu ao Painel. O curso, porém, não ficou visível: a navegação foi para `/main`, e a confirmação da rota expirou após 45 segundos. Uma nova tentativa com a sessão já existente também ficou em `/main`, sem novo navegador. Não houve NG0911 nessa tentativa.

O usuário informou que não queria a tela que estava vendo, por considerá-la antiga/diferente da versão nova. Os testes na interface foram interrompidos e o app foi devolvido a `/login/painel`, com tentativa pendente encerrada e perfil/dashboard/token preservados. Foi solicitada confirmação sobre se a diferença percebida era só na tela padrão do Moodle ou também no Painel IFRN. **A sequência completa ainda não foi aprovada no APK novo.**

A observação da navegação mostrou apenas `/main`, sem seleção de aba nem rota de curso. Foi preparada em código uma entrada explícita na rota nativa `/main/home/course/{id}` ao partir da shell IFRN, carregando os dados pelo CoreCourseHelper e preservando o handler usual quando já existe aba nativa. Isso evita depender da seleção automática do Dashboard. Há três testes adicionais dessa entrada, totalizando 43 testes aprovados nesta seleção. Essa alteração posterior ainda não foi instalada/testada no aparelho; o APK de SHA256 `71E135...` não a contém.

O usuário esclareceu depois que o Painel estava correto e que uma nova abertura exibiu o curso com a interface esperada. A inspeção confirmou Acessibilidade em `/main/home/course/4022/contents`, com título correto e 14 elementos de formato/módulos/accordions. Voltar retornou a `/login/painel`. Na abertura seguinte de Metodologia, o Presencial ainda não possuía sessão, e a conexão explícita foi acionada. O usuário relatou loop durante essa conexão. O teste foi novamente interrompido e o app devolvido ao Painel, preservando o token do Acadêmico. A conexão Presencial e a terceira abertura ainda não foram aprovadas nessa rodada.

Foi adicionada proteção de retomada OAuth de uso único, vinculada ao curso e ambiente, com validade de dois minutos. Uma rota `startOAuth=true` sozinha não autoriza outra autenticação; marcadores antigos ou já consumidos passam a oferecer conexão em vez de reiniciar o fluxo. O retorno OAuth só é consumido quando a sessão corresponde à identidade e ao ambiente do curso pendente. O callback também transporta o ambiente e desativa explicitamente flags anteriores de conexão. Os novos testes verificam reentrada em cache sem segundo OAuth, expiração/uso único/escopo da retomada e rejeição de sessão Acadêmico para retorno Presencial. A seleção passou a ter 46 testes aprovados; a nova compilação ainda precisa de validação no aparelho.

## Rodada com entrada direta e retomada OAuth de uso único

O APK de SHA256 `DBF59FF701D954A18EBB2779095CD74DF93E2A604E6421F5C3F0B3C8DC2A8E4E` foi instalado com `adb install -r`, preservando os dados. Acessibilidade abriu diretamente em `/main/home/course/4022/contents`, com 14 elementos de conteúdo, sem reconexão.

Metodologia ainda não tinha token após as tentativas interrompidas. O card exibiu Conectar este ambiente. Essa primeira conexão explícita abriu o navegador, recebeu autenticação e chegou a `/main/home/course/2836/contents`, com 18 elementos de conteúdo. Depois disso, os tokens de Acadêmico e Presencial foram confirmados simultaneamente no armazenamento seguro, com identidades correspondentes ao Painel.

Na terceira abertura, Acessibilidade abriu diretamente: os logs de 22:00:14–22:00:15 mostram conta armazenada recuperada, identidade validada e curso aberto, sem nova preparação/abertura OAuth. Foi feita ainda uma nova abertura de Metodologia pelo card: os logs de 22:01:57 mostram recuperação do site salvo e curso aberto, sem novo navegador. Nenhum NG0911 foi identificado nessa rodada. A primeira conexão do Presencial não foi apresentada como eliminação do navegador: ela continua dependendo do fluxo oficial.

No teste adicional de Voltar, uma página anterior de Metodologia ainda pôde aparecer na pilha ao sair de Acessibilidade. Para impedir restauração de telas de outro ambiente, a entrada nativa a partir da shell passou a usar reset de navegação. O Voltar Android foi registrado abaixo da prioridade de overlays/abas e acima da navegação comum: somente o índice marcado como originado do Painel volta ao Painel; atividades continuam com a navegação nativa. O retorno explícito ao Painel também limpa a pilha visual. Um teste adicional cobre prioridade, ausência de navegação durante o registro e delegação fora do índice. A seleção passou a 47 testes aprovados. Essa última correção ainda estava em compilação nesta etapa do registro.

## Validação final com as duas sessões existentes

APK SHA256 `5965A5CE51D423E8D9F8E0F71958D85F46DA3BD61BD5D5E3DE8E7D25C9E0A87C`, instalado com `adb install -r`, preservando as sessões. TypeScript, build web, preparação Cordova e Gradle concluíram com sucesso, além dos 47 testes direcionados.

Sequência executada pelos cards reais do Painel e botão Voltar do Android entre cursos:

| Curso | Clique / abertura nativa (horário do log) | Rota confirmada | Conteúdo visível |
| --- | --- | --- | --- |
| Acessibilidade | 22:05:47.987 / 22:05:48.851 | `/main/home/course/4022/contents` | 14 elementos |
| Metodologia | 22:06:02.252 / 22:06:02.579 | `/main/home/course/2836/contents` | 18 elementos |
| Acessibilidade | 22:06:16.082 / 22:06:16.356 | `/main/home/course/4022/contents` | 14 elementos |

O Voltar retornou diretamente a `/login/painel` nas duas transições, sem restaurar o curso do outro ambiente. Os três cliques recuperaram a conta salva, validaram identidade e abriram o curso nativo, sem eventos de abertura do navegador ou preparação OAuth. Ao final, Acadêmico e Presencial continuavam com tokens no armazenamento seguro e identidade correspondente ao Painel. O aplicativo ficou em Acessibilidade.

A primeira conexão anterior do Presencial realmente abriu o navegador; este teste confirma o reaproveitamento posterior das duas sessões, não autenticação inicial silenciosa. Nenhuma integração de servidor para troca de credenciais foi implantada nesta rodada.

Não houve novo NG0911. O log da primeira abertura final registrou quatro erros `Cannot read properties of undefined (reading 'onAriaChanged')`, originados em `vendor.js`, associados ao watcher de acessibilidade de botões Ionic. Não impediram as três aberturas nem o retorno ao Painel; permanecem uma observação técnica, sem declaração de ausência total de erros JavaScript.
