# Evidência — `COUR-01` (app do prestador: *Em andamento* + *Agenda*)

> **Data:** 2026-08-09
> **Agente:** Claude Code (Opus 5)
> **Ambiente:** desenvolvimento local no PC `acer`; nenhuma cloud tocada.
> **Banco:** descartável `aqui_log_cour01` no container `aqui-log-postgres` (porta 5433)
> **API viva:** `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`
> **Gates:** `DEC-21` (decidida) · plano §5.2 · depende de `SCHED-01` ✅
> **Commit inicial:** `531a432` (`main`)

## 1. O que foi entregue

O app do prestador deixou de mostrar todas as corridas numa lista só. A aba
*Corridas* passou a separar o que ele faz **agora** do que ele **reservou para
depois** (aceite antecipado, `DEC-20`).

| Peça | Onde |
| --- | --- |
| Regra pura de classificação (`CourierSection`, `CourierBoard`) | `packages/aqui_log_core/lib/src/courier_board.dart` |
| `isScheduledAheadAt(now)` — a mesma pergunta com o instante explícito | `packages/aqui_log_core/lib/src/models.dart` |
| Abas *Em andamento* / *Agenda* / *Concluídas* + cartão da corrida | `apps/courier_app/lib/screens/my_deliveries_screen.dart` |
| Testes da regra pura (9 casos) | `packages/aqui_log_core/test/courier_board_test.dart` |
| Testes de widget da separação (5 casos) | `apps/courier_app/test/widget_test.dart` |
| Trava do contrato da listagem do prestador (4 casos) | `apps/backend/src/deliveries/courier-list.contract.spec.ts` |

### O backend **não** precisou mudar

A primeira coisa verificada foi se `GET /deliveries` já entrega o que a
separação exige. Entrega: `present()` devolve a entidade inteira ao prestador
(menos o segredo do `PICK-01`), então `fulfillmentMode`, `pickupWindowStart/End`,
`deliveryWindowStart/End`, `courierFeeCents`, endereços e encomenda **já
chegavam** desde `SCHED-01`. Nenhuma rota, DTO ou migration foi criada.

O que se acrescentou foi um teste que **tranca esse contrato**
(`courier-list.contract.spec.ts`): se um dia a listagem parar de devolver modo
ou janela, o agendado de amanhã volta a aparecer como corrida de agora e nada
quebra visivelmente. O teste faz a falha aparecer.

Nenhum código de produção do backend foi tocado — o diff do backend é um único
arquivo `.spec.ts`.

## 2. A regra de separação, e por que ela é assim

```
DELIVERED | CANCELED                                   -> Concluídas
ACCEPTED + SCHEDULED + pickupWindowStart no futuro      -> Agenda
qualquer outro (ACCEPTED, AT_PICKUP, PICKED_UP, IN_TRANSIT) -> Em andamento
```

Três decisões que a especificação não fixava:

1. **Só `ACCEPTED` pode estar na Agenda.** Se o status já andou (`AT_PICKUP`,
   `PICKED_UP`, `IN_TRANSIT`), a corrida está acontecendo — e admin/suporte
   podem abrir a coleta antes da janela (`SCHED-01`). Deixar a janela futura
   mandar sozinha esconderia uma corrida em curso na aba errada.
2. **Terceira aba, *Concluídas*.** O plano §5.2 pede duas seções, mas a lista
   antiga do app mostrava **todas** as corridas, inclusive entregues e
   canceladas. Com só duas seções, uma entrega concluída cairia em *Em
   andamento* (errado) ou sumiria (perda de função que já existia). A terceira
   aba preserva o que havia sem contaminar as duas do plano.
3. **Agendada sem janela não fica presa na Agenda.** Sem instante de início não
   há como afirmar que é futuro; a corrida vai para *Em andamento*, onde o
   prestador a vê. Esconder por falta de dado seria pior.

A regra mora no pacote compartilhado, não na tela, e recebe o "agora" por
parâmetro — a fronteira entre as duas seções é um instante, e teste que lê o
relógio real não prova os dois lados dela.

## 3. O que o cartão mostra (plano §5.2)

Código público, modo (`Imediato`/`Agendado`), janelas de coleta e entrega quando
agendado, os dois endereços, a encomenda (tipo · tamanho · peso e a foto do
cliente), o repasse e o status. Tocar no cartão abre o
`DeliveryDetailScreen` **existente** — nenhuma tela de coleta ou entrega foi
recriada.

**Não há botão de cancelar.** O cancelamento com taxa é `COUR-02` e depende de
`PAY-01`; um botão desabilitado só prometeria uma saída que ainda não existe. O
teste de widget verifica que a palavra "Cancelar" não aparece na tela.

A aba *Ofertas* (auto-dispatch) continua separada e intocada: oferta ainda não é
corrida do prestador. A sonda ao vivo confere que a listagem das duas seções e a
lista de ofertas são coisas diferentes.

## 4. Prova em HTTP vivo

Banco descartável `aqui_log_cour01`, 11 migrations (nenhuma nova nesta rodada),
API em `PORT=3011` com `PUBLIC_API_URL` alinhado (armadilha do `ESTADO-ATUAL`
§7), e um prestador isolado como único disponível para que o auto-dispatch não
entregasse a corrida a um entregador de rodada anterior.

Cenário montado: uma imediata levada até `IN_TRANSIT`; uma agendada para **10 h
à frente**, aceita antecipadamente; e uma agendada aceita cuja janela foi
empurrada para o passado no banco — que é o que o relógio faria sozinho meia
hora depois.

```
=== GET /deliveries como prestador ===
AQL-MSMCZ5G8DSD	ACCEPTED	SCHEDULED	janela=2026-08-09T22:02:47.062Z	repasse=1020	codigo_vazado=false
AQL-MSMCZ5AKNJA	ACCEPTED	SCHEDULED	janela=2026-08-10T08:12:46.000Z	repasse=1020	codigo_vazado=false
AQL-MSMCZ4XLFQL	IN_TRANSIT	IMMEDIATE	janela=-                        	repasse=1106	codigo_vazado=false

=== classificacao pela regra do COUR-01 (mesma do core) ===
AGENDA		AQL-MSMCZ5AKNJA	ACCEPTED	SCHEDULED
EM_ANDAMENTO	AQL-MSMCZ4XLFQL	IN_TRANSIT	IMMEDIATE
EM_ANDAMENTO	AQL-MSMCZ5G8DSD	ACCEPTED	SCHEDULED

=== assercoes ===
OK: 3 corridas do prestador
OK: modo + janela + repasse em todas
OK: nenhum pickupCode vazado (PICK-01 intacto)
OK: agendada futura vem aceita e com janela (-> Agenda)
OK: agendada com janela aberta (-> Em andamento)
OK: imediata em transito (-> Em andamento)

=== ofertas continuam separadas das duas secoes ===
ofertas pendentes: 0
```

Os dois agendados têm o **mesmo** modo e o **mesmo** status; o que os separa é
só a janela — que é exatamente o critério do `DEC-21`.

## 5. Comandos executados

| Comando | Resultado |
| --- | --- |
| `pnpm build` | ✅ PASS |
| `pnpm lint` | ✅ PASS |
| `pnpm test` | ✅ PASS — **18 suítes / 153 testes** (eram 17 / 149) |
| `pnpm smoke` | ✅ PASS — contra a API viva em `PORT=3011` |
| `migration:run` em `aqui_log_cour01` | ✅ PASS — 11 migrations (nenhuma nova) |
| Sonda `GET /deliveries` do prestador em HTTP vivo | ✅ PASS — 6 asserções |
| `flutter analyze` (motoboy) | ✅ PASS — sem apontamentos |
| `flutter test` (motoboy) | ✅ PASS — **18 testes** (eram 14) |
| `flutter analyze` (cliente) | ✅ PASS — sem apontamentos |
| `flutter test` (cliente) | ✅ PASS — 15 testes |
| `dart analyze` (core) | ✅ PASS |
| `dart test` (core) | ✅ PASS — **23 testes** (eram 14) |
| Migration nova / rollback | **N/A** — nenhuma migration foi criada |
| APK e QA em emulador/dispositivo | ❌ **NÃO EXECUTADO** — segue em `UX-02` |
| QA de navegador do painel | **N/A** — o painel não foi tocado |

Testes novos, por assunto:

- `courier_board_test.dart` — 9 casos da regra pura (agendada futura, janela já
  aberta, o instante exato da fronteira, imediata, status adiantado por
  suporte, entregue/cancelada, agendada sem janela, separação e ordenação da
  lista inteira, e a concordância entre `scheduledAhead` e `isScheduledAheadAt`);
- `widget_test.dart` — 5 casos de tela (separação das três abas com contagem,
  conteúdo do cartão, toque abrindo o detalhe existente, vazio próprio de cada
  seção e a ausência do botão de cancelar);
- `courier-list.contract.spec.ts` — 4 casos do contrato da listagem (modo e
  janelas presentes, imediato sem janela, escopo por prestador, `pickupCode`
  ausente).

## 6. Limitações desta rodada

1. **Sem QA visual.** Nenhum emulador ou dispositivo; a tela foi provada por
   teste de widget, não por olho humano. Segue em `UX-02`.
2. **A fronteira é o relógio do aparelho.** A classificação roda no app, com
   `DateTime.now()` local. O servidor continua sendo a autoridade — ele recusa
   `AT_PICKUP` fora da janela com `409` (`SCHED-01`) — então um relógio adiantado
   move o cartão de aba antes da hora, mas **não** libera a coleta.
3. **`COUR-02` continua fora.** Não há botão de cancelar, nem a taxa sendo
   debitada; depende de `PAY-01`.
4. **A lista do prestador não pagina.** `GET /deliveries` sem `page`/`limit`
   devolve o histórico inteiro, e a aba *Concluídas* cresce sem limite. Não é
   problema hoje (banco descartável), mas vira um quando houver volume — é
   trabalho de outro pacote.
5. **A sonda ao vivo não está no repositório.** Ela roda contra banco
   descartável e precisou isolar o prestador via SQL; virou evidência, não
   script versionado. O `pnpm smoke` versionado continua cobrindo o fluxo.
