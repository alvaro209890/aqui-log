# Histórico de entregas (Sprints 1–4 scaffold)

Linha do tempo do monorepo `aqui-log` em `main` (2026-07-16).

## Fluxo cliente↔prestador nos planos — 2026-08-07

## `B2C-05`: foto e campos obrigatórios na criação — 2026-08-08

- `CreateDeliveryDto`: `productType`, `packageSize`, `weightKg` e
  `productPhotoUrls` (≥ 1) deixam de ser opcionais (`DEC-01`, `DEC-18`).
  Mensagens de erro passam a ser em português e específicas por campo.
- Endereços e nome do destinatário ganham `@IsNotEmpty` com aparo de espaços:
  `"   "` deixa de ser aceito como endereço.
- App cliente: a foto vira obrigatória na tela de novo pedido — botão em
  vermelho, mensagem inline e envio bloqueado antes de chamar a API.
- `scripts/smoke-test.sh`: o cliente sobe a foto por `presign purpose=product`,
  o pedido vai completo e um **assert negativo** garante que o payload legado é
  recusado com `400` (validado invertendo a expectativa: `exit=1`).
- Leitura de pedido legado **não** mudou: linha sem campos B2C continua abrindo
  em lista, detalhe, histórico e visão de admin. Fallback de `notes` intacto.
- Testes: backend 36 → **44**; app cliente 10 → **11**.
- `PICK-01` promovido a `READY` (dependia de `B2C-05`; `DEC-24` já decidida).
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

## `BASE-04` e `B2C-01B` fechados com evidência de runtime — 2026-08-08

- `BASE-04` `DONE`: banco descartável `aqui_log_base04`, 8 migrations sem
  `synchronize=true`, `RemoveCompanyModel` revertida e reaplicada, health com
  `db`/`redis` `ok`, smoke B2C aprovado em 6 execuções com códigos distintos.
- `B2C-01B` `DONE`: QA de navegador em Chrome real cobrindo os quatro filtros,
  combinação, estado vazio, paginação com filtro e escopo por papel
  (`CUSTOMER` ignora `customerId` alheio; não-UUID → 400; sem token → 401).
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (backend 10 suítes / 36 testes).
- Achados de UI registrados para `UX-01C`/`UX-02`: busca decorativa na `TopBar`
  com vocabulário B2B ("empresa"), ação "Assign" em inglês, painel ainda verde.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

## Smoke deixa de aprovar com upload de prova quebrado — 2026-08-08

- `scripts/smoke-test.sh`: a falha do `PUT` da prova era engolida dentro de `$( )`,
  onde `set -e` não aborta; o script imprimia `Smoke test aprovado` mesmo com o
  arquivo nunca subindo.
- Agora `upload_proof` retorna erro e a chamada usa `|| exit 1`, com mensagem que
  nomeia a prova, a URL tentada e explica o alinhamento de `PUBLIC_API_URL`.
- Verificado nos dois sentidos: falha com `exit=1` quando desalinhado, aprova com
  `exit=0` quando alinhado.
- Consequência: evidências de smoke anteriores a esta data não comprovam upload.

## B2C-01B fatia 4 (`customerId`) — 2026-08-08

- `GET /deliveries?customerId=` com validação UUID (`400` se inválido).
- Filtro aplicado só a papéis admin; outros ignoram o param.
- Dashboard: input Cliente + coluna (prefixo UUID); predicados + testes.
- Backend 36 testes; builds/lints verdes. Falta QA browser.

## B2C-01B fatia 3 (faixa de peso) — 2026-08-08

- `GET /deliveries?weightMin=&weightMax=` com validação (>=0, min≤max).
- Dashboard: inputs peso min/max + coluna Peso; legado sem peso fora do filtro.
- Backend 35 testes; builds/lints verdes.

## B2C-01B fatia 2 (`packageSize`) — 2026-08-08


- `GET /deliveries?packageSize=` com validação (`SMALL`/`MEDIUM`/`LARGE`).
- Dashboard: select Tamanho + coluna; combo com `productType` nos testes.
- Backend 34 testes; builds/lints verdes. `B2C-01B` ainda `IN_PROGRESS`.

## B2C-01B fatia 1 (`productType`) — 2026-08-08


- `GET /deliveries?productType=` com validação de catálogo (`400` se inválido).
- Predicados puros + testes; dashboard: select Categoria + coluna na tabela.
- Pedidos legados sem categoria não entram no filtro.
- Evidência: backend 33 testes, builds/lints backend+dashboard verdes.
- QA navegador / smoke vivo: não executados. `B2C-01B` permanece `IN_PROGRESS`.

## Hospedagem cloud travada — 2026-08-07


- `DEC-25`: API **Render**, dashboard **Vercel**, banco **Firebase Firestore**
  (+ Storage/FCM). Plano `PLANO_HOSPEDAGEM.md`; `OPS-DB-01`/`OPS-02`/`OPS-03`.
- `INV-02`/`INV-05` atualizados: Postgres local permanece; cloud não provisionada
  nesta sessão (só documentação + comentários do blueprint).
- Sessão docs-only; push em `main`.

## Fluxo cliente↔prestador nos planos — 2026-08-07

- Novo plano `PLANO_FLUXO_CLIENTE_PRESTADOR.md` com modos IMMEDIATE/SCHEDULED,
  km dual, aceite antecipado, Agenda, taxa de cancelamento no saldo do prestador,
  saldo sacável e `pickup_code`.
- Decisões `DEC-01` e `DEC-18`…`DEC-24` registradas como `DECIDIDA`.
- Roadmap/backlog ganharam IDs `B2C-05`, `B2C-06`, `SCHED-01`, `COUR-01/02`, `PICK-01`.
- Contradições removidas: foto “opcional até decidir”, “desistência sem penalidade
  dura”, preço único por km, ausência de código de recolhimento.
- Sessão somente documental; `BASE-04` continua o próximo trabalho técnico.

## Organização documental para agentes — 2026-08-07

- Documentação separada em governança, produto, planejamento, referência, estado e arquivo.
- Criados `AGENTS.md`, índice, backlog único, registro de decisões, estado atual,
  handoff substituível, fluxo numerado, checklist e templates.
- Próximo item normalizado para `BASE-04`; `B2C-01B` aguarda validação do baseline.
- Contradições removidas: B2B residual, reversão de `DELIVERED`, custódia pós-coleta,
  IDs colidentes e Redis como autoridade única de reserva.
- Sessão somente documental: nenhum teste de aplicação ou runtime foi executado.

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
- Planos de confiança/preço, pagamentos e lote multi-pedido ganharam dependências,
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
