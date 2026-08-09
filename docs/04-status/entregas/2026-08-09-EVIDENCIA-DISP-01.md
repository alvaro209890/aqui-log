# Evidência — `DISP-01` (reoferta resiliente por anéis de raio)

> **Data:** 2026-08-09
> **Agente:** Claude Code (Opus 5)
> **Ambiente:** desenvolvimento local no PC `acer`; nenhuma cloud tocada.
> **Banco:** descartável `aqui_log_disp01` no container `aqui-log-postgres` (porta 5433)
> **API viva:** `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`
> **Gates:** `DEC-03` (ampliar raio com limite; nunca aumento silencioso de preço) e `DEC-02` (valores provisórios editáveis) · plano de confiança e preço §6.1/§6.2
> **Commit inicial:** `d0761c2` (`main`)

## 1. O que foi entregue

O pedido sem aceite deixou de depender de sorte. Agora existe um **ciclo de
reoferta** explícito: rodadas numeradas, anéis de raio que crescem, exclusão de
quem já foi tentado, limite de rodadas e de tempo, e um **motivo de término**
gravado no pedido. Ao esgotar, o pedido continua `REQUESTED` — recuperável — e
nenhum job insiste mais.

| Peça | Onde |
| --- | --- |
| Regra pura dos anéis, rodadas, timebox e motivos | `apps/backend/src/deliveries/dispatch.ts` |
| Migration aditiva (4 colunas no pedido, 4 na oferta, 2 índices) | `apps/backend/src/database/migrations/1785600000000-DispatchRounds.ts` |
| Ciclo, lock e término no serviço | `apps/backend/src/deliveries/deliveries.service.ts` (`dispatch`, `endDispatchCycle`, `createOffer`, `rejectOffer`, `redispatchPendingRequested`) |
| Job que faz o raio crescer com o tempo | `apps/backend/src/deliveries/delivery-jobs.service.ts` |
| Lock por pedido (plano §6.2) | `apps/backend/src/deliveries/delivery-locks.ts` |
| 4 settings novos + validação | `apps/backend/src/settings/settings.module.ts` |
| Painel: seção "Reoferta por aneis" | `apps/dashboard/src/pages/SettingsPage.tsx` |
| Cenário DISP-01 no smoke | `scripts/smoke-test.sh` |

### 1.1 Como o ciclo funciona

1. **Rodada** = uma oferta que de fato existiu. **Anel** = a faixa de raio dessa
   rodada: `inicial + (rodada − 1) × incremento`. A rodada 3 usa o anel 3.
2. Cada rodada exclui **todo motoboy já tentado** neste pedido — recusa e
   expiração contam igual. Reofertar a quem recusou só queima o TTL de novo.
3. Se o anel da vez está vazio, o raio **amplia dentro da mesma chamada** até
   achar alguém ou acabar as rodadas. Anel vazio **não consome rodada**: o job
   roda a cada 10 s e queimaria 4 rodadas em 40 segundos com a cidade offline.
   Quem freia esse caso é a **duração total**.
4. O ciclo termina com motivo: `ACCEPTED`, `MAX_ROUNDS`, `TIMEBOX`,
   `NO_CANDIDATE` (tempo esgotado sem nunca ter havido candidato) ou `CANCELED`.
5. Terminado, o pedido **continua `REQUESTED`**. Encerrar a busca não é
   cancelar. O despacho manual do admin (`POST /deliveries/:id/dispatch`) reabre
   o ciclo do zero, e quem recusou continua excluído.

`DEC-03` é respeitada por construção: **nenhuma rodada toca no preço**. A
reoferta usa o snapshot congelado na criação (`DEC-19`). Rodada com valor maior,
mediante consentimento explícito do cliente, é `DISP-02` — e não foi implementada.

### 1.2 Valores provisórios escolhidos (padrão `DEC-02`, editáveis no admin)

| Chave | Valor | Origem |
| --- | --- | --- |
| `dispatchInitialRadiusKm` | **3 km** | provisório desta rodada |
| `dispatchRingIncrementKm` | **3 km** | provisório desta rodada |
| `dispatchMaxRounds` | **4** | `DEC-02` pede 3–5 |
| `dispatchTotalDurationMinutes` | **20** | `DEC-02` pede 15–30 |

Com isso o último anel chega a **12 km** na rodada 4. Validação nova de settings:
a duração total precisa ser **≥ o TTL de uma oferta**, senão o ciclo morreria
antes de a primeira oferta expirar e o limite de rodadas viraria enfeite.

### 1.3 Comportamento anterior que precisou mudar

Duas coisas foram encontradas no caminho, e ambas são consequência direta do
pacote — não refatoração oportunista:

1. **Oferta recusada de um pedido imediato ficava parada para sempre.**
   `expireStaleOffers` só olha oferta *pendente* e `dispatchDueScheduled` só
   olha pedido com `scheduled_at`. Ninguém redespachava um imediato recusado; só
   um admin, na mão. Agora a recusa dispara a rodada seguinte na hora, e o job
   `redispatchPendingRequested` mantém o ciclo andando (é ele que faz o raio
   crescer com o tempo).
2. **O agendado precisou de uma reabertura pontual.** Ele é ofertado na criação
   (`DEC-20`, aceite antecipado). Se ninguém aceitou, o ciclo termina — mas
   quando a janela abre, horas depois, a situação é outra. `shouldReopenForWindow`
   reabre **uma única vez** (a condição é auto-idempotente: depois do reinício
   `dispatch_started_at` passa a ser posterior ao início da janela). Sem isso,
   um agendado feito com um dia de antecedência morreria 20 minutos após criado.

Não foi tocado: preço, `notes`, código de recolhimento, capacidade do agendado,
apps Flutter.

## 2. Migration em banco vivo, com rollback ensaiado

```
$ psql -h localhost -p 5433 -U aqui_log -d postgres -c "CREATE DATABASE aqui_log_disp01;"
CREATE DATABASE

$ DATABASE_NAME=aqui_log_disp01 npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
… Migration DispatchRounds1785600000000 has been executed successfully.   (12 migrations)
```

Colunas criadas — **todas opcionais, nenhum `NOT NULL`, nenhum `DEFAULT`**:

```
deliveries:      dispatch_round (integer) | dispatch_started_at (timestamptz)
                 dispatch_ended_at (timestamptz) | dispatch_end_reason (varchar(16))
delivery_offers: dispatch_round (integer) | radius_km (numeric(6,2))
                 eligible_count (integer) | attempted_count (integer)
```

Índices: `UQ_delivery_offers_delivery_courier_round` (único **parcial**, sobre
`delivery_id, courier_id, dispatch_round` onde a rodada não é nula) e
`IDX_deliveries_dispatch_end_reason`.

### 2.1 A trava de idempotência provada no próprio banco (plano §6.2)

```
== duas ofertas LEGADAS (rodada NULL) para o mesmo par ==
INSERT 0 2                                   <- índice parcial não colide com o legado
== duplicata na MESMA rodada ==
INSERT 0 1
ERROR:  duplicate key value violates unique constraint "UQ_delivery_offers_delivery_courier_round"
DETAIL:  Key (delivery_id, courier_id, dispatch_round)=(bc4fa708…, 33333333…, 1) already exists.
== rodada diferente passa ==
INSERT 0 1
```

### 2.2 Rollback com dados dentro da tabela

Ensaiado com um pedido legado (`AQL-LEGADO-DISP`), um motoboy e 4 ofertas
inseridos direto no banco **antes** do revert:

```
Migration DispatchRounds1785600000000 has been reverted successfully.
== depois do revert ==  colunas_dispatch = 0 | indices = 0 | 11 migrations
                        AQL-LEGADO-DISP | REQUESTED | ENCOMENDA | Tipo: Documento
                        ofertas = 4 (2 pendentes)
Migration DispatchRounds1785600000000 has been executed successfully.
== reaplicada ==        12 migrations | AQL-LEGADO-DISP | REQUESTED | rodada vazia | motivo vazio
                        ofertas = 4, com rodada = 0
```

O pedido legado sobrevive ao ciclo, continua legível e é lido como "ciclo ainda
não começou" — ou seja, volta a ser despachado normalmente, do primeiro anel.

## 3. Comportamento provado em HTTP vivo

### 3.1 Dentro do `scripts/smoke-test.sh` (aborta se qualquer caso sair diferente)

O bloco DISP-01 roda 55 km ao norte do ponto base e **suspende os motoboys de
execuções anteriores** antes de começar: sem isso o resultado dependeria do
histórico do banco. Ele também fixa os quatro settings do cenário, o que o torna
idempotente mesmo depois de uma execução interrompida.

| Caso | Esperado | Resultado |
| --- | --- | --- |
| Rodada 1 vai ao motoboy em cima da coleta | `dispatchRound=1`, `radiusKm=3`, `eligibleCount=1`, `attemptedCount=1` | ✅ |
| Motoboy a 5 km **não** recebe na rodada 1 (fora do anel de 3 km) | 0 ofertas | ✅ |
| Despacho repetido com oferta pendente | `409` | ✅ |
| Após a recusa, o recusante **não** recebe de volta | 0 ofertas para ele | ✅ |
| Rodada 2 alcança o de 5 km | `dispatchRound=2`, `radiusKm=6`, `attemptedCount=2` | ✅ |
| Preço não muda entre rodadas (`DEC-03`) | `priceCents` idêntico, `dispatchEndReason=null` | ✅ |
| Com `dispatchMaxRounds=1`, a recusa esgota o ciclo | `REQUESTED` + `MAX_ROUNDS` + `dispatchEndedAt` | ✅ |
| Depois de esgotado, ninguém recebe por reoferta automática | 0 ofertas | ✅ |
| Despacho do admin reabre o ciclo | oferta rodada 1, raio 3, `dispatchEndReason=null` | ✅ |
| Duração total menor que o TTL da oferta | `400` na escrita de settings | ✅ |

Estado gravado no banco ao fim das execuções:

```
 dispatch_round | radius_km | eligible_count | attempted_count |  status
----------------+-----------+----------------+-----------------+----------
              1 |      3.00 |              1 |               2 | PENDING
              1 |      3.00 |              1 |               1 | REJECTED
              2 |      6.00 |              1 |               2 | PENDING
              1 |      3.00 |              1 |               1 | ACCEPTED
```

### 3.2 Duração total, fora do smoke (exige esperar o relógio)

Dois cenários rodados contra a API viva com `offerTtlSeconds=30` e
`dispatchTotalDurationMinutes=1` (settings restauradas ao fim).

**Sem candidato algum** — pedido no meio do nada, ninguém em nenhum anel:

```
criado:        {"status":"REQUESTED","dispatchRound":null,"dispatchEndReason":null}
apos 15s:      {"status":"REQUESTED","dispatchRound":null,"dispatchStartedAt":"…T22:49:04.565Z"}
apos 70s:      {"status":"REQUESTED","dispatchRound":null,"dispatchEndReason":"NO_CANDIDATE",
                "dispatchEndedAt":"…T22:50:10.016Z"}
histórico:     Pedido solicitado (dist 1.562km)
               Reoferta encerrada: nenhum entregador elegivel no periodo (rodadas usadas: 0)
```

Repare: **nenhuma rodada foi consumida** em ~60 s de tentativas a cada 10 s, e o
ciclo parou pelo tempo — não por rodada. É a diferença entre `NO_CANDIDATE` e
`TIMEBOX`.

**Com uma oferta que expirou** — um motoboy elegível, que não responde:

```
logo apos criar:  {"status":"OFFERED","dispatchRound":1}
apos 45s:         {"status":"REQUESTED","dispatchRound":1,"dispatchEndReason":null}
apos 75s:         {"status":"REQUESTED","dispatchRound":1,"dispatchEndReason":"TIMEBOX",
                   "dispatchEndedAt":"…T22:51:40.044Z"}
histórico:        Pedido solicitado (dist 1.564km)
                  Reoferta rodada 1 (raio 3 km, 1 elegiveis)
                  Oferta expirada; reabrindo despacho
                  Reoferta encerrada: duracao total da reoferta esgotada (rodadas usadas: 1)
```

Nos dois casos o pedido termina **`REQUESTED`**, sem loop infinito, com motivo
legível no próprio pedido e no histórico.

## 4. Comandos executados

| Comando | Resultado |
| --- | --- |
| `pnpm build` | ✅ PASS |
| `pnpm lint` | ✅ PASS (8 apontamentos de formatação corrigidos antes) |
| `pnpm test` | ✅ PASS — **21 suítes / 197 testes** (eram 18 / 153) |
| `pnpm smoke` | ✅ PASS — **3 execuções** contra o build final, com o cenário DISP-01 |
| `migration:run` em `aqui_log_disp01` | ✅ PASS — 12 migrations |
| `migration:revert` + `migration:run` | ✅ PASS — com pedido, motoboy e 4 ofertas legadas dentro |
| Duplicata de rodada em SQL direto | ✅ recusada pelo índice único parcial |
| Cenário de duração total (2×, relógio real) | ✅ `NO_CANDIDATE` e `TIMEBOX` |
| `dart analyze` / `dart test` (core) | ✅ PASS — 23 testes |
| `flutter analyze` / `flutter test` (motoboy) | ✅ PASS — 18 testes |
| `flutter analyze` / `flutter test` (cliente) | ✅ PASS — 15 testes |
| APK e QA em emulador/dispositivo | ❌ **NÃO EXECUTADO** — segue em `UX-02` |
| QA de navegador do painel | ❌ **NÃO EXECUTADO** — a seção nova de settings foi validada por `tsc`/build e pela API, não por Chrome real |

Testes novos, por assunto:

- `dispatch.spec.ts` — 21 casos da regra pura (raio por anel, incremento zero,
  mais próximo dentro do anel, borda exata, ampliação na mesma chamada, rodada
  seguinte no anel seguinte, limite de rodadas, timebox no minuto exato,
  `NO_CANDIDATE` × `TIMEBOX`, reabertura idempotente da janela);
- `dispatch.flow.spec.ts` — 16 casos de serviço (registro da rodada na oferta,
  exclusão de recusa e de expiração, ampliação, esgotar rodadas, esgotar tempo,
  ciclo encerrado ignorado pelos jobs, reabertura pelo admin, lock, despacho
  repetido, aceite e cancelamento fechando o ciclo, preço intocado);
- `dispatch-rounds.migration.spec.ts` — 3 casos (aditividade, índice único
  parcial, rollback);
- `settings-validation.spec.ts` — 3 casos novos (duração < TTL recusada,
  duração = TTL aceita, anéis maiores aceitos).

## 5. Limitações desta rodada

1. **`DISP-02` não foi implementado.** O cliente **não é notificado** quando a
   busca termina, e não existe botão de "tentar de novo / editar / cancelar" nos
   apps. O que existe é o estado explícito (`dispatchEndReason`) e a reabertura
   pelo admin. É exatamente o que `DISP-02` vai consumir.
2. **`DISP-03` não foi implementado.** Não há relatório nem métrica agregada. O
   que ficou pronto é a matéria-prima por rodada (raio, elegíveis, tentados,
   status da oferta) e por pedido (rodadas, início, fim, motivo).
3. **Rodada sem candidato não vira linha em lugar nenhum.** Ela não cria oferta
   e, para não inundar `delivery_events` a cada 10 s, também não gera evento —
   só o término gera. Contar "quantas varreduras vazias houve" exige a tabela
   própria de telemetria, que é `DISP-03`.
4. **O motivo por rodada mora no status da oferta**, não numa coluna própria:
   `REJECTED` é recusa, `EXPIRED` é expiração. `dispatch_end_reason` responde
   outra pergunta — por que o sistema parou de tentar.
5. **Sem QA visual.** Nem emulador (apps) nem Chrome real (painel). A seção
   "Reoferta por aneis" foi exercitada por API e build, não pela tela.
6. **O raio é distância em linha reta** (mesma `distanceInKm` do preço), não
   rota real. Calibrar isso depende da telemetria de `DISP-03`.
7. **O bloco DISP-01 do smoke suspende os motoboys de execuções anteriores** do
   banco descartável. É intencional (isola o cenário) e inofensivo ali, mas é
   mais uma razão para nunca apontar o smoke para um banco que importe.
