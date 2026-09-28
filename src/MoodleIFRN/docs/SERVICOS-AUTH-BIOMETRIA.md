# Serviços — autenticação e biometria

Serviços Angular usados pelo login IFRN.

Código-fonte: `src/MoodleIFRN/services_mobile/`  
Este documento fica em `docs/` para o índice da documentação.

---

## Arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `../services_mobile/auth.service.ts` | Login/refresh/verify no SUAP, guardar/ler/limpar JWT, abrir o painel |
| `../services_mobile/biometric.service.ts` | Ativar / autenticar / desativar login biométrico |

---

## AuthService

### Endpoints do SUAP (produção)

Base: `https://suap.ifrn.edu.br`  
Docs: https://suap.ifrn.edu.br/api/docs/  
OpenAPI: https://suap.ifrn.edu.br/api/openapi.json

| Método | Caminho | Uso |
|--------|---------|-----|
| `POST` | `/api/token/pair` | Login com IFRN-id (`username`) e senha (`password`) |
| `POST` | `/api/token/refresh` | Renovar sessão com `{ "refresh": "…" }` |
| `POST` | `/api/token/verify` | Conferir se o access token ainda é válido |

### Body / resposta de login

**Request**

```json
{ "username": "matricula-ou-cpf", "password": "senha" }
```

**Response 200** (SimpleJWT do SUAP)

```json
{
  "username": "matricula-ou-cpf",
  "refresh": "eyJ…",
  "access": "eyJ…"
}
```

O `AuthService` normaliza para o formato interno:

```json
{
  "access_token": "eyJ…",
  "refresh_token": "eyJ…",
  "token_type": "bearer",
  "username": "matricula-ou-cpf"
}
```

### Métodos principais

| Método | O que faz |
|--------|-----------|
| `login(credentials)` | Autentica no SUAP e retorna tokens |
| `refresh(refreshToken)` | Troca refresh por novos tokens |
| `verify(accessToken)` | Confere o token no SUAP |
| `saveToken(token)` | Valida e grava o access token |
| `saveUsername(username)` | Guarda matrícula/CPF no sessionStorage |
| `getToken()` | Lê o token (memória → sessionStorage) |
| `isAuthenticated()` | `true` se existe token válido |
| `getAuthHeaders()` | Headers com `Authorization: Bearer …` |
| `logout()` | Remove token e username |
| `openMobileMoodle(hash)` | Navega para `mobilemoodle/index.html` |

### Armazenamento do token

- Chave: `ifrn_access_token`
- Username: `ifrn_username`
- Local: `sessionStorage` (+ cópia em memória na sessão Angular)
- Validação no cliente:
  - formato JWT (3 partes)
  - tamanho máximo (&lt; 4096)
  - se existir `exp`, rejeita token vencido

### Abertura do painel

Após o login, o app **não coloca o token na URL**.  
O token já está no `sessionStorage` (mesma origem) e o painel lê de lá.

---

## BiometricService

Usa o plugin Cordova `FingerprintAIO`.

| Método | O que faz |
|--------|-----------|
| `isAvailable()` | Verifica se o aparelho tem biometria forte |
| `isEnabled()` | Flag em `localStorage` (`ifrn_biometric_login_enabled`) |
| `enable(refreshToken)` | Guarda o refresh token no cofre biométrico |
| `authenticate()` | Libera o refresh token após biometria |
| `disable()` | Remove a flag de biometria ativada |

### Segurança da biometria

- Exige biometria forte (`requireStrongBiometrics`)
- Sem backup de PIN/padrão (`disableBackup` / `allowBackup: false`)
- Invalida o segredo se novas digitais forem cadastradas (`invalidateOnEnrollment`)
- Só aceita segredo no formato JWT e com tamanho limitado

---

## Relação com o painel

```text
AuthService.saveToken()
        │
        ▼
sessionStorage["ifrn_access_token"]
        │
        ▼
mobilemoodle/core_mobile/api-auth.ts  →  Authorization: Bearer …
```

## Ver também

- [Login IFRN](../ifrn-login/LOGIN-IFRN.md)
- [Painel de cursos](./PAINEL-CURSOS.md)
- [Contrato da API](./CONTRATO-API.md)
- [Índice](./README.md)
