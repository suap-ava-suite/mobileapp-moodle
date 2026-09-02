# Serviços — autenticação e biometria

Serviços Angular usados pelo login IFRN.

---

## Arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `auth.service.ts` | Login, refresh, guardar/ler/limpar JWT, abrir o painel |
| `biometric.service.ts` | Ativar / autenticar / desativar login biométrico |

---

## AuthService

### Endpoints usados (FastAPI de teste)

| Método | Caminho | Uso |
|--------|---------|-----|
| `POST` | `/auth/login` | Login com usuário e senha |
| `POST` | `/auth/refresh` | Renovar sessão com refresh token |

Base atual de desenvolvimento: `http://localhost:8000`

### Métodos principais

| Método | O que faz |
|--------|-----------|
| `login(credentials)` | Autentica e retorna tokens |
| `refresh(refreshToken)` | Troca refresh por novos tokens |
| `saveToken(token)` | Valida e grava o access token |
| `getToken()` | Lê o token (memória → sessionStorage) |
| `isAuthenticated()` | `true` se existe token válido |
| `getAuthHeaders()` | Headers com `Authorization: Bearer …` |
| `logout()` | Remove o token |
| `openMobileMoodle(hash)` | Navega para `mobilemoodle/index.html` |

### Armazenamento do token

- Chave: `ifrn_access_token`
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
