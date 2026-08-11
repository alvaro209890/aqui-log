# Estado PAY-01 — Ledger interno (em andamento, interrompido pelo dono)

> **Data:** 2026-08-10
> **Ambiente:** PC `acer`; banco local `aqui_log` (Postgres 5433, container
> `aqui-log-postgres`) + Redis 6379; API viva em `PORT=3011`.
> **Contexto:** `PAY-01` foi iniciado pelo OpenCode (sessão "DISP-02: aviso de
> busca esgotada", prompt de continuação) e **interrompido pelo Álvaro** antes
> de concluir. O Hermes finalizou a verificação, corrigiu bugs encontrados no
> caminho e documentou o estado — **sem declarar a tarefa DONE**.
> **Base do trabalho:** `eb211d4` (docs auditoria pós-DISP-02) no `main`.

## 1. O que já está implementado (código presente no working tree)

### Ledger interno (plano §2, §3 e §5 de `PLANO_PAGAMENTOS.md`)

- **Entidades novas** (`apps/backend/src/database/entities/`):
  - `financial-account.entity.ts` — conta (owner_type, owner_id, purpose,
    currency, status), índice único por (owner, purpose).
  - `ledger-transaction.entity.ts` — transação (type, reference, idempotency_key
    único, status, metadata).
  - `ledger-entry.entity.ts` — lançamento (transaction_id, account_id,
    direction, amount_cents > 0), índice único por (transaction, account).
- **Migration** `1785800000000-LedgerInternal.ts` — cria as 3 tabelas + enums
  (`ledger_owner_type_enum`, `ledger_account_purpose_enum`,
  `ledger_transaction_type_enum`, `ledger_transaction_status_enum`,
  `ledger_entry_direction_enum`) + índices + CHECK de amount positivo.
  **Aplicada no banco local** (migration:run executado pelo Hermes — o OpenCode
  tinha criado a migration mas não aplicado, e o smoke quebrava com
  `relation "financial_accounts" does not exist`).
- **Regras puras** (`apps/backend/src/finance/ledger-rules.ts` + spec):
  - `buildReservationPostings`, `buildSettlementPostings` (partidas balanceadas);
  - `reservationKey` / `releaseKey` / `settlementKey` / `adjustmentKey`
    (idempotência determinística por operação de domínio);
  - `describeTransaction` (rótulos do extrato em pt-BR);
  - `nextReservationStatus` (máquina RESERVED → SETTLED/RELEASED).
- **FinanceService** (`finance.service.ts`, ~660 linhas novas):
  - `account()` (get-or-create com `orIgnore`), `lockAccounts()` (lock em ordem
    estável), `balanceOf()` (saldo reconstruído do ledger);
  - `applyTransaction()` — grava transação + lançamentos em transação de banco;
  - `reserve()` — reserva atômica ao confirmar pedido (402 `PaymentRequired`
    se saldo insuficiente); idempotente por `reserve:delivery:<id>`;
  - `release()` — liberação em cancelamento/expiração; idempotente;
  - `settle()` — liquidação em `DELIVERED`: reserva vira receita da plataforma
    (preço − repasse) + obrigação contábil com o motoboy (repasse), sem payout;
  - `adjust()` — ajuste administrativo auditado (só admin), motivo obrigatório
    ≥ 5 chars, débito > saldo → 409, idempotência por chave;
  - `statement()` — extrato: saldo disponível/reservado + **uma entrada por
    transação** com o efeito no disponível (corrigido pelo Hermes — antes
    listava cada perna separada e o smoke esperava agregação);
  - `summary()` — resumo admin (obrigação com motoboys, receita retida);
  - `resolveOwner()` — cliente/motoboy enxergam só a própria carteira.
- **FinanceController**:
  - `GET /finance/statement` — participante vê a própria; admin consulta
    qualquer uma por `ownerType`/`ownerId`; **participante tentando ver carteira
    alheia → 403** (corrigido pelo Hermes — antes devolvia a própria com 200).
  - `POST /finance/accounts/:ownerType/:ownerId/adjust` — só admin.
  - `GET /finance/summary` — só admin.
- **PaymentRequiredException** (`common/payment-required.exception.ts`) — 402
  com mensagem "Saldo insuficiente..." em pt-BR.
- **Integração deliveries**: `create()` reserva o preço na MESMA transação do
  save (produto pré-pago); `PATCH :id/status` libera/liquida conforme o estado
  (CANCELED → release, DELIVERED → settle) — `deliveries.service.ts` +112.
- **Registros**: `app.module.ts` e `data-source.ts` incluem as 3 entidades novas.

### Smoke test (scripts/smoke-test.sh, +138 linhas)

- Bloco PAY-01 completo: crédito de teste, 402 sem saldo, validações do ajuste
  (400 motivo curto / zero, 409 débito > saldo, 403 papel errado), idempotência
  do ajuste, reserva, liberação no cancelamento, corrida de concorrência (uma
  200/201 + uma 402), autorização de extrato (403 alheio), liquidação e
  obrigação do motoboy, resumo admin.

## 2. Correções feitas pelo Hermes nesta rodada (bugs reais encontrados)

| # | Onde | Bug | Correção |
| --- | --- | --- | --- |
| 1 | `smoke-test.sh` (ajuste idempotente) | `jq -nc '{...idempotencyKey:"smoke-$RUN_ID"}'` com aspas simples NÃO expandia `$RUN_ID` — chave literal fixa entre execuções; a idempotência retornava a transação de OUTRA rodada e o cliente novo ficava com saldo 0 | `--arg key "smoke-$RUN_ID"` |
| 2 | `smoke-test.sh` (corrida de reserva) | esperava `200` mas `POST /deliveries` devolve `201 Created` (padrão Nest) | aceitar 200 **ou** 201 |
| 3 | `smoke-test.sh` (7 consultas de oferta) | `jq -er '... // empty'` com array vazio sai com exit 4 e `set -euo pipefail` mata o smoke sem mensagem | `jq -r` (sem `-e`) |
| 4 | `finance.service.ts` `statement()` | listava cada perna do ledger como entrada separada (reserva virava 2 linhas) — extrato ilegível e smoke quebrava | agrupar por transação, somando o efeito no saldo **disponível** |
| 5 | `finance.service.ts` `statement()` / `summary()` | SQL cru usava `entry.amountCents` (camelCase) — `column entry.amountcents does not exist` | `entry.amount_cents` no SQL |
| 6 | `finance.service.ts` `summary()` | placeholder `:available` sem parâmetro — `syntax error at or near ":"` | adicionar `available` aos parâmetros |
| 7 | `deliveries.service.ts` `retry()` | propagava o 404 do `dispatch` quando não havia candidato no momento — o comentário do código diz que deveria devolver o pedido reaberto (o job segue tentando) | capturar `NotFoundException` do reopen e devolver o pedido |
| 8 | `finance.controller.ts` `statement()` | participante que passava `ownerType`/`ownerId` alheio recebia a própria carteira (200) em vez de 403 | `ForbiddenException` se os params não forem do próprio dono |
| 9 | `smoke-test.sh` (bloco DISP-02) | o courier2 era movido para perto no fim do DISP-01 e roubava as ofertas dos pedidos novos do DISP-02 (que esperam cair no courier principal) | devolver courier2 para 5 km antes do bloco DISP-02 |
| 10 | `smoke-test.sh` (liberação) | asserção esperava `entries[1]` mas a RELEASE é a entrada mais recente (`entries[0]` na ordem DESC) | `entries[0]` |

## 3. O que foi validado

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm build` (backend) | ✅ PASS | Hermes |
| `pnpm --filter backend lint` | ✅ PASS | Hermes |
| `pnpm --filter backend test` | ✅ PASS — 25 suítes / **219 testes** | inclui `ledger-rules.spec` e `ledger.migration.spec` novos |
| Migration `LedgerInternal` em banco local | ✅ PASS | `migration:run` aplicou; tabelas + enums + índices criados |
| `pnpm smoke` (PORT=3011) | ⚠️ **FALHA na última asserção** | chegou até o bloco PAY-01 inteiro; falha em `GET /finance/summary` → `courierObligationCents == $fee` — o summary soma o ledger de TODAS as execuções acumuladas no banco (couriers residuais de rodadas anteriores do smoke), e a asserção assume banco limpo. **Não corrigido** (dono mandou parar). |
| `flutter analyze` / `flutter test` | não executado | nenhum arquivo Dart/Flutter tocado nesta rodada |
| QA de navegador / APK | não executado | fora de escopo (UX-02) |

## 4. O que falta para o PAY-01 fechar (não feito — dono mandou parar)

1. Corrigir a asserção final do smoke (`courierObligationCents`): comparar o
   delta do courier da execução atual (saldo antes vs depois do fluxo principal)
   em vez do total do banco, ou zerar o banco descartável antes do smoke.
2. Rodar `pnpm smoke` 3× consecutivas até verde.
3. Rodar `flutter analyze`/`flutter test` nos apps e `dart analyze`/`dart test`
   no core (nada foi tocado, mas o checklist do AGENTS.md pede a execução).
4. Escrever a evidência formal `docs/04-status/entregas/2026-08-10-EVIDENCIA-PAY-01.md`
   com o cenário completo (este documento é o estado preliminar).
5. Atualizar `01-ESTADO-ATUAL.md`, `02-BACKLOG.md` (PAY-01 DONE), `01-ROADMAP.md`,
   `02-HANDOFF.md`, changelog e `MVP_COVERAGE` (append-only) — **somente quando
   a tarefa estiver realmente DONE com evidência** (regra §3.5 do AGENTS.md).
6. Decisão pendente `PAY-DEC-02` (política de cancelamento do cliente após
   aceite/coleta) — não implementada de propósito; sem inventar.

## 5. Commits desta sessão

- **`(a criar)`** — este documento + código do PAY-01 em andamento, com as
  correções acima. Commit único `feat(PAY-01)` parcial + `docs:` de estado,
  conforme autorização do dono ("documente como está e mande ao main").

## 6. Riscos / observações

- O banco local acumula dados de execuções anteriores do smoke (couriers,
  entregas, lançamentos). Para rodadas limpas, usar banco descartável
  (`aqui_log_pay01` etc.) como nas evidências anteriores, ou zerar antes.
- A migration `LedgerInternal` **já foi aplicada** no banco local `aqui_log` —
  não rodar `migration:run` de novo às cegas (TypeORM controla por tabela
  `migrations`).
- `PAY-01` **não está DONE**: o smoke não fecha e faltam evidências/checklist.
  O backlog deve continuar marcando `PAY-01` como `READY`/`IN_PROGRESS` até a
  conclusão real.
