# AVA IFRN Mobile — relatório técnico de adaptação iOS

Auditoria refeita em 19/10/2026. Escopo: iOS, com verificações de preservação do Android. Este documento substitui o relatório da rodada anterior e descreve o checkout e os testes desta nova execução.

## 1. Resumo executivo

O projeto tem configuração declarada para Cordova iOS 7.1.1, mas **não tem plataforma iOS preparada** neste checkout: existe apenas `platforms/android`. O ambiente disponível é Linux, sem Xcode, simulador ou iPhone disponível para homologação.

Foram corrigidos: seleção de plataforma no build web IFRN, formato do número de build iOS, mínimo iOS incompatível com o builder instalado, resolução das safe areas entre host/iframe e comunicação do teclado nativo iOS com o painel. As permissões iOS foram localizadas. O bundle mobilemoodle foi regenerado pelas fontes. O tratamento especial do teclado está condicionado a `cordova.platformId === 'ios'` no host; Android conserva seu cálculo local anterior.

**A versão iOS não está pronta para distribuição.** Faltam preparação/compilação nativas, validação dos plugins/Pods com a ferramenta Apple atual, identidade e assinatura institucionais, auditoria de privacidade e testes de ponta a ponta em iPhone.

A Apple exige Xcode 26+ e SDK iOS/iPadOS 26+ para uploads ao App Store Connect desde 28/04/2026. Os mínimos históricos do Cordova 7.x não bastam para concluir compatibilidade de publicação. Não houve atualização cega da plataforma ou dos plugins sem logs de compilação nativa. [Requisito oficial de SDK](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).

## 2. Ambiente analisado

| Item | Evidência nesta rodada |
|---|---|
| Repositório | `mobileapp-moodle`, branch `feature/moodle-curso-ifrn` |
| Commit base | `7aecc415db8a7f5582194d5a5aa1f0acc156b496` |
| Estado inicial | Arquivos rastreados limpos; já existiam relatório anterior, `apis-e-endpoints.md`, `painel-courses.ts` e testes não rastreados |
| Sistema | Linux x86_64, kernel 7.0.0-38-generic |
| Node/npm/Git locais | 22.23.2 / 10.9.8 / 2.53.0 |
| Node exigido | `>=v22.17 <23` em package.json e raiz do lock; `.nvmrc` usa `lts/jod` |
| Cordova CLI | 13.0.0 no manifesto e lock |
| Plataformas | Android 14.0.1 e iOS 7.1.1 no manifesto, lock e dependências locais; somente Android preparado |
| Framework | Angular 20.3.18; Angular CLI/build 20.3.22; Ionic 8.8.1; TypeScript 5.9.3 |
| iOS declarado | Deployment target antes 15.0, agora 16.0; SwiftVersion 5.0; WKWebView; esquema interno `moodleappfs` |
| Identidade atual | `com.moodle.moodlemobile`, nome Moodle; Bundle ID do Firebase plist coincide com o widget, sem comprovação de titularidade IFRN |
| Ferramentas Apple | `xcodebuild` e `pod` ausentes do PATH; sem execução de testes Apple nesta rodada |
| Referência Android | JDK ativo 21, JDK 17 também instalado; diretório SDK inspecionado contém Build Tools 36.0.0 e plataforma android-37.0, sem 35/35.0.0 |
| Divergência Android preexistente | config.xml solicita target 36; referência Cordova Android 14 corresponde ao SDK 35. Não alterado |

O guia oficial do Cordova iOS 7.x informa iOS 11+, Node 16.13+, Xcode 11+, CocoaPods 1.8+ e ios-deploy 1.9.2+ como mínimos históricos. O aplicativo exige mais: o arquivo `node_modules/@angular/build/.browserslistrc` aceita iOS >=16, e o build anterior alertava sobre a configuração iOS 15. O piso foi alinhado a 16; isso não constitui homologação de todas as APIs/WebKit nessa versão. [Guia Cordova 7.x](https://cordova.apache.org/archive/docs/en/12.x/guide/platforms/ios/), [compatibilidade Angular 20](https://v20.angular.dev/reference/versions).

Para um ambiente de publicação, escolher edição estável de Xcode 26+ aceita pela Apple e macOS suportado por essa edição. Como referência concreta, Xcode 26 suporta macOS Sequoia 15.6 até a faixa Tahoe indicada pela Apple e inclui SDK iOS 26. Edições posteriores têm requisitos próprios. **Deployment target 16 e SDK 26 são conceitos distintos.** [Matriz oficial Xcode/macOS/SDK](https://developer.apple.com/xcode/system-requirements).

JDK, Android SDK e Build Tools não são requisitos de compilação do iOS. Para Android 14, a documentação confirma SDK 35, Build Tools 35.0.0 e JDK 17; a divergência local permanece registrada, sem mudança de toolchain Android. [Cordova Android 14](https://cordova.apache.org/announcements/2025/03/26/cordova-android-14.0.0.html), [guia Android](https://cordova.apache.org/docs/en/latest/guide/platforms/android/index.html).

## 3. Matriz de compatibilidade

P0: bloqueia entrega iOS; P1: obrigatório para homologação; P2: manutenção.

| Componente ou fluxo | Evidência encontrada | Situação no iOS | Ação necessária | Prioridade |
|---|---|---|---|---|
| Plataforma | package/lock iOS 7.1.1; platforms/ios ausente | Declarada, sem prepare/build | Preparar e compilar no Mac; registrar versões resolvidas | P0 |
| Publicação/toolchain | Cordova 7.x verifica Xcode >=11; Apple exige SDK 26+ | Compatibilidade atual não demonstrada | Build/Archive com Xcode 26+; decidir migração conforme erros reais | P0 |
| Mínimo de instalação | Antes iOS 15; builder aceita >=16 | Configuração alinhada a 16 | Homologar menor versão oferecida e iOS atual; aprovar redução de cobertura | P1 |
| Identidade/recursos | Bundle ID e marca padrão Moodle; sem declaração de ícones iOS institucionais no config | Distribuição IFRN não configurada | Definir ID iOS/Team/marca, AppIcon, launch screen e Firebase correspondente | P0 |
| Número de build | CFBundleVersion tinha quatro segmentos | Corrigido para 5.2.1 | Conferir histórico App Store Connect e incrementar antes do upload | P0 |
| Marketplace/SUAP | enterAva chama SuapEntryService.loginWithSuap → authenticateWithBrowser | Entrada atual usa IAB do painel | Homologar autenticação oficial SUAP nessa integração existente | P0 |
| OAuth Moodle/cursos | SuapBrowserService.login e MoodleSiteService usam openBrowserForOAuthLogin | Mecanismo oficial preservado | Validar navegador do sistema, callback e identidade nos três ambientes | P0 |
| Cancelamento | Marketplace tem cancelConnection; painel observa exit e timeout de 120s; OAuth externo exige retorno/cancelamento explícito | Código existente, sem ensaio nativo | Cancelar em cada etapa, voltar do Safari sem callback, tentar novamente e rejeitar retorno tardio | P1 |
| Callback | plugin e moodle.config usam moodlemobile; core implementa handleOpenURL e valida assinatura SSO | Scheme declarado, sem URL Types gerado inspecionado | Conferir configuração final e servidores; testar app aberto/fechado e coexistência com Moodle oficial | P0 |
| Cookies/WKWebView | ionic-webview, wkwebview-cookies, wkuserscript; core fixIframeCookies específico iOS | Integração disponível, cookies não homologados | Testar os contextos Safari/IAB/WebView e limpeza apenas da sessão pertinente | P0 |
| Persistência | SQLite/CoreSites; snapshots em storage com owner/expiração; estado transitório IFRN em sessionStorage | Cache local não comprova sessão remota válida | Revogar/expirar sessão; matar processo durante OAuth e após login; testar reabertura offline | P0 |
| Perfil/foto | mapNativeProfile e mergeVerifiedPanelProfile com comparação de identidade | Testes simulados passaram | Conferir foto e dados reais na troca de contas | P1 |
| Cursos | resolução de site/curso e comparação de username em moodle-site.service | Código não alterado | Abrir Acadêmico, Presencial e AVA Aberto com sessões próprias e IDs repetidos | P0 |
| Favoritos | chave por proprietário e site/ambiente + curso | Dois testes simulados de isolamento passaram | Repetir persistência e alternância de contas em iPhone | P1 |
| Atividades/retorno | rotas de moodle-open-course e navegação do core | Sem execução nativa | Atividade → curso → painel, voltar visível, gesto lateral, links e erros | P1 |
| Safe areas/recorte | env()/calc() do host podiam chegar sem resolução ao iframe | Resolvidos em pixels no host para quatro lados | Testar notch/home indicator, rotação, zoom e status bar em aparelho | P1 |
| Teclado | plugin iOS escreve --keyboard-height no host; ion-app do host já encolhe | iframe iOS acompanha estado sem subtrair altura novamente | Confirmar foco/rolagem em campos finais e restauração após fechar teclado | P1 |
| Rede/ATS/CSP | access e allow-navigation usam *; prepare.js 7.1.1 gera NSAllowsArbitraryLoads para wildcard | Permissão ampla preexistente; CSP não substitui ATS | Auditar plist final/TLS/redirects e allowlists sem quebrar ambientes e atividades | P1 |
| Arquivos/offline | file, file-transfer, opener, chooser, zip e SQLite têm iOS | Suporte declarado, sem execução | Download, abrir PDF, compartilhar, MIME, sandbox e offline | P1 |
| Câmera/áudio/QR | plugins iOS e permissões; microfone também declarado pelo plugin local | Textos locais ajustados | Permitir/negar/revogar; capturar, anexar e voltar ao curso | P1 |
| Biometria | fingerprint-aio 6.0.1 e wrapper 9.1.2 no lock; Face ID usage configurado | Teste nativo pendente | Face ID/Touch ID, indisponibilidade, cancelamento e novo cadastro biométrico | P1 |
| Push/local/badge | push com Firebase/Messaging ~>10.23.0 e Sodium fixado por commit; entitlements APNs no plugin | Pods não resolvidos neste checkout | Compilar dependências e testar APNs em foreground/background/encerrado | P0 |
| Acessibilidade/VLibras/tema | preferências locais, VLibras remoto sob demanda e sincronização da classe dark | Sem VoiceOver/WKWebView homologados | Foco, texto ampliado, contraste, claro/escuro, movimento e indisponibilidade de VLibras | P1 |
| Privacidade nativa | config sem privacy-manifest; template Cordova vazio; device/file têm manifestos próprios; Diagnostic.m usa NSUserDefaults | Cobertura do app/plugins/Pods não auditada | Inventariar APIs/motivos e dados; gerar privacy report do Archive | P0 |
| Autoinscrição preexistente | dois testes esperam false, mapeamento atual retorna true | Falha compartilhada independente de iOS | Revisão funcional própria da normalização; sem alterar produção nesta tarefa | P1 |

**Fluxo real de autenticação:** o Marketplace atual chama `loginWithSuap`, que abre o painel/SUAP no InAppBrowser. O método `login` de SuapEntryService contém a outra entrada por helper oficial. Na abertura dos cursos, MoodleSiteService chama diretamente `CoreLoginHelper.openBrowserForOAuthLogin`. Esta diferença foi conferida nas fontes; não se afirma que toda abertura do Marketplace já use o helper. Nenhum desses caminhos de produção foi substituído nesta adaptação.

O core persiste os dados de lançamento SSO em CoreConfig, valida a assinatura do retorno e trata URLs repetidas. O estado transitório IFRN em sessionStorage tem prazo próprio; sua sobrevivência a encerramento do processo não foi demonstrada. O snapshot de perfil tem validade local máxima de 30 dias e não renova cookies/tokens nem atesta que a sessão do servidor continua válida. Conta, foto, favoritos e seleção de ambiente não foram reescritos.

A documentação do InAppBrowser distingue abertura `_system`, `_blank`, eventos e limpeza de cookies; as versões usadas aqui são forks Moodle e precisam de ensaio específico. Não presumir compartilhamento automático de sessão Safari/IAB/WebView. O plugin wkwebview-cookies usado pelo core para iframes não prova que cookies de autenticação sejam compartilhados entre todos os navegadores. [Cordova InAppBrowser](https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-inappbrowser/).

Inventário dos `plugin.xml` das dependências instaladas, confrontado com package.json/lock:

| Grupo | Plugins e versões resolvidas | Evidência e limite |
|---|---|---|
| Navegador/web | @moodlehq/inappbrowser 6.0.0-moodle.1; ionic-webview 5.0.0-moodle.5; ionic-keyboard 2.2.0-moodle.3 | Bloco iOS presente; nomes abreviados nesta tabela correspondem aos cordova-plugin-* do package |
| HTTP/arquivos | @moodlehq/advanced-http 3.3.1-moodle.1; file-opener 4.0.0-moodle.1; file-transfer 2.0.0-moodle.3; zip 3.1.0-moodle.1 | iOS declarado |
| Mídia | @moodlehq/camera 7.0.0-moodle.1; media-capture 5.0.0-moodle.1; qrscanner 3.0.1-moodle.6; statusbar 4.0.0-moodle.5 | iOS declarado |
| Notificações | @moodlehq/phonegap-plugin-push 4.0.0-moodle.13; local-notification 1.0.0; badge 0.8.9 | iOS declarado; Pods/APNs e permissões pendentes |
| Arquivos/dados | cordova-plugin-file 8.1.3; chooser 1.3.2; cordova-sqlite-storage 7.0.0 | iOS declarado |
| Integração | clipboard 1.3.0; customurlscheme 5.0.2; device 3.0.0; network-information 3.0.0; screen-orientation 3.0.4; fingerprint-aio 6.0.1 | iOS declarado; wrappers JavaScript não substituem teste nativo |
| Somente iOS | wkuserscript 1.0.1; wkwebview-cookies 1.0.1; nl.kingsquare.cordova.background-audio 1.0.1 | Dependências específicas iOS mantidas |
| Somente Android | @moodlehq/intent 2.2.0-moodle.3; @totalpave/insets 0.3.2; androidx-adapter 1.1.3; prevent-override 1.0.1 | Não removidos: Cordova filtra blocos de plataforma. Core protege WebIntent por isAndroid; edge-to-edge também é Android |
| Plugin local | cordova-plugin-moodleapp, dependência file: | SecureStorage/Diagnostic iOS; InstallReferrer/PinchToZoom têm implementação Android; detecção do core permanece preservada |
| Auxiliares | add-swift-support 2.0.2 declarado como pacote; es6-promise-plugin auxiliar | add-swift-support não está listado nos plugins Cordova da raiz; presença npm não comprova execução de hook. Conferir instalação final no Mac |

Suporte declarado em plugin.xml significa que há fontes iOS, não que compilem com o Xcode atual ou satisfaçam as regras da loja. Em especial, conferir os Pods Firebase/Sodium, certificados APNs e manifestos das bibliotecas efetivamente resolvidas.

## 4. Adaptações realizadas

| Problema | Solução e arquivos | Impacto no Android |
|---|---|---|
| Build IFRN fixava Android e mensagem sugeria binário nativo | `build-native.mjs`: aceita --platform=ios, mantém android padrão, rejeita argumentos inválidos/duplicados e esclarece que gera web/assets | Seleção e comando Android anteriores preservados |
| CFBundleVersion tinha quatro componentes | `config.xml`: 5.2.1.0 → 5.2.1 | versionCode e android-versionCode preservados |
| iOS 15 fora da faixa do builder | `config.xml`: deployment-target 16.0; `.browserslistrc`: iOS >=16 | Queries Android/Chrome preservadas |
| Safe areas do host podiam conter env()/calc() sem valor numérico | Novo `navigation/painel-host-layout.ts` mede no documento do host usando propriedades CSS concretas; `painel/painel.ts` copia os quatro valores em px | Usa os mesmos insets do host Android; não altera plugin/configuração Android |
| Teclado nativo não observado corretamente no iframe iOS | `mobilemoodle/core_mobile/app-keyboard.ts`: observa layout do host; iOS usa altura para estado/foco, deixa altura local em zero pois host já encolhe; restaura inset inferior ao fechar | Ramo condicionado ao runtime Cordova iOS; cálculo Android por visualViewport preservado |
| Descrições de permissões em inglês/localização só en | `config.xml`, bloco iOS: câmera/fotos/microfone em português e pt-BR incluído, mantendo en | Nenhuma permissão Android alterada |
| Bundle precisa refletir fontes | `mobilemoodle/mobilemoodle.js` regenerado por npm run build:mobilemoodle após alterações das fontes | Artefato compartilhado gerado pela mesma rotina |
| Mock antigo impedia teste de entrada | `docs/test-marketplace-entry.cjs`: mock de loginWithSuap e da classe SuapEntryAccountError; correção mantida conforme orientação do usuário | Apenas teste; nenhum fluxo de produção alterado |
| Necessidade de verificar limites da mudança | Novos testes painel-ios-layout e painel-favourites-isolation em tests/ | Incluem regressão simulada do teclado Android e isolamento por conta/ambiente |

Nenhum arquivo foi excluído. Não foram editados platforms/, plugins/ ou node_modules/. Package.json e lock não precisaram mudar: nenhuma dependência foi adicionada ou atualizada. As alterações de configuração compartilhada se restringem ao necessário para iOS. O número de build deve ser conciliado com o histórico institucional antes da publicação. [Formato CFBundleVersion](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion).

## 5. Pendências

| Tarefa | Dependência | Critério de conclusão | Responsável sugerido |
|---|---|---|---|
| Preparar plataforma e compilar 7.1.1 com Xcode 26+ | Mac/macOS compatível, CocoaPods e acesso aos pacotes | prepare, build e Archive bem-sucedidos; registrar toolchain e Podfile.lock | Engenharia iOS/DevOps |
| Resolver incompatibilidades nativas encontradas | Logs reais de build | Correções em fontes/config/plugins; reprepare reproduzível, sem patch só em platforms | Engenharia mobile |
| Homologar mínimo iOS 16 | Dispositivo/ambiente de teste | Fluxos aprovados na menor versão oferecida; ajustar piso se necessário | Produto/QA |
| Definir identidade e recursos de distribuição | Decisão institucional, Apple Team, Firebase | Bundle ID autorizado, assets IFRN, callbacks coerentes e APNs entregue | IFRN + mobile |
| Confirmar retornos e isolamento de contas | Contas de teste, servidores SUAP/Moodle | Callback válido funciona; inválido/tardio/cancelado não abre sessão indevida | Infra SUAP/Moodle + QA |
| Validar reabertura e expiração remota | iPhone, sessões revogáveis | Estado antigo não libera acesso indevido; retomada consistente após matar processo | QA + mobile |
| Auditar privacidade nativa | Fontes/plugins/Pods e dados efetivos | Motivos obrigatórios corretos e privacy report/Validate App sem pendências | Engenharia + encarregado de dados |
| Homologar recursos e acessibilidade | iPhone/VoiceOver/APNs | Roteiro da seção 7 aprovado com evidências | QA |
| Corrigir autoinscrição preexistente | Contrato API v2 e revisão funcional própria | Dois casos de mapeamento passam e UI distingue matrícula de vitrine | Engenharia funcional |
| Sanear lint preexistente | Convenções do projeto | Headers/nomes públicos/no-bitwise e JSDoc conformes | Engenharia |

A divergência Android de target/ferramentas é uma pendência externa a esta adaptação iOS. Não houve rebaixamento de target, atualização de Gradle ou mudança de identificador Android.

## 6. Compilação e execução

Comandos existentes confirmados: `npm run build`, `build:prod`, `build:mobilemoodle`, `dev:ios` e `prod:ios`. Os dois últimos usam `ionic cordova run ios`; prod:ios não constitui sozinho um pipeline de assinatura/publicação.

O build-native IFRN gera o conteúdo web de Cordova e escreve o dicionário pt-br em www/assets/lang; não executa o compilador nativo nem assina IPA. --check valida a seleção da plataforma e o dicionário, sem build.

```bash
node src/MoodleIFRN/build-native.mjs --check --platform=ios
node src/MoodleIFRN/build-native.mjs --check
npm run build:mobilemoodle
npx --no-install tsc --noEmit -p tsconfig.app.json
```

Roteiro necessário no macOS, ainda não executado nesta análise:

```bash
node --version
npm --version
npm ci
xcodebuild -version
xcodebuild -showsdks
pod --version
npx cordova platform add ios@7.1.1 --nosave
npx cordova requirements ios
npx gulp
node src/MoodleIFRN/build-native.mjs --platform=ios
npx cordova prepare ios
npx cordova build ios --debug --emulator
npx cordova run ios --emulator
```

Depois, abrir o workspace gerado em platforms/ios e usar Run/Archive com scheme/dispositivo apropriados. Conferir deployment target também dos Pods, URL Types, Info.plist, entitlements, assets e assinatura. Em dispositivo atual, se ios-deploy do Cordova antigo falhar, registrar o erro e executar pelo Xcode; não confundir falha do instalador com falha do binário.

O gulp prepara assets/idiomas e chama o gerador mobilemoodle. O postinstall aplica patches e instala o plugin local. O hook scripts/cordova-hooks/before_plugin_add.sh compila esse plugin quando selecionado. `scripts/build.sh` depende de scripts privados/token de CI e não foi executado; hooks/build pertence ao DockerHub. Não houve reinstalação limpa por npm ci nesta rodada. O roteiro macOS pode demandar correções conforme resultados reais.

## 7. Testes

**Ambiente de todos os testes executados: Linux/Node 22.23.2. Nenhum teste desta seção comprova funcionamento no iPhone.** Foram usados DOM/VM e dados sintéticos, sem autenticação real nem dados pessoais.

| Teste/verificação executada nesta rodada | Resultado e alcance |
|---|---|
| npm run build:mobilemoodle | Passou; fontes e bundle sincronizados |
| tsc --noEmit -p tsconfig.app.json | Passou; tipos do código compartilhado |
| npm run build | Build web de desenvolvimento passou antes e depois de restringir teclado a iOS; primeiro build 42,3 s; final: 2026-10-19T18:55:44.040Z - Hash: daa83b5697bbc117 - Time: 32535ms |
| XML/CFBundleVersion | XML válido; 5.2.1 com três segmentos numéricos |
| Build-native --check Android/iOS | Ambos passaram; 2795 entradas de idioma |
| Argumentos inválidos do build-native | Quatro casos rejeitados: plataforma desconhecida, valor com sufixo, plataforma duplicada e argumento desconhecido |
| painel-ios-layout.test.mjs | 6 casos passaram: quatro margens/rotação, teclado iOS sem redução dupla, browser independente, fallback Android, cálculo do iframe Android e origem inacessível |
| painel-favourites-isolation.test.mjs | 2 casos passaram: recriação do painel, sites com mesmo courseid, alternância e isolamento de contas |
| docs/test-marketplace-entry.cjs | Passou após correção dos mocks; teste simulado de entrada/cancelamento/recuperação |
| docs/test-oauth.cjs | Passou: snapshot de perfil/foto, expiração local e compatibilidade de sessão simulados |
| docs/test-course-environments.cjs | Passou: resolução de ambientes/idioma sem abrir cursos reais |
| docs/test-suap-entry-profile.cjs | Passou: mapeamento/enriquecimento de perfil e proteção de foto/conta |
| painel-courses.test.mjs | 5 casos passaram; o módulo painel-courses.ts preexistente não é importado pelo fluxo atual, portanto seus testes não comprovam a paginação da produção |
| painel-course-mapping.test.mjs | 1 passou e 2 falharam: matrícula aninhada v2 e autoinscrição sem confirmação retornam true em vez de false. Falhas preexistentes, produção não alterada |
| ESLint do novo painel-host-layout.ts | Passou |
| Comparação de lint com HEAD | painel.ts: 4 erros na base, 3 após edição; app-keyboard.ts: 4 erros/13 avisos na base, 3 erros/13 avisos após edição. Lint global não aprovado |
| git diff --check | Passou |

A primeira tentativa de build esbarrou na escrita da configuração Ionic em ~/.ionic; a repetição autorizada concluiu. Persistem alertas preexistentes de Browserslist Android/Chrome, CommonJS e fontes sem uso (inclusive painel-courses.ts). O alerta de iOS 15 desapareceu com a correção do mínimo.

Não foram executados build nativo Android, build nativo iOS, simulador, iPhone, Archive, TestFlight ou login autenticado de ponta a ponta. Não se declara regressão Android ausente apenas por TypeScript/build web/testes simulados.

Roteiro pendente para simulador e iPhone (registrar modelo, versão iOS, Xcode, commit/build, ambiente e resultado; remover dados pessoais das evidências):

1. Instalação limpa: Marketplace → SUAP → retorno/painel; conferir foto, identidade e cursos. Exercitar separadamente a primeira entrada Moodle de cada ambiente.
2. Reutilizar sessão válida, expirar/revogar cookies/token no servidor e voltar ao app; confirmar autenticação exigida quando cabível. Um snapshot local ainda válido não deve ser usado como prova de validade remota.
3. Cancelar na preparação, no IAB, no Safari e pelo aplicativo; retornar sem callback, receber retorno tardio/repetido/inválido e tentar novamente. Verificar loading e ausência de abertura indevida.
4. Trocar conta A → B com sessão anterior no navegador; testar divergência painel/SUAP/Moodle. Não mostrar dados, foto, favoritos ou cursos de A em B.
5. Abrir cursos Acadêmico, Presencial e AVA Aberto, com sessões separadas; repetir courseid em sites distintos, sessão expirada e conta sem matrícula.
6. Abrir atividade, arquivo e link; retornar à atividade/curso/painel pelos controles visíveis e gesto de voltar. Exercitar menus, erros de rede, timeout, lista vazia e cancelamento de carregamento.
7. Favoritar/desfavoritar, encerrar processo e reabrir; alternar contas. Testar após login e também matar o processo enquanto OAuth está aberto.
8. Teclado no iframe: foco em campo final, fechamento, rotação, home indicator e notch; confirmar que o host encolhe uma vez e não há espaços duplicados. Conferir status bar e claro/escuro após retomada.
9. VoiceOver, foco, zoom/texto ampliado, contraste e redução de movimento. Ativar VLibras, navegar e testar falha de carregamento remoto/CSP e sobreposição de controles.
10. Download/PDF/compartilhamento/offline; câmera/fotos/áudio/QR com permissões concedidas/negadas; Face ID/Touch ID e cancelamento; notificações locais e APNs em foreground/background/processo encerrado.

No simulador, registrar quais recursos não puderam ser reproduzidos. Homologar recursos físicos e o fluxo completo no iPhone antes da distribuição; executar regressão Android sem mudar sua configuração como parte desta tarefa.

## 8. Distribuição

**Requisitos técnicos:** Mac/macOS/Xcode/SDK aceitos para envio; preparar e compilar a plataforma; configurar Bundle ID autorizado, número de build crescente, assets, capacidades e entitlements. Assinar pelo Apple Team correto, com certificado Apple Distribution e perfil de provisionamento App Store, ou assinatura automática autorizada. Push depende de APNs/Firebase coerentes com o ID final. Guardar chaves/certificados fora do repositório.

Gerar Archive Release pelo workspace, inspecionar privacidade, Validate App e enviar ao App Store Connect. Resolver diagnósticos do binário e preencher export compliance conforme criptografia efetivamente utilizada. Após processamento, liberar TestFlight interno; testes externos podem exigir Beta App Review. Somente submeter à App Review após homologação. [Fluxo oficial TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

**Privacidade:** Cordova 7.1 adicionou suporte a privacy-manifest no config.xml, mas seu template vazio não declara corretamente todos os usos dos plugins. Device e File já incluem manifestos próprios; o plugin local Diagnostic usa NSUserDefaults e outros plugins/Pods precisam ser inventariados. Não foram inventados motivos de API ou declarações de ausência de coleta. Auditar manifestos do conjunto final e gerar o privacy report no Archive. [Cordova: suporte ao manifesto](https://cordova.apache.org/announcements/2024/04/03/cordova-ios-7.1.0.html), [Apple TN3183](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest).

**Responsabilidades institucionais:** IFRN deve confirmar titularidade Apple Developer/Team, Bundle ID, marca, responsáveis por certificados/APNs, acessos App Store Connect, suporte, política de privacidade/LGPD, declarações de dados/público/classificação etária e material de loja. Fornecer acesso autorizado de revisão ou demonstração apropriada ao conteúdo restrito. Avaliar regras de autenticação/contas aplicáveis ao modelo institucional e aos recursos realmente oferecidos; não presumir exigência automática de Sign in with Apple. [Diretrizes App Review](https://developer.apple.com/app-store/review/guidelines/).

## 9. Conclusão

Estão implementadas e disponíveis para revisão as adaptações de configuração/build web, mínimo iOS, permissões e layout do painel, incluindo teclado condicionado ao iOS e bundle regenerado. O helper oficial de OAuth Moodle, perfil/foto, favoritos, resolução dos ambientes e verificações de identidade de produção permanecem preservados.

A integração nativa permanece parcialmente adaptada: os plugins declaram suporte iOS, porém não há compile/Archive nem validação em WebKit/iPhone. A entrega depende do ambiente Apple, identidade/assinatura institucionais, auditoria de privacidade e homologação dos fluxos. As duas falhas funcionais preexistentes de autoinscrição foram registradas, sem expandir as alterações de produção além do escopo iOS.
