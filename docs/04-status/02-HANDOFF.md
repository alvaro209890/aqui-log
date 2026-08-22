# Handoff vigente

- **Data/hora:** 2026-08-22
- **Agente:** Cursor Grok 4.6 (acer)
- **Tarefa:** `QA-03` — ligar o aparato no portão, documentar e push no `main`
- **Branch/commit:** `main` (este commit)
- **Escopo autorizado:** uma tarefa da onda 1; commit+push no `main`

## Resultado

`QA-03` fechado. `QA_SKIP_MOBILE=1 pnpm qa`: roundtrip
`legado.roundtrip.1787410149@aquilog.test` + Playwright 3 passed / 39,2 s
(API morta reprova). Portão: build/lint ok; `pnpm test` 32 suítes / 258 testes;
smoke público `AQL-MT4IY2U8LII`. Hex plantado em `theme.ts` falha; checkout
passa. Emulador nesta sessão: QEMU hang — não fingido. CI: job `dashboard-e2e`,
sem emulador no runner.

## Alterações

- `scripts/migration-roundtrip.sh`, `scripts/qa.sh` — portão na raiz
- `scripts/qa-dashboard.sh` / `qa-mobile.sh` — CI sem path vazio do Chrome;
  health 180 s; Gradle do usuário se o sandbox redirecionar
- `.github/workflows/ci.yml` — job Playwright + roundtrip
- `package.json` — `pnpm qa`, `pnpm qa:mobile`
- portão, backlog (`UX-02` DONE), evidência `2026-08-22-EVIDENCIA-QA-03.md`

## Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `QA_SKIP_MOBILE=1 pnpm qa` | PASS | roundtrip + dash live 0 / dead 1 |
| hex plantado em `theme.ts` | FAIL depois PASS | portão que reprova |
| `pnpm build` / `lint` / `test` | PASS | 32/258 |
| smoke público | PASS | `AQL-MT4IY2U8LII` |
| `qa:mobile customer_app` | NÃO EXECUTADO até o fim | QEMU hang/segfault |
| flutter analyze/test | NÃO EXECUTADO | QA-03 não tocou Dart |

## Não feito e bloqueios

- CI deste commit ainda precisa ficar verde no GitHub Actions
- **`FROTA-01` / `FROTA-02` / `ADMIN-04`:** não tocar — Claude e Hermes estão na frota
- Recarga Pagar.me, Firebase, Render/Vercel, iOS compile — runbook do Álvaro

## Riscos conhecidos

- Smoke desta sessão criou pedidos no banco do runtime público (`cursar.space`)
- QEMU do `aqui_log_qa` pode pendurar CPU neste host; não use o AVD do AquiResolve

## Próximo passo recomendado

1. `[ADMIN-01]` — motivo obrigatório, audit log, matriz de permissões, confirmação dupla
2. Não pegar `FROTA-*`

## Mensagem de retomada

> `QA-03` está no `main`. Pegue `ADMIN-01`. Não mexa em frota.
