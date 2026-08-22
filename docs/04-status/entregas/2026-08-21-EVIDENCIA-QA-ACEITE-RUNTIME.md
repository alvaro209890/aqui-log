# Evidência — QA de aceite no runtime real (2026-08-21)

> **PC:** acer. **Autor:** Hermes-acer. **Pedido do Álvaro:** confirmar que quem
> instala os APKs de hoje consegue criar conta e usar boa parte do app — exceto
> pagamentos (dependem da Pagar.me). **Resultado: OK** — fluxo ponta a ponta
> provado contra `https://aquilog-api.cursar.space/api/v1` (runtime de
> distribuição deste PC), nenhum bug encontrado.

## O que foi provado contra o runtime real (evidência medida)

| # | Passo | Resultado |
| --- | --- | --- |
| 1 | `POST /auth/register/customer` (conta pessoa física) | ✅ **201** + `accessToken`/`refreshToken`, role `CUSTOMER` (auto-login) |
| 2 | `POST /auth/register/courier` (conta motoboy) | ✅ registro criado com `status: PENDING` (aprovação manual de admin — design previsto) |
| 3 | Login admin → `PATCH /couriers/:id/approve` | ✅ motoboy `ACTIVE`; login do motoboy passa a funcionar (antes: 401 "Cadastro ainda nao aprovado") |
| 4 | `POST /storage/presign` + `PUT` raw + `GET` | ✅ foto da encomenda armazenada e recuperável (GET 200) |
| 5 | `POST /deliveries` (cliente, com foto) | ✅ pedido criado, pricing server-side (`courierFeeCents: 967`), ledger reserva o valor |
| 6 | Redespacho: motoboy informa posição (`PATCH /couriers/me/location`) + disponibilidade (`PATCH /couriers/me/availability`) | ✅ oferta `PENDING` no `GET /deliveries/offers/mine` para o pedido do cliente QA |
| 7 | `PATCH /deliveries/offers/:id/accept` | ✅ corrida `ACCEPTED`, `courierId` do motoboy QA |
| 8 | Ledger interno (`PAY-01`): ajuste admin auditado (`POST /finance/accounts/:owner/:id/adjust`, R$ 100, motivo obrigatório, idempotência) | ✅ `COMPLETED`; `GET /finance/statement` do cliente: crédito +10000, reserva −1209, saldo 8791 |
| 9 | Cliente lista as próprias corridas (`GET /deliveries`) | ✅ vê o pedido `ACCEPTED` com fee 967 |
| 10 | Superfície de pagamento externo | ✅ **inexistente** — varredura de controllers (audit, auth, couriers, dashboard, deliveries, devices, finance, geo, notifications, settings, storage, users) sem nenhum de gateway; sem `Pagar.me`/checkout/charge no código |

## Observações de produto (comportamento por design, não bug)

- **Cadastro de motoboy é PENDING** até aprovação manual de admin — quem instala
  o app do entregador só opera depois de aprovado. O app deve comunicar esse
  estado (tela de "aguardando aprovação").
- **Motoboy só recebe oferta após informar posição e marcar disponível** no app
  (auto-dispatch por proximidade; `GEO_PROVIDER=local` no runtime).
- `GET /finance/summary` (agregado global) é admin; participante consulta só a
  própria carteira via `statement` (pitfall 32 já registrado na skill).
- Swagger desligado em `NODE_ENV=production` (404 em `/docs*`) — por design.

## Config do runtime conferida (sem expor segredos)

`PHONE_VERIFY_ADAPTER=local` e **sem** `PHONE_VERIFY_REQUIRED` → cadastro de
cliente não trava na confirmação de celular; storage local; **zero chaves de
gateway** (`PAGARME_*`/correlatas) → confirma que pagamento externo está fora
do alcance atual, como o Álvaro esperava.

## Resíduo de QA no banco real (avisar/limpar à vontade)

Criados com sufixo `-1787361659@teste.local` (emails `qa-hermes-*`):
2 clientes, 1 motoboy (`QA Hermes Motoboy`, ACTIVE), 1 corrida `ACCEPTED`
(id `ac5b0c8f-5e32-40c0-b131-9ece193b8012`) e crédito de teste R$ 100 no
ledger do cliente. Não atrapalham a operação; podem ser removidos via SQL
controlado ou no painel admin se o Álvaro preferir banco 100% limpo.