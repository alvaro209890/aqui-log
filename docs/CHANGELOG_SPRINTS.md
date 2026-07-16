# Histórico de entregas (Sprints 1–4 scaffold)

Linha do tempo do monorepo `aqui-log` em `main` (2026-07-16).

## Sprint 1 — Backend robusto
- Redis: health + lock aceite
- Jobs: expirar oferta / re-despacho / scheduled
- Pricing server-side
- Refresh token, logout, forgot/reset
- Alertas mark-read
- Timezone America/Sao_Paulo

## Sprint 2 — Mobile piloto
- Storage local + policy proofUrl
- Geocode API
- Device tokens skeleton
- Flutter: mapas OSM, câmera/upload, GPS, geocode, refresh client

## Sprint 3 — Dashboard gestão
- Users / Audit / Settings pages
- Dispatch, assign, cancel deliveries
- Reject/suspend companies & couriers
- Reports from/to
- Pagination admin lists

## Sprint 4 (parcial) — Estrutura cloud, sem vínculo
- Render blueprint (`infra/render.yaml`)
- Vercel config (`vercel.json`)
- Firebase folder + Nest stubs (`FIREBASE_ENABLED=false`)
- Docs: `DEPLOY_TARGETS.md`, `HANDOFF.md`

## Fora de escopo (ainda)
- Pagamentos, MFA, deploy real, Firebase ligado, FKs, load test
