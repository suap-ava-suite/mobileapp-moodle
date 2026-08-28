# Criação da rota de login IFRN

Para registrar / reparar as rotas IFRN no Moodle Mobile após uma atualização:

```bash
npm run patch:ifrn
```

O script fica em `src/MoodleIFRN/patch-moodle-ifrn.js` — copie a pasta `MoodleIFRN` inteira para o novo projeto e execute de novo.

Documentação: [`src/MoodleIFRN/PATCH-AO-ATUALIZAR.md`](src/MoodleIFRN/PATCH-AO-ATUALIZAR.md)

A documentação completa da customização está em:

**[`src/MoodleIFRN/VISAO-GERAL.md`](src/MoodleIFRN/VISAO-GERAL.md)**

Índice rápido:

- [Visão geral](src/MoodleIFRN/VISAO-GERAL.md)
- [Login IFRN](src/MoodleIFRN/ifrn-login/LOGIN-IFRN.md)
- [Serviços (auth + biometria)](src/MoodleIFRN/services_mobile/SERVICOS-AUTH-BIOMETRIA.md)
- [Painel de cursos](src/MoodleIFRN/mobilemoodle/PAINEL-CURSOS.md)
- [Scripts JS do painel](src/MoodleIFRN/mobilemoodle/js/SCRIPTS-JS.md)
- [Templates HTML](src/MoodleIFRN/mobilemoodle/pages/TEMPLATES-HTML.md)
- [Tema visual](src/MoodleIFRN/mobilemoodle/static/theme/ifrn/TEMA-VISUAL.md)
- [Segurança](src/MoodleIFRN/SEGURANCA.md)
- [Contrato da API](src/MoodleIFRN/CONTRATO-API.md)
