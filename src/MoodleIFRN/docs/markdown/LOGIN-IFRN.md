# Rota de compatibilidade do login IFRN

A tela de matrícula/senha foi retirada. `ifrn-login.ts` redireciona links antigos
para o marketplace e preserva os parâmetros de recuperação da conta dos cursos.
A rota permanece necessária enquanto houver chamadas a `/login/ifrn-login`.

A entrada atual está em `services_mobile/suap-entry.service.ts`. Não usa Python,
Cloudflare nem os serviços de OAuth local/Gov.br que foram removidos.
