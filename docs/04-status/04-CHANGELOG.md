# Histórico de entregas (Sprints 1–4 scaffold)

Linha do tempo do monorepo `aqui-log` em `main` (2026-07-16).

## Fluxo cliente↔prestador nos planos — 2026-08-07

## `PICK-01`: código de recolhimento na coleta — 2026-08-09

- **`AT_PICKUP → PICKED_UP` exige código válido + foto do prestador** (`DEC-24`).
  A foto tem de ser do prestador: reapresentar a foto que o cliente enviou na
  criação é recusada com `400`.
- **Código de 4 dígitos** (`FLOW-DEC-03`) gerado no servidor **no aceite**, com
  `crypto.randomInt`. Vai na notificação de aceite e no detalhe do pedido do
  cliente; **o app do entregador nunca recebe o valor** — só
  `pickupCodeRequired`, `pickupCodeAttemptsLeft` e `pickupCodeBlockedUntil`.
  O valor também não entra na auditoria.
- **Rate limit:** 4 erros devolvem `400` com as tentativas restantes; o 5º
  bloqueia por 15 min com `429`, alerta ao cliente e auditoria
  (`DELIVERY_PICKUP_CODE_FAILED` / `_BLOCKED`). Durante o bloqueio nem o código
  certo passa.
- **Fallback de código perdido:** `POST /deliveries/:id/pickup-code/override`,
  só admin/suporte, motivo obrigatório (≥ 10 caracteres), prova alternativa
  opcional, auditado. Ele destrava a coleta, não avança o status.
- **Pedido legado sem código** continua avançando só com a foto — leitura e
  escrita legadas intactas. Migration `1785400000000` aditiva, revertida e
  reaplicada com uma linha legada dentro da tabela.
- App do motoboy: a tela de coleta pede os 4 dígitos e só libera o envio com a
  foto e o código completos; bloqueada, ela recusa nova tentativa. App do
  cliente: o código aparece em destaque no detalhe do pedido.
- Smoke passou a reprovar se o entregador receber o campo `pickupCode`.
- Testes: backend 70 → **96**; core Dart 6 → 10; motoboy 7 → 11; cliente 11 → 13.
- Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md`.

## `DEC-02` + `B2C-02`: preço v2 e tema escuro — 2026-08-08

- **`DEC-02` DECIDIDA** pelo Álvaro com valores **provisórios**, todos editáveis
  no painel admin sem deploy: base R$ 7,00, mínimo R$ 9,00, plataforma 20%,
  km imediato R$ 2,50 / agendado R$ 1,80, faixas de peso até 2/5/10/20 kg,
  tamanho P/M/G, multa do prestador R$ 3,00 e cutoffs.
- **Preço v2 (`B2C-02`/`B2C-02A`):** `base + km × tarifa_do_modo + peso +
  tamanho`, com piso. `pricingVersion`, `pricingBreakdown` e `fulfillmentMode`
  persistidos no pedido — mudar settings **não** altera pedido criado (`DEC-19`).
  Migration aditiva `1785300000000`, revertida e reaplicada em teste.
- **Settings do admin** ganharam 9 campos novos (tarifa dual, faixas de peso,
  adicionais de tamanho, multas e cutoffs), com validação `DEC-19` na escrita.
- **Tema escuro** do painel, derivado por tokens (regra 7 das diretrizes), com
  alternador na `TopBar`, persistência e respeito ao `prefers-color-scheme`.
  No escuro o laranja claro `#FB923C` assume o texto; `#C54B07` sumiria.
- Correção: **patch parcial de settings apagava valores personalizados** —
  o DTO chega com as chaves ausentes em `undefined` e elas sobrescreviam o
  estado salvo; como `JSON.stringify` descarta `undefined`, a perda era
  silenciosa. Também cegava a validação do `DEC-19`. Dois testes de regressão.
- Correção: o formulário de configurações **não submetia** — `min=0.001` com
  `step=0.5` invalida todo peso inteiro e o navegador bloqueia o submit inteiro
  sem mensagem.
- Pendência registrada: o gráfico de pizza não renderiza setores (Recharts 3.9
  + React 19); pré-existente, reproduzido sem `Cell`, sem `label` e com as cores
  originais.
- Testes: backend 44 → **70**. Contraste AA: 0 reprovações em 11 telas × 2 temas.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-02-E-TEMA-ESCURO.md`.

## `UX-01C`: identidade laranja no dashboard — 2026-08-08

- `styles.css` ganha uma camada de tokens em `:root` e vira a **fonte única** de
  cor de marca do painel; o verde/menta saiu, inclusive dos neutros que eram
  tingidos de verde. Sidebar passa a ser escura neutra com destaque laranja.
- `theme.ts` (novo) leva os tokens para Recharts e Leaflet exportando **nome** de
  token (`var(--...)`), não valor. Resultado: 0 hexadecimais fora do tema.
- **Dois laranjas, uma marca:** `--color-primary` `#F97316` para acentos, ícones
  e séries de gráfico; `--color-primary-strong` `#C54B07` (4,8:1 sobre branco)
  para botões, links e texto — branco sobre `#F97316` dá 2,8:1 e reprova no AA.
  `#C2410C` foi testado e revertido: passa no contraste, mas lê como vermelho.
- `StatusBadge`: `DELIVERED` e `CANCELED` usavam **o mesmo cinza** — entrega
  concluída ficava indistinguível de cancelada. Agora verde e vermelho;
  `IN_TRANSIT` vira azul (rastreamento) e `REJECTED` vermelho. Criada `.status.red`.
- Vocabulário: placeholder da busca deixa de citar "empresa" (B2B removido do
  produto) e a ação "Assign" vira "Atribuir".
- QA em Chrome real: 11 telas sem verde de marca, 7 pares de texto ≥ 4,5:1,
  foco de teclado visível e mobile 430px sem overflow horizontal.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

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
