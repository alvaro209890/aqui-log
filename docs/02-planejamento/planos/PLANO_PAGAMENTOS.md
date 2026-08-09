# Plano técnico — Carteira, pagamentos e repasses

> **Atualizado:** 2026-08-09
> **Status:** especificação; ledger autorizado (`DEC-05`), gateway definido = **Pagar.me v5** (`DEC-06`, padrão AquiResolve); cobrança real depende de conta/credenciais Pagar.me
> **Roadmap:** `PAY-01`, `PAY-01A`, `PAY-01B` e `PAY-02`
> **Pré-requisito:** preço v2 (`B2C-02`) estável e política de cancelamento aprovada

## 1. Separar os conceitos

| Conceito | Significado |
| --- | --- |
| Preço | Valor congelado do pedido, calculado pelo servidor |
| Carteira | Visão contábil do saldo do participante |
| Reserva | Parte do saldo do cliente indisponível enquanto a entrega está aberta |
| Liquidação | Conversão da reserva em receita da plataforma e obrigação com o motoboy |
| Pagamento | Entrada de dinheiro confirmada por gateway ou operação autorizada |
| Repasse/payout | Saída real de dinheiro para o motoboy |

A carteira atual do motoboy é um crédito interno do MVP. Ela não comprova recebimento financeiro real nem substitui uma integração de payout.

## 2. Decisão arquitetural recomendada

Usar **ledger imutável de partidas balanceadas**, com projeções de saldo, em vez de atualizar apenas uma coluna `balance_cents`.

Cada evento financeiro gera lançamentos vinculados por uma transação lógica:

```text
recarga confirmada     gateway-clearing → cliente-disponível
reserva do pedido      cliente-disponível → cliente-reservado
cancelamento integral  cliente-reservado → cliente-disponível
entrega concluída      cliente-reservado → receita-plataforma + pagar-motoboy
payout confirmado      pagar-motoboy → gateway-clearing
```

Invariantes:

- soma dos lançamentos de cada transação = zero;
- valores sempre em centavos inteiros e positivos no contrato de entrada;
- ledger não é editado/apagado; correção ocorre por transação reversa;
- cada operação externa ou de domínio possui chave idempotente única;
- saldo disponível nunca fica negativo;
- reserva, liquidação e estorno ocorrem em transação de banco com lock adequado.

## 3. Modelo de dados proposto

Não ampliar `wallet_transactions` de modo ambíguo sem migração planejada. Preferir modelo genérico:

| Entidade | Campos essenciais |
| --- | --- |
| `financial_accounts` | `id`, `owner_type`, `owner_id`, `purpose`, `currency`, status |
| `ledger_transactions` | `id`, `type`, `reference_type/id`, `idempotency_key`, status, metadata, timestamps |
| `ledger_entries` | `transaction_id`, `account_id`, `direction`, `amount_cents` |
| `payment_intents` | pedido/recarga, gateway, método, valor, status, referência externa |
| `payouts` | courier, valor, gateway, status, referência externa |

Projeções de saldo podem ser tabela/cache, mas devem ser reconstruíveis a partir do ledger.

## 4. Estados

### 4.1 Reserva do pedido

```text
NONE → RESERVED → SETTLED
          └──────→ RELEASED
```

- `RESERVED`: saldo bloqueado após criação confirmada;
- `SETTLED`: entrega concluída e valor distribuído contabilmente;
- `RELEASED`: cancelamento/expiração devolveu saldo disponível.

Transições repetidas retornam o resultado anterior pela mesma chave idempotente.

### 4.2 Payment intent

```text
CREATED → PENDING → PAID
    │         ├──→ EXPIRED
    │         └──→ FAILED
    └────────────→ CANCELED
PAID → REFUND_PENDING → REFUNDED | REFUND_FAILED
```

O estado interno é atualizado por webhook validado e reconciliação; redirecionamento do navegador/app não confirma pagamento.

## 5. `PAY-01` — ledger interno sem gateway

Objetivo: provar contabilidade e regras usando apenas saldo de teste creditado por operação administrativa auditada.

### Entregas

1. contas e ledger imutável;
2. saldo disponível e reservado do cliente;
3. reserva atômica ao confirmar pedido;
4. liberação em cancelamento/expiração;
5. liquidação idempotente em `DELIVERED`;
6. obrigação contábil com o motoboy, sem payout real;
7. extrato legível nos apps e dashboard;
8. ajuste administrativo somente com papel apropriado, motivo e auditoria.

### Política de cancelamento a fechar

#### Cliente (reserva)

| Momento | Recomendação inicial |
| --- | --- |
| Antes de aceite | liberar 100% |
| Aceito, antes da coleta | regra configurável com possível taxa; decisão explícita |
| Após coleta | não automatizar na v1; abrir análise administrativa |
| Cancelamento do sistema/sem motoboy | liberar 100% |

#### Prestador (saldo interno) — `DEC-22`

| Momento | Regra decidida |
| --- | --- |
| Pré-coleta, dentro do cutoff | Debita `courier_cancel_fee_cents` (congelada no aceite) do saldo disponível; pedido volta à fila |
| Pré-coleta, fora do cutoff | Recusa; só suporte/admin redespacha |
| Saldo < taxa | Cancelamento **recusado** (sem saldo negativo) |
| Pós-coleta | Só suporte (custódia/devolução) |

Revoga a regra antiga “desistência sem penalidade dura” pré-coleta. Detalhe:
[PLANO_FLUXO_CLIENTE_PRESTADOR.md](PLANO_FLUXO_CLIENTE_PRESTADOR.md) §6.

### Saldo do prestador e saque — `DEC-23`

O crédito MVP do motoboy evolui para conta do ledger. Dinheiro real ao prestador
só via **saque** (`PAY-02`), após janela de contestação de **24 h** (`DEC-17`).
Taxas de cancelamento do prestador são lançamentos do ledger (`PAY-01A` / `COUR-02`).

### Aceite

- duas tentativas simultâneas não reservam além do saldo;
- replay de create/cancel/deliver não duplica lançamentos;
- falha no meio da transação não altera saldos parcialmente;
- soma do ledger fecha e projeção pode ser reconstruída;
- autorização impede cliente de consultar carteira alheia;
- testes cobrem reserva, liberação, liquidação, ajuste e concorrência.

## 6. `PAY-02` — PIX por gateway (**Pagar.me v5**, `DEC-06` decidida 2026-08-09)

Só implementar após credenciais/sandbox Pagar.me e `PAY-01` validado. Escolha de
fornecedor **fechada**: Pagar.me, mesmo padrão do AquiResolve (experiência real em
produção naquele projeto — backend Node → Pagar.me v5, PIX funcionando).

### Padrão de integração (estilo AquiResolve)

- **Cobrança:** backend cria a cobrança PIX na Pagar.me (`PAGARME_SECRET_KEY`,
  `PAGARME_BASE_URL`); app/dashboard exibem QR code + copia-e-cola.
- **Confirmação:** fonte da verdade = **webhook** assinado
  (`X-Hub-Signature: sha256=<hmac>`, validar com HMAC-SHA256 sobre o raw body);
  rota pública (fora de auth), idempotência por `eventId` (retries não reprocessam),
  IP whitelist dos IPs publicados pela Pagar.me. Eventos: `order.paid`,
  `charge.refunded`, etc.
- **Polling do app** (fallback): enquanto o cliente está na tela do QR, consulta
  `GET /payments/:id/status` a cada ~5 s; webhook continua sendo a única
  confirmação confiável com app fechado.
- **Reembolso/devolução:** por API da Pagar.me; refletido no ledger como
  transação reversa.
- **Split/payout do motoboy:** avaliar quando `PAY-02` estiver estável — no
  AquiResolve o payout ao prestador é manual pelo painel (comprovante + saldo),
  não split automático; validar disponibilidade real na conta do Aqui Log.
- **Reconciliação:** job periódico compara `payment_intents`/`payouts` internos
  com o estado na Pagar.me; divergência gera alerta.

### Segurança e operação

- segredo apenas no servidor/secret manager;
- verificar assinatura, timestamp e replay do webhook;
- armazenar payload mínimo necessário, com proteção de dados;
- processar webhook em transação e responder idempotentemente;
- job de reconciliação compara estados internos e gateway;
- nunca armazenar dados brutos de cartão;
- logs não exibem token, QR completo ou dados sensíveis.

### Aceite

- criar cobrança PIX e confirmar por webhook de sandbox;
- webhook duplicado e fora de ordem não duplica crédito;
- expiração e devolução refletidas no ledger;
- reconciliação detecta divergência;
- fluxo de erro é visível ao cliente e ao admin;
- procedimento de contingência e suporte documentado.

## 7. Ordem futura

| Ordem | ID | Entrega | Gate |
| --- | --- | --- | --- |
| 1 | `PAY-01` | Ledger + reserva/liberação | autorização de pagamentos + `B2C-02` |
| 2 | `PAY-01A` | Liquidação e política completa de cancelamento | regras aprovadas |
| 3 | `PAY-01B` | Operação/admin e extratos | `PAY-01A` |
| 4 | `PAY-02` | Recarga PIX + webhook + reconciliação | `DEC-06` ✅ Pagar.me; credenciais/sandbox + `PAY-01` |
| 5 | futuro | Payout real ao motoboy | viabilidade regulatória/operacional |
| 6 | futuro | Cartão tokenizado | PIX estável e necessidade comprovada |

## 8. Decisões pendentes

- `PAY-DEC-01` (`DEC-05`) — **decidida** (2026-08-09): autorizado `PAY-01` (ledger interno sem gateway).
- `PAY-DEC-02` (`DEC-13`) — política de cancelamento do **cliente** após aceite/coleta.
- `PAY-DEC-02b` (`DEC-22`) — **decidida** a lógica da taxa do prestador; valores em `FLOW-DEC-01`.
- `PAY-DEC-03` — recarga mínima e saldo máximo.
- `PAY-DEC-04` (`DEC-06`) — **decidida** (2026-08-09): gateway = **Pagar.me v5** (padrão AquiResolve); falta conta/credenciais do Aqui Log.
- `PAY-DEC-05` — quem assume taxas e devoluções.
- `PAY-DEC-06` (`DEC-17`) — **decidida** (2026-08-09): crédito sacável **24 h** após `DELIVERED`.
- `PAY-DEC-07` — necessidade fiscal/contábil antes do piloto pago.
- `DEC-23` — **decidida:** modelo = saldo interno sacável (implementação ainda `PAY-*`).

## 9. Fora de escopo inicial

- cartão, parcelamento e crédito;
- dinheiro na entrega;
- split/payout automático sem validação jurídica e operacional;
- chargeback/antifraude avançado;
- saldo negativo ou “pagar depois”;
- produção cloud como efeito colateral deste plano.
