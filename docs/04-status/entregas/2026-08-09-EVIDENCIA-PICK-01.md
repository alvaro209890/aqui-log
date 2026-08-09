# Evidência — `PICK-01` (código de recolhimento na coleta)

> **Data:** 2026-08-09
> **Agente:** Claude Code (Opus 5)
> **Ambiente:** desenvolvimento local no PC `acer`; nada produtivo foi tocado.
> **Banco:** descartável `aqui_log_pick01` no container `aqui-log-postgres` (porta 5433)
> **API viva:** `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`
> **Gates:** `DEC-24` + `FLOW-DEC-03` · plano seção 7
> **Commit inicial:** `a5e5909` (`main`)

## 1. O que foi entregue

`AT_PICKUP → PICKED_UP` passa a exigir **código de recolhimento válido** e
**foto de prova do prestador**, distinta da foto que o cliente enviou na criação.

| Peça | Onde |
| --- | --- |
| Migration aditiva (código, tentativas, bloqueio, verificação, liberação) | `apps/backend/src/database/migrations/1785400000000-DeliveryPickupCode.ts` |
| Regras puras (geração, formato, comparação, tentativa/bloqueio) | `apps/backend/src/deliveries/pickup-code.ts` |
| Geração no aceite, validação, alerta e recorte por papel | `apps/backend/src/deliveries/deliveries.service.ts` |
| Fallback admin/suporte auditado | `POST /deliveries/:id/pickup-code/override` |
| Tela de coleta do motoboy pedindo o código | `apps/courier_app/lib/screens/proof_screen.dart` |
| Código visível ao cliente | `apps/customer_app/lib/screens/delivery_detail_screen.dart` |
| Smoke com as asserções do código | `scripts/smoke-test.sh` |

### Decisão de desenho registrada

O plano (seção 7, regra 1) diz que o código é "revelado ao prestador no fluxo de
coleta". O que a implementação revela ali é a **exigência** do código — nunca o
número. A regra 3 da mesma seção ("o prestador informa o código; o servidor
valida") só fecha assim: devolver o valor ao app do motoboy transformaria o
controle em enfeite. O app do entregador recebe `pickupCodeRequired`,
`pickupCodeAttemptsLeft` e `pickupCodeBlockedUntil`; o valor vai só para o
cliente (que o mostra) e para admin/suporte.

O valor do código **não** entra em nenhum registro de auditoria.

## 2. Migration em banco vivo, com rollback ensaiado

```
$ psql -h localhost -p 5433 -U aqui_log -d postgres -c "CREATE DATABASE aqui_log_pick01;"
CREATE DATABASE

$ DATABASE_NAME=aqui_log_pick01 npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
Migration InitialSchema1784082573425 has been executed successfully.
… (10 migrations)
Migration DeliveryPickupCode1785400000000 has been executed successfully.
```

Colunas criadas (todas opcionais; só o contador é `NOT NULL`, e com `DEFAULT 0`):

```
         column_name         |        data_type         | is_nullable | column_default
-----------------------------+--------------------------+-------------+----------------
 pickup_code                 | character varying        | YES         |
 pickup_code_attempts        | integer                  | NO          | 0
 pickup_code_blocked_until   | timestamp with time zone | YES         |
 pickup_code_override_by_id  | uuid                     | YES         |
 pickup_code_override_reason | text                     | YES         |
 pickup_code_verified_at     | timestamp with time zone | YES         |
```

Rollback ensaiado **com um pedido legado dentro da tabela**
(`AQL-LEGADO-PICK`, inserido direto no banco antes do revert):

```
Migration DeliveryPickupCode1785400000000 has been reverted successfully.
== depois do revert ==     colunas_pickup = 0   |  AQL-LEGADO-PICK | REQUESTED
Migration DeliveryPickupCode1785400000000 has been executed successfully.
== reaplicada ==           colunas_pickup = 6   |  AQL-LEGADO-PICK | pickup_code vazio | attempts 0
```

A linha legada sobreviveu ao ciclo inteiro, sem código e sem erro.

## 3. Comportamento provado em HTTP vivo

Roteiro executado contra a API em `:3011` (script de sessão, não versionado).

### 3.1 Bloqueio após 5 tentativas erradas (`FLOW-DEC-03`)

```
pedido d87ee95f-a90f-4d2e-a48d-541fc004ed24 | codigo do cliente: 7888
tentativa 1 -> HTTP 400 :: Codigo de recolhimento invalido. Restam 4 tentativas.
tentativa 2 -> HTTP 400 :: Codigo de recolhimento invalido. Restam 3 tentativas.
tentativa 3 -> HTTP 400 :: Codigo de recolhimento invalido. Restam 2 tentativas.
tentativa 4 -> HTTP 400 :: Codigo de recolhimento invalido. Restam 1 tentativas.
tentativa 5 -> HTTP 429 :: Muitas tentativas erradas. A coleta ficou bloqueada temporariamente; peca liberacao ao suporte.
tentativa 6 -> HTTP 429 :: Muitas tentativas erradas. Tente de novo em 15 min ou peca liberacao ao suporte.
-- codigo CERTO durante o bloqueio:
HTTP 429 :: Muitas tentativas erradas. Tente de novo em 15 min ou peca liberacao ao suporte.
-- status do pedido: AT_PICKUP
-- notificacao ao cliente: "Código de recolhimento bloqueado"
-- auditoria:
      1 DELIVERY_CREATED
      1 DELIVERY_OFFER_ACCEPTED
      1 DELIVERY_PICKUP_CODE_BLOCKED
      4 DELIVERY_PICKUP_CODE_FAILED
      1 DELIVERY_STATUS_CHANGED
```

Durante o bloqueio nem o código certo passa, e o pedido não sai de `AT_PICKUP`.

### 3.2 Fallback só de admin/suporte, com motivo e auditoria (`DEC-24`)

```
-- entregador tenta liberar sozinho:   HTTP 403 :: Forbidden resource
-- admin sem motivo suficiente:        HTTP 400 :: ["O motivo precisa ter ao menos 10 caracteres"]
-- admin com motivo:                   HTTP 201
-- coleta apos a liberacao:            HTTP 200 :: status PICKED_UP
-- auditoria do override:
{
  "action": "DELIVERY_PICKUP_CODE_OVERRIDE",
  "metadata": {
    "code": "AQL-MSLXT2R6RKR",
    "reason": "Cliente perdeu o codigo; confirmado por telefone e foto do documento",
    "courierId": "d73bbcb2-4072-4d0a-ba4d-eea9aa51b494",
    "alternativeProofUrl": null
  }
}
```

A liberação **não** avança o status sozinha: ela destrava a próxima coleta, que
continua exigindo a foto do prestador.

### 3.3 Foto do cliente reapresentada como prova

```
HTTP 400 :: A foto de coleta precisa ser do prestador, diferente da foto enviada pelo cliente
```

### 3.4 Pedido legado (sem `pickup_code`)

```
-- visao do entregador: {"pickupCodeRequired":false,"pickupCodeAttemptsLeft":null,"haCodigo":false}
coleta so com foto -> HTTP 200 :: status PICKED_UP
```

## 4. Smoke B2C

`scripts/smoke-test.sh` ganhou as asserções do pacote: o cliente **precisa** ver
4 dígitos, o entregador **não pode** receber o campo `pickupCode`, coleta sem
código é recusada com `400`, código errado é recusado e consome uma tentativa
(`pickupCodeAttemptsLeft` cai de 5 para 4), e só então o código certo conclui.

```
$ PORT=3011 API_URL=http://localhost:3011/api/v1 bash scripts/smoke-test.sh   (3×)
Smoke test aprovado: AQL-MSLXQSHONR0 (762ce6cb-c386-4619-baa6-753f3c59e2f0)
Smoke test aprovado: AQL-MSLXQUSE57R (aab61fee-b01c-4d3c-933f-8f9726488b69)
Smoke test aprovado: AQL-MSLXQWGCBT2 (dec456cd-364c-4c0f-bb61-a288b51f512a)
```

## 5. Build, lint e testes

| Comando | Resultado |
| --- | --- |
| `pnpm build` | ✅ backend (nest) + dashboard (vite, 2442 módulos) |
| `pnpm lint` | ✅ eslint backend + `tsc -b` dashboard |
| `pnpm test` | ✅ **14 suítes / 96 testes** (eram 70) |
| `pnpm smoke` | ✅ 3 execuções, códigos distintos |
| `cd apps/courier_app && flutter analyze && flutter test` | ✅ sem issues; **11 testes** |
| `cd apps/customer_app && flutter analyze && flutter test` | ✅ sem issues; **13 testes** |
| `cd packages/aqui_log_core && dart analyze && dart test` | ✅ sem issues; **10 testes** |

Testes adicionados nesta rodada:

- `pickup-code.spec.ts` — geração de 4 dígitos (500 amostras), formato, normalização,
  comparação, contagem de tentativas e expiração do bloqueio;
- `pickup-code.flow.spec.ts` — coleta ponta a ponta: código certo, ausente, errado,
  bloqueio na 5ª, foto do cliente recusada, foto obrigatória mesmo com código certo,
  pedido legado, quem vê o código e as quatro regras do fallback;
- `delivery-pickup-code.migration.spec.ts` — migration aditiva e rollback simétrico;
- DTO: motivo do fallback e `pickupCode` opcional em `UpdateDeliveryStatusDto`;
- Flutter/Dart: tela de coleta pedindo o código, pedido legado sem campo, tela
  bloqueada, aviso no detalhe do motoboy, código no detalhe do cliente e envio do
  campo pela API.

## 6. Limitações e o que ficou de fora

- **APK e QA em emulador/dispositivo: NÃO EXECUTADO.** A tela de coleta foi
  provada por teste de widget, não em aparelho. Continua em `UX-02`.
- Dashboard: admin/suporte já recebem `pickupCode` e o motivo da liberação pela
  API, mas **nenhuma tela nova foi construída** no painel — o fallback é chamado
  por API. Uma tela de suporte é trabalho de `SUP-*`/`ADMIN-*`.
- O bloqueio dura **15 minutos**, valor fixo em código (`FLOW-DEC-03` decidiu as
  5 tentativas, não a duração). Não foi exposto no admin.
- Nenhum serviço cloud foi tocado, provisionado ou publicado.
- O banco `aqui_log_pick01` é descartável e não tem valor; nenhum dado real.
