# Handoff móvel SUAP/Gov.br

## Implementação local

O login Gov.br termina primeiro dentro do fluxo oficial SUAP. O backend Django continua responsável pelo OAuth SUAP, pela validação de `state`, pela obtenção do usuário e pela seleção do vínculo. Após o callback oficial concluir, uma extensão da view existente emite um código de curta duração para o app. A extensão chama `super().get()` e não reimplementa a autenticação do pacote.

O código é de uso único, vinculado ao estado da tentativa, ao usuário que o callback oficial autenticou e a um desafio PKCE S256. O app abre o navegador do sistema, valida o `state`, troca o código no endpoint mobile, e só então busca perfil e diários com um bearer token. Cookies do browser, senha SUAP/Gov.br e tokens do provedor não são transportados ao app. O callback móvel reservado é `moodlemobile://ifrn-auth/callback`.

Enquanto o backend não anunciar a capacidade móvel, o app mantém o fluxo SUAP tradicional já existente como fallback. O Gov.br continua encerrando com mensagem segura nesse fluxo antigo até que a configuração institucional do handoff esteja habilitada.

## Repositórios e arquivos

- Frontend: branch `fix/p0-release-2.0.1`, no repositório original `mobileapp-moodle`.
- Backend: cópia local isolada em `C:\Users\T-GAMER\AppData\Local\Temp\djangoapp-painel_ava-govbr`, HEAD `c65812ca1525c766b95f49f73a4f6bc719e1f7d3`.
- Dependência instalada para os testes: `django-suap-auth 1.8.13`.
- Implementação principal do backend: `src/painel/v2/mobile_auth.py`, `src/painel/v2/models.py`, `src/painel/v2/migrations/0001_mobile_login_attempt.py`, `src/painel/v2/api.py`, `src/urls.py` e `src/settings/securities.py`.
- Integração do app nesta etapa: `src/MoodleIFRN/services_mobile/suap-entry.service.ts`, `src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.ts` e `src/MoodleIFRN/tests/suap-mobile-auth-handoff.test.cjs`. O patch que reserva o callback em `src/core/services/urlschemes.ts` já estava presente no estado local antes desta etapa; foi preservado, sem nova alteração no núcleo.

O backend permanece numa cópia temporária e não foi publicado nem copiado para o repositório institucional. Os demais arquivos locais preexistentes do frontend foram preservados.

## Configuração necessária para homologação

O servidor Django só habilita o fluxo quando a instituição configura:

- `MOBILE_AUTH_CALLBACK_URI=moodlemobile://ifrn-auth/callback`;
- `JWT_SECRET` com chave privada aleatória adequada. O fallback conhecido `secret` deixou de ser aceito para assinar ou validar tokens;
- `MOBILE_AUTH_CORS_ORIGINS` com a origem real do Cordova WebView (`https://localhost` e, se usado pelo build institucional, `http://localhost`). As rotas móveis não habilitam CORS para origens arbitrárias.
- Aplicação da migração Django `MobileLoginAttempt`.

O redirect OAuth registrado no SUAP permanece o callback HTTPS do Django, por exemplo `/auth/suap/callback/` ou `/authenticate/`, conforme configuração já aprovada. Não se deve cadastrar `moodlemobile://...` como redirect do SUAP: o app link é usado somente depois que o backend recebe e valida o callback institucional.

Como o deploy pode trocar a chave JWT que assinava tokens legados, a equipe do backend precisa confirmar se `JWT_SECRET` já está configurado e preservar a chave existente quando segura. Se a instalação usa o fallback antigo, tokens emitidos por ele não serão aceitos depois da mudança; isso pode exigir nova autenticação e precisa ser planejado antes da homologação.

## Verificações executadas

- Frontend: 14 testes CJS focados em Gov.br, perfil, telemetria, PKCE, identidade, cancelamento pelo retorno ao app e patch de URL; todos passaram.
- TypeScript: `tsc -p tsconfig.app.json --noEmit`; passou.
- Backend: 14 testes Django focados usando SQLite em memória, cache local e mocks sintéticos; todos passaram. Isso não é validação PostgreSQL institucional nem teste real de OAuth Gov.br.
- Backend: `manage.py check`, `makemigrations painel --check --dry-run` e Ruff nos arquivos alterados; passaram.
- `git diff --check` e verificações de sintaxe JavaScript; passaram.
- Não houve autenticação manual, build APK, instalação ou teste em emulador/dispositivo nesta etapa.

## Estado

O código do handoff está implementado nos componentes controlados e a falha do callback/seleção de vínculo tem uma rota segura de retorno. A homologação funcional ainda depende do deploy do backend, da configuração de callback, CORS e assinatura JWT, e de um teste manual na página oficial SUAP/Gov.br. A P0.4 de concorrência da sessão nativa Moodle permanece separada e não foi corrigida aqui.
