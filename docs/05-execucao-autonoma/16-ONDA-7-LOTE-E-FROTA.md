# Onda 7 — Lote manual e frota

> **Objetivo:** o motoboy pega vários pedidos de uma vez quando *ele* quiser, e o
> operador enxerga a operação no mapa sem virar vigilância.

Planos de requisitos:
[`PLANO_LOTE_MULTI_PEDIDO.md`](../02-planejamento/planos/PLANO_LOTE_MULTI_PEDIDO.md)
e [`PLANO_FROTA_DASHBOARD.md`](../02-planejamento/planos/PLANO_FROTA_DASHBOARD.md).

## ⚠️ Antes de qualquer coisa: o que foi cortado

A `DEC-07` (2026-08-19) decidiu que **não haverá agrupamento automático de
rotas**. Consequências, sem exceção:

- **`TRIP-00`, `TRIP-01` e `TRIP-02` estão fora do roadmap.** Não implemente, não
  "prepare o terreno", não crie tabela pensando neles.
- O gate de descoberta de densidade (`TRIP-00`) **deixou de ser gate**: `LOT-01`
  nunca dependeu dele mesmo (`DEC-08`: quem busca o lote é o motoboy), e agora
  ninguém depende.
- O texto dos planos que fala em agrupamento automático vira histórico. Ao mexer
  nesses arquivos, marque a seção como superada em vez de apagar.

## Decisões que valem aqui

| Decisão | Valor |
| --- | --- |
| `DEC-08` | Lote manual convive com auto-dispatch; ofertas individuais continuam em paralelo. |
| `DEC-09` | Bloco agendado por **candidatura livre**, elegibilidade filtrada pelo índice de pontualidade. Sem pré-alocação. |
| `DEC-10` | Janela de espera na coleta do lote = **15 min**; depois disso pula para a próxima parada, com aviso e nova estimativa. |
| `DEC-11` | ETA divergente > **5 min** avisa; **120 s** sem resposta com pedido não coletado oferece redespacho; tolerância de **15 min** no índice de pontualidade (janela móvel de 30 dias). |
| `DEC-12` | Trilha: **crua 7 d / agregada 30 d / diária 90 d**, com job de limpeza. |
| `DEC-14` | Ocioso **coarsificado (~1 km)** na zona operacional, **oculto fora**; exato só em viagem ativa. |
| `DEC-15` | **Sem pagamento de retorno vazio.** No lugar: **adicional de longa distância por km acima de um limiar**, embutido no preço e no repasse. Provisórios editáveis: limiar **15 km**, **+20%** sobre o km do modo, só na parte excedente. |

### Sobre a `DEC-15`, porque é contraintuitiva

O modelo é o da Uber, pesquisado antes de decidir: **não existe linha de
"deadhead"**. A Uber cobra um adicional por km em viagem longa (no Brasil,
+R$ 0,30/km a partir do km 15 no UberX), avisa o motorista de que a viagem é
longa **antes** de ele aceitar, e deixa ele recusar livremente. Quem faz a conta
de valer a pena é o motorista, com a informação na tela.

Traduzido para cá: **nada de campo `deadhead_cents`**. O adicional entra na régua
de preço que já existe (base + km × tarifa do modo + peso + tamanho), como mais
uma faixa. O prestador já vê o repasse antes de aceitar desde 2026-08-11 — o que
falta é o **aviso de corrida longa** e a garantia de que recusar não penaliza.

---

## `FROTA-01` — fundação de frota

**Depende de:** `DISP-03`.

- [ ] Desacoplar o heartbeat: `courier:position` **sem** `deliveryId`, tabela
      `courier_positions`, pub/sub no Redis.
- [ ] Mapa, trilha e lista no painel, respeitando a `DEC-14`.
- [ ] Retenção da `DEC-12` com **job de limpeza que roda de verdade** — retenção
      sem job é só um parágrafo.
- [ ] Alertas `FROTA-ALERTA-01..07`, incluindo o dedup (mesmo alerta re-dispara no
      máximo a cada 10 min, com contagem no histórico).
- [ ] Permissão "ver frota" **distinta** de ser admin, com audit log de acesso.

**Aceite:** motoboy ocioso fora da zona operacional **não aparece** no mapa;
motoboy em viagem aparece exato; o job de limpeza remove trilha crua com mais de
7 dias e isso é provado com dado semeado.

**Não fazer:** não expor posição em tempo real sem viagem ativa. É dado pessoal de
trabalhador; a `DEC-14` é o limite e o motoboy precisa saber que está sendo visto.

---

## `LOT-01` — aceite de lote manual

**Depende de:** `B2C-02B`, `B2C-03A`, `DISP-03`.

- [ ] Modelo de viagem com paradas, capacidade e janelas.
- [ ] **Aceite atômico**: reserva global por `delivery_id` + lock. Dois motoboys
      aceitando o mesmo lote ao mesmo tempo → um leva, o outro recebe erro claro.
- [ ] Um pedido **nunca** é ofertado individualmente e em lote ao mesmo tempo.
- [ ] Sequenciador: TSP exaustivo até 4 paradas, heurística com janela acima
      disso. **Carga cresce na coleta e decresce na entrega** — a versão invertida
      dessa regra já esteve escrita no plano e foi corrigida em 2026-08-07; se o
      seu teste assume o contrário, o teste está errado.
- [ ] Anti-atraso da `DEC-11`; espera de 15 min da `DEC-10`.
- [ ] Falha parcial não contamina: parada `FAILED` com motivo e prova, viagem
      re-sequenciada, demais pedidos seguem.
- [ ] **Lote não mistura `IMMEDIATE` e `SCHEDULED`** (`DEC-18`).

**Aceite:** teste de concorrência com dois prestadores; cancelamento parcial;
expiração; capacidade estourada recusada como invariante duro; reconciliação
viagem × entregas.

---

## `LOT-02` — blocos agendados intermunicipais

**Depende de:** `LOT-01`.

- [ ] `scheduled_lots` publicados por (origem, destino, dia), com janelas
      obrigatórias de coleta e entrega.
- [ ] **Candidatura livre** (`DEC-09`): o bloco aparece para todo prestador
      elegível e quem se candidata leva; elegibilidade pelo índice de
      pontualidade. Sem pré-alocação, sem fila secreta.
- [ ] Um bloco agendado ativo por faixa de tempo, sem sobreposição de janelas.
- [ ] Folgas da regra R5.6: coletar todos com > 30 min antes da partida; chegar ao
      destino com ≥ 45 min sobre a primeira entrega.
- [ ] **Adicional de longa distância** da `DEC-15` no preço e no repasse, com o
      aviso de corrida longa antes do aceite.

**Aceite:** prestador inelegível não vê o bloco; dois candidatos simultâneos
resolvem sem duplicar; recusar bloco longo **não** afeta o índice de pontualidade.

---

## `FROTA-02` — progresso multi-parada no painel

**Depende de:** `FROTA-01`, `LOT-01`. Mostra a viagem parada a parada, com
`arrived_at`/`departed_at` em `trip_stops` — que é o mesmo dado que isenta o
motoboy de atraso que não é dele (`SUP-03`).

---

## `ADMIN-04` e `ADMIN-05`

Requisitos em [`11-ONDA-2-PAINEL-ADMIN.md`](11-ONDA-2-PAINEL-ADMIN.md).
