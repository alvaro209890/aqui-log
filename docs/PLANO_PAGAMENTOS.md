# Plano — Pagamentos e Carteira

> **Status:** FUTURO — hoje existe só a carteira do entregador (crédito automático
> ao entregar) e o preço é calculado no servidor. Cliente ainda não paga.
> **Data:** 2026-08-04

---

## 1. Situação atual

- **Carteira do motoboy** ✅ (já existe): crédito automático ao concluir entrega,
  extrato (`/finance/statement`), saldo.
- **Pagamento do cliente** ❌: o pedido é criado sem pagamento; não há recarga,
  cobrança nem repasse reverso.

## 2. Modelo proposto (recomendado pelo plano B2C §5-5a)

Carteira interna do cliente com **recarga antes de pedir**:

1. Cliente recarrega a carteira (PIX via QR; cartão depois).
2. Ao criar o pedido, o valor é **reservado (bloqueado)** da carteira.
3. Entrega concluída → valor reservado vira repasse pro motoboy (payout).
4. Cancelamento (cliente ou sistema) → estorno automático do valor reservado.

## 3. Tabelas/entidades futuras

- `customer_wallets` (id, customer_id, balance_cents) — ou reusar o conceito da
  carteira de courier com `owner_type`.
- `wallet_transactions` já existe — ganha `customer_id` e `type` de reserva/estorno.
- `payments` (nova): gateway ref, status, valor, método (PIX/cartão/dinheiro).
- `payouts` (nova): transferência da plataforma para o motoboy (PIX).

## 4. Regras de negócio

| Regra | Comportamento |
|---|---|
| Saldo insuficiente | Bloqueia criação do pedido (ou permite "pagar na entrega" se habilitado) |
| Reserva | `RESERVED` no momento do pedido; nunca soma ao saldo disponível |
| Estorno | Automático em CANCELED (antes de coleta: 100%; depois: decisão) |
| Repasse | Na entrega: reserva vira receita; repasse ao motoboy = courier_fee_cents |
| Comissão | Plataforma fica com (price_cents - courier_fee_cents) |
| Dinheiro na entrega | Flag por pedido; repasse manual depois (fora da carteira do cliente) |

## 5. Gateway externo (futuro, fora do MVP)

- **PIX**: Asaas / Mercado Pago / Pagar.me (o Álvaro já usa Pagar.me no AquiResolve).
- **Cartão**: mesmo gateway, checkout transparente.
- Nunca armazenar dados de cartão no nosso backend (tokenização no gateway).

## 6. Fases

| Fase | Entrega | Esforço |
|---|---|---|
| 1 | Carteira do cliente + reserva/estorno (sem gateway; saldo só via admin/PIX manual) | Médio |
| 2 | PIX via gateway (QR code) + webhook de confirmação | Médio-Alto |
| 3 | Payout automático pro motoboy (PIX) | Médio |
| 4 | Cartão (checkout transparente) | Alto |
| 5 | Dashboard financeiro (receita, repasses, inadimplência) | Baixo |

## 7. Fora de escopo

- Crédito/parcelamento, antifraude avançado, chargeback automatizado.
- "Pagar depois" sem recarga (avalista).

## 8. Decisões pendentes (para o Álvaro)

1. Recarga mínima (recomendo R$ 10).
2. Aceitar dinheiro na entrega na v1? (recomendo NÃO — só carteira).
3. Gateway preferido para PIX (Asaas vs Mercado Pago vs Pagar.me).
