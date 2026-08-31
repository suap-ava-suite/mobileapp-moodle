# Criação da rota de login IFRN

Para registrar / reparar as rotas IFRN no Moodle Mobile após uma atualização:

```bash
npm run patch:ifrn
```

O script fica em `src/MoodleIFRN/patch-moodle-ifrn.js` — copie a pasta `MoodleIFRN` inteira para o novo projeto e execute de novo.

Documentação: [`src/MoodleIFRN/docs/PATCH-AO-ATUALIZAR.md`](src/MoodleIFRN/docs/PATCH-AO-ATUALIZAR.md)

A documentação completa da customização está em:

**[`src/MoodleIFRN/docs/VISAO-GERAL.md`](src/MoodleIFRN/docs/VISAO-GERAL.md)**

Índice rápido:

- [Visão geral](src/MoodleIFRN/docs/VISAO-GERAL.md)
- [Login IFRN](src/MoodleIFRN/ifrn-login/LOGIN-IFRN.md)
- [Serviços (auth + biometria)](src/MoodleIFRN/services_mobile/SERVICOS-AUTH-BIOMETRIA.md)
- [Painel de cursos](src/MoodleIFRN/docs/PAINEL-CURSOS.md)
- [Scripts TypeScript do painel](src/MoodleIFRN/mobilemoodle/core_mobile/SCRIPTS-TS.md)
- [Templates HTML](src/MoodleIFRN/docs/TEMPLATES-HTML.md)
- [Tema visual](src/MoodleIFRN/docs/TEMA-VISUAL.md)
- [Segurança](src/MoodleIFRN/docs/SEGURANCA.md)
- [Contrato da API](src/MoodleIFRN/docs/CONTRATO-API.md)
