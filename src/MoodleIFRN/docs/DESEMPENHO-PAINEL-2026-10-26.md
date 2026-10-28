# Menos trabalho repetido ao abrir o Painel

A leitura dos snapshots regravava perfil e listas no sessionStorage mesmo quando
o conteúdo já era idêntico. Além disso, toda resposta válida de atualização de
perfil retornava `true`, inclusive quando os nomes não mudavam. O host interpretava
esse retorno como mudança e recarregava o iframe inteiro do Painel.

## Alterações

- `oauth-profile.ts` só restaura dados no armazenamento quando eles diferem.
  As validações de identidade, proprietário das listas e expiração continuam
  acontecendo em cada leitura; não foi introduzido cache de autorização.
- `profile-refresh.ts` sinaliza mudança apenas se os campos de nome ou sua
  origem mudarem. Não recria o Painel para respostas idênticas. Se uma cópia
  persistida estiver ausente, ela ainda é reparada sem recarregar a interface.
- Alterações reais no nome continuam atualizando os snapshots e a interface.
  Fotos, cursos, prazos e preferências são preservados.

## Comparação controlada

O mesmo cenário foi executado com o código anterior e o código otimizado, usando
armazenamentos instrumentados e uma lista sintética de 1.000 diários. A restauração
inicial ficou fora da contagem. Os números abaixo são operações, não tempos de
execução medidos no celular.

| Cenário | Antes | Depois |
|---|---:|---:|
| Gravações em 100 leituras de perfil + listas já restauradas | 500 | 0 |
| Gravações em 20 atualizações sem mudança no perfil | 100 | 0 |
| Pedidos de recarga do Painel nessas 20 atualizações | 20 | 0 |

## Validação

Os testes verificam a ausência de gravações repetidas e recargas desnecessárias,
restauração inicial, reparo da cópia persistida, alterações reais de nome, expiração,
isolamento entre contas e origem autenticada. Os testes existentes de navegação
de cursos e novo login também foram executados. Não foi alterado o fluxo SUAP/SSO.

Foram aprovados 23 testes distintos nas baterias de perfil, desempenho de
armazenamento, navegação de cursos, Painel e retorno ao login. A verificação
TypeScript e os builds web/Android também passaram.

O APK foi instalado com `adb install -r`. Na revalidação real do perfil no Android,
o serviço retornou `changed=false`, fez zero gravações de armazenamento e manteve
o mesmo documento do iframe com os cards presentes. Os cursos Acadêmico
`4022/contents` e Presencial `2836/contents` abriram sem erro após a instalação.
Não foram apagados os dados ou as sessões do app.

Esse ajuste reduz trabalho no armazenamento e evita recriar a tela, mas não torna
mais rápidas as respostas dos servidores institucionais.
