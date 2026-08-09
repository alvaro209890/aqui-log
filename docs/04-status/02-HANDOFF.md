# Handoff vigente

- **Data/hora:** 2026-08-09 (~17:00 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `SCHED-01` + `B2C-06` — modo agendado individual com aceite antecipado
  (`DEC-18`, `DEC-19`, `DEC-20`, `FLOW-DEC-02`)
- **Branch/commit inicial:** `main` @ `5d0ecd7`

## Resultado

`SCHED-01` e `B2C-06` estão `DONE` — um único esforço, como o backlog previa.

- Todo pedido novo **declara** `fulfillmentMode`; o campo é **obrigatório** e não
  tem default no contrato de criação.
- `SCHEDULED` exige janela de coleta com **30 minutos** de antecedência
  (`FLOW-DEC-02`), fim depois do início, duração entre 15 min e o máximo
  configurado (480), e horizonte de até 30 dias. Janela de entrega é opcional,
  mas se vier, vem inteira.
- O km do modo é aplicado **e congelado** no pedido (`km_rate_cents` + o
  `pricing_breakdown` que já existia): 250 no imediato × **180** no agendado.
- **Aceite antecipado (`DEC-20`):** o agendado entra na fila de ofertas na
  criação; o aceite congela `courier_cancel_fee_cents` e **não** tira o
  prestador do mercado.
- **Reserva de agenda (plano §5.1):** quem tem agendado aceito não recebe oferta
  cuja execução colida com a janela, com folga configurável.
- `ACCEPTED → AT_PICKUP` antes do início da janela devolve `409`; admin e
  suporte passam.
- Pedido legado sem modo continua legível e vale como `IMMEDIATE`.

## Coisas que o próximo agente precisa saber

1. **`fulfillment_mode` já existia desde `B2C-02A`** (coluna com
   `NOT NULL DEFAULT 'IMMEDIATE'`), e `pricing.calc.ts` já sabia escolher a
   tarifa por modo. Esta rodada não criou a coluna — criou **quem a preenche**.
2. **Tornar o modo obrigatório é uma quebra de contrato para app antigo.** Um
   APK que não mande `fulfillmentMode` recebe `400` ao criar pedido. Não há APK
   publicado, e os dois apps do repositório foram atualizados junto. Se algum
   dia isso doer, o conserto é um default explícito no DTO — mas o plano §3.1 e
   §12 pedem o campo obrigatório, então não faça isso sem nova decisão.
3. **O aceite antecipado NÃO marca o prestador como indisponível.** É
   intencional: a janela é lá na frente. Quem protege a janela é
   `filterByCapacity` no `dispatch()`. Se alguma mudança futura voltar a marcar
   `available = false` no aceite, o `DEC-20` passa a custar horas de trabalho ao
   motoboy — e o teste `não tira o prestador do mercado antes da janela` quebra.
4. **Toda a regra de janela e colisão é pura**, em
   `apps/backend/src/deliveries/scheduling.ts`, e recebe o "agora" por
   parâmetro. Mexa nela lá, não espalhada pelo service.
5. **Quatro settings novos**, todos no admin: `minScheduleLeadMinutes` (30,
   `FLOW-DEC-02`), `scheduleMaxWindowMinutes` (480), `scheduleCapacitySlackMinutes`
   (15) e `immediateExecutionEstimateMinutes` (45). Os três últimos são
   **provisórios** desta rodada. Janela mínima de 15 min e horizonte de 30 dias
   são **constantes de código**, de propósito (limite de sanidade, não política).
6. **`COUR-01` é o próximo pacote esperado** e já está `READY`. O modelo
   compartilhado (`DeliverySummary`) expõe `scheduledAhead`, que é exatamente o
   critério que separa *Agenda* de *Em andamento*.
7. **Achado pré-existente, não corrigido:** a resposta de `POST /deliveries`
   mostra `status: "REQUESTED"` mesmo quando o auto-dispatch já ofertou — o
   `create()` apresenta uma instância que ficou velha depois do `dispatch()`. O
   smoke convive com isso pelo fallback de despacho manual. Corrigir é mudança
   de comportamento e merece pacote próprio.
8. **`ADMIN_PASSWORD` do `.env` local não é o default do smoke**; scripts de
   sessão que logam como admin precisam ler o `.env`.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 17 suítes / **149 testes** (eram 96) |
| `pnpm smoke` | PASS — 3 execuções contra o build final, com o cenário agendado |
| Migration em banco descartável (`aqui_log_sched01`) | PASS — 11 migrations |
| Rollback + reaplicação da migration nova | PASS — com linha legada dentro da tabela |
| Recusas de janela (passado, <30 min, invertida, imediato com janela) | PASS — `400` em HTTP vivo |
| Tarifa dual congelada (`DEC-19`) | PASS — 250 × 180 na mesma rota; settings alteradas não mexem no pedido |
| Aceite antecipado (`DEC-20`) | PASS — taxa congelada; prestador segue disponível |
| `AT_PICKUP` antes da janela | PASS — `409` |
| Capacidade (plano §5.1) | PASS — `404` com o reservado sozinho; com dois, foi para o outro |
| Pedido legado sem modo | PASS — legível como `IMMEDIATE` |
| `flutter analyze` / `flutter test` (cliente 15, motoboy 14) | PASS |
| `dart analyze` / `dart test` (core, 14) | PASS |
| QA de navegador do painel | **NÃO EXECUTADO** |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** |

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md`.
