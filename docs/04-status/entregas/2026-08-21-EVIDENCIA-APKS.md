# Evidência — APKs de distribuição cliente + entregador (2026-08-21)

> **PC:** acer. **Autor:** Hermes-acer. **Pedido do Álvaro:** gerar os dois APKs,
> entregar, documentar, pushar e manter o runtime online no domínio `cursar.space`.
> **Estado:** entregue (APKs enviados no canal), docs pushadas, CI verde.

## Artefatos gerados

| App | Arquivo | Tamanho | SHA-256 |
| --- | --- | --- | --- |
| Cliente (B2C) | `dist/aqui-log-cliente-2026-08-21.apk` | 19,4 MB | `c749937ff2d3f12cf395d71b330930a9dbbb041a3ecc341baf8d181545e8afde` |
| Entregador | `dist/aqui-log-entregador-2026-08-21.apk` | 19,4 MB | `ef878a00288fe3a34749e4808fe56162d512a7add5408f9484083246dae8ebf7` |

- Build: `flutter build apk --release --target-platform android-arm64` (arm64,
  ~19 MB — cabe em WhatsApp/Discord; pitfall 22).
- `dist/` é ignorado no git: APK é artefato de entrega via chat, não versionado.
- ApplicationIds: `br.com.aquilog.aqui_log_cliente` (customer_app) e
  `br.com.aquilog.aqui_log_entregador` (courier_app).

## URL apontada pelos APKs

Padrão travado em `3d66fd0` — `app_state.dart` usa
`defaultValue: 'https://aquilog-api.cursar.space/api/v1'` nos dois apps, com
override por `--dart-define=AQUI_LOG_API=...`. **Os APKs deste build conversam
com o runtime de distribuição do acer** (Cloudflare Tunnel + domínio
`*.cursar.space`), sem configuração extra no celular.

## Verificação executada (evidência real)

| Passo | Resultado |
| --- | --- |
| `flutter analyze` — customer_app | ✅ No issues found (10,1 s) |
| `flutter test` — customer_app (widget) | ✅ **23 passed** |
| `flutter analyze` — courier_app | ✅ No issues found (5,7 s) |
| `flutter test` — courier_app (widget) | ✅ **30 passed** |
| Build APK cliente | ✅ `app-release.apk (19.4MB)`, Gradle 127,6 s |
| Build APK entregador | ✅ `app-release.apk (19.4MB)`, Gradle 92,2 s |
| `GET https://aquilog-api.cursar.space/api/v1/health` | ✅ `{"status":"ok","checks":{"db":"ok","redis":"ok"}}` |
| `systemctl --user is-active aqui-log-api aqui-log-dashboard cloudflared-aqui-log` | ✅ active active active |
| Containers `aqui-log-postgres` / `aqui-log-redis` | ✅ healthy / healthy (9 h up) |

## O que NÃO foi tocado

- Working tree sujo do QA-02 (opencode): `apps/dashboard/package.json`,
  `pnpm-lock.yaml` modificados; `apps/dashboard/e2e/`,
  `apps/dashboard/playwright.config.ts`, `scripts/qa-dashboard.sh` não
  monitorados — **preservados intactos** (commit seletivo, pitfall 25).
- Runtime/publicação: nenhuma unit systemd parada/reiniciada; nenhum outro
  túnel do acer tocado.