# Onda 4 — App prestador

> **Objetivo:** o motoboy trabalha o dia inteiro pelo app sem esbarrar em tela
> que não existe — e recebe o dinheiro dele.

## Estado de onde se parte

O app (`apps/courier_app`, 9 telas) já faz cadastro dentro do app (nasce
`PENDING`), login com auto-login, disponibilidade, oferta com o **repasse visível
antes do aceite**, abas *Em andamento* / *Agenda* / *Concluídas*, coleta com
código, cancelamento com taxa (`COUR-02`), prova de entrega e carteira do ledger.
Existe APK release arm64.

Cinco pendências registradas no estado atual:

1. não avalia o cliente (o outro lado do `B2C-03`);
2. a aba *Concluídas* **não pagina** e cresce sem limite;
3. não abre navegação no app de mapas do aparelho — o mapa é ilustrativo;
4. **não saca saldo** — o dinheiro entra e não sai;
5. a classificação das abas roda no **relógio do aparelho**.

---

## `COUR-03` — prestador avalia o cliente

**Depende de:** `B2C-03`. Metade do par de avaliação mútua; o schema vem de lá.

- [ ] Tela de avaliação ao concluir a entrega, sem bloquear a próxima corrida.
- [ ] Motivos objetivos (endereço errado, cliente ausente, espera longa) além da
      nota — é o que alimenta a proteção do `SUP-03` depois.

---

## `COUR-04` — paginar a aba *Concluídas*

**Depende de:** `QA-03`.

- [ ] Paginação no backend (a lista do prestador hoje devolve tudo).
- [ ] Rolagem infinita ou "carregar mais", com estado de fim de lista.

**Aceite:** com 200 corridas concluídas semeadas, a tela abre sem travar e o
tempo da primeira renderização não cresce com o histórico.

---

## `COUR-05` — navegação no app de mapas

**Depende de:** `QA-03`.

- [ ] Botão que abre o app de mapas do aparelho na coleta e na entrega.
- [ ] Fallback quando não há app de mapas instalado (não pode crashar).

**Não fazer:** não trocar o provedor de mapas embutido. OSM/`flutter_map`
continua no piloto; provedor pago é decisão em aberto e não é desta tarefa.

---

## `COUR-07` — abas pelo relógio do servidor

**Depende de:** `QA-03`.

Hoje a classificação *Em andamento* × *Agenda* usa a hora do aparelho. O servidor
já é a autoridade real (recusa `AT_PICKUP` fora da janela com `409`), então um
relógio adiantado não libera coleta — mas move o cartão de aba antes da hora e
confunde quem está trabalhando.

- [ ] O servidor devolve a classificação, ou devolve a hora de referência.
- [ ] Diferença grande entre o relógio do aparelho e o do servidor vira aviso
      visível, não silêncio.

---

## `COUR-06` — saque

**Depende de:** `PAY-02` (e portanto do item de Pagar.me no runbook).

- [ ] Saldo **sacável** separado do saldo pendente: crédito de uma entrega só
      vira sacável **24 h depois** de `DELIVERED` (`DEC-17`), por causa da janela
      de contestação.
- [ ] Pedido de saque com valor mínimo e idempotência.
- [ ] Extrato mostra pendente, sacável, em processamento e pago, sem ambiguidade.

**Aceite:** saque de valor ainda pendente recusado com mensagem clara; dois
pedidos de saque simultâneos **não** retiram o dinheiro duas vezes; nenhum
caminho leva o saldo a ficar negativo (o mesmo princípio da `DEC-22`).

---

## O que NÃO fazer em nenhuma tarefa desta onda

- Não afrouxar o corte de papel: o app do prestador recebe `courierFeeCents` (é o
  "Você recebe"), mas **nunca** `pickupCode` nem `priceBoostProposal`. Há teste
  travando os dois lados; se um payload novo precisar passar por `present()`,
  passe.
- Não usar `pumpAndSettle` em teste que chega ao shell do prestador — o timer de
  localização de 15 s nunca assenta.
- Não reabrir o cancelamento: `COUR-02` fechou a regra (só em `ACCEPTED`, dentro
  do cutoff, taxa congelada no aceite, recusa se saldo insuficiente) e fechou o
  atalho `PATCH .../status CANCELED`, que cancelava de graça.
