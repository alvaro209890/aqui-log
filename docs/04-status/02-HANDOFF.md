# Handoff vigente

- **Data/hora:** 2026-08-22
- **Agente:** Cursor Grok 4.6 (acer)
- **Tarefa:** `QA-02` — Playwright no painel admin, documentar e push no `main`
- **Branch/commit:** `main` (este commit)
- **Escopo autorizado:** uma tarefa da onda 1; commit+push no `main`

## Resultado

`QA-02` fechado. `pnpm qa:dashboard` (run 1787401039): 3 testes Playwright
verdes com API viva (36,7 s); o mesmo spec **falha** com a API morta (login
não entra). Portão: build/lint ok; `pnpm test` 32 suítes / 258 testes; smoke
público `AQL-MT4CJY6TX7P`. Flutter não rodou neste ambiente (EUID root).

## Alterações

- `apps/dashboard/e2e/*`, `playwright.config.ts` — spec alinhado ao DOM real
- `scripts/qa-dashboard.sh` — seed PENDING + DELIVERED + CANCELED; prova API morta
- `package.json` — script `qa:dashboard`
- prints em `docs/04-status/entregas/qa-02-*.png`

## Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm qa:dashboard` | PASS | live 0 / dead 1 |
| `pnpm build` / `lint` / `test` | PASS | 32/258 |
| smoke público | PASS | `AQL-MT4CJY6TX7P` |
| flutter analyze/test | NÃO EXECUTADO | sandbox root; QA-02 não tocou Dart |

## Não feito e bloqueios

- `QA-03` ainda aberto
- **`FROTA-01` / `FROTA-02` / `ADMIN-04`:** não tocar — Claude e Hermes estão na frota
- Recarga Pagar.me, Firebase, Render/Vercel, iOS compile — runbook do Álvaro

## Riscos conhecidos

- Smoke desta sessão criou pedidos no banco do runtime público (`cursar.space`)
- Busca da TopBar continua decorativa (`ADMIN-01`)

## Próximo passo recomendado

1. `[QA-03]` — `scripts/migration-roundtrip.sh`, `pnpm qa`, job Playwright no CI
2. Depois: `ADMIN-01` (não `FROTA-*`)

## Mensagem de retomada

> `QA-02` está no `main`. Pegue `QA-03`. Não mexa em frota.
