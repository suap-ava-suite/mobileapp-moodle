# Desempenho, tamanho e distribuição

Data: 01/11/2026. Checkout auditado: `erro-fluxo`, `c55d20fe4`. Auditoria sem refatoração.

## Baselines que não devem ser misturadas

1. **Fonte:** checkout `c55d20fe4`; sem rebuild que sobrescreva artefatos.
2. **Artefatos locais preexistentes:** `www` e APK debug datados de 27/10. Não são prova de build reprodutível do checkout atual.
3. **Android instalado:** versão 5.2.1/code 52100, depurável, atualização em 28/10. Hash `09894084…442318`, diferente do APK local `f6b391d4…a93f4`. Testes no telefone não certificam esse checkout nem seu APK local.

Não foi feito build ou instalação para esta auditoria. Não existe AAB local no caminho examinado.

## Medições de tamanho

| Artefato | Bytes observados | Interpretação |
|---|---:|---|
| Bundle IFRN versionado `mobilemoodle.js` | 108.044 | JS sem minificação; gzip em memória 25.335 B |
| CSS IFRN versionado `mobilemoodle.css` | 49.931 | gzip em memória 9.246 B |
| `www` inteiro | 111.137.909 | 7.479 arquivos; diretório de build preexistente |
| JS em `www` | 52.317.247 | inclui código original Moodle e lazy chunks; não propor exclusão por não ser IFRN |
| Sourcemaps em `www` | 45.280.540 | revisar política do artefato de distribuição |
| `www/main.js` | 11.421.992 | build local de desenvolvimento |
| APK debug local | 52.588.337 | aproximadamente 50,15 MiB; não AAB/release |
| 616 sourcemaps dentro desse APK | 45.280.540 descomprimidos / 12.777.685 comprimidos | contribuição medida dos entries ZIP; não redução final já verificada de um novo APK |
| Fontes `.ts/.mjs/.md` do painel dentro do APK | 158.268 descomprimidos / 53.060 comprimidos, 23 arquivos | `angular.json:38` copia `mobilemoodle/**/*`, incluindo fontes/build/docs; avaliar allowlist de assets executáveis necessários |

O ZIP total possui 8.089 entries, 130.286.963 bytes descomprimidos. Tamanho total do APK inclui ZIP, alinhamento e assinatura. Excluir entries não é uma previsão exata do tamanho final assinado.

## Experimentos sem alteração de produção

- Minificação **em memória** do JS versionado: 108.044 → **60.118 B**; gzip 25.335 → **19.318 B**. Economia bruta observada 47.926 B, não promessa de melhora de tempo ou novo APK pronto. Não foram executados testes funcionais do bundle minificado.
- Rebuild **em memória** com os parâmetros do esbuild: 105.005 B. A diferença para o arquivo versionado são **3.039 CRLF**: após normalizar quebras de linha, os dois bundles são iguais. **Não foi encontrada desatualização lógica do JS por esse teste.**
- Prova sintética do checkout: 20 respostas idênticas de perfil produziram **100 gravações de storage** e **20 retornos true** que pedem reload do iframe. `profile-refresh.ts:41–47` não verifica igualdade, e `painel.ts:55–58` faz `location.reload()` se recebe true. Comportamento comprovado, não hipótese de rede.
- `oauth-profile.ts:45` e `:96–98` também regravam snapshots/listas em leituras. A correção idempotente já existe nas referências locais posteriores. Revisar/reaproveitar, não recriar automaticamente.

## Android USB — observações desta execução

| Observação | Resultado | Limite |
|---|---|---|
| `am start -W` com processo inicialmente ausente | `LaunchState COLD`, TotalTime **4.807 ms**, WaitTime 4.810 ms | Uma amostra; mede Activity, não Painel utilizável nem todo o login |
| Nova chamada com Activity já em primeiro plano | TotalTime **0 ms**, WaitTime **4 ms** | Intent entregue à Activity existente; não usar como “startup de 0 ms” |
| Memória do processo principal, PID 21082 | TOTAL PSS **99.437 KiB**, RSS **183.392 KiB**, swap PSS 26.325 KiB | Um snapshot; não soma isoladamente todos os renderers WebView, não prova leak |
| Objetos | 1 Activity, 2 WebViews | Parent/iframe/navegador não equivalem a duas telas vazadas |
| Abertura do bridge de curso Acadêmico | retorno em **1.707 ms** | Sessão existente; até retorno do bridge, não tempo total até conteúdo |
| Abertura do bridge Presencial | retorno em **1.045 ms** | Mesmo limite; sem percentis e sem comparação antes/depois |
| Conteúdo nativo | 11/14 elementos de módulo nos dois cursos, rota `course/:id/contents` | Somente leitura e navegação, sem validar todas as atividades |
| Retorno | Painel com cards novamente presente | App deixado no Painel, sessão preservada |

Login novo, primeira sessão Moodle sem token, troca de conta e offline real não foram medidos no dispositivo. Não foram lidos cookies, tokens, senhas, nomes ou matrícula nos probes. O caminho do curso é anonimizado nos arquivos de evidência.

## Propostas e ganhos que dependem de implementação

1. **Baixo risco relativo:** aproveitar a atualização idempotente existente em referência posterior, preservando reidratação e mudanças reais de nome. Esperado: menos gravações e ausência de reload sem mudança; novo resultado físico depende da branch aprovada.
2. **Médio:** pipeline explícito debug/release e remoção de sourcemaps do pacote de distribuição, conservando-os de forma privada para diagnóstico. A contribuição comprimida medida dá ordem de grandeza, mas novo tamanho/tempo permanece pendente.
3. **Médio/alto:** minificação e otimização de scripts. `angular.json:85` tem `scripts:false` até em production; avaliar motivo e código serializado antes de mudar. Scripts injetados em IAB precisam sobreviver a Babel/esbuild e não depender de variáveis renomeadas externas.
4. **Baixo/médio:** allowlist de assets do painel; manter HTML, CSS, JS, fontes, imagens, traduções, ícones e chunks dinâmicos reais. Não apagar recursos originais do Moodle para encolher APK.
5. **Médio:** entrada única de build, evitando dupla cópia de vendor e modos inconsistentes. `build-native.mjs` e `build-android-web.cjs` têm diferenças funcionais, não são duplicatas exatas.
6. **A medir:** custo do observador de aparência com Painel em cache e múltiplas verificações locais de identidade. Não retirar validações por suspeita de lentidão.

CPU sustentada, tráfego HTTP completo, retenção de heap e economia de RAM após refatorar: **não medidos**. Não houve “depois” funcional, pois esta fase não implementa propostas.
