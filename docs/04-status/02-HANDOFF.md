# Handoff vigente

- **Data/hora:** 2026-08-09 (~19:30 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `COUR-01` — app do prestador com as seções *Em andamento* e
  *Agenda* (`DEC-21`, plano §5.2)
- **Branch/commit inicial:** `main` @ `531a432`

## Resultado

`COUR-01` está `DONE`. A aba *Corridas* do app do motoboy virou três abas, e a
separação usa **a janela de coleta**, não o modo do pedido.

- ***Em andamento*** — imediata aceita ou em execução, e agendada cuja janela
  **já abriu**.
- ***Agenda*** — `SCHEDULED` aceita com o início da janela ainda no futuro
  (o aceite antecipado do `DEC-20`), ordenada pelo próximo compromisso.
- ***Concluídas*** — `DELIVERED`/`CANCELED`.
- Cartão com código público, modo, janelas de coleta e entrega, os dois
  endereços, a encomenda (tipo, tamanho, peso e foto) e o repasse; tocar abre o
  `DeliveryDetailScreen` **existente**.
- A aba *Ofertas* (auto-dispatch) continua separada e intocada.

## Coisas que o próximo agente precisa saber

1. **O backend não mudou nesta rodada.** `GET /deliveries` já devolvia
   `fulfillmentMode`, as quatro colunas de janela, endereços, encomenda e
   `courierFeeCents` ao prestador desde `SCHED-01` — `present()` entrega a
   entidade inteira, menos o segredo do `PICK-01`. Não houve rota, DTO nem
   migration nova. O diff do backend é **um único arquivo `.spec.ts`**.
2. **Esse `.spec.ts` existe de propósito.** `courier-list.contract.spec.ts` trava
   o contrato de que as abas dependem. Se a listagem parar de mandar modo ou
   janela, a separação quebra **em silêncio** — o agendado de amanhã volta a
   parecer corrida de agora. Não apague o teste ao mexer em `findAll`/`present`.
3. **A regra de separação é pura e mora no core**, em
   `packages/aqui_log_core/lib/src/courier_board.dart`, e recebe o "agora" por
   parâmetro (`courierSectionOf(d, now:)` / `CourierBoard.from(list, now:)`).
   Mexa nela lá, não na tela. `DeliverySummary.isScheduledAheadAt(now)` foi
   acrescentado pelo mesmo motivo; `scheduledAhead` agora delega para ele.
4. **Só `ACCEPTED` pode estar na *Agenda*.** Se o status já andou, a corrida
   está acontecendo, mesmo com a janela no futuro — admin/suporte podem abrir a
   coleta antes da hora (`SCHED-01`). Inverter isso esconderia corrida em curso.
5. **A terceira aba não estava no plano §5.2, e é deliberada.** A lista antiga
   mostrava **todas** as corridas; com só duas seções, uma entrega concluída
   cairia em *Em andamento* ou sumiria. Se alguém decidir que o histórico não
   pertence a esta tela, é decisão de produto, não limpeza.
6. **Não existe botão de cancelar, de propósito.** É `COUR-02`, que depende de
   `PAY-01`. Um teste de widget verifica que a palavra "Cancelar" **não** aparece
   na tela — ele vai falhar quando `COUR-02` chegar, e é assim que deve ser:
   apague a asserção junto com a implementação do botão.
7. **A classificação roda no relógio do aparelho.** O servidor continua sendo a
   autoridade (`409` em `AT_PICKUP` fora da janela), então relógio adiantado move
   o cartão de aba, não libera a coleta.
8. **A lista do prestador não pagina.** `GET /deliveries` sem `page`/`limit`
   devolve o histórico inteiro; a aba *Concluídas* cresce sem limite. Não dói
   hoje, dói com volume.
9. **Para rodar a sonda de listagem de novo:** entregadores de rodadas
   anteriores continuam `ACTIVE` e `available` no banco descartável e roubam o
   auto-dispatch. Isole o prestador da vez
   (`UPDATE couriers SET available = false WHERE id <> '<id>'`) e lembre que
   aceitar uma **imediata** tira o prestador do mercado — é preciso religar a
   disponibilidade antes de aceitar os agendados.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 18 suítes / **153 testes** (eram 17 / 149) |
| `pnpm smoke` | PASS — contra a API viva em `PORT=3011` |
| Migrations em banco descartável (`aqui_log_cour01`) | PASS — 11 migrations (**nenhuma nova**) |
| Sonda `GET /deliveries` do prestador em HTTP vivo | PASS — 6 asserções; 2 agendados de mesmo modo e status separados só pela janela |
| `flutter analyze` / `flutter test` (motoboy) | PASS — **18 testes** (eram 14) |
| `flutter analyze` / `flutter test` (cliente) | PASS — 15 testes |
| `dart analyze` / `dart test` (core) | PASS — **23 testes** (eram 14) |
| Migration nova / rollback | **N/A** — nenhuma foi criada |
| QA de navegador do painel | **N/A** — painel não tocado |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** — segue em `UX-02` |

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md`.

## Próximo ID sugerido

`PAY-01` (ledger interno, `READY`) destrava `COUR-02`, que agora só espera por
ele. As alternativas na fila são `UX-02` (QA visual — exige
dispositivo/emulador) e `DISP-01` (reoferta por anéis). Escolher **um** ID,
conforme o backlog.
