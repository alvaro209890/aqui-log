# Onda 5 — Pagamento

> **Objetivo:** o cliente põe saldo sozinho e o motoboy tira o dele. Hoje o
> produto é pré-pago e **o único caminho de crédito é um admin ajustando à mão** —
> ou seja, um cliente que instala o APK não consegue publicar pedido.

Plano de requisitos: [`PLANO_PAGAMENTOS.md`](../02-planejamento/planos/PLANO_PAGAMENTOS.md).

## Estado de onde se parte

O `PAY-01` (2026-08-11) entregou o ledger interno: contas de cliente e prestador,
lançamentos imutáveis, reserva na criação do pedido, liberação no cancelamento,
liquidação em `DELIVERED`, `402` sem saldo, ajuste administrativo auditado,
extrato e resumo com autorização por papel. O `COUR-02` (2026-08-19) somou o
débito da taxa de desistência do prestador.

Falta: política de cancelamento **do cliente**, crédito manual com tela, e
**recarga real**.

## Decisões que valem aqui

- `DEC-05` — ledger sem gateway: já implementado.
- `DEC-06` — gateway é **Pagar.me v5**, padrão AquiResolve: cobrança PIX com
  QR code e copia-e-cola, confirmação por **webhook assinado HMAC-SHA256**
  (`X-Hub-Signature`) com idempotência, polling do app como reforço, reembolso
  por API.
- `DEC-17` — crédito do prestador vira sacável **24 h** após `DELIVERED`.
- `DEC-13` (= `PAY-DEC-02`) — cancelamento **depois da coleta**: estorno do frete
  até R$ 30 automático quando o dossiê fecha; acima disso, humano.
- `DEC-02` — multa do cliente hoje é **R$ 0** (provisório, editável no admin).

Sub-decisões do plano ainda sem dono, **adotadas como provisórias e editáveis no
admin** (registre em [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md) para o Álvaro
confirmar depois):

| # | Adotado |
| --- | --- |
| `PAY-DEC-03` | recarga mínima **R$ 10**, saldo máximo **R$ 500** |
| `PAY-DEC-05` | a **plataforma absorve** a taxa do gateway na recarga; devolução volta o valor cheio ao saldo |
| `PAY-DEC-07` | exigência fiscal/contábil fica no runbook — depende de CNPJ, não de código |

---

## `PAY-01A` — política de cancelamento do cliente e liquidação idempotente

**Depende de:** `QA-03`. Não depende de credencial nenhuma.

- [ ] Cancelamento do cliente **antes do aceite**: libera a reserva inteira.
- [ ] **Depois do aceite e antes da coleta**: libera a reserva, aplica a multa do
      cliente (hoje R$ 0, mas o caminho tem que existir e ser configurável) e o
      prestador não é penalizado.
- [ ] **Depois da coleta**: não é cancelamento, é caso de suporte — abre o
      caminho do `SUP-02` e a custódia continua com o prestador.
- [ ] Liquidação **idempotente**: `DELIVERED` processado duas vezes não paga duas
      vezes. Chave de idempotência no ledger, não confiança no chamador.

**Aceite:** cada transição com teste de saldo antes/depois; replay do mesmo evento
não move dinheiro; nenhum caminho gera saldo negativo.

---

## `PAY-01B` — crédito manual auditado

**Depende de:** `PAY-01A`.

- [ ] A rota `POST /finance/accounts/customer/:id/adjust` ganha motivo
      obrigatório, teto e trilha.
- [ ] Só papel autorizado; `SUPPORT` lê e não credita.

---

## `ADMIN-03` — financeiro no painel

**Depende de:** `PAY-01B`, `ADMIN-01`. Requisitos em
[`11-ONDA-2-PAINEL-ADMIN.md`](11-ONDA-2-PAINEL-ADMIN.md).

---

## `PAY-02` — recarga PIX pela Pagar.me

**Depende de:** `PAY-01A` **e do item "conta Pagar.me" do runbook.**

Esta é a tarefa modelo do padrão "vai até o fim e para no *cole a chave*". Faça
tudo o que não depende da credencial, prove com sandbox/mock, e só então pare.

### Parte que roda sem credencial nenhuma

- [ ] Adapter de gateway atrás de interface, com **implementação falsa** que gera
      QR fake e dispara webhook local — o mesmo padrão do `STORAGE_DRIVER=local`
      e do adapter de telefone da `B2C-04`, que já são o jeito deste repo.
- [ ] Criação de cobrança, persistência do estado e reconciliação.
- [ ] **Verificação da assinatura HMAC-SHA256 do webhook**, com teste de
      assinatura inválida, corpo adulterado e replay.
- [ ] **Idempotência do webhook**: o mesmo evento chegando 3 vezes credita 1 vez.
      Gateway reenvia; isso não é hipótese.
- [ ] Polling do app como reforço quando o webhook atrasa.
- [ ] Tela de recarga no app cliente, com QR e copia-e-cola.
- [ ] Reembolso por API, idempotente.

### Parte que exige a credencial

- [ ] Escrever em [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md): criar conta
      Pagar.me do **Aqui Log** (não reusar a do AquiResolve — CNPJ e faturamento
      diferentes), pegar chave e secret do webhook, colar em
      `~/.config/aqui-log/env` (**fora do repo**), apontar a URL do webhook para
      `https://aquilog-api.cursar.space/api/v1/...`.
- [ ] Marcar `PAY-02` como `BLOCKED` e **seguir para a próxima tarefa**.
- [ ] Quando a credencial existir: trocar o adapter, provar contra o sandbox,
      rodar o portão e fechar.

**Aceite (parte sem credencial):** o fluxo inteiro passa com o adapter falso, e
existe teste que **falha** se a verificação de assinatura for removida.

**Não fazer:** nunca commitar chave, secret ou `.env`. Nunca creditar saldo com
base só no retorno do app — o webhook assinado é a autoridade.
