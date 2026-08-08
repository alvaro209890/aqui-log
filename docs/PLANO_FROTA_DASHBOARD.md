# Plano — Monitoramento de frota no dashboard

> **Atualizado:** 2026-08-07
> **Status:** design aprovado para planejamento (sem implementar ainda — documentação apenas)
> **Dependências:** `PLANO_LOTE_MULTI_PEDIDO.md` (viagens/lotes), tracking atual (`tracking.gateway.ts`, `LiveMap.tsx`)
> **Roadmap:** `FROTA-01`, `FROTA-02`

## 1. Objetivo

O front web (dashboard) deve **monitorar os prestadores em tempo real**:

1. **Localização dos prestadores** — onde está cada motoboy (ocioso ou em viagem).
2. **Se um pedido foi recolhido ou não** — status de coleta por pedido.
3. **Localização durante a viagem** — trajeto real, paradas e andamento, inclusive em viagens multi-pedido/intermunicipais.

O dashboard já tem um mapa Leaflet com pinos de entregadores e linhas por entrega (`apps/dashboard/src/LiveMap.tsx`, `pages/MapPage.tsx`) e WebSocket de tracking (`tracking.gateway.ts`). Este plano especifica a evolução para um **mapa de frota operacional**.

## 2. Pré-requisito técnico crítico

Hoje o evento `courier:location` **exige `deliveryId`** e é rejeitado sem entrega vinculada; o courier guarda só `lastLatitude/lastLongitude` (sem histórico). Para o mapa de frota:

- **Heartbeat desacoplado da entrega:** evento `courier:position` = `{ courierId, latitude, longitude, batteryPct?, accuracy?, timestamp }`, com `deliveryId/tripId` **opcional** (contexto, não requisito).
- **Histórico de posição:** nova tabela `courier_positions` (amostragem) + posição corrente no Redis (TTL ~2 h).
- **Estado derivado, nunca enviado:** o pin "ocioso / indo para coleta / com carga / entregando / sem sinal" é inferido de `courier.status + delivery/trip.status + presença`; o app não manda um campo de estado mágico.
- **Snapshots no WebSocket:** ao reconectar, o cliente recebe `fleet:snapshot` completo (não só delta) para não perder pins após queda de rede.

## 3. Dados e eventos

### REST (novos/alterados)

| Endpoint | Conteúdo |
| --- | --- |
| `GET /fleet/couriers` | Lista: id, nome, status, lat/lng, `lastSeenAt`, bateria, disponibilidade, `currentDeliveryId?`, `currentTripId?`, estado derivado. Filtros por estado. |
| `GET /fleet/couriers/:id` | Detalhe: posição, bateria, pedido/viagem atual, ETA, atraso, janela. |
| `GET /fleet/couriers/:id/track?from=&to=` | Trilha real do período, com amostragem para exibição (não devolver 2.000 pontos crus). |
| `GET /fleet/alerts?active=true` | Alertas ativos com ack. |
| `GET /deliveries/:id` | Enriquecer com `pickedUpAt`, `pickupConfirmedBy`, `eta`, `delaySeconds`. |
| (futuro) `GET /trips/:id` + `/trips/:id/stops` | Progresso multi-parada quando `TRIP-*` existir. |

### WebSocket (namespace `tracking`, JWT existente)

| Evento | Payload |
| --- | --- |
| `courier:position` | posição desacoplada (acima) |
| `courier:presence` | `{ courierId, online, reason }` (app fechou, segundo plano) |
| `courier:status` | mudança de disponibilidade / bateria crítica |
| `delivery:status` | cada transição de pedido (cobre "recolhido ou não" sem polling) |
| `trip:event` | (futuro) chegada/conclusão/reordenação de parada, ETA por parada |
| `courier:alert` | alertas novos em tempo real |
| `fleet:snapshot` | payload inicial: todos os couriers + pedidos ativos + alertas |

### Frequência e retenção

- Heartbeat: **10 s em viagem ativa, 30 s ocioso** (foreground service no Android). Rate limit por courier (ex.: 1 msg/2 s com dedupe).
- Dashboard: pin "fraco" após 45 s sem sinal; "sem sinal" oficial após 90 s; offline da lista após 5 min.
- Redis pub/sub para multi-instância (Socket.IO adapter) desde o dia 1 do piloto; heartbeat amortizado por buffer (flush batch), não write por mensagem no Postgres.
- Retenção: trilha crua 7 dias, agregada por minuto 30 dias, resumo diário 90 dias (confirmar com dono — LGPD, seção 6).

## 4. UX do mapa e páginas

### Painel 1 — Mapa operacional

- Pino por prestador online, zoom auto ("fit") + botão voltar à cidade operacional.
- **Ícones por estado derivado:**

| Estado | Visual |
| --- | --- |
| Ocioso (disponível) | Verde, moto — **coarsificado**: raio/área aproximada (ex.: célula ~500 m), sem endereço exato, para não revelar a casa do motoboy (LGPD) |
| Indo para coleta | Laranja, seta |
| Com carga / em trânsito | Índigo, pacote |
| Entregando | Roxo, casa |
| Sem sinal (> 90 s) | Cinza, borda tracejada pulsante |
| Parado no trajeto | Anel pulsante (alerta) |

- Posição exata e trilha completa só são expostas **durante viagem ativa**; fora dela, apenas o pino coarsificado (ou oculto fora da zona operacional — decisão pendente 12).
- Drawer de detalhe: telefone do motoboy e dados do cliente **só para papéis que precisam** (SUPPORT em incidente), com registro de visualização no audit log.

- Pinos de coleta/entrega: **coleta recolhida = selo verde "✓"**; coleta pendente com motoboy presente = pulsar; sem motoboy = cinza.
- Linhas: trajeto real sólida azul (tooltip com horário por ponto); rota prevista tracejada cinza; desvio destacado em vermelho; cabeça de cobra (direção).
- ETA no popup e no card da lista (sempre do backend — rota + velocidade média histórica, nunca calculado no cliente); atraso em vermelho (`+8 min`).
- Clique no pino → drawer: nome, telefone, avaliação, bateria, "último sinal há X s", veículo; pedido atual (código, cliente, origem/destino, recolhido? há quanto tempo?, ETA, janela, atraso, km, tempo de viagem); trilha do dia clicável; progresso da viagem multi-parada (paradas numeradas `PICKUP/DELIVERY`, barra de progresso, ETA por parada).

### Painel 2 — Lista de prestadores

- Tabela ordenável: nome, estado, pedido atual (código + status de coleta), ETA, alertas, tempo sem sinal. Filtros por estado/alerta/"em viagem", busca por nome. Badge "sem sinal" ordenado ao topo.

### Painel 3 — Alertas

- Painel lateral: alertas ativos com severidade, **ack** (auditado), filtro, histórico das últimas 24 h. Card clicável → zoom no pino. Toast sonoro opcional.

### Painel 4 — Métricas

- Contadores em tempo real (WebSocket, sem polling): online, ocioso, em viagem, sem sinal, entregas em andamento, pedidos em atraso.

### Permissões

- Só `SUPER_ADMIN/ADMIN/SUPPORT` veem a frota; permissão "ver frota" **distinta** de "ver entrega". `SUPPORT` tem **somente leitura** na frota (nunca cancela/reembolsa sozinho — ver `PLANO_ADMIN.md`). Posição exposta **só em detalhe durante viagens ativas**; ocioso aparece coarsificado (seção 4). Acesso registrado em audit log. Motoboy tem ciência no cadastro (LGPD, seção 6).
- **Guards de estado:** nenhuma ação do mapa (cancelar, reofertar, reordenar parada) fura a máquina de estados — cancelar exige pedido ≤ `AT_PICKUP` (pós-coleta só com fluxo de devolução), reordenação roda o sequenciador e revalida D-R1..D-R13. Toda ação gera evento em `trip_events` e transação reversa no ledger quando mexe em valor.

## 5. Regras de alerta (configuráveis server-side)

Calculadas no backend (job + eventos), entregues por `courier:alert`:

| # | Regra | Limiares v1 |
| --- | --- | --- |
| A-1 | Atraso de janela (ETA > fim da janela) | amarelo +10 min; vermelho +30 min (cliente só avisado no vermelho) |
| A-2 | Parado fora de parada programada (< 50 m de raio) | amarelo > 5 min; vermelho > 10 min + sugestão de ligar |
| A-3 | Desvio de rota (perpendicular > limiar) | amarelo > 800 m / 2 min; vermelho > 1,5 km (não dispara ao pular para próxima parada válida) |
| A-4 | Sem sinal | fraco > 45 s; vermelho > 3 min em viagem ativa; alerta de frota > 5 min; incidente > 15 min |
| A-5 | Pedido não recolhido (`AT_PICKUP` parado) | amarelo > 15 min; vermelho > 30 min + ação "cancelar e reofertar" sugerida (alinhar com `DISP-*`) |
| A-6 | Bateria | < 20 % aviso; < 10 % em viagem amarelo |
| A-7 | Dedup | mesmo alerta/categoria re-dispara só a cada 10 min, com contagem no histórico |

**Máscara intermunicipal:** em viagem entre municípios, o 1º sem-sinal em 60 min **não** alerta (estrada); ETA calculado por trechos (urbano + rodoviário).

## 6. Privacidade e LGPD

- Finalidade: operação/logística. Minimização: posição **só durante viagens ativas** para exposição no dashboard; histórico gravado por amostragem.
- Retenção definida (seção 3) com job de limpeza; dados não usados para score sem regra própria.
- Acesso por papel + audit log de quem viu o quê; ciência do motoboy no cadastro/aprovação (cláusula de uso de localização).
- `canAccess` atual precisa corrigir suporte de `customerId` (cliente B2C não consegue assistir a própria entrega via WS hoje — bug latente).
- Tudo em UTC no wire; exibição em `America/Sao_Paulo`.
- Descarte de pontos com timestamp fora de ±60 s do "agora" (anti-replay de GPS em cache).

## 7. Edge cases

| Caso | Resolução |
| --- | --- |
| Sem permissão de GPS | Heartbeat informa `locationUnavailable`; pin "sem posição" na borda do mapa; regra A-4 suspensa, mas em viagem ativa é amarelo imediato e impede novo aceite (decisão pendente 7) |
| App fechado/processo morto | `courier:presence offline` com timeout de 30 s (ignorar troca de rede); viagem ativa vira alerta vermelho + ação de suporte |
| Viagem longa intermunicipal | máscara A-4; histórico cobre o trecho; "pular" para posição mais recente |
| Múltiplos pedidos na mesma viagem | um pin por prestador; stops numerados; alerta de parada usa `trip_stops` (não marca "parado" em parada programada); coleta é por pedido |
| Recusa de localização em segundo plano | heartbeat degrada para 60 s; estado "sinal intermitente" (45–90 s) sem falso alerta; guidance no app |
| Modo economia de bateria | app reduz frequência e avisa `batterySaving`; dashboard mostra o motivo em vez de alertar |
| Vários browsers/abas | dedupe por `courierId` (trocar chave atual que deduplica por `deliveryId`) |
| GPS antigo/em cache | anti-replay ±60 s |

## 8. Decisões pendentes

| # | Decisão | Recomendação |
| --- | --- | --- |
| 1 | Provedor de rota/ETA (OSRM self-host vs Google/Mapbox) | OSRM local (sem custo) para o piloto |
| 2 | Frequência de heartbeat (10 s/30 s vs 5 s/15 s) | 10 s/30 s + foreground service |
| 3 | Retenção da trilha e política LGPD | crua 7 d / agregada 30 d / diária 90 d, job de limpeza |
| 4 | "Sem sinal" em viagem notifica cliente? | Não; só admin. Cliente só se atrasar janela |
| 5 | Cancelar/reofertar pedido não recolhido | Ação ao admin, não automática (alinhar `DISP-*`) |
| 6 | Idle = disponível para oferta? | Mostrar `isAvailable` explícito, não inferir |
| 7 | Sem GPS em viagem bloqueia novos aceites? | Sim, amarelo imediato (confirmar) |
| 8 | Multi-parada: modelo `trips` já no dashboard ou atrás de flag | UI pronta atrás de flag; sem CRUD antes do gate |
| 9 | Ack de alerta: quem pode e SLA | Admin/suporte, auditado |
| 10 | Bateria no payload | Obrigatória no Android, opcional no iOS |
| 11 | Reordenação de paradas em voo | Evento `trip:event:reorder` notifica o dashboard |
| 12 | Pino ocioso: coarsificação (raio ~500 m) ou oculto fora da zona operacional? | Coarsificado na zona operacional; oculto fora dela |

## 9. Ordem sugerida de implementação (`FROTA-01` → `FROTA-02`)

1. Refatorar heartbeat desacoplado de `deliveryId` + sala `fleet` + Redis adapter.
2. `courier_positions` (amostragem + retenção) e `fleet:snapshot` + REST de frota.
3. Página Frota: pinos por estado derivado + lista + stale (45/90 s).
4. Trilha real + ETA backend + popup/drawer de detalhe.
5. Alertas A-1..A-7 + painel de alertas com ack.
6. (`FROTA-02`) Progresso de viagem multi-parada (`/trips/:id/stops`) atrás de flag.
7. Correção de `canAccess` para `customerId` + permissão "ver frota" + audit log + ciência do motoboy.

**Fora de escopo:** expor posição fora de viagem ativa, alertas ao cliente por GPS (apenas por janela), mudanças de código nesta rodada (design apenas).
