# Handoff vigente

- **Data/hora:** 2026-08-10 (~23:00 BRT)
- **Agente:** opencode (deepseek-v4-flash-free)
- **Tarefa:** `DISP-02` — aviso de demora da busca e ações explícitas do cliente
  (tentar de novo, editar, cancelar) + aumento de valor com consentimento
  (`DEC-03` §3.3, plano de confiança e preço §6.1.4/§6.1.5)
- **Branch/commit inicial:** `main` @ `b57cfb6` (docs `DEC-26`)
- **Escopo autorizado:** somente `DISP-02`; não tocar `DISP-03`/`PAY-01`/`COUR-02`/`UX-02`/cloud

## Resultado

`DISP-02` está `DONE`. A busca por motoboy agora tem o lado do cliente completo:

- **Aviso de demora** idempotente por ciclo (`dispatch_warning_at` + índice,
  migration `1785700000000-DispatchClientNotice`), disparado pelo job de 10 s
  quando `dispatchFirstWarningMinutes` passa (default 5; 0 = imediato), com
  evento + notificação + WebSocket `delivery:warning`. Conta do início do ciclo.
- **Busca esgotada recuperável** (`MAX_ROUNDS`/`TIMEBOX`/`NO_CANDIDATE`):
  `POST /deliveries/:id/retry` (cliente) reabre pelo **mesmo caminho do admin**
  (`dispatch(id, actorId, { reopen: true })`), sem mudar preço; `PATCH
  /deliveries/:id` edita só campos sem valor (endereços/destinatário/telefone/
  observação/janelas — preço/peso/tipo/foto dão `400`); cancelar usa o
  `PATCH /deliveries/:id/status` existente.
- **Aumento com consentimento**: `POST /deliveries/:id/price-boost/consent`
  recalcula a proposta com a settings real (Redis), grava o novo preço com
  evento + auditoria (anterior → novo) + notificação + `delivery:price-boosted`
  e reabre a busca. Único caminho que muda preço em pedido em busca.
- **UI**: app cliente com cards de status da busca/ações/proposta; dashboard com
  2 settings novas; tokens soft no tema compartilhado.

## Alterações

- `apps/backend/src/database/migrations/1785700000000-DispatchClientNotice.ts` — coluna + índice novos.
- `apps/backend/src/deliveries/dispatch.ts` — `firstWarningDue`, `priceBoostProposal` (regras puras).
- `apps/backend/src/deliveries/deliveries.service.ts` — `warnSlowDispatch`, `retry`, `updateDelivery`, `consentPriceBoost`; `present()` com `priceBoostProposal` (percentual real via `findOne`/ações).
- `apps/backend/src/deliveries/deliveries.controller.ts` — 3 rotas `@Roles(CUSTOMER)`.
- `apps/backend/src/deliveries/delivery-jobs.service.ts` — `warnSlowDispatch` no tick.
- `apps/backend/src/deliveries/deliveries.module.ts` — importa `TrackingModule`.
- `apps/backend/src/deliveries/dto/delivery.dto.ts` — `UpdateDeliveryDto`.
- `apps/backend/src/settings/settings.module.ts` — 2 settings novas.
- `apps/backend/src/tracking/{tracking.gateway,tracking.module}.ts` — emitters novos + export.
- `apps/backend/src/pricing/pricing.types.ts` — campo `boost` no breakdown.
- `apps/backend/src/database/entities/delivery.entity.ts` — `dispatchWarningAt`.
- Mocks dos 4 specs de fluxo ganharam `config`/`settings`/`tracking` (os testes existentes passam a instanciar o serviço com os args novos).
- `packages/aqui_log_core/lib/src/{models,api_client}.dart` — campos + 3 métodos.
- `apps/customer_app/lib/screens/delivery_detail_screen.dart`, `main.dart` — UI e wiring.
- `apps/dashboard/src/{api.ts,pages/SettingsPage.tsx}` — 2 campos.
- `packages/aqui_log_ui/lib/src/theme.dart` — `*Soft`.
- `scripts/smoke-test.sh` — bloco DISP-02 + restauração de settings.
- Docs: evidência nova, `ESTADO-ATUAL`, `BACKLOG`, `ROADMAP`, `COBERTURA-MVP`, `CHANGELOG`, este handoff.

## Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm build` / `pnpm lint` (raiz) | PASS | backend + dashboard |
| `pnpm test` (raiz) | PASS — **205 testes** (eram 197) | +8 das regras puras novas |
| Migration `DispatchClientNotice` | PASS | run → revert → run no banco 5433; coluna + `IDX_deliveries_dispatch_warning` conferidos |
| `pnpm smoke` | PASS — **3 execuções** em `PORT=3011` | bloco DISP-02 completo (aviso, `409`s, proposta, edição sem preço, retry, consentimento) |
| `flutter analyze`/`test` (cliente / motoboy) | PASS — 15 / 18 | motoboy só tocou o tema compartilhado |
| `dart analyze` (core) | PASS | — |
| QA de navegador do painel / APK / emulador | NÃO EXECUTADO | segue em `UX-02` |

## Não feito e bloqueios

- WebSocket no app cliente (acompanha por polling; eventos prontos no gateway).
- Proposta de aumento com valor escolhido pelo cliente (só o percentual da settings).
- Taxa de cancelamento do cliente (`COUR-02`/`PAY-01`).
- Nada de cloud; `DEC-26`/`OPS-01A` seguem só planejadas.
- Obs.: o revert da legada `RemoveCompanyModel` falha no banco 5433 com dados
  (`company_id` NOT NULL) — problema pré-existente, não desta tarefa; o banco de
  dev foi normalizado via `migration:run` (13 aplicadas).

## Riscos conhecidos

- Settings vivem no Redis e sobrevivem entre execuções: o bloco DISP-02 do smoke
  fixa os valores no início e **restaura** os do cenário DISP-01 no fim — não
  mude isso sem atualizar o smoke.
- O `present()` usa o percentual do env como fallback em fluxos de lista; o
  detalhe/ações usam a settings real do Redis — se divergirem, o card do app
  pode mostrar uma prévia diferente do valor aplicado no consentimento (o
  servidor sempre decide).

## Próximo passo recomendado

1. `PAY-01` — ledger interno (`DEC-05`); destrava `COUR-02`. Alternativas:
   `UX-02` (QA visual, exige dispositivo/emulador; inclui seções do painel sem
   QA de navegador) e `OPS-01A` (runtime de distribuição no acer via Cloudflare
   Tunnel, `DEC-26` — ver `PLANO_HOSPEDAGEM.md`). Escolher **um** ID.
