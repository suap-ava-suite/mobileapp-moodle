# Criação da rota de login IFRN

**Manual completo para desenvolvimento, build Android e execução iOS no MacBook:**
[Abrir manual HTML offline](src/MoodleIFRN/docs/index.html) · [Inventário e classificação dos documentos](src/MoodleIFRN/docs/markdown/INVENTARIO-DOCUMENTACAO.md)

Para registrar / reparar as rotas IFRN no Moodle Mobile após uma atualização:

```bash
npm run patch:ifrn
```

O script fica em `src/MoodleIFRN/patch-moodle-ifrn.js` — copie a pasta `MoodleIFRN` inteira para o novo projeto e execute de novo.

Documentação: [`src/MoodleIFRN/docs/markdown/PATCH-AO-ATUALIZAR.md`](src/MoodleIFRN/docs/markdown/PATCH-AO-ATUALIZAR.md)

A documentação completa da customização está em:

**[`src/MoodleIFRN/docs/markdown/README.md`](src/MoodleIFRN/docs/markdown/README.md)** · **[`src/MoodleIFRN/docs/markdown/VISAO-GERAL.md`](src/MoodleIFRN/docs/markdown/VISAO-GERAL.md)**

Índice rápido:

- [Índice da documentação](src/MoodleIFRN/docs/markdown/README.md)
- [Visão geral](src/MoodleIFRN/docs/markdown/VISAO-GERAL.md)
- [Login IFRN](src/MoodleIFRN/docs/markdown/LOGIN-IFRN.md)
- [Serviços (auth + biometria)](src/MoodleIFRN/docs/markdown/SERVICOS-AUTH-BIOMETRIA.md)
- [Painel de cursos](src/MoodleIFRN/docs/markdown/PAINEL-CURSOS.md)
- [Scripts TypeScript do painel](src/MoodleIFRN/mobilemoodle/core_mobile/SCRIPTS-TS.md)
- [Templates HTML](src/MoodleIFRN/docs/markdown/TEMPLATES-HTML.md)
- [Tema visual (header / safe-area)](src/MoodleIFRN/docs/markdown/TEMA-VISUAL.md)
- [Segurança](src/MoodleIFRN/docs/markdown/SEGURANCA.md)
- [Contrato da API](src/MoodleIFRN/docs/markdown/CONTRATO-API.md)
- [Patch após atualizar o Moodle](src/MoodleIFRN/docs/markdown/PATCH-AO-ATUALIZAR.md)
