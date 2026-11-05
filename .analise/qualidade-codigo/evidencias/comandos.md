# Comandos e resultados relevantes — auditoria de 01/11/2026

Todos foram executados na raiz do projeto. Saídas numéricas completas estão nos JSON/TAP desta pasta. Comandos de leitura `rg`, `Get-Content`, `Get-ChildItem` e `git show` foram usados para conferir as localizações citadas nos relatórios; não foram usados para editar produção.

## Estado e referências

```text
git status --short --branch
## erro-fluxo...origin/erro-fluxo [behind 10]
# sem mudanças rastreadas no início

git log -4 --oneline
c55d20fe4 fix(ifrn): mantém SSO dos cursos no app e destrava novo login
1cbeef0e1 diminuindo autenticação
c4458c16f fix: corrige fluxo de abertura de cursos IFRN
b750aed7a melhorando a transição

git branch -vv
# branch atual c55d20fe4; release/2.0.1 0ba7bc2e7

git rev-parse origin/erro-fluxo
7925a4c67286e78e5e9448616074a28699d50cf2

git diff --name-only HEAD..origin/erro-fluxo
# confirma correções posteriores de perfil, scripts de teste, hook Android etc.

git show origin/erro-fluxo:.analise/estrategia-testes-baseline.md
# relatório anterior lido; não copiado como resultado atual nem sobrescrito

git ls-files '*AGENTS.md'
# nenhum caminho retornado

git ls-files src/MoodleIFRN | Measure-Object
Count: 3123
```

Buscas de `.analise`/`.agents` inicialmente não encontraram diretórios no checkout. A pasta de entrega foi criada explicitamente. Leituras exploratórias também constataram inexistência de `navigation/course-handoff-style.ts`, `moodle-course/moodle-course.ts`, `theme/dsgov-auditoria/relatorio.md` e `src/app/app.module.ts`; foram usados os arquivos reais (`handoff-loading.ts`, `course-menu.ts`, inventário de auditoria, rotas/serviços). Essas falhas de busca não foram tratadas como defeitos de produção.

## Métricas, análise estática e testes

```text
node .analise/qualidade-codigo/evidencias/medir.cjs
# arquivos físicos 3161; fonte autoral 84 / 22779 LOC físicas
# CC aproximada, profundidade, imports e duplicação em metricas.json

node --max-old-space-size=6144 .analise/qualidade-codigo/evidencias/verificar.cjs typescript
# TypeScript API, noEmit/noUnusedLocals/noUnusedParameters
# zero erros fora dos diagnósticos de não uso
# 12 diagnósticos de não uso IFRN; 541 fora do IFRN

node --max-old-space-size=6144 .analise/qualidade-codigo/evidencias/verificar.cjs lint
# ESLint existente, fix:false; 45 arquivos; 6457 erros, 389 avisos
# 5590 ocorrências são de aspas; ver eslint.json

node .analise/qualidade-codigo/evidencias/complexidade.cjs
# regra ESLint complexity classic, análise isolada sem fix em 45 arquivos TS
# 54 funções acima de 10; 14 com valor >=20

node .analise/qualidade-codigo/evidencias/verificar.cjs tests
# invoca node --test --test-concurrency=2 com os 17 *.test.cjs/*.test.mjs
# tests 80; pass 80; fail 0; cancelled 0; skipped 0; duration_ms 8297.4381
# executado fora do sandbox devido à restrição de leitura do esbuild no Windows

node src/MoodleIFRN/build-native.mjs --platform=android --check
Dicionário validado para android: 2795 entradas; nenhum arquivo gerado.

node .analise/qualidade-codigo/evidencias/inspecionar.cjs
# tamanhos/SHA, arquivos idênticos, regras CSS e acoplamento estático
# 0 blocos completos de regras idênticas no painel.scss, respeitando contexto

node .analise/qualidade-codigo/evidencias/provas-isoladas.cjs
# profile: 20 respostas idênticas / 100 gravações / 20 pedidos de reload
# logout: flags atuais OAuth/resume continuam presentes
# callback: pendente após timeout + cancelamento, com handler que nunca resolve
# sanitização: callback normal redigido; HTTP envolvido não redigido
# dados sintéticos, nenhum tráfego HTTP

python .analise/qualidade-codigo/evidencias/apk.py
# 616 mapas: 45280540 B descomprimidos / 12777685 B comprimidos
# 23 fontes .ts/.mjs/.md do painel no APK: 158268 B / 53060 B comprimidos
```

Experimentos Node/esbuild em memória (comandos `node -e` executados com esses parâmetros):

```js
esbuild.transformSync(bundle, {minify:true,target:'es2020',legalComments:'inline'})
// 108044 -> 60118 bytes; gzip 25335 -> 19318
// Não salva o resultado nem altera opções de build.

esbuild.buildSync({
  absWorkingDir:process.cwd(),
  entryPoints:['src/MoodleIFRN/mobilemoodle/mobilemoodle.ts'],
  outfile:'src/MoodleIFRN/mobilemoodle/mobilemoodle.js',
  write:false,bundle:true,format:'iife',target:'es2020',legalComments:'inline'
})
// 105005 B em memória; igual ao bundle versionado após normalizar 3039 CRLF.
```

Não foram executados `npm test`, `test:coverage`, build Angular, Cordova prepare, Gradle, patch de produção, instalação/atualização de pacote, nem comandos com `--fix`.

## Android — sem dados pessoais

```text
adb devices
# um Android USB disponível; serial omitido deste registro

adb shell pidof com.moodle.moodlemobile
# inicialmente sem processo

adb shell dumpsys package com.moodle.moodlemobile
# saída filtrada: code 52100, versionName 5.2.1, DEBUGGABLE
# lastUpdateTime 2026-10-28 16:08:56

adb shell am start -W -n com.moodle.moodlemobile/.MainActivity
# LaunchState COLD / TotalTime 4807 / WaitTime 4810 / Status ok

adb shell am start -W -n com.moodle.moodlemobile/.MainActivity
# Activity existente: TotalTime 0 / WaitTime 4; não mede cold start

adb shell dumpsys meminfo 21082
# registro restrito ao PID em android-memoria.txt
# PSS 99437 KiB / RSS 183392 KiB / SWAP PSS 26325 KiB / 2 WebViews

adb shell pm path com.moodle.moodlemobile
adb shell sha256sum <caminho-do-base.apk-retornado>
# APK instalado: 09894084979b54e889db2099ece03ff0403718fe0e4c537377a826d32a442318
# APK local:     f6b391d471200cad777784a8cfbb96f72f2cb8ef340de5d919f7318d968a93f4

adb forward tcp:9482 localabstract:webview_devtools_remote_21082
node .analise/qualidade-codigo/evidencias/android.cjs state
node .analise/qualidade-codigo/evidencias/android.cjs open academico
node .analise/qualidade-codigo/evidencias/android.cjs state
adb shell input keyevent 4
node .analise/qualidade-codigo/evidencias/android.cjs open presencial
node .analise/qualidade-codigo/evidencias/android.cjs state
adb shell input keyevent 4
node .analise/qualidade-codigo/evidencias/android.cjs state
# caminhos anonimizados, 11/14 módulos nativos; Painel final com cards
```

Uma primeira consulta de meminfo pelo nome do pacote, durante a abertura, devolveu dados globais em vez de dados do processo. Foi descartada e o arquivo sobrescrito pela consulta restrita ao PID; nenhum relatório usa essa primeira saída. Não foi inferido consumo do app a partir de memória global do telefone.

Os probes CDP só leem estado/contagens e acionam o bridge de leitura de curso já matriculado; não consultam valores de armazenamento, headers, cookies ou senhas. Não foi coletado logcat. Não houve logout, força de parada, limpeza de dados, mudança de conta ou instalação. O forward de diagnóstico foi removido ao fim.

## Preservação final

```text
git diff --name-only
# vazio: nenhum arquivo rastreado de produção modificado

git diff --check
# sem erros

git status --short
# somente arquivos novos de auditoria em .analise/
```

Detalhes da verificação final ficam em `preservacao.json`. Relatórios/ferramentas novos não foram commitados ou enviados.
