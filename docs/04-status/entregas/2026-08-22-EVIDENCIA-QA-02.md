# Evidência — `QA-02` (Playwright no painel, sem humano)

> **Data:** 2026-08-22
> **Agente:** Cursor Grok 4.6 (acer)
> **Branch:** `main`
> **Superfície:** `apps/dashboard` + `scripts/qa-dashboard.sh`
> **Fora de escopo:** Flutter, `FROTA-*`, `ADMIN-04`, cloud, Pagar.me

## 1. O que foi entregue

O rascunho `d60b128` não fechava o aceite: seletor de tema pelo `title` errado,
pizza testada em `/reports` (ícones Lucide passavam), seed **aprovava** o
candidato da fila, e não havia contraste, hex de marca, entrega cancelada nem
prova de falha com API morta.

Nesta sessão:

- `apps/dashboard/e2e/helpers.ts` + `e2e/dashboard.spec.ts` reescritos
- Chromium do cache `~/.cache/ms-playwright/chromium-1234` (`--no-sandbox`)
- `scripts/qa-dashboard.sh` sobe banco descartável via `psql` em `127.0.0.1:5433`
  (sem `docker exec`), API e Vite em portas livres, semeia fila PENDING +
  DELIVERED + CANCELED, roda o e2e, depois mata a API e exige reprovação
- `pnpm qa:dashboard` na raiz

## 2. Aceite

| Critério | Resultado |
| --- | --- |
| 11 páginas × 2 temas, load, 0 console.error (rede OSM/fonte/WS filtrada), overflow ≤ 2 px em 430 px | ✅ varredura claro 15,9 s + escuro 17,6 s |
| Fila mostra **nome e e-mail** (`.approval-queue`) | ✅ `Candidato QA` / `candidato.qa.1787401039@aquilog.test` — print `qa-02-fila-aprovacao-claro.png` |
| Pizza de status desenha `<svg path>` em `/` (`data-testid=chart-deliveries-by-status`) | ✅ |
| `DELIVERED` (`.status.green`) e `CANCELED` (`.status.red`) com **cores distintas** | ✅ |
| Contraste AA ≥ 4,5:1 nos pares amostrados (login, heading, selos) | ✅ |
| Zero `#f97316`/`#c54b07` (e hover) fora de `styles.css`; zero hex em `.ts/.tsx` | ✅ 8 ms |
| `qa:e2e` passa com API viva e **falha** com ela morta | ✅ live exit 0; dead exit 1 (login não entra, 20 s) |
| Credencial só de env / `~/.config/aqui-log/env` | ✅ |
| Settings "Modo agendado" e "Reoferta por aneis" visíveis | ✅ print `qa-02-settings-claro.png` |

## 3. Portão base

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS — backend nest + dashboard vite 1,44 s |
| `pnpm lint` | PASS — eslint backend + `tsc -b` dashboard |
| `pnpm test` | PASS — **32 suítes / 258 testes**, 5,243 s |
| `pnpm qa:dashboard` | PASS — run `1787401039`, db `aqui_log_qa_dash_1787401039` dropado no trap |
| `API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke` | PASS — `AQL-MT4CJY6TX7P` + agendado `AQL-MT4CKBEXIO5` + reoferta `4238eb08-…` + cour-02 `2c8932fd-…` (131 s) |
| `flutter analyze` / `flutter test` | **NÃO EXECUTADO** — o Flutter do agente recusou (EUID root no sandbox: `engine.stamp: Permissão negada`). QA-02 não tocou Dart. Última evidência mobile: cliente 23 / entregador 30 (`QA-01`) |
| Migration ida e volta | N/A — nenhuma migration nesta tarefa |

## 4. Prints

Arquivados em `docs/04-status/entregas/`:

- `qa-02-login-claro.png`
- `qa-02-overview-claro.png` / `qa-02-overview-escuro.png`
- `qa-02-fila-aprovacao-claro.png`
- `qa-02-entregas-claro.png`
- `qa-02-settings-claro.png`

Rodada bruta (logs, gitignored): `docs/04-status/entregas/qa-02-1787401039/`.

## 5. O que não foi feito

- `QA-03` (portão `pnpm qa`, roundtrip, CI Playwright) — próxima da onda 1
- `FROTA-*` / `ADMIN-04` — **não tocados**; Claude e Hermes estão na frota
- Recarga PIX / cloud / iOS compile
