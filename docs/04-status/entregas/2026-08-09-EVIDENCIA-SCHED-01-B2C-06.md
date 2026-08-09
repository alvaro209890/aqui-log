# Evidência — `SCHED-01` + `B2C-06` (modo agendado individual com aceite antecipado)

> **Data:** 2026-08-09
> **Agente:** Claude Code (Opus 5)
> **Ambiente:** desenvolvimento local no PC `acer`; nenhuma cloud tocada.
> **Banco:** descartável `aqui_log_sched01` no container `aqui-log-postgres` (porta 5433)
> **API viva:** `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`
> **Gates:** `DEC-18`, `DEC-19`, `DEC-20`, `FLOW-DEC-02` · plano seções 3, 4 e 5
> **Commit inicial:** `5d0ecd7` (`main`)

## 1. O que foi entregue

Todo pedido novo declara `fulfillment_mode`. O cliente **escolhe** o modo; o
agendado exige janela de coleta com 30 minutos de antecedência mínima, custa o
km mais barato, entra na fila de ofertas na mesma hora (aceite antecipado) e só
"abre" para execução quando a janela começa.

| Peça | Onde |
| --- | --- |
| Regras puras de janela e capacidade | `apps/backend/src/deliveries/scheduling.ts` |
| Migration aditiva (janelas, `km_rate_cents`, taxa congelada, 2 índices) | `apps/backend/src/database/migrations/1785500000000-DeliveryScheduling.ts` |
| Modo obrigatório + janelas no contrato de criação | `apps/backend/src/deliveries/dto/delivery.dto.ts` |
| Cotação por modo, congelamento, capacidade, portão da janela | `apps/backend/src/deliveries/deliveries.service.ts` |
| 4 settings novos com validação | `apps/backend/src/settings/settings.module.ts` |
| Filtro `fulfillmentMode` na listagem | `deliveries.controller.ts` + `DeliveriesPage.tsx` |
| Painel: seção "Modo agendado" | `apps/dashboard/src/pages/SettingsPage.tsx` |
| App cliente: escolha do modo + seleção da janela | `apps/customer_app/lib/screens/new_order_screen.dart` |
| App motoboy: janela na oferta e no detalhe; coleta travada fora da janela | `apps/courier_app/lib/screens/{available_deliveries,delivery_detail}_screen.dart` |
| Modelo compartilhado (`fulfillmentMode`, janelas, rótulos) | `packages/aqui_log_core/lib/src/{models,fulfillment}.dart` |
| Cenário agendado no smoke | `scripts/smoke-test.sh` |

## 2. Conflitos entre especificação e código, e o que se decidiu

Três pontos em que a especificação encontrou o código já existente:

1. **`fulfillment_mode` já existia.** `B2C-02A` (migration `1785300000000`)
   criou a coluna com `NOT NULL DEFAULT 'IMMEDIATE'`, e `pricing.calc.ts` já
   sabia escolher a tarifa por modo. O que faltava era exatamente o que o
   backlog dizia: **o cliente escolher**. `deliveries.service` fixava
   `fulfillmentMode: 'IMMEDIATE'` no `create`. Não foi criada coluna nova para o
   modo; só passou a existir quem a preencha.
2. **O modo virou campo obrigatório na criação, sem default.** O plano §3.1
   lista o modo entre os campos obrigatórios e o §12 pede que pedido sem modo
   seja rejeitado. Deixar cair em `IMMEDIATE` por omissão faria o cliente pagar
   a tarifa cara sem ter escolhido. **Consequência:** um APK antigo, que não
   manda `fulfillmentMode`, passa a receber `400` ao criar pedido. Não há APK
   publicado (segue pendente em `UX-02`), e os dois apps deste repositório foram
   atualizados na mesma rodada.
3. **`km_rate_cents` duplica um valor que já está no `pricing_breakdown`.** A
   duplicação é deliberada: `DEC-19` exige provar qual tarifa foi cobrada, e
   fazer isso abrindo JSON em consulta de auditoria é caro e frágil.

Também foram fixados **valores provisórios** para o que o plano deixou em
aberto na capacidade (§5.1), todos editáveis no admin:

| Chave | Valor | Origem |
| --- | --- | --- |
| `minScheduleLeadMinutes` | **30** | `FLOW-DEC-02` (decidido) |
| `scheduleMaxWindowMinutes` | 480 | provisório desta rodada |
| `scheduleCapacitySlackMinutes` | 15 | provisório — a "folga mínima" do plano §5.1 |
| `immediateExecutionEstimateMinutes` | 45 | provisório — quanto se assume que um imediato ocupa |

Duas constantes ficaram **em código**, não no admin, por serem limites de
sanidade e não política de negócio: janela mínima de 15 min
(`SCHEDULE_MIN_WINDOW_MINUTES`) e horizonte máximo de 30 dias
(`SCHEDULE_MAX_HORIZON_DAYS`).

### Comportamento pré-existente observado (não corrigido aqui)

A resposta de `POST /deliveries` mostra `status: "REQUESTED"` mesmo quando o
auto-dispatch da própria criação já ofertou o pedido: `dispatch()` recarrega a
entrega do banco e salva **outra instância**, e o `create()` apresenta a sua,
que ficou velha. É anterior a esta rodada (o smoke já convivia com isso pelo
fallback "se não houver oferta, despacha manualmente") e foi deixado como está —
corrigir é mudança de comportamento fora do escopo de `SCHED-01`.

## 3. Migration em banco vivo, com rollback ensaiado

```
$ psql -h localhost -p 5433 -U aqui_log -d postgres -c "CREATE DATABASE aqui_log_sched01;"
CREATE DATABASE

$ DATABASE_NAME=aqui_log_sched01 npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
… (11 migrations)
Migration DeliveryScheduling1785500000000 has been executed successfully.
```

Colunas criadas — **todas opcionais, nenhum `NOT NULL`, nenhum `DEFAULT`**:

```
       column_name        |        data_type         | is_nullable
--------------------------+--------------------------+-------------
 courier_cancel_fee_cents | integer                  | YES
 delivery_window_end      | timestamp with time zone | YES
 delivery_window_start    | timestamp with time zone | YES
 fulfillment_mode         | character varying        | NO      <- já existia (B2C-02A)
 km_rate_cents            | integer                  | YES
 pickup_window_end        | timestamp with time zone | YES
 pickup_window_start      | timestamp with time zone | YES
```

Rollback ensaiado **com um pedido legado dentro da tabela**
(`AQL-LEGADO-SCHED`, inserido direto no banco antes do revert):

```
Migration DeliveryScheduling1785500000000 has been reverted successfully.
== depois do revert ==   colunas_sched = 0 | indices = 0 | AQL-LEGADO-SCHED | REQUESTED | IMMEDIATE
Migration DeliveryScheduling1785500000000 has been executed successfully.
== reaplicada ==         11 migrations | AQL-LEGADO-SCHED | IMMEDIATE | janela vazia | km_rate vazio
```

## 4. Comportamento provado em HTTP vivo

### 4.1 Criação e recusas (`FLOW-DEC-02`)

Executado dentro do `scripts/smoke-test.sh`, que **aborta** se qualquer caso
sair diferente:

| Caso | Esperado | Resultado |
| --- | --- | --- |
| Agendado com janela **no passado** (−180 min) | `400` | ✅ |
| Agendado com **10 min** de antecedência | `400` + "30 minutos" na mensagem | ✅ |
| Agendado com **fim igual ao início** | `400` | ✅ |
| **Imediato** com janela preenchida | `400` | ✅ |
| Agendado com janela válida (2 h à frente, 1 h de duração) | `201` com modo e janelas | ✅ |

### 4.2 Tarifa dual congelada (`DEC-19` / `B2C-06`)

Mesma rota, mesmos peso e tamanho, só o modo mudando:

| Modo | `kmRateCents` | `priceCents` |
| --- | --- | --- |
| `IMMEDIATE` | 250 | 1380 |
| `SCHEDULED` | **180** | **1273** |

Congelamento conferido no smoke: alterar `pricingPerKmScheduledCents` no admin
**não** mexeu no `kmRateCents` do pedido já criado (e o valor foi restaurado
logo depois). O `pricingBreakdown` do agendado traz
`fulfillmentMode: "SCHEDULED"` e o mesmo `kmRateCents`.

A validação de settings do `B2C-02` continua de pé:

```
agendado=250 (igual ao imediato) -> HTTP 400
agendado=400 (maior)             -> HTTP 400
scheduleMaxWindowMinutes=5       -> HTTP 400: "must not be less than 15"
```

### 4.3 Aceite antecipado (`DEC-20`)

```
agendado criado para 40 min à frente, aceito imediatamente
apos aceite antecipado: {"status":"ACCEPTED","courierCancelFeeCents":300,"fulfillmentMode":"SCHEDULED"}
prestador segue disponivel: true
```

A taxa de cancelamento (`courier_cancel_fee_cents`) é **congelada no aceite**,
como manda o `DEC-20`. A cobrança em si continua fora deste pacote
(`COUR-02` / `PAY-01`).

O prestador **continua disponível** depois de aceitar um agendado cuja janela
ainda não começou — marcá-lo indisponível faria o aceite antecipado custar horas
de trabalho. Quem protege a janela é a regra de capacidade.

### 4.4 Execução só abre na janela

No smoke, com o agendado aceito e a janela 2 h à frente:

```
PATCH /deliveries/:id/status {"status":"AT_PICKUP"} -> HTTP 409
```

Admin e suporte passam (operação de exceção); o prestador não.

### 4.5 Capacidade do prestador (plano §5.1)

Cenário montado com o prestador reservado como **único disponível no banco**,
para que a recusa não pudesse ter outra explicação:

```
unico prestador aceitou agendado para daqui a 40 min; available=true
--- imediata colidindo (execucao estimada 45 min + folga 15 vs janela em 40 min) ---
criada em status: REQUESTED  (auto-dispatch nao achou ninguem)
dispatch manual -> HTTP 404: Nenhum entregador com agenda livre para esta janela
--- agendado distante (10 h à frente, nao colide) ---
foi ofertado ao mesmo prestador
```

Em um segundo cenário, com dois prestadores, o pedido imediato colidente foi
para **o outro** prestador, e não para o reservado — mesmo sendo o reservado o
mais próximo do ponto de coleta:

```
{"status":"OFFERED","courierId":"661be…","reservado":"faece…","foiParaOReservado":false}
ofertas do prestador reservado: []
```

### 4.6 Legado

O pedido `AQL-LEGADO-SCHED`, inserido direto no banco sem nenhum campo novo,
continua legível pela API e é lido como imediato:

```
{"code":"AQL-LEGADO-SCHED","status":"REQUESTED","fulfillmentMode":"IMMEDIATE",
 "pickupWindowStart":null,"kmRateCents":null,"notes":"ENCOMENDA | Tipo: Documento …"}
fora do filtro de agendados: true
```

O fallback de `notes` **não** foi tocado.

### 4.7 Filtro por modo

```
GET /deliveries?fulfillmentMode=SCHEDULED -> contém o pedido agendado
GET /deliveries?fulfillmentMode=IMMEDIATE -> não contém
GET /deliveries?fulfillmentMode=TALVEZ    -> HTTP 400: "fulfillmentMode invalido. Use: IMMEDIATE, SCHEDULED"
```

## 5. Comandos executados

| Comando | Resultado |
| --- | --- |
| `pnpm build` | ✅ PASS |
| `pnpm lint` | ✅ PASS (17 apontamentos de formatação corrigidos antes) |
| `pnpm test` | ✅ PASS — **17 suítes / 149 testes** (eram 14 / 96) |
| `pnpm smoke` | ✅ PASS — **3 execuções** contra o build final, com o cenário agendado |
| `migration:run` em `aqui_log_sched01` | ✅ PASS — 11 migrations |
| `migration:revert` + `migration:run` | ✅ PASS — com linha legada dentro da tabela |
| `flutter analyze` (cliente) | ✅ PASS — sem apontamentos |
| `flutter test` (cliente) | ✅ PASS — **15 testes** (eram 13) |
| `flutter analyze` (motoboy) | ✅ PASS — sem apontamentos |
| `flutter test` (motoboy) | ✅ PASS — **14 testes** (eram 11) |
| `dart analyze` (core) | ✅ PASS |
| `dart test` (core) | ✅ PASS — **14 testes** (eram 10) |
| APK e QA em emulador/dispositivo | ❌ **NÃO EXECUTADO** — segue em `UX-02` |
| QA de navegador do painel | ❌ **NÃO EXECUTADO** nesta rodada — a tela nova de settings foi validada por `tsc`/build e pela API, não por Chrome real |

Testes novos, por assunto:

- `scheduling.spec.ts` — 26 casos da regra pura (antecedência exata de 30 min,
  29 min recusado, janela invertida, curta, longa, horizonte de 30 dias, janela
  de entrega opcional, colisão com e sem folga);
- `scheduled.flow.spec.ts` — 17 casos de serviço (persistência, km por modo,
  recusas, aceite antecipado, disponibilidade, capacidade no despacho, portão
  da janela, legado);
- `delivery-scheduling.migration.spec.ts` — 3 casos (aditividade, índices, rollback);
- `delivery-package.dto.spec.ts` — 5 casos do contrato do modo;
- `settings-validation.spec.ts` — 2 casos dos limites novos.

## 6. Limitações desta rodada

1. **Sem QA visual.** Nem emulador (apps) nem Chrome real (painel). A seção
   "Modo agendado" do admin foi exercitada pela API, não pela tela.
2. **`COUR-01` não foi tocado.** Não existem as abas *Em andamento* / *Agenda*
   no app do prestador; o agendado aceito aparece na lista comum, com a janela e
   o aviso de que a coleta só abre no horário. O modelo compartilhado já expõe
   `scheduledAhead`, que é o critério de separação das duas listas.
3. **Cancelamento com taxa (`COUR-02`) continua fora.** A taxa é congelada no
   aceite, mas nada a debita — depende de `PAY-01`.
4. **A capacidade usa uma estimativa, não a rota real.** `immediateExecutionEstimateMinutes`
   é um número fixo (45 min), não o tempo estimado daquela corrida. Calibragem
   real depende de telemetria (`DISP-03`).
5. **A antecedência mínima está espelhada no app cliente** como constante
   (`kMinScheduleLeadMinutes = 30`), porque `/settings` é rota administrativa.
   O servidor continua sendo a autoridade; se o dono mudar o valor no painel, o
   app só erra para o lado de recusar antes.
6. **Troca de modo continua exigindo novo pedido** (plano §4.2): não há edição
   in-place, e nada foi implementado para isso.
