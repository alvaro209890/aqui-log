# Plano — Lote multi-pedido, viagens intermunicipais e anti-atraso

> **Atualizado:** 2026-08-07
> **Status:** design aprovado para planejamento. **Aceite de lote pelo motoboy** é
> feature decidida pelo dono (sem implementar ainda — documentação apenas).
> **Agrupamento automático** pela plataforma permanece atrás do gate de descoberta `TRIP-00`.
> **Roadmap:** `LOT-01`, `LOT-02`, `TRIP-00`, `TRIP-01`, `TRIP-02`, `FROTA-01`, `FROTA-02`
> **Pré-requisitos:** pedido simples estável, preço v2, telemetria de despacho e política de responsabilidade por atraso

## 1. Hipótese de produto

Dois movimentos convivem:

1. **Aceite de lote pelo motoboy (decisão do dono, 2026-08-07):** o prestador pode
   escolher **aceitar vários pedidos juntos**, inclusive **lotes agendados de um
   município para outro** (ex.: Cuiabá → Rondonópolis). Ele monta o lote, o servidor
   valida capacidade/viabilidade/janelas e o aceite é atômico. Não depende de
   descoberta: é o próprio motoboy buscando eficiência.
2. **Agrupamento automático (descoberta futura):** a plataforma combina pedidos
   próximos para reduzir custo e aumentar o ganho por viagem. Só avança depois que
   o gate `TRIP-00` medir densidade real.

## 2. Decisões novas do dono (2026-08-07)

| # | Decisão | Consequência |
|---|---|---|
| D-1 | Motoboy pode aceitar **vários pedidos juntos** (lote) | Novo fluxo de aceite atômico multi-delivery |
| D-2 | Lotes **agendados intermunicipais** (vários pedidos de um município para outro) | `scheduled_at` + janelas + blocos agendados |
| D-3 | Lógica **anti-atraso** obrigatória (folgas, ETAs, alertas, redespacho) | Regras verificáveis (seção 7) |
| D-4 | Dashboard web **monitora** localização dos prestadores, coleta de cada pedido e trajeto em viagem | Novo plano `PLANO_FROTA_DASHBOARD.md` |

## 3. Vocabulário e invariantes

| Termo | Definição |
| --- | --- |
| Viagem (`trip`) | Execução de um conjunto ordenado de paradas por um motoboy |
| Lote | Conjunto de pedidos aceitos juntos pelo motoboy (origem da viagem) |
| Bloco agendado | Lote publicado com janelas e data fixas (ex.: município A → município B) |
| Parada (`stop`) | Retirada ou entrega vinculada a um ou mais pedidos |
| Capacidade | Limites de peso, volume, quantidade e tipo de veículo |
| Janela | Intervalo permitido para retirada/entrega |
| `AT_RISK` | Flag (não estado): ETA da parada excede o fim da janela |
| Shadow mode | Agrupador automático calcula propostas, mas não altera ofertas reais |

Invariantes (herdados + novos):

- uma entrega pertence a no máximo uma viagem ativa;
- cada pacote conserva código, destinatário, estado e provas próprios;
- nenhuma combinação excede capacidade declarada;
- reordenar paradas não pode violar coleta antes de entrega;
- preço e prazo são informados antes do aceite do cliente/motoboy;
- falha em um pacote não pode concluir ou apagar os demais;
- cancelamento precisa definir se a viagem é recalculada, continua ou termina;
- **aceite de lote é all-or-nothing transacional** (todos juntos ou nenhum);
- **composição e preço são congelados no aceite**; mudança exige nova proposta e consentimento;
- lote/agrupador nunca coexiste com oferta individual do mesmo delivery (reserva global por `delivery_id`);
- motoboy só aceita o que consegue executar dentro das janelas e da capacidade.

## 4. Requisitos funcionais — aceite de lote pelo motoboy

### 4.1 Despacho

- R1.1. Fila de pedidos disponíveis no app motoboy com: código, coleta (endereço + janela), entrega (endereço + janela), município destino, peso/tamanho, preço do cliente e repasse. Filtro por município e ordenação por janela.
- R1.2. Multi-select → "Montar lote" → **pré-vet** no servidor (capacidade, viabilidade de sequência, janelas, ETAs por parada), sem persistir nada.
- R1.3. Pré-vet falho → motivo específico (ex.: "peso total excede a capacidade da moto") e envio bloqueado. Pré-vet ok → resumo: sequência sugerida (com mapa), km, tempo, peso/volume somado, repasse total.
- R1.4. Aceite **atômico**: todos os pedidos passam juntos para `ACCEPTED` ou nenhum. Row locks (`SELECT ... FOR UPDATE`) nos deliveries + chave de idempotência `(courierId, deliveryIds)`.
- R1.5. Composição congelada no aceite: snapshot de pedidos, paradas, preços e repasses (`composition_snapshot` em `trips`).
- R1.6. Limite piloto: **máx. 3 pedidos por lote** (parametrizável; bloco agendado intermunicipal pode ter teto próprio — decisão pendente 9).
- R1.7. Seleção local revalidada a cada 30 s; pedido que saiu do estado elegível sai do lote com aviso.
- R1.8. Nenhum item com restrição incompatível com o veículo do motoboy.

### 4.2 Blocos agendados intermunicipais

- R2.1. Pedidos com `scheduled_at` futuro e destino em município diferente da coleta são elegíveis a **blocos agendados**, publicados por (origem, destino, dia): "Cuiabá → Rondonópolis, 3 pedidos, coleta 07h–08h, entrega até 12h, repasse R$ 84".
- R2.2. Motoboy **se candidata** ao bloco (`CANDIDATE`) ou recebe pré-alocação para confirmação (decisão pendente 4). Confirmação segue o aceite atômico.
- R2.3. Blocos têm janelas obrigatórias (coleta e entrega) definidas na publicação.
- R2.4. Um motoboy só tem um bloco agendado ativo por faixa de tempo (sem sobreposição de janelas sem folga mínima).

### 4.3 Janelas de tempo

- R3.1. `deliveries` ganham `pickup_window_start/end` e `delivery_window_start/end` (opcionais na v1, obrigatórios em agendados).
- R3.2. Validação server-side na criação: `start < end`, `start` futuro, duração mínima (60 min), coleta antes da entrega.
- R3.3. Janela efetiva de cada parada é resultado do sequenciador (entrega nunca antes da própria coleta, nunca depois do fim da janela).

### 4.4 Capacidade

- R4.1. `couriers` ganham `capacity_kg`, `capacity_volume_l`, `max_packages` por veículo, recolhidos no cadastro/habilitação (decisão pendente 13).
- R4.2. Banda verde ≤ 80%; 80–100% exige confirmação explícita extra; > 100% bloqueado.
- R4.3. Nenhum lote com soma > capacidade é aceitável (invariante duro).
- R4.4. Carga corrente **cresce na coleta e decresce na entrega**, revalidada a cada parada (regra corrigida 2026-08-07: versão anterior estava invertida e viraria teste errado).

### 4.5 Anti-atraso (comportamento)

- R5.1. Sequenciador do servidor: coletas por janela mais cedo; entregas respeitando coleta-antes-entrega. TSP exaustivo para ≤ 4 paradas; acima disso, heurística com janela (teto intermunicipal pode gerar até 12 paradas — exaustivo explodiria). Reordenação manual do motoboy é sempre revalidada.
- R5.1A. **Deadhead intermunicipal:** viagem de retorno vazio precisa entrar no cálculo de preço/repasse (custo do trecho de volta), senão nenhum motoboy aceita bloco. O sequenciador estima distância ida+volta; decisão pendente 17 define a fórmula.
- R5.2. A cada evento (chegada, coleta, entrega, cancelamento, GPS), ETAs recalculados; divergência > 5 min gera `eta_updated` (auditável) e notifica cliente.
- R5.3. Parada com ETA além do fim da janela → `AT_RISK` + push ao motoboy com 3 opções (seguir, pular, reordenar); cliente avisado com nova estimativa.
- R5.4. Sem resposta em 120 s e pedido não coletado → redespacho oferecido. Já coletado → registra `late_delivery` e segue (política suave).
- R5.5. Índice de pontualidade do motoboy (janela móvel 30 dias, tolerância 15 min) afeta prioridade de fila e elegibilidade a blocos agendados; **não** afeta pagamento na v1. **Atrasos com causa registrada são excluídos do índice:** cliente ausente na coleta, falha de parada anterior na mesma trip, espera por resposta D-R9. A captura de espera por parada (`arrived_at`/`departed_at` em `trip_stops`) alimenta essa isenção — sem ela, motoboy é punido por atraso que não é dele.
- R5.6. Bloco intermunicipal: coleta de todos com folga > 30 min antes da partida; chegada no destino com folga ≥ 45 min sobre a 1ª entrega.

### 4.6 Falha parcial, cancelamento e redespacho

- R6.1. Falha em um pedido não afeta os demais: parada `FAILED` com motivo + prova, viagem re-sequenciada.
- R6.2. Falha antes da coleta → pedido volta à fila (`REMOVED_FROM_TRIP` → `REQUESTED`) e re-despacha como individual.
- R6.3. Cancelamento do cliente: pedido sai da viagem, re-sequenciamento, cliente não paga o trecho cancelado (alocação de preço por delivery permite estorno parcial). **Estorno por fase** (fecha a divergência com `PLANO_PAGAMENTOS.md`):
  - coleta **não ocorrida** → estorno automático da fatia (`trip_quotes`);
  - coleta **ocorrida** → automático apenas até teto de valor (R$ 30); acima disso, análise humana com SLA;
  - motoboy recebe compensação parcial de deslocamento se cancelamento após coleta (decisão pendente 5).
- R6.4. Cancelamento da viagem inteira → pedidos não concluídos voltam à fila com evento de auditoria.
- R7.1. Desistência antes da 1ª coleta: sem penalidade dura, registrada e afeta índice de confiabilidade.
- R7.2. Desistência após 1ª coleta: só com autorização de suporte; devolução/repasso conforme política (decisão pendente 6).
- R7.3. Redespacho: pedido → `REQUESTED`, nova oferta; viagem re-sequenciada; cliente recebe push quando novo motoboy aceita.

### 4.7 Comunicação com o cliente

- R8.1. Cliente vê no app: confirmação do lote, **espera de agrupamento** (5–15 min com linguagem clara: "buscando motoboy para otimizar sua entrega"), janelas prometidas, ajustes de ETA (delta > 5 min), **"seu pacote está a N paradas de você"**, status da própria parada, aviso de chegada, e — em falha/redespacho — a informação de que o pacote foi transferido para outro motoboy.
- R8.2. Cliente **nunca paga acima** do preço individual já apresentado sem nova confirmação.
- R8.3. Atraso inevitável: nova janela estimada + opção de cancelar sem custo se atraso > 45 min além da janela.
- R8.4. **Privacidade cruzada:** cliente rastreia só o próprio pacote (ETA/status, "a N paradas de você"); nunca vê coordenadas/endereço de paradas de terceiros.

## 5. Modelo de domínio

### Novas tabelas

| Entidade | Responsabilidade |
| --- | --- |
| `trips` | motoboy, estado, capacidade usada, distância/tempo previstos e reais, `composition_snapshot` (congelado no aceite), totais de preço/repasse |
| `trip_stops` | sequência, tipo `PICKUP/DELIVERY/RETURN_STOP`, coordenadas, janela efetiva, estado, `eta_at/arrived_at/departed_at`, folga pós-parada, motivo de falha, prova |
| `trip_stop_deliveries` | liga pedidos à parada; estado por pacote (`PENDING/PICKED/DELIVERED/FAILED/REMOVED`); prova por pacote |
| `trip_events` | auditoria: criação, aceite, reordenação, ETA, chegada, falha, `LATE`, redespacho, cancelamento |
| `trip_quotes` | preço do cliente, repasse do motoboy, **alocação por delivery** (fatia de preço e repasse por pacote), economia e versão do algoritmo |
| `scheduled_lots` | origem/destino município, dia, janelas, teto de pedidos, status `PUBLISHED/CLAIMED/ASSIGNED/EXECUTED/EXPIRED` |
| `courier_metrics` | agregado diário de pontualidade/confiabilidade (alimentado por job) |
| `courier_positions` | histórico de posição (amostragem) — ver `PLANO_FROTA_DASHBOARD.md` |

### Alterações em tabelas existentes

```
deliveries   + trip_id (índice, nullable)
             + pickup_window_start/end, delivery_window_start/end
             + scheduled_at, promised_delivery_at
             + status_delta: REQUESTED | OFFERED | ACCEPTED | AT_PICKUP | PICKED_UP
               | IN_TRANSIT | DELIVERED | CANCELED | FAILED | REMOVED_FROM_TRIP | REDISPATCHED
             + failure_reason, eta_forecast (jsonb), at_risk_at

couriers     + capacity_kg, capacity_volume_l, max_packages
             + on_time_rate_30d (cache do agregado)

delivery_offers + offer_batch_id (liga rodada de oferta de lote)
```

## 6. Máquina de estados

**Viagem:**

```
DRAFT ──monta lote──► PROPOSED ──aceite atômico──► ACCEPTED ──1ª coleta──► IN_PROGRESS
  │                      │                            │                       │
  │                      │        (agendado)          │                       ├──► COMPLETED
  │                      │   SCHEDULED ──► ACCEPTED   │                       ├──► PARTIALLY_COMPLETED
  ▼                      ▼                            │                       └──► CANCELED
CANCELED              (expira) ──► CANCELED ──────────┴──► (pedidos restantes → fila)
```

**Pedido dentro da viagem** (estados legados preservados):

```
REQUESTED ─► OFFERED ─► ACCEPTED ─► AT_PICKUP ─► PICKED_UP ─► IN_TRANSIT ─► DELIVERED
   │  ▲          │            │            ▲            │             ▲
   │  │redespacho│            │falha coleta│            │falha entrega│
   ▼  │          ▼            ▼            │            ▼             │
CANCELED   REMOVED_FROM_TRIP ─► REDISPATCHED ─► REQUESTED   FAILED
```

**Mapeamento trip → delivery** (evita divergência de estado):

| Estado da trip | Estado dos deliveries |
| --- | --- |
| `ACCEPTED` | todos `ACCEPTED` |
| `IN_PROGRESS` | ≥1 coletado (`PICKED_UP`/`IN_TRANSIT`), demais `AT_PICKUP` ou pendentes |
| `COMPLETED` | todos `DELIVERED` |
| `PARTIALLY_COMPLETED` | ≥1 `DELIVERED` e ≥1 `CANCELED`/`FAILED`/`REMOVED_FROM_TRIP` |
| `CANCELED` | não concluídos → `REQUESTED` (volta à fila) |

Job de reconciliação detecta divergência trip × delivery. Qualquer mudança de janela/sequência é evento em `trip_events`, nunca update mudo.

## 7. Regras anti-atraso verificáveis

Configuráveis por feature flag/env; valores v1 propostos:

| ID | Regra | Valor v1 |
| --- | --- | --- |
| D-R1 | Folga mínima entre paradas consecutivas | ≥ 10 min |
| D-R2 | Folga mínima sobre o fim da janela de coleta para aceitar lote | ≥ 15 min |
| D-R3 | Folga mínima sobre a 1ª entrega intermunicipal (chegada no destino) | ≥ 45 min |
| D-R4 | Limite de pedidos por lote (piloto) | 3 (parametrizável) |
| D-R5 | Toda entrega tem coleta anterior (invariante global) | sempre |
| D-R6 | Recálculo de rota/ETAs a cada evento; divergência > 5 min ⇒ `ETA_UPDATED` | sempre |
| D-R7 | Parada entregue > 15 min após o fim da janela ⇒ `late_stop` no índice de pontualidade | tolerância 15 min |
| D-R8 | ETA além do fim da janela ⇒ flag `AT_RISK` + notificação | imediato |
| D-R9 | Sem resposta ao alerta `AT_RISK` ⇒ redespacho oferecido (se não coletado) | 120 s |
| D-R10 | Novo lote com janelas sobrepostas a viagem ativa ⇒ bloqueado se violar D-R1 | sempre |
| D-R11 | Soma peso/volume ≤ 100% (bloqueio); 80–100% exige confirmação extra | sempre |
| D-R12 | Publicação de bloco agendado só com volume ≥ 2 e janela de coleta ≥ 60 min | conforme |
| D-R13 | Cliente com atraso > 45 min além da janela recebe oferta de cancelamento sem custo | 45 min |

Aceitar um lote exige D-R1, D-R2, D-R5, D-R10 e D-R11 simultaneamente — qualquer falha impede o envio com mensagem específica. D-R7 é a "penalidade suave": não corta pagamento, rebaixa prioridade de fila.

## 8. Concorrência e consistência

- **Reserva global por delivery:** `SETNX` no Redis no momento em que o pedido entra na janela de lote; checada em **todos** os caminhos de aceite (individual e lote). Rodada de lote e oferta individual nunca coexistem para o mesmo delivery. TTL da reserva alinhado ao fim da janela de agrupamento (decisão pendente 3).
- **Aceite all-or-nothing:** transação com lock em todos os `delivery_id` do lote, revalidando estados e expiração dentro da transação. Perdedor recebe "lote indisponível" e seleção local é revalidada.
- **TTL de oferta de lote** com job de expiração (lote órfão nunca fica pendurado).
- **Capacidade reservada:** motoboy com bloco agendado aceito tem capacidade reservada (Redis com TTL até a execução) para não aceitar corrida que exceda a carga.
- **Preço imutável pós-aceite:** estorno da fatia do delivery cancelado mantém preço dos demais (delta na margem da plataforma — medir no piloto como custo).
- **Fallback individual** reutiliza o preço congelado da cotação original (nunca maior), com auditoria de motivo.

## 9. Compatibilidade e legado

- Agrupador/lote restrito a `customer_id != null` (B2C) + flag de opt-in; B2B nunca entra em lote no piloto (decisão pendente 14).
- Avaliação permanece **por delivery** (regra atual intacta); cliente avalia só o próprio pacote.
- Liquidação contábil por delivery usando a alocação de `trip_quotes`; lançamentos de "viagem" apenas para custo/margem internos.
- `courier:location` (tracking atual) precisa ser **desacoplado de `deliveryId`** — ver `PLANO_FROTA_DASHBOARD.md`.

## 10. Fases

### `LOT-01` — aceite de lote manual (feature decidida)

- schema aditivo (`trips`, `trip_stops`, `trip_stop_deliveries`, `trip_events`, `trip_quotes`);
- `scheduled_at` + janelas + validações server-side;
- pré-vet de lote + aceite atômico com locks e idempotência;
- reserva global por `delivery_id` + TTL de oferta de lote;
- regras anti-atraso D-R1..D-R13;
- app motoboy: multi-select, resumo, aceite; app cliente: comunicação de lote;
- testes: concorrência (dois motoboys), cancelamento parcial, expiração, capacidade, reconciliação trip×delivery.

### `LOT-02` — blocos agendados intermunicipais

- `scheduled_lots` + candidatura/confirmação;
- índice de pontualidade (R5.5) filtrando elegibilidade;
- reserva de capacidade de motoboy agendado;
- comunicações de bloco e janelas prometidas.

### `TRIP-00` — gate de descoberta (agrupamento automático)

Medir por período operacional representativo: pedidos por hora/região, pares em janelas de 5/10/15 min, proximidade entre retiradas e destinos, peso/tamanho/capacidade combinados, tempo até aceite/entrega, cancelamentos, km/tempo adicionais simulados.

**Critério mínimo para avançar** (definir antes da análise): percentual de pedidos agrupáveis, economia média por pedido, ganho do motoboy por hora, desvio máximo de prazo, volume diário para um piloto. Se o gate não fechar, manter oferta simples e reavaliar quando o volume crescer.

### `TRIP-01` — shadow mode

- agrupador determinístico e testável, propostas gravadas sem alterar despacho;
- dashboard interno de qualidade das combinações;
- teste de concorrência para impedir dupla alocação.

### `TRIP-02` — piloto controlado

- opt-in do motoboy; máx. 3 pedidos e uma região operacional;
- tela de paradas e provas por pacote;
- acompanhamento do próprio pacote pelo cliente;
- fallback seguro para corridas individuais;
- feature flag e possibilidade de desligar sem migration destrutiva.

### `FROTA-01` e `FROTA-02`

Monitoramento de frota no dashboard — ver `docs/PLANO_FROTA_DASHBOARD.md`.

## 11. Métricas de sucesso e guardrails

| Métrica de sucesso | Guardrail |
| --- | --- |
| custo médio por pedido menor | atraso p95 dentro do limite aprovado |
| ganho do motoboy por hora maior | cancelamento não piora além do limite |
| mais entregas por km | nenhuma perda de rastreabilidade/prova |
| boa taxa de aceite da viagem | incidentes e suporte não aumentam de forma material |
| aceite de lote crescente | índice de pontualidade não degrada (R5.5) |

## 12. Decisões pendentes

1. Modelo de despacho: lote manual convive com auto-dispatch individual? (recomendação: convive; o mesmo pedido nunca está nas duas filas ao mesmo tempo)
2. Bloco agendado: candidatura livre ou pré-alocação com confirmação? (recomendação: publicação + candidatura com ranking por pontualidade)
3. Janela de espera para agrupar: quanto tempo o pedido fica "segurado" antes de virar corrida individual? (recomendação: 5–15 min, cliente avisado no pedido)
4. Limite por lote: 3 para tudo ou teto maior para intermunicipal agendado (ex.: 6)?
5. Cancelamento pós-coleta: compensação de deslocamento ao motoboy (fórmula? % do repasse ou fixo por km)?
6. Desistência pós-coleta: fluxo de devolução (hub/remetente?) e quem custeia.
7. Falha por ausência do cliente: taxa de nova tentativa? Quem paga?
8. Quem absorve a diferença quando cliente cancela de lote aceito e demais mantêm desconto (recomendação: plataforma, medindo como custo)?
9. Tolerâncias D-R1..D-R13 (10/15/45 min, 120 s, 15 min, 45 min) — confirmar.
10. Penalidades: índice de pontualidade só prioridade de fila na v1? (recomendação: sim)
11. Preço do cliente: desconto por lote na v1 ou cliente paga individual e lote vira vantagem de fila? (recomendação: individual na v1, desconto depois)
12. Repasse do motoboy: soma simples ou tabela de incentivo por lote?
13. Capacidade do motoboy: quem cadastra (motoboy + aprovação admin?) e o que o agrupador faz com motoboy sem perfil?
14. B2B legado: lote é B2C-only no piloto? (recomendação: sim)
15. Onde começa o piloto (região/município de maior densidade) e critérios de sucesso/abort (p95 atraso, cancelamentos, aceite de lotes).
16. Regras e gatilhos de `TRIP-00` (quem decide os limiares e o que acontece se o gate não fechar).
17. **Deadhead intermunicipal:** como o trecho de retorno entra no preço do cliente e no repasse do motoboy (percentual sobre km ida+volta? tarifa mínima por município?).
18. **Avaliação em lote:** flag `trip_id` na tela de avaliação + contexto "lote de N pacotes"; avaliações de entregas com evento `LATE` sistêmico passam por revisão leve (evita punir motoboy por decisão do sequenciador e vingança cruzada na avaliação mútua).
19. **Fraude de auto-entrega:** correlação cliente-novo × motoboy-novo × mesmo dispositivo/IP na criação + teto de estorno por conta antes de telefone verificado (`B2C-04`).

## 13. Fora de escopo inicial

- van/caminhão, múltiplos motoristas ou transferência entre hubs;
- otimização em escala nacional;
- rastreamento por caixa com hardware;
- agrupamento automático operacional antes do gate `TRIP-00`;
- habilitação cloud ou pagamentos por consequência deste plano;
- mudanças de código nesta rodada (design apenas).
