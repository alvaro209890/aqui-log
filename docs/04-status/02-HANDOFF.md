# Handoff vigente

- **Data/hora:** 2026-08-10 (atualizado pelo Hermes após interrupção do PAY-01)
- **Agente:** OpenCode (iniciou `PAY-01`) → Hermes (verificou, corrigiu bugs de
  caminho e documentou o estado)
- **Tarefa:** `PAY-01` — ledger interno (cliente + prestador) sem gateway
  (`DEC-05`, plano `PLANO_PAGAMENTOS.md` §5) — **INTERROMPIDA pelo dono antes
  de concluir**
- **Branch/commit inicial:** `main` @ `eb211d4` (auditoria pós-DISP-02)
- **Estado:** código do ledger implementado no working tree (entidades,
  migration, FinanceService, controller, integração deliveries, smoke), mas
  **NÃO commitado/pushado** — este handoff documenta o estado como está.

## Resultado parcial

Ver `docs/04-status/entregas/2026-08-10-ESTADO-PAY-01-INTERROMPIDO.md` — o
documento completo de estado com as 10 correções feitas no caminho e o que
falta. Resumo:

- Ledger implementado (3 entidades + migration `LedgerInternal` + regras puras
  + FinanceService: reserve/release/settle/adjust/statement/summary +
  controller com autorização por papel + 402 `PaymentRequired`).
- Migration aplicada no banco local (o OpenCode não tinha aplicado — smoke
  quebrava com `relation "financial_accounts" does not exist`).
- `pnpm build` ✅, `pnpm lint` ✅, `pnpm --filter backend test` ✅ (25 suítes /
  219 testes).
- `pnpm smoke` ⚠️ **não fecha**: falha na última asserção
  (`GET /finance/summary` → `courierObligationCents == $fee`) porque o banco
  local acumula execuções anteriores do smoke — a asserção assume banco limpo.
  Não corrigido (dono mandou parar).

## Coisas que o próximo agente precisa saber

1. **Migration `LedgerInternal` já aplicada no banco local** `aqui_log` — não
   rodar `migration:run` às cegas.
2. **O smoke não é idempotente em banco sujo**: a asserção final do summary
   compara o total do ledger com o repasse de UMA entrega; com dados de
   execuções anteriores acumulados, o total é maior. Corrigir comparando o
   delta do courier da execução atual (antes vs depois) ou zerando o banco.
3. **10 correções já feitas** (listadas no doc de estado) — não refazer; em
   particular: `jq --arg` na idempotência do ajuste, `jq -r` nas consultas de
   oferta, agregação por transação no `statement()`, `entry.amount_cents` no
   SQL, `:available` no `summary()`, 403 para carteira alheia, retry que não
   propaga 404, courier2 devolvido para longe antes do bloco DISP-02.
4. **`PAY-01` NÃO está DONE** — o backlog deve continuar marcando como
   `READY`/`IN_PROGRESS` até o smoke fechar e as evidências serem escritas.

## Não feito e bloqueios

- Asserção final do smoke (summary) não corrigida — dono mandou parar.
- `flutter analyze`/`flutter test`/`dart analyze`/`dart test` não executados
  (nenhum arquivo Dart tocado).
- Evidência formal `EVIDENCIA-PAY-01.md` e atualização de BACKLOG/ROADMAP/
  MVP_COVERAGE pendentes — só quando a tarefa estiver DONE de verdade.
- `PAY-DEC-02` (cancelamento do cliente após aceite/coleta) segue pendente —
  não inventar política.

## Próximo passo recomendado

1. Fechar o `PAY-01`: corrigir a asserção do summary no smoke, rodar o smoke
   3×, completar o checklist (Flutter/Dart), escrever a evidência e atualizar
   os docs. Depois disso, `COUR-02` destrava; alternativas `UX-02` e
   `OPS-01A`.

## Mensagem de retomada

> PAY-01 (ledger) está com o código implementado e os testes de backend verdes,
> mas o smoke não fecha na asserção do summary (banco acumula execuções
> anteriores). Estado completo e as 10 correções de caminho em
> `docs/04-status/entregas/2026-08-10-ESTADO-PAY-01-INTERROMPIDO.md`.
