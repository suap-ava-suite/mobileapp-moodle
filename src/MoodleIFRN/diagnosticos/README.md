# Ferramentas de diagnóstico do MoodleIFRN

Esta pasta reúne verificações locais e utilitários que não fazem parte do app nem do build de produção. O nome da pasta é `diagnosticos`; os arquivos CJS foram retirados de `docs/` para separar ferramentas do portal de documentação.

## Verificações simuladas

Executadas com Node a partir da raiz do repositório; usam mocks/fixtures locais e não exigem aparelho nem login real:

```bash
node src/MoodleIFRN/diagnosticos/test-course-environments.cjs
node src/MoodleIFRN/diagnosticos/test-marketplace-entry.cjs
node src/MoodleIFRN/diagnosticos/test-oauth.cjs
node src/MoodleIFRN/diagnosticos/test-suap-browser-visibility.cjs
node src/MoodleIFRN/diagnosticos/test-suap-entry-profile.cjs
```

Estes arquivos são verificações CJS avulsas, não integram o runner principal do projeto. Não use o prefixo `test-` como indicação de que passaram; confira a saída no checkout atual.

Na verificação da mudança de localização (11/11/2026), `test-course-environments.cjs` e `test-suap-entry-profile.cjs` passaram. `test-marketplace-entry.cjs` falhou por dependência mock não configurada (`@static/opener`); `test-oauth.cjs` por alias mock não tratado (`@/core/constants`); `test-suap-browser-visibility.cjs` por expectativa antiga de `./suap-login-telemetry`. Essas falhas são anteriores à movimentação dos arquivos: os caminhos relativos resolvem ao mesmo diretório `MoodleIFRN`. Nenhum desses cinco scripts usou ADB ou fez requisições de rede nesta execução.

## Diagnóstico com aparelho ou rede

Os arquivos `course-*`, `device-course-test.cjs`, `trace-course-device.cjs` e `audit-device.cjs` podem depender de ADB, CDP ou WebView ativa. `device-course-test.cjs` aceita ações que clicam em controles da interface (abrir curso, voltar, conectar ou repetir); não o execute contra uma conta real sem revisar a ação e confirmar o estado do aparelho. `trace-course-device.cjs` executa na WebView o JavaScript indicado pelo operador.

`audit-endpoints.cjs`, `course-launch-chain.cjs` e `course-public-contract.cjs` consultam serviços por rede; confira os hosts e métodos no próprio arquivo antes de executar. As saídas de auditoria são escritas em `os.tmpdir()`, não em `docs/`.

```bash
node --check src/MoodleIFRN/diagnosticos/arquivo.cjs
```

## Documentação

- [Portal HTML](../docs/index.html)
- [Inventário da documentação](../docs/html/INVENTARIO-DOCUMENTACAO.html)
- [Guia de curso](../docs/markdown/COURSE-OPENING-2026-10-19.md)
