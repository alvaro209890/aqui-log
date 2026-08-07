# Histórico de entregas (Sprints 1–4 scaffold)

Linha do tempo do monorepo `aqui-log` em `main` (2026-07-16).

## B2C-01 e identidade mobile — 2026-08-07

- Encomenda estruturada em colunas proprias, com migration aditiva e rollback coberto por teste.
- DTO/API validam catalogos estaveis, peso e fotos hospedadas pelo storage do Aqui Log.
- `OrderMeta` serializa o contrato novo e mantem leitura de `notes` legado.
- Apps cliente e motoboy exibem tipo, tamanho, peso, alcance, observacao e foto pelo contrato novo.
- Tema compartilhado mudou de verde/menta para laranja `#F97316`; status continuam semanticos.
- Testes locais: backend 32/32, core 6/6, UI 2/2, cliente 10/10, motoboy 7/7; build backend/dashboard verde.
- Encerrado sem migration/smoke ao vivo, APK ou QA visual: host sem `.env`/Docker e AVD Android offline no ADB.

## Planejamento consolidado — 2026-08-07 (documentação local)

- `ROADMAP.md` refeito como fila executiva do produto B2C atual.
- Próximo pacote definido: `B2C-01`, dados estruturados da encomenda com fallback legado.
- Planos de confiança/preço, pagamentos e transportadora ganharam dependências,
  invariantes, gates e critérios de aceite.
- `PLANO_IMPLEMENTACOES.md` e `PROMPT_AGENTE.md` marcados como históricos para
  evitar reexecução de trabalho já entregue.
- Identidade laranja mantida como trilha paralela `UX-01/02`, ainda sem mudança de código.

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
