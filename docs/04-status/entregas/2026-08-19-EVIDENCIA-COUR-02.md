# Evidência — `COUR-02`: cancelamento do prestador com taxa

> **Data:** 2026-08-19
> **Agente:** Grok 4.6
> **Ambiente:** PC Windows (`C:\GIS\aqui-log`); Node v22.22.0, Flutter 3.44.9
> **Base:** `main` @ `0d3ea55` (`ADMIN-02A`)
> **Escopo:** somente `COUR-02` (`DEC-22`, `FLOW-DEC-01`, plano
> `PLANO_FLUXO_CLIENTE_PRESTADOR` §6)

---

## 0. Resumo

| Item | Resultado |
| --- | --- |
| Desistência em `ACCEPTED` dentro do cutoff | ✅ |
| Débito da taxa congelada no ledger | ✅ |
| Pedido volta a `REQUESTED` e redespacha (desistente excluído) | ✅ |
| Reserva do cliente **não** é solta | ✅ |
| Saldo insuficiente / fora do cutoff / após coleta → `409` | ✅ |
| `PATCH .../status CANCELED` pelo motoboy → `400` | ✅ |
| App: botão com confirmação da taxa + recusa visível | ✅ |
| `pnpm --filter backend test` | ✅ 29 suítes / 242 testes |
| `pnpm --filter backend lint:check` / `build` | ✅ |
| `dart analyze` / `dart test` no `aqui_log_core` | ✅ 30 testes |
| `flutter analyze` / `flutter test` no app entregador | ✅ 30 testes |
| `pnpm --filter dashboard build` | ✅ |
| Migration em banco vivo | ❌ **NÃO EXECUTADO** neste PC (runtime está no acer) |
| `pnpm smoke` | ❌ **NÃO EXECUTADO** neste PC |
| QA em aparelho / rebuild de APK | ❌ `UX-02` |

---

## 1. O que foi feito

### Backend

- Regras puras em `courier-cancel.ts`: imediato = `acceptedAt + 5 min`;
  agendado = `pickupWindowStart − 60 min` (`FLOW-DEC-01`). Status ≠
  `ACCEPTED` recusa.
- `POST /deliveries/:id/courier-cancel` (`COURIER`): lock Redis, débito
  `COURIER_CANCEL_FEE` no ledger, pedido volta a `REQUESTED` com
  `courierId` nulo, prestador fica `available` de novo, ciclo de busca
  reabre (`dispatch(..., { reopen: true })`). Quem já aceitou continua
  excluído pelas ofertas tentadas.
- Saldo insuficiente: `409`, pedido intacto, sem saldo negativo.
- `PATCH /deliveries/:id/status { CANCELED }` pelo entregador agora é
  `400` — o atalho cancelaria o pedido e estornaria o cliente sem taxa.
  Admin/cliente continuam podendo cancelar o pedido de verdade.
- Presente do detalhe para o motoboy: `courierCancelAllowed` +
  `courierCancelUntil` (o código de recolhimento continua cortado).
- Migration `1785900000000`: valor `COURIER_CANCEL_FEE` no enum do ledger.

### App entregador

- Botão *Cancelar corrida* só no detalhe e só quando o servidor autoriza.
- Confirmação mostra o valor da taxa (`formatCents`).
- Recusa (`409`) vira SnackBar. Cartão da lista continua sem botão.

### Fora de escopo

- Índice de confiabilidade (`courier_metrics` — `LOT-01`/`SUP-03`): a
  trilha ficou em auditoria `COURIER_CANCELED` + evento do pedido.
- `PAY-01A` (política de cancelamento do **cliente**).
- `PAY-02`, rebuild de APK, QA em aparelho.

---

## 2. Verificação executada neste PC

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm --filter backend test` | PASS | 29 suítes / 242 testes |
| `pnpm --filter backend lint:check` | PASS | |
| `pnpm --filter backend build` | PASS | |
| `pnpm --filter dashboard build` | PASS | |
| `dart analyze` + `dart test` (`aqui_log_core`) | PASS | 30 testes |
| `flutter analyze` + `flutter test` (`courier_app`) | PASS | 30 testes |
| `git diff --check` | PASS | |
| `pnpm smoke` | NÃO EXECUTADO | runtime e banco vivem no acer |
| Migration em Postgres vivo | NÃO EXECUTADO | aplicar `1785900000000` no acer antes de ligar o código novo |
| QA visual / APK | NÃO EXECUTADO | `UX-02` |

O smoke ganhou um bloco COUR-02 (caminho feliz, atalho `CANCELED` do
motoboy, `AT_PICKUP`, saldo insuficiente, agendado dentro do cutoff de
60 min) e a asserção final do resumo admin passa a descontar a taxa
debitada (`fee − cancel`).

---

## 3. Como aplicar no acer

```bash
cd /home/acer/Documentos/aqui-log
git pull --ff-only origin main
pnpm db:migrate
# reiniciar a API (systemd user aqui-log-api)
pnpm smoke
```

Sem a migration, o primeiro cancelamento real falha ao gravar
`COURIER_CANCEL_FEE` no enum do Postgres.
