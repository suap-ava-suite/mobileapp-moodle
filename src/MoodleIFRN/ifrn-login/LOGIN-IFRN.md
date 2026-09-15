# Login IFRN

Tela de login institucional do AVA IFRN, feita em **Angular + Ionic**.

Rota no app: `/login/ifrn-login`

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `ifrn-login.ts` | Lógica da página (login SUAP, biometria, validação, mensagens de erro) |
| `ifrn-login.html` | Layout: IFRN-id, senha, botões (entrar, biometria, Gov.br, limpar) |
| `ifrn-login.scss` | Estilos da tela de login |

---

## Funcionalidades

### Login com senha do SUAP

1. Usuário informa IFRN-id (matrícula ou CPF) e senha — as **mesmas credenciais do SUAP**
2. A página valida campos vazios, tamanho máximo (usuário ≤ 150, senha ≤ 128) e intervalo mínimo entre tentativas (~800 ms)
3. Chama `AuthService.login()` → `POST https://suap.ifrn.edu.br/api/token/pair`
4. Salva o `access_token` e o username retornados pelo SUAP
5. Oferece ativar biometria (se o aparelho permitir)
6. Abre o painel Mobile Moodle (`/painel`)

### Login com biometria

1. Lê o refresh token protegido pelo plugin de biometria
2. Chama `AuthService.refresh()` → `POST https://suap.ifrn.edu.br/api/token/refresh`
3. Salva o novo access token e abre o painel

### Gov.br

Botão presente no layout. **Ainda não autenticado** — exibe aviso de que a integração oficial ainda não está ativa.

### Outros

- **Limpar**: zera os campos do formulário
- **Esqueci a senha**: abre o portal do SUAP (`https://suap.ifrn.edu.br/`)
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
| API offline (status 0) | Não foi possível alcançar o SUAP |
| 400 / 401 | IFRN-id ou senha inválidos |
| 429 | Muitas tentativas |
| 5xx | SUAP indisponível |

---

## Observações para revisão

- A senha **não** é persistida após o login (é limpa da memória da página).
- O access token fica em `sessionStorage` (não em `localStorage`).
- A biometria guarda apenas o **refresh token**, protegido pelo cofre do dispositivo.
- Fonte da API: [OpenAPI do SUAP](https://suap.ifrn.edu.br/api/openapi.json) / [Swagger](https://suap.ifrn.edu.br/api/docs/).

## Ver também

- [Serviços auth/biometria](../docs/SERVICOS-AUTH-BIOMETRIA.md)
- [Painel de cursos](../docs/PAINEL-CURSOS.md)
- [Índice da documentação](../docs/README.md)
