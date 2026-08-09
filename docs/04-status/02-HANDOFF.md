# Handoff vigente

- **Data/hora:** 2026-08-09 (~20:00 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `DISP-01` — reoferta resiliente por anéis de raio, exclusão de
  recusas e limite de rodadas (`DEC-03`, plano de confiança e preço §6.1/§6.2)
- **Branch/commit inicial:** `main` @ `d0761c2`

## Resultado

`DISP-01` está `DONE`. O pedido sem aceite passou a ter um **ciclo de reoferta**
com começo, meio e fim registrados.

- **Rodada** = uma oferta que existiu; **anel** = o raio dessa rodada
  (`inicial + (rodada − 1) × incremento`). Rodada 3 usa o anel 3.
- Cada rodada **exclui todo motoboy já tentado** neste pedido — recusa e
  expiração contam igual.
- Anel vazio **não consome rodada**; quem freia esse caso é a **duração total**.
- Fim do ciclo com motivo no pedido: `ACCEPTED`, `MAX_ROUNDS`, `TIMEBOX`,
  `NO_CANDIDATE` ou `CANCELED`. O pedido **continua `REQUESTED`** — encerrar a
  busca não é cancelar.
- Cada oferta guarda rodada, raio, elegíveis e tentados (matéria-prima do
  `DISP-03`).
- Valores provisórios, editáveis no painel: **3 km inicial, +3 km por anel,
  4 rodadas, 20 min** (último anel = 12 km).

## Coisas que o próximo agente precisa saber

1. **Nenhuma rodada toca no preço (`DEC-03`/`DEC-19`).** A reoferta usa o
   snapshot congelado na criação. A rodada com valor maior, mediante
   consentimento explícito do cliente, é `DISP-02` e **não existe**.
2. **A regra dos anéis é pura** e mora em
   `apps/backend/src/deliveries/dispatch.ts`, recebendo o "agora" por parâmetro.
   Mexa nela lá, não no serviço.
3. **Duas correções de comportamento entraram junto, e não são refatoração
   solta:** (a) oferta recusada de pedido **imediato** ficava parada para sempre
   — nenhum job olhava para ela; agora a recusa dispara a rodada seguinte e o job
   `redispatchPendingRequested` mantém o ciclo andando (é ele que faz o raio
   crescer com o tempo); (b) o **agendado** reabre o ciclo **uma vez** quando a
   janela chega (`shouldReopenForWindow`, auto-idempotente), senão um agendado
   feito com um dia de antecedência morreria 20 min após criado.
4. **`POST /deliveries/:id/dispatch` (admin) agora REABRE o ciclo** mesmo
   esgotado — é a ação de recuperação do plano §6.1.5. Quem recusou continua
   excluído. Se `DISP-02` criar um "tentar de novo" para o cliente, é este
   caminho que ele deve usar (`dispatch(id, actorId, { reopen: true })`).
5. **A idempotência tem duas camadas:** o lock por pedido
   (`dispatchLockKey`) e o índice único **parcial**
   `UQ_delivery_offers_delivery_courier_round`. O índice é parcial porque as
   ofertas anteriores ao pacote têm rodada nula e não podem colidir entre si.
6. **`dispatch_end_reason` responde "por que o sistema parou de tentar"**, não
   "o que houve na rodada". O desfecho de cada rodada é o **status da própria
   oferta** (`REJECTED`/`EXPIRED`). Não misture os dois ao construir o `DISP-03`.
7. **Rodada sem candidato não vira linha em lugar nenhum** — não cria oferta e
   não gera evento (o job roda a cada 10 s e inundaria `delivery_events`).
   Contar varredura vazia exige a tabela de telemetria do `DISP-03`.
8. **Para reproduzir o cenário de tempo** é preciso esperar o relógio: baixe
   `offerTtlSeconds` para 30 e `dispatchTotalDurationMinutes` para 1, e lembre
   de restaurar (as settings vivem no Redis e **sobrevivem entre execuções** —
   foi assim que uma execução interrompida do smoke deixou `dispatchMaxRounds=1`
   para trás e quebrou a seguinte; por isso o bloco DISP-01 do smoke agora fixa
   os quatro valores antes de começar).
9. **O bloco DISP-01 do smoke suspende os motoboys de execuções anteriores.**
   Sem isso a rodada 2 cairia em qualquer motoboy residual a poucos metros. É
   mais um motivo para nunca apontar o smoke para banco que importe.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 21 suítes / **197 testes** (eram 18 / 153) |
| `pnpm smoke` | PASS — **3 execuções** contra a API viva em `PORT=3011`, com o cenário DISP-01 |
| Migrations em banco descartável (`aqui_log_disp01`) | PASS — **12 migrations** |
| `migration:revert` + `migration:run` | PASS — com pedido, motoboy e 4 ofertas legadas dentro da tabela |
| Índice único parcial (duplicata de rodada em SQL direto) | PASS — recusada pelo banco |
| Duração total em HTTP vivo (relógio real, 2 cenários) | PASS — `NO_CANDIDATE` e `TIMEBOX` |
| `flutter analyze` / `flutter test` (motoboy / cliente) | PASS — 18 e 15 testes |
| `dart analyze` / `dart test` (core) | PASS — 23 testes |
| QA de navegador do painel | **NÃO EXECUTADO** — a seção "Reoferta por aneis" foi validada por build e API |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** — segue em `UX-02` |

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-DISP-01.md`.

## Próximo ID sugerido

`DISP-02` — avisar o cliente quando a busca termina e oferecer ação explícita
(tentar de novo, editar, cancelar) e, com consentimento, a rodada com valor
maior do `DEC-03`. Ele agora depende só de `DISP-01`, e a estrutura de que
precisa já existe: `dispatchEndReason` no pedido e a reabertura por
`dispatch(..., { reopen: true })`. As alternativas na fila são `PAY-01`
(ledger, destrava `COUR-02`) e `UX-02` (QA visual — exige dispositivo/emulador).
Escolher **um** ID, conforme o backlog.
