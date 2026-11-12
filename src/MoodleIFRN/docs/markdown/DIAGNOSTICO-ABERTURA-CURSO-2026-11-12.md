# Diagnóstico da abertura de curso — 12/11/2026

## Estado

**Correção parcial aplicada na branch `fix/erro-abertura-curso`. Estado: NÃO CONCLUÍDO.** Após a instalação da build nova, o operador relatou que “Metodologia” demora e termina em erro de parâmetro. Essa mensagem ainda não foi capturada de forma independente nem associada a um parâmetro específico.

## Evidências

- **MEDIDO — patch local:** antes da aplicação, o manifesto P0.4 informou `ready`; os arquivos de `SecureStorage` no plugin estavam nos hashes-base. O patch versionado já continha o contrato `storeDurable` em TypeScript e Java Android, mas ainda não estava aplicado neste checkout.
- **LIDO — persistência:** o fluxo nativo de SSO prepara as credenciais com `storeDurable` antes de publicar a sessão Moodle no SQLite. A cópia Java Android inspecionada no build anterior não reconhecia a ação `storeDurable`; essa divergência impedia a conclusão do protocolo de publicação naquele build, mas não está confirmada como causa única do erro atual.
- **MEDIDO — correção de build:** `npm run patch:ifrn` aplicou e validou os hashes pós-patch. O wrapper JavaScript foi recompilado e sincronizado com os diretórios Cordova gerados; a implementação Java Android foi sincronizada com as cópias instaladas do plugin.
- **MEDIDO — compilação e instalação:** `npm run prod:android` terminou com `BUILD SUCCESSFUL`; o APK foi instalado e iniciado no Moto G20 (`Run Successful`).
- **MEDIDO — teste automatizado focado:** `node --test src/MoodleIFRN/tests/course-session-opening.test.cjs` terminou com código de saída 0.
- **RELATO DO OPERADOR — aparelho:** depois da instalação, ao abrir “Metodologia”, houve demora e apareceu erro de parâmetro. O curso não foi considerado aberto com sucesso.
- **NÃO VERIFICADO — causa do erro atual:** ainda não sabemos se o identificador chega vazio/inválido à ponte, se há divergência no destino/ambiente, ou se o erro vem de uma resposta do Moodle. Não registramos o valor do identificador, URL com query, credenciais nem conteúdo pessoal.

## Como o fluxo está organizado

O painel valida o identificador recebido antes de chamar `ensureSessionAndOpenCourse` e, se necessário, navega para `/login/moodle-open-course` com os parâmetros da disciplina. A ponte lê esses parâmetros e tenta abrir o curso nativo. O serviço rejeita `courseId` não finito ou menor/igual a zero. Essa validação é um ponto a verificar, mas **não prova** que seja a origem da mensagem relatada.

## Alterações e validação

O patch P0.4 existente é o mecanismo versionado para aplicar as alterações necessárias ao core e ao plugin Cordova, incluindo o armazenamento durável. Nesta execução ele foi aplicado por `npm run patch:ifrn`; a implementação Android gerada também foi sincronizada antes da compilação. Não houve alteração em dados acadêmicos, inscrições, notas, perfil ou atividades.

O teste local cobre o contrato de abertura de sessão, mas não substitui a confirmação no aparelho. A navegação por CDP ainda encontrou a rota de ponte de erro; o operador também relatou erro de parâmetro no curso. Portanto, a abertura **não está validada** e não será descrita como corrigida.

## Próxima verificação necessária

1. Na próxima sessão do aparelho, abrir o Painel e tocar uma vez em “Metodologia”.
2. Registrar apenas a etapa que falhou e flags sanitizadas: identificador presente/válido, ambiente reconhecido, sessão confirmada, resposta HTTP/status e categoria do erro. Não registrar ID, nome, URL completa, query, token, cookie ou corpo.
3. Confirmar se a ponte recebe os parâmetros de curso e se `ensureSessionAndOpenCourse` recebe um ID numérico válido.
4. Se a entrada for válida, seguir a resposta do Moodle até a rota nativa e classificar o erro sem salvar conteúdo da página.
5. Depois da correção, repetir o mesmo curso e um curso de outro ambiente, sem executar ações acadêmicas.

## Limites desta evidência

O operador relatou o erro após a instalação, mas não foi possível concluir uma abertura bem-sucedida nem capturar a origem exata da mensagem. O relatório não afirma que todos os cursos funcionam e não recomenda limpar dados ou refazer autenticação como correção.
