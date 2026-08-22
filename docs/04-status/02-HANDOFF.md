# Handoff vigente

- **Data/hora:** 2026-08-21
- **Agente:** Hermes-acer
- **Tarefa:** gerar e entregar os APKs de distribuição (cliente + entregador),
  documentar, pushar e confirmar o runtime online em `*.cursar.space`.
- **Branch/commit inicial:** `main` @ `766f78d` (QA-01 DONE)
- **Estado:** entregue e pushado. Evidência:
  `docs/04-status/entregas/2026-08-21-EVIDENCIA-APKS.md`.

## Resultado

Os dois APKs (arm64, ~19,4 MB cada) foram buildados
(`flutter build apk --release --target-platform android-arm64`), copiados para
`dist/` com data de hoje e enviados ao Álvaro no canal. Ambos apontam por
default para `https://aquilog-api.cursar.space/api/v1` (padrão `3d66fd0`), ou
seja, conversam com o runtime de distribuição deste PC sem configuração extra.

Verificação real: `flutter analyze` 0 issues e widget tests 23 (cliente) / 30
(entregador) verdes; health público `ok` com db+redis `ok`; as 3 units systemd
(`aqui-log-api`, `aqui-log-dashboard`, `cloudflared-aqui-log`) ativas.

## Atenção para o próximo agente

- **Working tree sujo do QA-02 (opencode) preservado intacto:** modificados
  `apps/dashboard/package.json` e `pnpm-lock.yaml`; não monitorados
  `apps/dashboard/e2e/`, `apps/dashboard/playwright.config.ts`,
  `scripts/qa-dashboard.sh`. Commit seletivo apenas — não rodar `git add -A`.
- `dist/` é ignorado no git: APK é artefato de entrega via chat, não versionado.
- Próxima da onda 1: `QA-02` (Playwright no painel) — já em andamento pelo
  opencode; depois `QA-03` fecha a onda.