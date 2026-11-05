# P0.5 — baseline Android por USB

Data: 2026-11-01. Branch preservada: `fix/p0-release-2.0.1`; HEAD inicial `5f88fd805653d0bc6d8d816332bdf06df14ec41e`.

## Dispositivo e versão instalada

Foi confirmado **exatamente um dispositivo autorizado**, antes das ações. Os scripts ADB repetem essa verificação. O número de série não é reproduzido neste relatório.

| Campo | Resultado comprovado |
|---|---|
| Modelo | moto g(20) |
| Android | 11 |
| Package ID | `com.moodle.moodlemobile` |
| Activity resolvida e em primeiro plano | `com.moodle.moodlemobile/.MainActivity` |
| Versão instalada | 5.2.1 |
| Version code | 52100 |
| Target SDK declarado | 36 |
| DEBUGGABLE | Presente |
| TEST_ONLY | Ausente |
| Processo observado | PID 21082 |
| Estado inicial | Activity já aberta, aparelho Awake, Painel acessível |

O pacote é **debuggable**. Isso não identifica por si só o certificado de assinatura ou a configuração exata usada pelo Gradle. Não foi certificado como build de produção.

### Proveniência dos APKs

| Artefato | Bytes | SHA-256 |
|---|---:|---|
| APK base instalado | 26614459 | `09894084979b54e889db2099ece03ff0403718fe0e4c537377a826d32a442318` |
| APK local em `platforms/android/app/build/outputs/apk/debug/app-debug.apk` | 52588337 | `f6b391d471200cad777784a8cfbb96f72f2cb8ef340de5d919f7318d968a93f4` |
| Bundle Painel dentro do APK instalado | 105262 | `b55b986eac27a0a813d11592a509c5a07cf71467b1dedf2c3bd9cd6604bc2792` |

Os APKs são diferentes. O APK instalado foi lido em memória para inspeção ZIP, sem salvar uma cópia ou substituí-lo. Entre 873 arquivos JS executáveis do payload, não foram encontrados os literais `ifrn_moodle_session_epoch` ou `courseSsoGeneration` das correções locais. O bundle Painel instalado também não tem esses marcadores.

**Não há correspondência comprovada do APK instalado com o commit atual ou com a release auditada.** A versão 5.2.1/52100 não é identificação de commit. A ausência dos marcadores comprova que esse mecanismo local não está nesse payload, mas não identifica exatamente todas as diferenças históricas ou quais outras correções teriam sido incorporadas.

## Procedimento e proteção dos dados

- Executados `adb devices -l`, consultas de versão/modelo/pacote, `dumpsys package`, resolução da Activity e hashes do APK instalado.
- A primeira chamada de `adb shell` no sandbox foi bloqueada pelo acesso ao diretório `.android`; a repetição com a permissão apropriada funcionou. Nenhum dado do app foi limpo para resolver isso.
- `am start -W` trouxe a Activity existente: status `ok`, TotalTime 0 ms, WaitTime 27 ms. **Não é medição de inicialização fria.**
- A inspeção UI Automator retornou somente o WebView e não expôs a árvore interna útil. Seu XML foi processado em memória; nenhum XML bruto foi salvo.
- Foi criado um encaminhamento USB local TCP 9483 para o WebView debug do processo. Consultas CDP retornaram somente rotas classificadas, contagens, booleanos e comparação de curso. Títulos, nomes, matrículas, tokens e cookies não foram registrados.
- O app não expôs o componente Angular por `window.ng`; a inspeção auxiliar de referências do bridge não recuperou o serviço. A pré-verificação independente da identidade nativa ficou indisponível. A abertura normal foi delegada às validações do próprio aplicativo, sem bypass.
- As disciplinas foram abertas pelo bridge já usado pelo Painel, com os dados de uma disciplina matriculada do cache. Nenhum método de logout, limpeza, troca manual de conta, inscrição ou envio de conteúdo foi chamado.
- O botão Android Back retornou ao Painel após cada abertura. O encaminhamento **somente da porta 9483**, criado nesta fase, foi removido ao final.
- As credenciais fornecidas pelo usuário não foram usadas ou copiadas para scripts/relatórios. Foi exercitada a sessão preexistente; não foi confirmado se ela pertence à conta de teste fornecida.

## Testes efetivamente executados

| Teste | Resultado e evidência |
|---|---|
| App já autenticado / Painel | Rota `painel`, um iframe e quatro cards visíveis. Cache com 11 entradas, 10 matriculadas: 8 Acadêmico e 2 Presencial. Cache não equivale a uma consulta nova confirmada no servidor. |
| Abrir disciplina Presencial | Pedido pelo bridge retornou em **748 ms**. Rota nativa correspondeu ao curso selecionado; amostra posterior confirmou conteúdo nativo, **14 módulos**, sem iframe nem loader visível. |
| Voltar do Presencial | Android Back retornou ao Painel: quatro cards, mesmas contagens do cache e bridge disponível. |
| Abrir disciplina Acadêmica | Pedido pelo bridge retornou em **240 ms**. Rota correspondeu ao curso selecionado; amostra posterior confirmou conteúdo nativo, **11 módulos**, sem iframe nem loader visível. |
| Voltar do Acadêmico | Android Back retornou ao mesmo Painel e às mesmas contagens. |
| Estado final | Painel aberto, um iframe, quatro cards, nenhum loader visível. Nenhum logout foi provocado. |
| Crashes/ANRs na janela de logs | Zero marcadores FATAL EXCEPTION no PID do app e zero `ANR in com.moodle.moodlemobile` no buffer system consultado. Não é prova de ausência de todo defeito. |

Não foram fotografados/exportados dados pessoais. A verificação final por um seletor de avatar do fonte local não encontrou o elemento no APK instalado. **Isso não comprova ausência de foto:** os payloads são diferentes e não houve validação visual independente da foto.

### Tempos e logs sanitizados

Janela consultada: a partir de **15:31:34**, horário do dispositivo, até a coleta às aproximadamente **15:39:50** (18:39:50 UTC). Os logs brutos permaneceram apenas em memória e foram descartados. Foram gravados exclusivamente estágios em lista permitida, números, outcomes conhecidos e contadores de marcadores fixos.

| Estágio | Presencial, primeira abertura | Acadêmico, segunda abertura |
|---|---:|---:|
| session-and-identity | 150 ms | 23 ms |
| language | 1 ms | 0 ms |
| enrolments-cache-or-network | 122 ms | 14 ms |
| native-helper-and-navigation | 320 ms | 98 ms |
| course-first-paint | 86 ms | 100 ms |

Todos esses estágios registraram `outcome=ok`. Foram observados dois marcadores de curso nativo aberto e dois de sessão correta definida como current; zero marcadores de falha na abertura e zero de início de `startSuapOAuthLogin`.

Os tempos de retorno do bridge **não medem o carregamento integral de todos os recursos do curso**. São duas amostras com o aplicativo aquecido; não há p50/p95, comparação entre builds ou comprovação de ganho de desempenho. O estágio de matrículas permite cache/rede; não foi medida separadamente a origem de cada resposta.

## Problemas observados e limites

1. Não ocorreu falha de abertura ou retorno nas duas disciplinas exercitadas.
2. A versão instalada não corresponde ao APK local e não tem os marcadores P0 citados. Portanto **estes testes não validam as correções P0 locais**.
3. Não foi possível consultar independentemente o comparador de identidade pelo componente Angular. Não houve confirmação de identidade pelo SUAP ao vivo nesta fase.
4. Nenhum novo login, renovação SSO, logout ou concorrência real foi testado. O sucesso com sessões já disponíveis não testa o caminho crítico `newSite` cancelado.
5. Não foram testados encerramento/reinício do processo, início frio, perda de rede, expiração, troca de conta, todos os cursos, matrícula, postagem ou envio de atividade.
6. O defeito de operação tardia continua reproduzido nas fixtures sintéticas. Nenhuma conclusão sobre sua ausência no aparelho é autorizada pelo fluxo comum que passou.

## Evidências e comandos

Arquivos novos nesta pasta:

- `p05-device.json`, `p05-apk.json`, `p05-start.json`: inventário, hashes e abertura da Activity.
- `p05-ui-panel.json`: árvore UI sanitizada, limitada ao WebView.
- `p05-debug.json`: encaminhamento para o processo correto.
- `p05-webview-*.json`: estados e pedidos de abertura, sem nomes ou identificadores de estudante. Fingerprints servem apenas para comparar o id do curso solicitado e o da rota; não representam matrícula.
- `p05-logs.json`: estágios/contadores permitidos.
- `p05-android.cjs`, `p05-webview.cjs`: scripts de inspeção. Nenhum deles foi integrado ao aplicativo.

Sequência relevante:

```text
adb devices -l
adb -d shell getprop ro.build.version.release
adb -d shell getprop ro.product.model
adb -d shell pm list packages | findstr /i moodle
p05-android.cjs info → start → ui panel → debug → apk
p05-webview.cjs state panel
p05-webview.cjs open presencial → state loaded-presencial
p05-android.cjs back → p05-webview.cjs state returned-presencial
p05-webview.cjs open academic → state loaded-academic
p05-android.cjs back → p05-webview.cjs state returned-academic
p05-android.cjs logs
p05-webview.cjs state final-panel
p05-android.cjs cleanup
```

Os scripts são executados com Node no diretório original e param se não houver exatamente um dispositivo autorizado. A porta precisa ser preparada antes das consultas CDP; não executar novamente o modo `open` sem intenção de repetir a ação no app. Repetições devem usar novas etiquetas de evidência para preservar o histórico.

## Próxima validação

Primeiro concluir o desenho e os testes sintéticos da integração P0.4. Depois, com autorização específica de instalação, gerar APK associado a commit/hash, preservar o anterior e verificar a correspondência instalada. Só então repetir estes testes e planejar login novo/expiração/troca de conta em ambiente apropriado, com autorização separada para encerrar a sessão existente.

Não houve instalação, publicação, push, merge, alteração de branch, limpeza de storage ou uso das credenciais nesta baseline.
