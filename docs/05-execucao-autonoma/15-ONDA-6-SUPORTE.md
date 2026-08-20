# Onda 6 — Suporte e reclamações

> **Objetivo:** o sistema resolve sozinho o que der, com prova, e o humano só
> entra onde importa — assédio, dano alto, disputa de dossiê e fraude.

Plano de requisitos:
[`PLANO_SUPORTE_RECLAMACOES.md`](../02-planejamento/planos/PLANO_SUPORTE_RECLAMACOES.md).
Leia inteiro antes de `SUP-01`: ele tem a filosofia, os tipos de reclamação, a
máquina de estados com SLA e o texto das árvores de auto-resolução.

## O que já está decidido (não reabra)

| Decisão | Valor |
| --- | --- |
| `DEC-13` | Estorno pós-coleta **automático até R$ 30 e só do frete**, quando o dossiê fecha contra o motoboy. Acima, ou envolvendo mercadoria: humano. |
| `DEC-16` | Juiz rápido decide sozinho **até R$ 25 por caso**; acumulado **R$ 100 por cliente / 30 dias**. |
| `DEC-17` | Contestação de 24 h antes do crédito virar sacável — é o que dá tempo do suporte agir antes do dinheiro sair. |

Os dois tetos são **editáveis no painel** (`ADMIN-07`). O plano manda começar
conservador e subir com dados; subir é operação, não deploy.

**Limites que não são negociáveis, e valem para todo o código desta onda:**

- assédio e segurança **nunca** passam pelo juiz rápido;
- todo veredito automático tem **botão de contestação**, e contestar vira
  `ESCALADO` com o dossiê anexado;
- o dossiê é **simétrico** — cliente e motoboy veem a mesma linha do tempo;
- timestamps são carimbados **server-side no momento do upload**. Hora de aparelho
  não é prova;
- responsabilidade objetiva do CDC (art. 14) e inversão do ônus da prova
  (art. 6º, VIII) valem: o dossiê serve para **resolver rápido com evidência**,
  nunca como política de não reembolsar. O cliente pode pedir reanálise humana
  uma vez.

---

## `SUP-01` — fundação e dossiê

**Depende de:** `ADMIN-01`. **Superfície:** backend + app cliente + painel.

- [ ] Schema: `tickets`, `ticket_messages`, `ticket_attachments`,
      `ticket_events`, `ticket_verdicts`, `delivery_dossiers`.
- [ ] **Coletor de dossiê** a partir dos eventos que já existem: fotos da criação
      e da coleta, `pickup_code` usado, GPS, `delivery_events`, timestamps
      server-side, prova de entrega. O sistema já tem tudo isso — a tarefa é
      juntar, não capturar de novo.
- [ ] Abertura pelo app do cliente: botões por tipo, perguntas guiadas, prazos.
- [ ] **Ack automático em menos de 5 s.** Nunca silêncio.
- [ ] Fila simples no painel.

**Aceite:** dossiê montado para uma entrega real do smoke, com todos os
timestamps server-side; abertura de ticket devolve ack dentro do SLA medido, não
estimado.

---

## `SUP-02` — auto-resolução e juiz rápido

**Depende de:** `SUP-01`, `PAY-01A`.

- [ ] Árvores de auto-resolução guiada (§3.2 do plano).
- [ ] Motor de vereditos com **tabela parametrizável** — os tetos da `DEC-13` e
      `DEC-16` são settings, não constantes de código.
- [ ] Nota de confiança do cliente (proativa; **não** consome o limite acumulado).
- [ ] Estorno via ledger com **idempotência** — reusar `PAY-01A`, não criar um
      segundo caminho de dinheiro.
- [ ] Triagem em 3 níveis.
- [ ] Painel de vereditos e contestações.

**Aceite:** caso de R$ 24 resolvido sozinho; caso de R$ 26 vai para humano; o
mesmo cliente pedindo o 5º reembolso no mês estoura o acumulado de R$ 100 e cai
para humano **mesmo com cada caso sendo elegível**; estorno repetido não paga
duas vezes.

---

## `SUP-03` — reclamação do motoboy e reputação

**Depende de:** `SUP-02`, `B2C-03`.

- [ ] Tipos de reclamação do motoboy (§2.2 do plano).
- [ ] **Proteção por dossiê**: reclamação sem dossiê contra motoboy com dossiê
      completo **não pune** o motoboy.
- [ ] `courier_metrics` com confiabilidade; atraso **com causa registrada** sai do
      índice de pontualidade (cliente ausente na coleta, falha de parada
      anterior, espera por resposta).
- [ ] Flags de fraude e limites por cliente.

---

## `ADMIN-06` — fila de suporte no painel

**Depende de:** `SUP-03`, `ADMIN-03`. Requisitos em
[`11-ONDA-2-PAINEL-ADMIN.md`](11-ONDA-2-PAINEL-ADMIN.md).

---

## `SUP-04` — painel de suporte completo

**Depende de:** `ADMIN-06`.

- [ ] Fila com SLA visível, chat, extrato, bloqueio, decisões em lote.
- [ ] Timers de SLA em job, com alerta no painel quando estourar.

---

## `SUP-05` — comunicação fora do app

**Depende de:** `SUP-04`.

- [ ] NPS automatizado depois da resolução — **isso roda sem provedor externo**.
- [ ] SMS e WhatsApp: escreva o item no runbook (provedor + credencial + custo),
      marque a parte externa como `BLOCKED` e **feche a parte que roda sozinha**.
      Não deixe a tarefa inteira parada por causa da metade que depende de conta.
