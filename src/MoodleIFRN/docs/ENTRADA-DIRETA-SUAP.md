# Entrada do Marketplace pelo SUAP

O Marketplace é a entrada do usuário. No fluxo atual, seu botão chama
`SuapEntryService.loginWithSuap()`, que abre a autenticação web do Painel AVA no
InAppBrowser e valida a identidade antes de entregar o dashboard ao app.

Não há formulário próprio de matrícula/senha nesta tela. A sessão web do Painel
e a sessão Moodle nativa usada para abrir um curso têm finalidades diferentes;
ver [Ponte Painel → Moodle](./PONTE-PAINEL-MOODLE.md).

## Depois do retorno

- Perfil e dashboard são associados à identidade observada na sessão.
- O curso selecionado mantém seu ID e ambiente enquanto o Moodle valida ou
  estabelece a sessão nativa.
- Se o serviço pedir renovação, o usuário conclui a etapa na autenticação
  institucional; o app não fabrica tokens nem compartilha cookies entre apps.
- A rota `/login/ifrn-login` continua apenas como compatibilidade para links
  antigos; não é a tela normal de entrada.

## Verificação local

```bash
npm run test:ifrn
npm run build:mobilemoodle
npm run prod:android
```

Esses comandos não substituem a validação manual em Android com conta de teste
autorizada. Resultados de aparelhos descritos em documentos datados estão
listados no [índice](./README.md#relatórios-históricos).
