# Publicar o AVA IFRN Mobile em beta na Google Play

Este guia cobre a criação do app **Moodle IFRN** no Play Console e a publicação inicial em teste. O beta é distribuído pela Play Store a um grupo autorizado; ele não publica automaticamente o app para todos.

## Estado atual deste repositório

Antes de criar a ficha ou enviar um pacote, resolva estes itens:

- [ ] O nome informado para a ficha é **Moodle IFRN**. O nome nativo ainda aparece como **Moodle** em `config.xml`.
- [ ] Escolha e aprove com o responsável institucional um identificador Android exclusivo, por exemplo no formato `br.edu.ifrn.<nome-do-app>`. O identificador atual em `config.xml` é `com.moodle.moodlemobile`, pertencente ao namespace do app Moodle. Não envie o pacote com esse identificador para uma nova ficha IFRN.
- [ ] O identificador do pacote fica fixo depois do primeiro envio de AAB à ficha do Play Console. Confirme-o antes do upload.
- [ ] O `versionCode` configurado hoje é `52100` e a versão é `5.2.1`. Confirme o histórico da ficha nova e defina um `versionCode` inteiro maior em cada atualização futura.
- [ ] O `config.xml` pede `android-targetSdkVersion=36`, que atende ao requisito do Google Play a partir de 31/08/2026. Porém, o projeto declara `cordova-android` 14.0.1; a tabela oficial da plataforma lista suporte até API 35 para a linha 14 e API 36 para a linha 15. Atualize para Cordova Android 15.x e valide plugins e compilação antes de submeter.
- [ ] Não há configuração de assinatura de release nem keystore no repositório. Configure uma chave de upload em local seguro e fora do Git; nunca coloque keystore, senha ou arquivo de configuração com segredos em um commit.
- [ ] `src/MoodleIFRN/build-native.mjs` gera ativos web Cordova usando a configuração `development`; ele sozinho não produz nem assina o AAB de produção.
- [ ] A ficha de privacidade e Segurança dos dados ainda precisa ser preenchida com base nos dados efetivamente usados no login SUAP/Painel e no Moodle. Não marque respostas presumidas.

## 1. Criar a ficha no Play Console

1. Entre em [Google Play Console](https://play.google.com/console/) usando a conta institucional responsável pela publicação. Se ainda não houver conta de desenvolvedor, conclua o cadastro e as verificações exigidas pelo Google.
2. Selecione **Criar app**.
3. Informe o nome **Moodle IFRN**, idioma padrão, tipo **App**, gratuito ou pago conforme decisão institucional e aceite as declarações apresentadas.
4. Na ficha do app, selecione a disponibilidade inicial desejada. Para validar com poucas pessoas, comece com **Teste interno**; depois use **Teste fechado** para um grupo controlado maior.
5. Antes do primeiro AAB, altere `id` do elemento `<widget>` em `config.xml` para o identificador IFRN aprovado. Ajuste também o nome nativo para `Moodle IFRN`. Confira se o `applicationId` gerado em `platforms/android/app/build.gradle` acompanha o widget. Não edite só a cópia gerada em `platforms/android`, pois Cordova pode recriá-la.
6. Escolha o Play App Signing para a nova ficha. O Google guarda a chave usada para assinar a distribuição; a equipe mantém uma chave de upload separada para assinar cada AAB enviado.

## 2. Preparar metadados e declarações

No Play Console, complete a ficha principal e a página **Política > Conteúdo do app**:

- Nome: **Moodle IFRN** (limite atual de 30 caracteres).
- Descrição curta e completa, ícone de loja PNG de 512 × 512 e capturas reais do app. Não use capturas de telas que não existam no produto.
- E-mail de suporte e URL ativa da política de privacidade institucional, aplicável ao app e também acessível dentro dele.
- Declaração de anúncios, público-alvo e classificação indicativa, com respostas corretas para o uso educacional do app.
- **Segurança dos dados**: inventarie identificadores, perfil, fotos, dados de autenticação, atividade e eventuais dados compartilhados com SUAP, Painel AVA, Moodle e provedores de push/analytics. Registre finalidade, retenção e compartilhamento de acordo com a implementação real e a política institucional.
- **Acesso ao app**: descreva ao revisor como chegar às áreas protegidas. Se o fluxo exige autenticação institucional, forneça instruções e uma conta de demonstração autorizada, se houver. Não use credenciais reais de estudante.

## 3. Preparar assinatura e versão

1. Gere ou receba da instituição a chave de upload. Guarde keystore e senhas em armazenamento de segredos, fora do repositório e com acesso restrito. Faça backup seguro.
2. Crie a configuração local do Cordova para assinatura (`build.json`) fora do projeto. O arquivo contém caminhos e senhas; não o adicione ao Git nem o compartilhe em chamados ou mensagens.
3. Atualize `config.xml` com o identificador aprovado e com `version`/`android-versionCode` adequados. O código de versão precisa ser maior do que qualquer versão já enviada para essa ficha.
4. Use Node conforme `.nvmrc` (Node 22), JDK 17, Android SDK e a versão do Cordova Android compatível com API 36. Confirme com `cordova platform ls` e `java -version`.

Exemplo de configuração local de assinatura (substitua pelos caminhos e dados da chave institucional; mantenha esse arquivo fora do Git):

```json
{
  "android": {
    "release": {
      "keystore": "/caminho/seguro/ifrn-upload-key.jks",
      "storePassword": "DEFINIR_LOCALMENTE",
      "alias": "ifrn-upload",
      "password": "DEFINIR_LOCALMENTE",
      "packageType": "bundle"
    }
  }
}
```

## 4. Gerar e verificar o AAB

No Linux ou Git Bash, após acertar identificador, versão, versão do Cordova Android e assinatura:

```bash
npm ci
npx ionic cordova build android --prod --release \
  --buildConfig=/caminho/seguro/play-build.json -- -- --packageType=bundle
```

No Windows PowerShell, use um caminho absoluto para a configuração fora do repositório e execute o mesmo comando em uma única linha:

```powershell
npm ci
npx ionic cordova build android --prod --release --buildConfig="C:\segredos\play-build.json" -- -- --packageType=bundle
```

O caminho esperado do artefato é:

```text
platforms/android/app/build/outputs/bundle/release/app-release.aab
```

Confirme que o arquivo existe, que o pacote e o `versionCode` correspondem ao aprovado, que o AAB está assinado pela chave de upload e que a assinatura aparece no Play Console. Instale e teste o mesmo código em aparelhos reais antes de ampliar o grupo. Não use o AAB de desenvolvimento nem um APK debug como release.

## 5. Criar o primeiro teste interno

1. No Play Console, abra **Testar e lançar > Teste > Teste interno** e crie uma versão.
2. Faça upload de `app-release.aab`, revise os avisos e dê um nome à versão (por exemplo, `beta-1`).
3. Adicione uma lista pequena de e-mails Google autorizados como testadores e informe um canal para feedback.
4. Revise o resumo e inicie a publicação do teste interno.
5. Compartilhe o link de adesão com os testadores. Eles precisam aceitar o convite usando a conta Google incluída na lista e instalar pelo link da Play Store.
6. Colete defeitos, corrija, aumente o `versionCode` e envie cada atualização como nova versão de teste.

Para um grupo maior, crie um **Teste fechado** e selecione a lista de testadores. Contas pessoais de desenvolvedor criadas após 13/11/2023 têm requisito adicional antes de solicitar acesso à produção: teste fechado com pelo menos 12 testadores inscritos continuamente por 14 dias. Essa regra não impede começar pelo teste interno, mas pode afetar a passagem posterior para produção.

## 6. Checklist do AVA IFRN antes de convidar testadores

- [ ] Instalação limpa e atualização por cima da versão anterior.
- [ ] Login institucional SUAP, retorno ao Painel AVA, logout e novo login.
- [ ] Nome, foto, identificação e categorias de curso sem dados inventados.
- [ ] Abrir cursos reais autorizados em cada ambiente, voltar ao painel e reabrir após expiração da sessão.
- [ ] Links externos, notificações e permissões em Android real.
- [ ] Nenhuma tela, URL, chave de teste ou credencial de desenvolvimento exposta no build.
- [ ] Logs sem senha, matrícula, token ou cookie.
- [ ] Política de privacidade, Segurança dos dados e instruções ao revisor revisadas pelo responsável institucional.

## Referências oficiais

- [Criar e configurar um app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Configurar teste interno, fechado ou aberto](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Assinar seu app e configurar Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Preparar o app para revisão](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Requisitos de nível de API para apps Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Requisitos de teste para contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Comando Ionic Cordova Build](https://ionicframework.com/docs/cli/commands/cordova-build)
- [Guia Apache Cordova para Android](https://cordova.apache.org/docs/en/latest/guide/platforms/android/)
