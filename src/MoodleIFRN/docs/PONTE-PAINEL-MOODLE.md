# Ponte SUAP → Painel AVA → Moodle Mobile

Arquitetura implementada no MoodleIFRN **sem redesenhar o login SUAP**.

## Fluxo

```text
1. Login IFRN (inalterado na UX)
   POST https://suap.ifrn.edu.br/api/token/pair
   → JWT SUAP em sessionStorage (ifrn_access_token)

2. Best-effort (mesmo login, mesmas credenciais)
   POST https://painel.ead.ifrn.edu.br/api/v1/authenticate/
   → JWT do Painel (ifrn_painel_token) + perfil
   (falha aqui NÃO impede o painel; cai no fallback SUAP)

3. Painel mobile (#/painel)
   Preferência: GET /api/v1/diarios/  (courseid Moodle + viewurl + diario_id)
   Fallback:    API SUAP ensino     (só id do diário SUAP)

4. Clique “Abrir no Moodle”
   → /login/moodle-open-course
   → se não houver sessão: OAuth Moodle (launch.php + issuer suap)
   → CoreSites.newSite() / sessão restaurada
   → CoreCourseHelper.getAndOpenCourse(courseid)
```

## O que NÃO fazemos

- Não enviamos JWT SUAP / JWT Painel como `wstoken` Moodle
- Não inventamos endpoints além dos oficiais do Painel / Moodle / SUAP
- Não alteramos a tela “Entrar com SUAP” além de vincular o Painel em background

## Arquivos principais

| Arquivo | Papel |
|---------|--------|
| `services_mobile/painel-ava.service.ts` | Auth Painel + tokens |
| `services_mobile/moodle-site.service.ts` | OAuth Moodle + abrir courseid |
| `moodle-open-course/` | Rota Ionic de abertura nativa |
| `mobilemoodle/core_mobile/api-painel.ts` | Cliente `/api/v1/diarios/` |
| `mobilemoodle/core_mobile/api.ts` | Preferência Painel → fallback SUAP |

## Tokens (sessionStorage)

| Chave | Origem | Uso |
|-------|--------|-----|
| `ifrn_access_token` | SUAP `/api/token/pair` | Sessão app / fallback |
| `ifrn_painel_token` | Painel `/api/v1/authenticate/` | Lista diários Moodle |
| `ifrn_painel_profile` | corpo `data` do authenticate | Nome/foto no painel |
| `ifrn_moodle_pending_open_course` | clique no diário | courseid a abrir após OAuth |

## Evidências

- Painel produção: `https://painel.ead.ifrn.edu.br` (helm `painel.ead.ifrn.edu.br`)
- `GET /api/v1/diarios/` → 428 sem token (endpoint vivo)
- `tool_painelava` devolve `id` = courseid Moodle e `viewurl`
- `local_suap` / Integrador: `idnumber` = `{turma}.{sigla}#{diario.id}`
