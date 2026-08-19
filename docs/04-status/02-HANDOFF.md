# Handoff vigente

- **Data/hora:** 2026-08-19
- **Agente:** Grok 4.6
- **Tarefa:** `COUR-02` — cancelamento do prestador com taxa no ledger
- **Branch/commit inicial:** `main` @ `0d3ea55`
- **Estado:** entregue, commitado e pushado (`9492a53`). Migration aplicada
  no acer, API reiniciada, smoke vivo **aprovado** (bloco COUR-02 incluso).

## Resultado

Evidência: `docs/04-status/entregas/2026-08-19-EVIDENCIA-COUR-02.md`.

O motoboy desiste só em `ACCEPTED`, dentro do cutoff (`DEC-22` /
`FLOW-DEC-01`). A taxa congelada no aceite sai do saldo dele; o pedido
volta à busca sem soltar a reserva do cliente; quem desistiu não recebe
a mesma corrida de volta. Saldo insuficiente, coleta já começada e prazo
esgotado recusam com `409`. O atalho `PATCH .../status CANCELED` pelo
entregador foi fechado (`400`).

App: botão *Cancelar corrida* no detalhe, com confirmação do valor.

## Coisas que o próximo agente precisa saber

1. **Imediato vs agendado no relógio.** A fórmula "âncora − cutoff" do
   plano só fecha no agendado. No imediato a âncora É o aceite, então o
   cutoff é uma janela **depois** dele (senão o cancelamento imediato
   seria impossível). Código e comentário em `courier-cancel.ts`.
2. **Não é `CANCELED`.** `CANCELED` encerra o pedido e devolve a reserva
   do cliente. COUR-02 devolve a `REQUESTED` e redespacha. Por isso a
   rota é `POST /deliveries/:id/courier-cancel`, não o `PATCH` de status.
3. **Índice de confiabilidade não existe.** `courier_metrics` é
   `LOT-01`/`SUP-03`. A desistência fica na auditoria `COURIER_CANCELED`
   e no evento do pedido — não inventar a tabela nesta fatia.
4. **Migration `1785900000000` é só o enum.** `ALTER TYPE ... ADD VALUE`.
   O `down` recria o tipo; falha se já houver lançamento com o valor novo.
5. **Smoke.** O bloco COUR-02 assume o motoboy principal em
   `DISP_LATITUDE` (estado no fim do DISP-02) e desconta a taxa no
   `courierObligationCents` final. O agendado de cutoff procura a
   oferta em qualquer motoboy do bloco (o auto-dispatch não garante o
   principal). Rodar com `PORT=3011` — o `.env` do repo no acer ainda
   aponta 3001.

## Não feito e bloqueios

- QA em aparelho e rebuild de APK (`UX-02`).
- `PAY-02` (recarga) — bloqueado por credenciais Pagar.me.
- Motivo na recusa de cadastro (`ADMIN-02`).
- `PAY-01A` (taxa de cancelamento do **cliente**) — fora deste ID.

## Próximo passo recomendado

1. **`UX-02`** — QA visual (APKs + fila de aprovação logada + este botão).
2. **`PAY-02`** passa na frente quando houver conta Pagar.me.

## Mensagem de retomada

> `COUR-02` fechou: o motoboy desiste com taxa no saldo, o pedido volta
> à busca, saldo insuficiente recusa. Migration e smoke no acer
> passaram. Fila: `UX-02` (aparelho) e `PAY-02` (recarga, bloqueado por
> Pagar.me). `.env` do acer ainda diz `PORT=3001`; a API sobe em **3011**.
