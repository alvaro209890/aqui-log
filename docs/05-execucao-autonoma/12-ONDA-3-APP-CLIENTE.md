# Onda 3 — App cliente

> **Objetivo:** o cliente vê o preço antes de confirmar, acompanha a busca em
> tempo real e fecha o ciclo de confiança avaliando quem entregou.

Planos de requisitos:
[`PLANO_CONFIANCA_E_PRECO.md`](../02-planejamento/planos/PLANO_CONFIANCA_E_PRECO.md)
e [`PLANO_FLUXO_CLIENTE_PRESTADOR.md`](../02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md).

## Estado de onde se parte

O app (`apps/customer_app`, 10 telas) já faz cadastro com auto-login,
confirmação de telefone por código (`B2C-04`), pedido com foto obrigatória,
escolha entre agora e agendar, código de recolhimento visível após o aceite,
acompanhamento com aviso de demora, histórico, avaliação e carteira. Existe APK
release arm64 apontando para a API pública.

Três buracos conhecidos:

1. o cliente **só descobre o preço depois de criar o pedido** (`B2C-02B`);
2. a avaliação é **unilateral** — o prestador não avalia de volta (`B2C-03`);
3. o acompanhamento é **polling**, embora os eventos
   `delivery:warning`, `delivery:dispatch-ended` e `delivery:price-boosted` já
   existam no gateway desde o `DISP-02`.

---

## `B2C-02B` — prévia de preço antes de confirmar

**Depende de:** `QA-03`.

- [ ] Endpoint de cotação que devolve **o mesmo cálculo** da criação, com
      `breakdown` e `pricingVersion`, sem criar pedido.
- [ ] Tela mostra a composição legível: base, km do modo, adicional de peso,
      adicional de tamanho, piso aplicado (quando aplicável).
- [ ] Cotação e criação **não podem divergir**: mesma entrada, mesmo resultado —
      trave isso com teste, não com cuidado.
- [ ] A criação continua **ignorando** qualquer preço vindo do app.

**Aceite:** o app nunca envia `priceCents` nem `courierFeeCents` (`INV-03`); teste
prova que alterar as settings entre a cotação e a criação **não** aplica preço
velho ao pedido novo — e que o pedido **já criado** fica intacto (`DEC-19`).

**Não fazer:** não cachear cotação no app "para economizar chamada". Preço é do
servidor, e cache é como preço divergente nasce.

---

## `B2C-03` — avaliação mútua

**Depende de:** `QA-03`. **Superfície:** backend + os dois apps.

Está `BLOCKED` no backlog há semanas esperando "baseline estável e migração de
ratings definida". A baseline existe desde o `PAY-01`/`OPS-01A`; o que falta é
decidir a migração dos ratings atuais — e isso é técnico, não é decisão do dono.

- [ ] Uma avaliação **por papel e por entrega**: cliente→prestador e
      prestador→cliente, com origem explícita na tabela.
- [ ] Migration aditiva sobre a `ratings` existente, preservando as avaliações já
      feitas (que hoje são todas do cliente).
- [ ] Janela para avaliar e regra de o que acontece se o outro lado não avaliar.
- [ ] Nenhum lado vê a nota do outro antes de dar a sua — senão vira retaliação.

**Aceite:** rollback ensaiado com avaliação legada dentro da tabela; teste prova
que o mesmo papel não avalia duas vezes a mesma entrega.

---

## `B2C-03A` — exibir reputação

**Depende de:** `B2C-03`.

- [ ] Média, contagem e contexto no app e no painel.
- [ ] Nada de dado sensível: sem nome completo de quem avaliou, sem comentário
      cru vazando entre papéis.
- [ ] Contagem baixa aparece como "poucas avaliações", não como média enganosa.

---

## `CLI-01` — acompanhar por WebSocket

**Depende de:** `QA-03`.

O gateway **já emite** `delivery:warning`, `delivery:dispatch-ended` e
`delivery:price-boosted` desde o `DISP-02` (2026-08-10). O app não consome. Esta
tarefa é só do lado do app.

- [ ] Cliente de socket com reconexão e *backoff*.
- [ ] Polling vira **fallback**, não o caminho principal — e continua funcionando
      quando o socket cai.
- [ ] Estado da tela reconcilia ao voltar do background, sem duplicar aviso.

**Aceite:** com o socket derrubado à força, o app continua correto pelo fallback;
com o socket vivo, o aviso de demora aparece **sem refresh manual**.

**Não fazer:** não mudar o contrato do gateway. Se algo faltar no payload, isso é
tarefa nova no [`01-ONDAS.md`](01-ONDAS.md), não um remendo aqui.

---

## `CLI-02` — cliente escolhe o valor do aumento

**Depende de:** `CLI-01`.

Hoje a proposta de aumento usa **só** o percentual da settings
(`dispatchPriceBoostPercent`, padrão 20%) — o cliente aceita ou não aceita, sem
poder oferecer mais.

- [ ] Cliente propõe um valor dentro de um teto configurável no admin.
- [ ] O servidor **recalcula e valida** — o valor do app é sugestão, nunca
      autoridade.
- [ ] `POST /deliveries/:id/price-boost/consent` continua sendo o **único**
      caminho que muda o preço de um pedido em busca, com auditoria
      anterior→novo, evento, notificação e reabertura da busca.

**Aceite:** valor acima do teto recusado com `400`; corrida entre dois
consentimentos simultâneos não gera preço duplicado — a janela teórica sem lock
foi registrada na auditoria de 2026-08-10 e **é para ser fechada aqui**.
