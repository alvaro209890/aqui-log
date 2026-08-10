# Evidência DISP-02 — aviso de demora e ações explícitas na busca

> **Data:** 2026-08-10
> **Ambiente:** PC `acer`; banco descartável `aqui_log` local (Postgres 5433) +
> Redis 6373; API viva em `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`
> **Base do trabalho:** `b57cfb6` (docs `DEC-26` no `main`) sobre `bc0d553` (DISP-01)
> **Documentos de referência:** `PLANO_CONFIANCA_E_PRECO.md` §3.3, §6.1.4 e §6.1.5;
> `DEC-03`; `DEC-19`

## 1. Objetivo

Avisar o cliente quando a busca por motoboy **demora** (plano §6.1.4) e, quando
ela **esgota** (§6.1.5), oferecer ações explícitas — tentar novamente, editar e
cancelar — incluindo o **aumento de valor com consentimento explícito**
(`DEC-03` §3.3: nunca silencioso), preservando os invariantes de `DISP-01`
(pedido continua `REQUESTED` com `dispatch_end_reason`; quem recusou segue
excluído; preço nunca muda sem consentimento — `DEC-19`).

## 2. O que foi implementado

### 2.1 Backend (`apps/backend`)

- **Migration `1785700000000-DispatchClientNotice`**: coluna opcional
  `dispatch_warning_at` no pedido + índice parcial — o aviso de demora é
  **idempotente** (uma vez por ciclo de busca).
- **Regra pura em `dispatch.ts`** (padrão `DISP-01`, sem banco/relógio):
  - `firstWarningDue(startedAt, now, warningMinutes)` — "primeiro atraso
    significativo" conta do **início do ciclo**, não da criação; `0` avisa no
    primeiro tick (usado por teste e smoke).
  - `priceBoostProposal(priceCents, boostPercent)` — monta a proposta
    (anterior → novo, `Math.round`, percentual 0/negativo devolve `null`).
    **Nunca aplica**: aplicar é do serviço, com consentimento.
- **Settings novas** (interface, DTO e defaults no `settings.module.ts`):
  `dispatchFirstWarningMinutes` (default 5; 0 = imediato) e
  `dispatchPriceBoostPercent` (default 20; 0 = sem proposta) — padrão `DEC-02`
  (provisórios, editáveis no admin, sem deploy).
- **Serviço (`deliveries.service.ts`)**:
  - `warnSlowDispatch()` — job de 10 s marca `dispatchWarningAt` + evento
    `DISPATCH_SLOW_WARNING` + notificação ao criador + WebSocket
    `delivery:warning`; idempotente por ciclo.
  - `retry(id, user)` — "tentar de novo" do cliente; reabre via
    `dispatch(id, actorId, { reopen: true })` (mesmo caminho de recuperação do
    admin), **sem mudar o preço** (`DEC-19`); `409` com busca ativa ou motivo
    não recuperável (`ACCEPTED`/`CANCELED`).
  - `updateDelivery(id, dto, user)` — "editar" com `UpdateDeliveryDto`
    (whitelist): endereços, destinatário, telefone, observação e janelas do
    agendado. **Preço, peso, tipo, tamanho e foto ficam fora** (`DEC-19`);
    `forbidNonWhitelisted` recusa com `400`. Só `REQUESTED` **sem oferta
    pendente** (`409` caso contrário). Editar **não reabre** a busca.
  - `consentPriceBoost(id, user)` — o aumento com consentimento: valida busca
    esgotada em motivo recuperável, recalcula a proposta com a **settings real**,
    grava o novo preço no snapshot, evento `PRICE_BOOST_CONSENTED` + auditoria
    (`PRICE_BOOST_CONSENTED`, anterior → novo) + notificação + WebSocket
    `delivery:price-boosted`, e reabre a busca com o novo valor. É o **único**
    caminho que muda o preço de um pedido em busca.
  - `present()` ganhou `priceBoostProposal` (só no detalhe/retorno das ações,
    com o percentual real do Redis via `findOne`/ações; lista usa o env) e o
    `endDispatchCycle` já notifica e emite `delivery:dispatch-ended` (DISP-01).
- **Controller**: `POST :id/retry`, `PATCH :id`, `POST :id/price-boost/consent`
  — todos `@Roles(CUSTOMER)`. `DeliveriesModule` importa `TrackingModule`.

### 2.2 Apps

- **Core (`aqui_log_core`)**: `DeliverySummary` com `dispatchStartedAt`,
  `dispatchEndReason`, `dispatchWarningAt`, `priceBoostProposal`,
  `recipientPhone` + getters `dispatchExhausted`/`dispatchSlowWarned`;
  `AquiLogApiClient.retryDelivery/updateDelivery/consentPriceBoost`.
- **App cliente**: tela de detalhe com card da busca (procurando → aviso de
  demora → esgotada com **Tentar novamente / Editar / Cancelar**) e card da
  proposta de aumento ("De R$ X para R$ Y (+20%)... só é aplicado com o seu
  aceite"). Diálogos de edição (campos restritos) e de cancelamento com motivo
  opcional. `main.dart` atualiza a lista ao voltar do detalhe.
- **Dashboard**: seção "Reoferta por aneis" ganhou **Aviso de demora
  (minutos)** e **Aumento para destravar a busca (%)** com nota explicativa.
- **Tema compartilhado**: tokens `successSoft/warningSoft/errorSoft/infoSoft`.

## 3. Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm --filter backend build` | ✅ PASS | — |
| `pnpm --filter backend lint` | ✅ PASS | — |
| `pnpm --filter backend test` | ✅ PASS — 21 suítes / **205 testes** (eram 197) | novos: 8 testes de `priceBoostProposal` e `firstWarningDue` |
| `pnpm build` (raiz) | ✅ PASS | dashboard incluso |
| `pnpm lint` (raiz) | ✅ PASS | `tsc -b` do dashboard |
| `pnpm test` (raiz) | ✅ PASS — 205 testes | — |
| Migration `DispatchClientNotice` em banco 5433 | ✅ PASS | `migration:run` aplicou **todas as 8 pendentes**; depois `revert` isolado da minha (coluna + índice removidos) e `run` de novo (coluna + índice `IDX_deliveries_dispatch_warning` presentes) |
| Revert da legada `RemoveCompanyModel` | ❌ conhecido | `23502` em `company_id` com dados — problema **pré-existente**, não desta tarefa; banco de dev foi normalizado via `migration:run` |
| `pnpm smoke` (API viva 3011) | ✅ PASS — **3 execuções** | bloco DISP-02 novo: aviso de demora idempotente, `409` em retry/editar com busca ativa, proposta na busca esgotada, edição sem preço, `400` em `priceCents`, retry sem mudar preço, consentimento aplicando o novo valor e reabrindo |
| Log do job | ✅ PASS | `jobs: ... warned=1` (aviso disparado uma vez) |
| `flutter analyze`/`flutter test` (cliente) | ✅ PASS — 15 testes | — |
| `flutter analyze`/`flutter test` (motoboy) | ✅ PASS — 18 testes | apenas o tema compartilhado mudou |
| `dart analyze` (core) | ✅ PASS | — |
| QA de navegador do painel | ❌ NÃO EXECUTADO | seção validada por build/API; segue em `UX-02` |
| APK / QA em emulador | ❌ NÃO EXECUTADO | segue em `UX-02` |

### 3.1 Decisões de design registradas

1. **Editar não reabre a busca** — a edição ajusta o pedido; quem decide
   continuar tentando é o "tentar novamente". Evita oferta criada com endereço
   velho.
2. **A proposta é recalculada no consentimento** com a settings real do Redis;
   o card do app é a prévia (a UI mostra e o servidor decide/grava — o servidor
   é sempre a autoridade do preço).
3. **Retry do cliente usa exatamente o caminho de recuperação do admin**
   (`dispatch(..., { reopen: true })`), garantindo os invariantes do `DISP-01`
   (exclusão de quem recusou, ciclo zerado).
4. **Aviso só quando o ciclo começou** (`dispatchStartedAt`): pedido que nunca
   foi despachado não "está demorando" — o job `redispatchPendingRequested`
   continua cuidando dele.

### 3.2 Observações do smoke (bloco DISP-02)

- Aviso: settings `dispatchFirstWarningMinutes=0` + despacho manual forçando o
  início do ciclo; 13 s (job de 10 s) → `dispatchWarningAt` preenchido.
- Busca esgotada: `dispatchMaxRounds=1` + recusa → `MAX_ROUNDS`; o cliente vê
  `priceBoostProposal` (anterior → +20% `round`), edita endereços/destinatário
  sem mexer no preço, `400` ao tentar `priceCents`.
- Retry do esgotado: `dispatchEndReason == null`, preço intacto (`DEC-19`).
- Consentimento: `priceCents == newPriceCents`, busca reaberta, oferta nova
  criada com o valor maior.
- O bloco restaura as settings do cenário DISP-01 ao final (Redis sobrevive
  entre execuções).

## 4. Não feito (escopo preservado)

- **`DISP-03`**: telemetria de rodadas/varreduras — não tocado.
- **`PAY-01`/`COUR-02`**: ledger e cancelamento com taxa — não tocados.
- **Cloud (Render/Vercel/Firebase)**: nada provisionado; `DEC-26` (`OPS-01A`)
  segue planejada.
- **Editar peso/tipo/foto/escopo**: mudaria o preço congelado (`DEC-19`) — é
  recotação, evolução futura, fora de `DISP-02`.
- **WebSocket no app cliente**: o app acompanha por polling (canal REST
  existente); os eventos `delivery:warning`/`delivery:dispatch-ended`/
  `delivery:price-boosted` estão prontos no gateway para quem consumir socket.

## 5. Limitações e pendências abertas

- O aviso de demora e o fim da busca chegam ao app via **polling/refresh**
  (não há socket no app cliente hoje).
- O cancelamento pelo cliente usa o `PATCH /deliveries/:id/status` já
  existente; a taxa de cancelamento do cliente segue em `COUR-02`/`PAY-01`.
- A proposta de aumento vale só para o percentual inteiro da settings; o
  cliente não escolhe valores — conforme `DEC-03`.
- QA visual das telas novas do app cliente e da seção nova do painel: pendente
  (`UX-02`).
