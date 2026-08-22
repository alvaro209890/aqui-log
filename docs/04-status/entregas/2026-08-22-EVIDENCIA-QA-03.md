# Evidência — `QA-03` (portão completo, sem humano)

> **Data:** 2026-08-22
> **Agente:** Cursor Grok 4.6 (acer)
> **Branch:** `main`
> **Superfície:** scripts de QA na raiz, portão, CI
> **Fora de escopo:** `FROTA-*`, `ADMIN-04`, Flutter (não tocado), cloud, Pagar.me

## 1. O que foi entregue

- `scripts/migration-roundtrip.sh` — banco descartável via `psql` em
  `127.0.0.1:5433`, 16 migrations, insert legado em `users`+`customers`,
  revert da última (`CustomerPhoneVerification`), a linha sobrevive, reapply,
  `phone_verified_at` nulo no legado, `dropdb` no trap
- `scripts/qa.sh` + `pnpm qa` — roundtrip + `qa-dashboard.sh` + mobile
  (pulável com `QA_SKIP_MOBILE=1`)
- `package.json` — scripts `qa` e `qa:mobile`
- `.github/workflows/ci.yml` — job `dashboard-e2e` (Playwright + roundtrip).
  Emulador Android **não** foi adicionado: lento/instável no runner; o YAML
  diz isso com todas as letras
- `02-PORTAO-DE-VERIFICACAO.md` §0 — portão completo (§2 + §3) a partir desta
  data
- Playwright no CI: Chromium gerenciado pelo runner; neste PC continua o
  cache `chromium-1234` (`--no-sandbox`). `PLAYWRIGHT_BROWSERS_PATH` vazio
  não é mais exportado (quebrava o `run_pw`)
- `qa-mobile.sh`: espera de health 180 s; se `GRADLE_USER_HOME` aponta para
  o cache do sandbox do agente, volta para `~/.gradle`; timeout do
  `flutter test` 25 min

`UX-02` no backlog aponta para esta onda e fica `DONE`.

## 2. Aceite

| Critério | Resultado |
| --- | --- |
| Roundtrip com linha legada sobrevive revert+reapply | ✅ `legado.roundtrip.1787410149@aquilog.test` |
| `QA_SKIP_MOBILE=1 pnpm qa` verde | ✅ roundtrip + dashboard 3 passed / 39,2 s; API morta reprova (login, 21,5 s) |
| Defeito plantado faz o portão falhar | ✅ `#f97316` em `theme.ts` → teste hex **falhou** (193 ms); `git checkout` → **passou** (8 ms). O mesmo plantio já tinha sido medido no começo da sessão |
| Job Playwright + roundtrip no CI | ✅ job `dashboard-e2e` no YAML; emulador no runner **não** fingido |
| `UX-02` absorvido | ✅ `DONE` no backlog, aponta para a onda 1 |
| Credencial só de env | ✅ |

## 3. Portão base

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS — nest + vite 1,80 s |
| `pnpm lint` | PASS — eslint backend + `tsc -b` dashboard |
| `pnpm test` | PASS — **32 suítes / 258 testes**, 5,327 s |
| `QA_SKIP_MOBILE=1 pnpm qa` | PASS — roundtrip `aqui_log_roundtrip_1787410149` + dash `1787410161` |
| `API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke` | PASS — `AQL-MT4IY2U8LII` + agendado `AQL-MT4IYG568OS` + reoferta `05baeaa2-…` + cour-02 `1886ff0d-…` (134 s) |
| `flutter analyze` / `flutter test` | **NÃO EXECUTADO** — QA-03 não tocou Dart. Última evidência: cliente 23 / entregador 30 (`QA-01`) |
| Mobile e2e nesta sessão | **NÃO EXECUTADO até o fim** — QEMU do `aqui_log_qa` pendurou CPU (`hanging thread 'QEMU2 CPU0'`) e segfaultou depois do boot. `Medium_Phone_API_36.0` **não foi tocado**. Aceite mobile permanece o de `QA-01` (2026-08-21). CI não finge cobertura de emulador |

## 4. O que não foi feito

- Emulador no GitHub Actions — recusado de propósito
- `FROTA-*` / `ADMIN-04` — **não tocados**; Claude e Hermes estão na frota
- Recarga PIX / Firebase / Render / Vercel / iOS compile
