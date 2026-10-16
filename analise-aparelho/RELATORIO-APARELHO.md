# Relatório de Validação Moodle Mobile IFRN no App Real (Android via USB)

**Data:** 16 de Outubro de 2026  
**Repositório:** `/home/matheusluiz/mobileapp-moodle`  
**Branch:** `feature/moodle-curso-ifrn`  
**Pacote:** `com.moodle.moodlemobile`  

---

## 1. Ambiente

* **Modelo:** Motorola moto g(20)
* **Versão do Android:** 11 (API 30, build RTAS31.68-66-3)
* **Resolução e Densidade:** 720 x 1600 px | Densidade: 280 dpi (DPR: 1.75)
* **Display Cutout:** Inset superior de 50 px físicos (`Rect(0, 50 - 0, 0)`), correspondente a **28.5714 px CSS** (`50 / 1.75`)
* **Métricas do Build Atual (Debug):**
  * **Initial total:** 5.26 MB (873.09 kB gzip) — *excedeu o orçamento de 5.00 MB em 259.80 kB*
  * **main.js:** 4.30 MB (776.08 kB gzip)

---

## 2. Tabela de Validação das Afirmações (F01 a F15)

| Item | Afirmação do Relatório Prévio | Medido no Aparelho / Código | Veredito | Evidência |
| :--- | :--- | :--- | :--- | :--- |
| **F01** | `.welcome__header` soma `--ifrn-safe-top` (padding 17px+safe-top, min-height 77px+safe-top); `config.xml` tem `AndroidEdgeToEdge=true` e `StatusBarOverlaysWebView=false`; `initialize-edge-to-edge.ts` chama `StatusBar.overlaysWebView(true)`; remover o safe-top é perigoso em edge-to-edge. | `config.xml:55,58`; `initialize-edge-to-edge.ts:23`; `marketplace-ifrn.scss:55,57`; `--ion-safe-area-top` = 28.57px; header padding-top = 45.57px; brandTop = 47.28px. Com override de 17px, brandTop cai para 33px (a apenas 4.4px da barra). | **CONFIRMADO** | `marketplace-ifrn.scss:55,57`, `m1-marketplace.json`, `01-marketplace.png`, `02-override17px.png` |
| **F02** | Marketplace fixa `color-scheme: light` e hex fixos; `moodle-course.scss` tem tokens `--ifrn-*` só claros; Moodle liga escuro por `:root.dark` (`theme.dark.scss:207`). | `marketplace-ifrn.scss:17` tem `color-scheme: light;` explícito e cores `#fbfcfa`, `#1e3427`; `theme.dark.scss:207` usa `:root.dark`. No aparelho, corpo ficou com fundo escuro mas marketplace manteve esquema claro. | **CONFIRMADO** | `marketplace-ifrn.scss:1-20`, `theme.dark.scss:207`, `m1-escuro.json`, `03-escuro-marketplace.png` |
| **F03** | Recarga total via `window.location.assign` em `marketplace-ifrn.ts`, `app-views.ts`, `moodle-site.service.ts`, `navigation.guard.ts`. | Inexistente em `marketplace-ifrn.ts`, `moodle-site.service.ts` e `navigation.guard.ts`. Presente em `mobilemoodle.js` (5x), `app-views.ts` (3x) e `app-utils.ts` (2x). Transições com iframe do painel disparam `REQ Document`. | **PARCIAL** | `static.txt` (F03), `transicoes.log` (16.0s e 43.0s REQ Document) |
| **F04** | Painel carrega Ionic e ionicons de `cdn.jsdelivr.net` (`index.html:116-121`); 33 requisições externas; offline não renderiza. | `index.html:116-119` referencia `static/vendor/ionic/...` local. Zero ocorrências de jsdelivr. Em modo avião (`airplane-mode enable`), `ionApp: true` e a página carregou 100% offline. | **REFUTADO** | `index.html:116-119`, `transicoes.log`, `m1-offline.json` |
| **F05** | `ifrn-language.ts` ~197 KB (2.818 linhas), importado por `moodle-site.service.ts:39`, chega ao bundle inicial. | Arquivo possui exatamente 2.818 linhas e 196.965 bytes. Símbolo `useIfrnBrazilianPortuguese` e chaves localizadas diretamente em `www/main.d6590257ca89c071.js`. | **CONFIRMADO** | `static.txt` (F05), `dicionario.txt`, `www/main.*.js` |
| **F06** | Sessão do SUAP via InAppBrowser oculto (`painel-ava.service.ts:454-458, 969-971`). | `PAINEL_IAB_CHROME` define `hidden: 'yes'`. Browser abre em segundo plano sem interface gráfica visível, confirmado em capturas e logcat. | **CONFIRMADO** | `painel-ava.service.ts:80,454,970`, `suap-logcat.txt` |
| **F07** | Voltar do Android: guard devolve false e recarrega o painel. | O guard **NÃO** devolve `false`. Devolve `inject(Router).createUrlTree(['/login/painel'])`. O redirecionamento carrega o painel em iframe (`REQ Document`). | **PARCIAL** | `navigation.guard.ts:37-39,54-56`, `transicoes.log` |
| **F08** | Cinco camadas de loading duplicadas (`app-utils.ts`, `early-course-handoff.js`, `handoff-loading.ts`, `marketplace-ifrn.html`). | Arquivos estão em `src/MoodleIFRN/navigation/` (caminho prévio incorreto). `early-course-handoff.js` já está desativado/esvaziado no código. | **PARCIAL** | `src/MoodleIFRN/navigation/early-course-handoff.js:1-8`, `handoff-loading.ts` |
| **F09** | `moodle-course.scss`: 824 linhas e 136 `!important`. | Possui 833 linhas e apenas **43** `!important` (contagem de 136 foi refutada). | **REFUTADO NA CONTAGEM** | `wc -l` (833) e `grep -c '!important'` (43) em `static.txt` |
| **F10** | Três identidades: marketplace verde (`#19743c`, `#1e3427`, `#fbfcfa`), painel azul DSGov (`#1351b4`, `#04122b`, Rawline), curso misto. | Exatamente as cores encontradas e aplicadas nos arquivos de estilo e telas capturadas. | **CONFIRMADO** | `marketplace-ifrn.scss:2-6`, `dsgov/_variables.scss:9,14`, `moodle-course.scss:34` |
| **F11** | Bundle inicial 5,26 MB vs orçamento 5,00 MB; `angular.json` `optimization.scripts=false`. | Initial total registrado em 5.26 MB (aviso de orçamento excedido por 259.80 kB); `angular.json:79` com scripts desotimizados. | **CONFIRMADO** | `build.log`, `angular.json:78-81` |
| **F12** | Fonte Rawline com caminho absoluto `/mobilemoodle/static/theme/ifrn/fonts/` (`moodle-course.scss:5`). | O caminho absoluto `/mobilemoodle/...` existe. No entanto, no dispositivo real, os pesos 400, 500 e 700 foram carregados com sucesso (`loaded`) pelo servidor web local do Cordova. | **CONFIRMADO** (com ressalva de que funciona localmente) | `moodle-course.scss:5`, `m1-marketplace.json`, `m1-painel.json` |
| **F13** | Domínios fixos: `presencial.ava`, `academico.ava`, `painel.ead (.ifrn.edu.br)` em três arquivos. | Os domínios fixos existem e são um risco alto, mas estão presentes em pelo menos **11 arquivos** (não apenas 3). | **PARCIAL / REFUTADO NA CONTAGEM** | `static.txt` (F13 lista 11 arquivos com URLs absolutas) |
| **F14** | Logout por `_system` em `moodle-open-course.ts:85`. | `window.open(..., '_system')` é chamado em `moodle-open-course.ts:85`, `marketplace-ifrn.ts:217` e `app.ts:50`. | **CONFIRMADO** | `moodle-open-course.ts:85`, `marketplace-ifrn.ts:217`, `app.ts:50` |
| **F15** | Centenas de avisos de build, maioria do núcleo. | O build gerou apenas **29 avisos**. Destes, **16 avisos** são do TypeScript acusando arquivos legados em `src/MoodleIFRN/mobilemoodle/core_mobile/` que não são utilizados na compilação. Não vêm do núcleo. | **REFUTADO** | `analise-aparelho/build.log` (29 avisos no total) |
| **Contraste** | Descartado: `#637266/#fbfcfa = 4.94` e `#666666/#f6f6f6 = 5.31` passam em AA. | Cálculos confirmados matematicamente: 4.94 e 5.31 (ambos > 4.5:1). | **CONFIRMADO O DESCARTE** | Execução de luminosidade relativa em `static.txt` |

---

## 3. Análise Detalhada F01 (Espaço no Topo e Edge-to-Edge)

### O app está em Edge-to-Edge no Android do aparelho?
**SIM.** O aparelho de teste executa Android 11. O arquivo `config.xml` define `<preference name="AndroidEdgeToEdge" value="true" />` e `initialize-edge-to-edge.ts` executa obrigatoriamente `StatusBar.overlaysWebView(true);` para Android <= 14. O plugin `@totalpave/cordova-plugin-insets` captura os insets reais do display cutout (`Rect(0, 50 - 0, 0)`), injetando no root `--ion-safe-area-top: 28.5714px`. A WebView renderiza por trás da barra de status.

### Avaliação das Hipóteses
* **H1 (Inset Duplicado no DOM):** **REFUTADA.** A inspeção de ancestrais (`anc`) revelou que apenas o próprio `.welcome__header` possui `padding-top: 45.5714px`. Nenhum elemento pai nem o `ion-content` (`inner-scroll` com padding 0) injeta safe area cumulativa.
* **H2 (Inset Inflado no CSS):** **CONFIRMADA.** Em `marketplace-ifrn.scss`, o CSS soma artificialmente `--ifrn-safe-top` a valores base já elevados:
  * `padding-top: calc(17px + var(--ifrn-safe-top));` (resulta em 45.57px)
  * `min-height: calc(77px + var(--ifrn-safe-top));` (resulta em 105.57px)
  Essa soma infla o cabeçalho em altura além da área necessária para o respiro visual.
* **H3 (Barra de Cor Diferente):** **CONFIRMADA VISUALMENTE.** O fundo verde do cabeçalho preenche a área sob a barra translúcida de status.
* **H4 (Problema do Painel):** **CONFIRMADA PARCIALMENTE.** No iframe do painel, `_sidebar.scss` soma `16px + max(32px, safe-area...)`, adicionando 48px de espaçamento no topo.

### Remover `--ifrn-safe-top` é SEGURO, INSEGURO ou INCONCLUSIVO?
**COMPLETAMENTE INSEGURO.**
* No teste em execução com `ovr.js` (`padding-top: 17px !important`), a posição `brandTop` caiu de `47.28px` para `33.00px`.
* Como a barra de status / entalhe da câmera consome `28.57px`, a margem restante entre a logo/marca e a barra de status foi de meros **4.43px**.
* Em aparelhos com furos maiores ou entalhes de 36px–48px, o texto e os botões da barra ficariam **completamente sobrepostos** pelo relógio e ícones do sistema operacional.

### Diff Mínimo Sugerido (Sem aplicar)
```diff
--- a/src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.scss
+++ b/src/MoodleIFRN/marketplace-ifrn/marketplace-ifrn.scss
@@ -52,10 +52,10 @@
         gap: 12px;
         border-bottom: 1px solid var(--ifrn-line);
         justify-content: space-between;
-        min-height: calc(77px + var(--ifrn-safe-top));
+        min-height: calc(56px + var(--ifrn-safe-top));
         padding:
-            calc(17px + var(--ifrn-safe-top))
+            calc(8px + var(--ifrn-safe-top))
             var(--ifrn-gutter)
-            18px
+            10px
             var(--ifrn-gutter);
     }
```

---

## 4. Métricas e Comportamento em Execução

* **Transições e Requisições Document (`transicoes.log`):**
  * Ao navegar para o Painel (em 16.0s e 43.0s), o aplicativo emite um `REQ Document http://localhost/mobilemoodle/index.html?lang=pt-br`, seguido de 40+ downloads locais de assets (`ionic.bundle.css`, `ionic.esm.js`, `p-*.entry.js`, SVGs de ícones).
  * A navegação entre páginas Angular não recarrega o documento, mas a entrada no Painel recria todo o documento HTML do iframe.
* **`main.js` rebaixado?** **NÃO.** Zero requisições de rede para `main.js` durante a navegação. O arquivo é mantido em cache e executado pela SPA do Angular.
* **Requisições Externas:** Restritas aos webservices oficiais do AVA (`https://presencial.ava.ifrn.edu.br/webservice/rest/server.php` e `academico.ava...`). Nenhuma dependência externa de CDNs foi solicitada em tempo de execução.
* **Status da Fonte Rawline:** No dispositivo real, `Rawline 400`, `500` e `700` constam como `loaded` no `document.fonts`. O peso `600` permaneceu `unloaded` por não ter sido requisitado pelos elementos da página.
* **Dicionário de Idiomas:** As strings de `ifrn-language.ts` e chaves como `addon.badges.alignment` foram compiladas diretamente no bundle inicial `www/main.d6590257ca89c071.js`, devido ao import estático em `moodle-site.service.ts`.
* **Consumo de Memória (dumpsys meminfo):**
  * **Antes das navegações (Login/Marketplace):**
    * PSS Total: 121.878 kB (~119.0 MB) | RSS Total: 193.732 kB (~189.2 MB)
    * Java Heap: 6.480 kB | Native Heap: 10.960 kB
  * **Após ciclo de navegações (3 voltas completas):**
    * PSS Total: 143.613 kB (~140.2 MB) — **Aumento de +21.7 MB**
    * RSS Total: 209.220 kB (~204.3 MB)
    * Java Heap: 20.816 kB — **Aumento de 3.2x (+14.3 MB)**
    * Native Heap: 32.824 kB — **Aumento de 3.0x (+21.8 MB)**

---

## 5. Erros do Relatório Prévio e Omissões Detectadas

### Erros do Relatório Prévio
1. **F04 (CDN jsdelivr e falha offline):** Erro factual total. O painel já consome arquivos locais em `static/vendor/ionic/`. O app funciona offline em modo avião.
2. **F09 (Quantidade de `!important`):** Afirmou 136 `!important`. A contagem real no arquivo é de **43**.
3. **F15 (Centenas de avisos do núcleo):** Afirmou centenas de avisos atribuídos ao núcleo. Houve apenas 29 avisos, sendo 16 provocados por código TypeScript abandonado da pasta `src/MoodleIFRN/mobilemoodle/core_mobile/`.
4. **F07 (Guard retornando `false`):** O guard retorna `UrlTree` de redirecionamento, não `false`.
5. **F13 (Contagem de arquivos com domínios fixos):** Subestimou como "três arquivos", quando na realidade há pelo menos 11 arquivos contendo URLs absolutas fixas.
6. **F08 (Caminhos de arquivos):** Apontou caminhos inexistentes (`mobilemoodle/early-course-handoff.js` em vez de `navigation/early-course-handoff.js`).

### 5 Problemas Reais Não Detectados pelo Relatório Prévio
1. **Acúmulo e vazamento de memória nas navegações:** O Java Heap triplicou (6.4 MB para 20.8 MB) ao alternar entre Marketplace, Painel e Curso via botão Voltar físico, indicando retenção de instâncias dos componentes e do iframe.
2. **Código Morto em `core_mobile` poluindo o build:** 16 arquivos TypeScript em `src/MoodleIFRN/mobilemoodle/core_mobile/` estão sem importação no Angular mas são processados pelo `tsconfig`, gerando advertências no build e consumo desnecessário de memória de compilação.
3. **Iframe arquitetural no Painel:** O componente `/login/painel` recarrega uma página HTML completa via iframe (`mobilemoodle/index.html`) com uma cópia integral do runtime Ionic 8, duplicando eventos globais e exigindo sincronização por bridge.
4. **Dessincronia de modo escuro entre shells:** O marketplace impõe `color-scheme: light` fixo, enquanto o Moodle altera o fundo para preto (`rgb(0,0,0)`), gerando contraste visual quebrado na transição entre telas.
5. **Carregamento especulativo de fontes Rawline:** A declaração de todos os pesos (400 a 700) via `@each` no CSS global dispara verificação de fontes em páginas onde nem todos os pesos são necessários, além de depender de path absoluto `/mobilemoodle/...` que falha em ambientes com base href customizado.

---

## 6. Ordem Recomendada de Correção

A fila lógica de trabalho prioriza estabilidade visual e de bundle antes de refatorações estruturais:

1. **Sprint 1 — Visual Crítico e Acessibilidade:**
   * **F01 / F02:** Ajustar `padding-top` e `min-height` do cabeçalho sem remover o `--ifrn-safe-top`. Remover `color-scheme: light` forçado e introduzir suporte a `:root.dark` no marketplace e curso.
2. **Sprint 2 — Otimização de Carregamento e Bundle:**
   * **F05 / F04:** Transformar `ifrn-language.ts` em carregamento sob demanda (lazy-loading) ou dicionário externo para subtrair ~197 KB do `main.js`. (F04 já sanado).
   * **Limpeza de `core_mobile`:** Remover do `tsconfig` os arquivos mortos que disparam 16 warnings de build.
3. **Sprint 3 — Navegação e Ciclo de Vida:**
   * **F03 / F07 / F08:** Eliminar `location.assign` remanescentes em `mobilemoodle/`, consolidar o fluxo do botão Voltar sem recarga de documento e unificar o gerenciamento de loading.
4. **Sprint 4 — Higiene CSS e Identidade Visual:**
   * **F09 / F10 / F12:** Reduzir os 43 `!important` de `moodle-course.scss`, padronizar os caminhos relativos de fontes Rawline e unificar as paletas verde/azul. *(Depende de definição da identidade visual com o time)*.
5. **Sprint 5 — Arquitetura de Autenticação e Ambientes (Dependências TI):**
   * **F06 / F14 / F13:** *(Depende de alinhamento com a TI/IFRN)*.
     * **F06:** Substituir InAppBrowser oculto por autenticação PKCE/OAuth nativa direta.
     * **F14:** Tratar logout sem abrir o navegador padrão do sistema (`_system`).
     * **F13:** Parametrizar domínios de AVA (presencial, acadêmico, ead) via configuração/ambiente em vez de constantes hardcoded.
   * **F11:** Reativar `optimization.scripts: true` em `angular.json` após o bundle inicial ficar abaixo dos 5.00 MB.

---

## 7. Fechamento e Integridade do Repositório

### Comparação do Git Status
* **Git Inicial:**
  ```text
   M src/assets/MoodleIFRN/navigation/early-course-handoff.js
   M src/core/features/login/login.module.ts
   M src/index.html
  ?? analise-aparelho/
  ```
* **Git Atual:**
  ```text
   M src/assets/MoodleIFRN/navigation/early-course-handoff.js
   M src/core/features/login/login.module.ts
   M src/index.html
  ?? analise-aparelho/
  ```

> **Nenhum arquivo versionado foi alterado.**  
> *(As pastas `www/` e `platforms/` geradas pelo comando de build debug não afetam o rastreamento do repositório).*

### Comandos Fora do Padrão Executados
Nenhum comando fora do escopo ou invasivo foi executado. Todos os artefatos de medição foram estritamente isolados na pasta `./analise-aparelho/`.
