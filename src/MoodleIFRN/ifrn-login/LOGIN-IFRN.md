# Login IFRN

Tela de login institucional do AVA IFRN, feita em **Angular + Ionic**.

Rota no app: `/login/ifrn-login`

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `ifrn-login.ts` | Lógica da página (login, biometria, validação, mensagens de erro) |
| `ifrn-login.html` | Layout: IFRN-id, senha, botões (entrar, biometria, Gov.br, limpar) |
| `ifrn-login.scss` | Estilos da tela de login |

---

## Funcionalidades

### Login com senha

1. Usuário informa IFRN-id e senha
2. A página valida campos vazios, tamanho máximo e intervalo mínimo entre tentativas (~800 ms)
3. Chama `AuthService.login()` → `POST /auth/login`
4. Salva o `access_token` e oferece ativar biometria (se o aparelho permitir)
5. Abre o painel Mobile Moodle (`/painel`)

### Login com biometria

1. Lê o refresh token protegido pelo plugin de biometria
2. Chama `AuthService.refresh()` → `POST /auth/refresh`
3. Salva o novo access token e abre o painel

### Gov.br

Botão presente no layout. **Ainda não autenticado** — exibe aviso de que a integração oficial ainda não está ativa.

### Outros

- **Limpar**: zera os campos do formulário
- **Esqueci a senha**: oriente para recuperação no SUAP/IFRN-id
- **Ajuda**: abre `https://ajuda.ead.ifrn.edu.br/`

---

## Dependências internas

```text
ifrn-login
 ├── AuthService        (services_mobile/auth.service.ts)
 └── BiometricService   (services_mobile/biometric.service.ts)
```

---

## Mensagens de erro (resumo)

| Situação | Mensagem ao usuário |
|----------|---------------------|
| Timeout | Autenticação demorou demais |
| API offline (status 0) | Serviço offline; iniciar FastAPI na porta 8000 |
| 401 | Usuário ou senha inválidos |
| 429 | Muitas tentativas |
| 5xx | Serviço indisponível |

---

## Observações para revisão

- A senha **não** é persistida após o login (é limpa da memória da página).
- O access token fica em `sessionStorage` (não em `localStorage`).
- A biometria guarda apenas o **refresh token**, protegido pelo cofre do dispositivo.
