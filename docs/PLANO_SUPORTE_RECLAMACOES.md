# Plano — Suporte e reclamações ("o lado legal")

> **Criado:** 2026-08-07 · **Papel:** especificação subordinada ao `ROADMAP.md`
> **Abrange:** `SUP-01` a `SUP-05`
> **Dependências:** `PLANO_CONFIANCA_E_PRECO.md` (B2C-03 avaliação mútua), `PLANO_PAGAMENTOS.md` (PAY-01 ledger/estorno), `PLANO_TRANSPORTADORA.md` (LOT-01/02, lote), `PLANO_FROTA_DASHBOARD.md` (FROTA-01), `PLANO_ADMIN.md` (painel admin)
> **Não autoriza:** gateway, SMS pago, WhatsApp, cloud, payout real

## 1. Filosofia: reclamação é parte do produto

Reclamação não é falha do produto — é **feedback pago pelo cliente**. Cada reclamação carrega três coisas: um problema real (ou não), uma lição de produto e um momento de retenção. Este plano desenha o suporte como **produto**, não guichê:

| Princípio | Regra prática |
|---|---|
| **Primeira resposta em segundos** | Abertura gera ack automático imediato (push/SMS em < 5 s). Nunca um silêncio. |
| **Resolução em horas quando possível** | Auto-resolução guiada resolve em minutos; juiz rápido em segundos; humano com SLA de 24 h (meta: 70% resolvidos em < 2 h). |
| **Prova reversa por design** | O sistema já tem as provas (fotos, GPS, timestamps). Cliente não "prova" nada: o **dossiê** decide. |
| **Servir primeiro, arbitrar depois** | Quando a regra é clara e barata, reembolsa/compensa na hora; a disputa vem depois. |
| **Prova > palavra** | Reclamação sem dossiê contra motoboy com dossiê completo não pune o motoboy (ver §6). |
| **Tudo vira dado** | Ticket resolvido alimenta índice de reputação, métricas e o pipeline do suporte. |
| **Dossiê simétrico e honesto** | O dossiê é exibido ao cliente E ao motoboy (mesma linha do tempo). Timestamps são carimbados **server-side no momento do upload** (hora do app não é prova) + geofence na coleta/entrega + assinatura de evento. |

Filosofia operacional: **o sistema resolve sozinho o que puder; o humano só entra onde importa** (assédio, dano de alto valor, disputa de dossiê, fraude).

**Nota legal (CDC):** o fornecedor de serviço tem responsabilidade objetiva (CDC art. 14) e inversão do ônus da prova é possível (art. 6º, VIII). O dossiê serve para **resolver rápido e com evidência**, nunca como política de "não reembolsar". Cliente pode pedir reanálise humana uma vez — o dossiê não é a palavra final definitiva.

## 2. Canais e tipos de reclamação

### 2.1 Cliente

Dois pontos de entrada no app do cliente:

1. **Pós-entrega**: tela de avaliação ganha a linha "Algo deu errado?" com botões rápidos.
2. **A qualquer momento no pedido**: botão "Ajuda" no card do pedido ativo (o botão de cancelar vira entrada de suporte se a entrega já estiver coletada).

| Tipo | Visível quando | Perguntas que o sistema faz | Evidência exigida | Prazo para reclamar |
|---|---|---|---|---|
| `ATRASOU` | pedido ativo ou 48 h pós-entrega | quanto atrasou? precisa da encomenda hoje? | nenhuma (sistema usa ETA prometido × real) | 72 h pós-entrega |
| `NAO_CHEGOU` | pedido ativo (sem `DELIVERED`) ou 48 h | tem foto/recado de onde deixou? | nenhuma; sistema confere status e GPS | sem prazo se entrega aberta; 72 h se `FAILED` |
| `VEIO_DANIFICADO` | pós-entrega | onde está o dano? | **1–3 fotos obrigatórias** | 48 h |
| `VEIO_ERRADO` | pós-entrega | o que veio vs o que foi pedido (foto da encomenda original) | 1 foto do que chegou | 48 h |
| `MOTORISTA_NAO_RESPEITOU` | pós-entrega | quê aconteceu (desrespeito, pressão, recusa de prova) | opcional; dossiê decide | 72 h |
| `COBRANCA` | a qualquer momento | qual valor na tela vs cobrado | print da tela do app | 7 dias |
| `OUTRO` | sempre | campo livre | conforme o caso | 7 dias |

Regra geral: **um único motivo por ticket**. Se o cliente descreve dois problemas, o sistema sugere abrir o segundo após fechar o primeiro (evita ticket duplo e métricas sujas).

### 2.2 Motoboy

No app do motoboy: botão "Problema" na entrega ativa e na tela de avaliação pós-entrega.

| Tipo | Quando | Exigência | Prazo |
|---|---|---|---|
| `CLIENTE_AUSENTE` | no destino | foto do local + aguardar 10 min (timer) antes de concluir | durante a parada ou 1 h após |
| `ENDERECO_ERRADO` | na coleta ou entrega | foto da placa/porta + geolocalização | durante a parada |
| `RECUSA_RECEBIMENTO` | no destino | foto + tentativa de contato registrada | durante a parada |
| `ASSEDIO` | a qualquer momento | nenhuma (segurança > prova); flag privada, não exige detalhe público | 72 h |
| `PROBLEMA_LOTE` | viagem/lote ativo | código(s) do pedido; sistema confere trip e paradas | durante a viagem |
| `ERRO_DE_PAGAMENTO` | a qualquer momento | extrato/lançamento citado | 7 dias |
| `OUTRO` | sempre | campo livre | 7 dias |

### 2.3 Fluxo de abertura por tipo (comum a ambos)

```
botão rápido → perguntas dinâmicas (1–3) → evidência exigida (se houver)
  → sistema tenta AUTO-RESOLUÇÃO (§3.2)   → resolveu? encerra com nota
                                          → não resolveu? monta DOSSIÊ (§3.1)
  → se valor e tipo elegíveis → JUIZ RÁPIDO (§3.3) resolve em segundos
  → senão → ticket ABERTO na fila do admin → ATRIBUÍDO → ...
```

## 3. A parte legal: os três mecanismos

### 3.1 "Prova reversa" — o dossiê automático da entrega

**Ideia:** a plataforma já coleta provas durante a operação (foto de coleta, foto de entrega, GPS, timestamps de cada transição de status, ETA prometido vs real). Em vez do cliente "provar" que o pedido não chegou, o **sistema monta o dossiê sozinho** e julga a partir dele. Resolução em segundos na maioria dos casos.

**Passo a passo:**

1. **Coleta contínua:** toda transição de status (`AT_PICKUP`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`), cada prova enviada, cada batida de GPS e cada ETA prometido/recálculo já vai para `delivery_events` com timestamp **server-side** (o carimbo de horário vem do servidor no momento do upload — relógio/mock de GPS do app não é prova).
2. **Montagem instantânea:** ao abrir um ticket com `delivery_id`, o serviço de dossiê monta a linha do tempo em < 2 s: `coletado às 14:02 (foto) · GPS a 12 m do endereço às 14:05 · entregue às 14:07 (foto + assinatura opcional) · janela prometida: até 15:00`. Cliente, motoboy e admin veem a **mesma** linha do tempo (sem versões da verdade).
3. **Veredito automático sugerido:** o sistema classifica o dossiê contra a reclamação:
   - `ATRASOU` → calcula `entregue_at − prometido_at`; ≤ 15 min de tolerância (herdado de `D-R7`) → **comprovadamente pontual**.
   - `NAO_CHEGOU` → status é `DELIVERED` com foto + GPS no raio do endereço → **entrega comprovada**; status `FAILED`/`CANCELED` → **reembolso automático** (§3.3).
   - `VEIO_ERRADO` → foto do produto na coleta vs foto do pedido original → **dossiê mostra o produto certo**.
4. **Julgamento:** com dossiê conclusivo, o sistema responde com a timeline e resolve. Com dossiê incompleto (sem foto, GPS fora do raio), o ticket vai para humano com o dossiê em mãos e `AUTO_VERDICT=indeterminado`.

**Limites e exceções:**

- Dossiê não é verdade absoluta: cliente pode pedir **reanálise humana** uma vez (vira `ESCALADO`).
- Foto de entrega sem verificação de conteúdo: cobre "chegou", não "veio íntegro" — dano/erro exigem foto do cliente (prazo 48 h).
- Dossiê só existe para pedidos com telemetria; pedidos legados (antes de `SUP-01`) caem direto no fluxo humano.
- GPS com precisão baixa (> 100 m) conta como "localização aproximada" — não vale como prova de chegada.
- Timestamps sempre **server-side**; geofence na coleta/entrega como reforço.

**Impacto:** o motoboy é **protegido por padrão** (prova reversa a favor do acusado quando o sistema tem as provas), o que reduz a tensão de reputação e incentiva aceitar mais corridas.

### 3.2 "Auto-resolução guiada" — resolve antes de virar ticket

**Ideia:** antes de criar ticket, o sistema conversa com o cliente por botões e **resolves** os casos baratos na hora, com ação concreta — não texto de apoio ao cliente.

**Árvores principais (v1):**

| Gatilho | Rodada 1 | Rodada 2 | Resolução automática |
|---|---|---|---|
| `ATRASOU` (entrega ativa, atraso > 15 min) | "Seu pedido está atrasado. Atraso previsto: +X min." | 3 botões: **Cancelar sem custo** / **Receber mesmo assim com 20% de desconto** / **Aguardo, me avise** | Cancelamento → release da reserva + push ao motoboy; desconto → cupom/crédito na carteira (§3.3); aguardar → alerta quando a entrega estiver a 5 min |
| `NAO_CHEGOU` (entrega aberta) | sistema checa status | `FAILED`/`CANCELED` → **"reembolsar agora"**; `IN_TRANSIT` → mostra ETA + "me avise na chegada" | reembolso automático ≤ teto; senão veredito |
| `COBRANCA` (valor difere do cotado) | "O valor cobrado foi R$ X, o combinado R$ Y." | **Concordar com a diferença** | estorno da diferença ≤ R$ 50 automático; acima, ticket |
| `MOTORISTA_NAO_RESPEITOU` (primeira ocorrência, dossiê sem violência) | "Vamos registrar. Uma ocorrência conta para o histórico do motoboy." | confirmar | registro no índice de reputação + ticket `ATRIBUÍDO` leve |

**Regras:**

- Máximo **2 rodadas**; se o cliente não escolhe nada em 10 min, vira ticket normal.
- A auto-resolução **sempre persiste um ticket resolvido** (`RESOLVIDO`) para métrica — não apaga rastro.
- Limite: auto-resolução **nunca** para `ASSEDIO` (humano, prioridade P1), nem para valor de dano acima do teto, nem para lote inteiro.
- **Triagem em 3 níveis** (fecha a fraude de "reclamar sempre"): (a) auto-aprovação até teto com **limite mensal por conta** (R$ 100/30 dias) e histórico de reclamações do cliente — reclamador habitual cai para nível humano; (b) revisão humana acima do teto com SLA por horário comercial e backlog noturno com prazo prometido ao cliente; (c) estorno de pedido em **lote** sempre com verificação do `trip_stops` e do `eta_forecast` persistido, nunca no relato.

### 3.3 "Juiz rápido" + "nota de confiança" — arbitragem em segundos e compensação proativa

**Ideia:** um motor de regras arbitra o caso em segundos com vereditos determinísticos e ações financeiras automáticas via ledger (`PAY-01`). A "nota de confiança" é o mesmo motor agindo **sem o cliente pedir nada**.

**Passo a passo de um julgamento:**

1. Ticket criado (ou auto-resolução devolvida sem conclusão).
2. Motor lê: tipo, dossiê (veredito automático), valor do pedido (`price_cents`), histórico do cliente (reclamações nos últimos 30/60 dias) e do motoboy (índices).
3. Aplica a tabela de vereditos abaixo.
4. Se veredito = reembolso/desconto: dispara estorno **idempotente** no ledger (`§6`) + push de confirmação + botão "ver como foi calculado".
5. Grava `ticket_verdicts` e alimenta métricas e índices.

**Tabela de vereditos (valores v1, parametrizáveis por feature flag):**

| Cenário | Condição | Veredito automático |
|---|---|---|
| Entrega comprovada dentro da janela (+15 min) | dossiê completo | `ENCERRADO_SEM_RESSARCIMENTO` + timeline enviada |
| Atraso > 45 min além da janela | pedido entregue | reembolso de 50% do `price_cents`, teto R$ 30 **ou** crédito 20% na próxima (cliente escolhe) — herda o espírito de `D-R13` |
| Atraso 15–45 min | pedido entregue | **nota de confiança**: crédito automático de 10% (teto R$ 10) sem pedir — "a gente se adiantou, seu pedido atrasou X min" |
| Pedido nunca entregue (`FAILED`/`CANCELED` pós-coleta) | dossiê confirma | reembolso integral ≤ R$ 50; acima → humano |
| Veio errado/danificado, valor do pedido ≤ R$ 50 | fotos do cliente | reembolso integral ≤ R$ 50 ou nova entrega grátis (cliente escolhe) |
| Veio errado/danificado, > R$ 50 | — | `EM_ANÁLISE` humano |
| Cobrança divergente | diferença ≤ R$ 50 | estorno da diferença |
| Reclamação falsa (dossiê comprovado contra) | cliente reincidente | ver §6 (fraude) |

**Limites e exceções:**

- Reembolso automático acumulado por cliente: **R$ 100 / 30 dias**; acima → humano (mesmo que o caso individual seja elegível).
- Nota de confiança não consome o limite acima (é proativo, não pedido).
- Assédio e segurança nunca passam pelo juiz rápido.
- Todo veredito automático tem **botão de contestação**; contestação vira `ESCALADO` com dossiê anexado.
- **Estorno pós-coleta:** automático apenas até teto (R$ 30); acima disso, humano com SLA — alinhado ao `PLANO_TRANSPORTADORA.md` R6.3.

## 4. Modelo de dados

### Novas tabelas

| Entidade | Campos essenciais |
|---|---|
| `tickets` | `id`, `ticket_no` (humano: `SUP-00042`), `type` (enum §2), `source` (`CUSTOMER`/`COURIER`), `author_id`, `delivery_id?`, `trip_id?`, `stop_id?`, `status`, `priority` (`P1`/`P2`/`P3`), `amount_cents` (valor envolvido), `auto_resolved`, `resolution` (enum), `opened_at`, `first_response_at`, `resolved_at`, `sla_due_at` |
| `ticket_messages` | `id`, `ticket_id`, `from_role`, `author_id`, `body`, `kind` (`TEXT`/`ACTION`/`SYSTEM`), `created_at` |
| `ticket_attachments` | `id`, `ticket_id`, `message_id?`, `type` (`PHOTO`/`DOC`), `url` (storage privado), `uploaded_by` |
| `ticket_events` | `id`, `ticket_id`, `event` (abrir, auto-tentar, atribuir, julgar, escalar, resolver…), `actor_role`, `metadata` (jsonb), `created_at` — auditoria completa |
| `ticket_verdicts` | `id`, `ticket_id`, `rule_id`, `outcome` (`REFUND`/`PARTIAL_REFUND`/`DISCOUNT_NEXT`/`CREDIT`/`DENIED`), `amount_cents`, `ledger_transaction_id?` (link do estorno), `explanation` (jsonb, o "como foi calculado") |
| `delivery_dossiers` | `id`, `delivery_id`, `snapshot` (jsonb: timeline de eventos, provas, ETAs, GPS), `confidence` (`FULL`/`PARTIAL`/`NONE`), `built_at` |

### Alterações em tabelas existentes

```
deliveries   + dossier_ready_at (flag de telemetria completa p/ dossiê)
delivery_events (já existe na prática de tracking; formalizar como fonte do dossiê;
                 timestamps SEMPRE server-side no upload)
ratings      + complaint_ref (avaliação 1 estrela pode puxar o ticket — vínculo B2C-03)
couriers     + complaint_rate_30d, block_flags (jsonb)
customers    + complaint_rate_30d, fraud_flags
ledger_transactions (PLANO_PAGAMENTOS)   + ticket_id (referência opcional no estorno)
courier_metrics (PLANO_TRANSPORTADORA)   + coluna de confiabilidade (ver §6)
```

## 5. Máquina de estados do ticket

```
ABERTO ──auto-resolve (§3.2/3.3)──► RESOLVIDO
   │                                   ▲
   ├──atribui──► ATRIBUÍDO ──analisa──► EM_ANÁLISE ──veredito──► RESOLVIDO
   │                                   │    └──────────────────► ENCERRADO_SEM_RESSARCIMENTO
   │                                   └──precisa humano──► ESCALADO ──► RESOLVIDO / ENCERRADO_SEM_RESSARCIMENTO
   │                                   └──AGUARDANDO_CLIENTE ──► (retorna a EM_ANÁLISE ou RESOLVIDO)
   └──abuso/duplicado──► CANCELADO (auditado)
```

| Estado | Quem chega | SLAs e timers |
|---|---|---|
| `ABERTO` | cliente/motoboy ou auto-resolução fracassada | ack em **< 5 s**; se elegível a juiz rápido, decide em **< 60 s**; senão auto-atribui em **< 2 min** |
| `ATRIBUÍDO` | sistema (round-robin) ou admin | `first_response_at` deve ser **< 5 min** (ack de humano); timeout 15 min sem ação → renomeia para o admin de plantão |
| `EM_ANÁLISE` | admin/suporte | SLA de resolução **24 h**; escalada automática **2 h** sem ação para P1 e **8 h** para P2/P3 |
| `AGUARDANDO_CLIENTE` | pediu reanálise ou evidência | cliente tem **48 h**; sem resposta, fecha com o veredito vigente |
| `RESOLVIDO` | veredito (auto ou humano) | ação financeira (se houver) executada em **≤ 1 min**; NPS de resolução disparado |
| `ESCALADO` | contestação / caso complexo | dono/admin sênior; sem SLA rígido, mas visibilidade no dashboard |
| `ENCERRADO_SEM_RESSARCIMENTO` | dossiê comprovado contrário | comunicado automático com o dossiê inteiro |
| `CANCELADO` | duplicado, spam, autor desistiu | sempre com motivo e auditoria |

Timers rodam em job; atraso de SLA emite alerta no painel (ver §7) e conta para métrica de suporte.

## 6. Regras de negócio

### Quem decide o quê

| Caso | Decisor | Regra |
|---|---|---|
| Reembolso integral ≤ R$ 50 com regra clara | **automático** | juiz rápido + ledger idempotente, respeitando limite mensal por cliente |
| Desconto/crédito de compensação (nota de confiança) | **automático** | tabela §3.3, independente de pedido |
| Reembolso parcial de atraso | **automático** | tabela §3.3 |
| Valor acima do teto, dossiê indeterminado, fraude suspeita, lote acima do teto | **admin** | ticket `ATRIBUÍDO`/`ESCALADO` |
| Assédio (ambos os lados) | **admin P1** | nunca automático; flag privada; bloqueio possível |
| Ajuste de saldo/carteira manual | **admin sênior** | via ledger com chave idempotente e motivo obrigatório (`PAY-01B`) |

### Financeiro (estorno pela carteira/ledger)

- Estorno = transação reversa no ledger (`PAY-01`): `cliente-reservado → cliente-disponível` se a entrega ainda não liquidou; se já liquidou, reversa a liquidação e re-estorna a fatia do motoboy/p plataforma conforme o veredito.
- Toda ação tem `idempotency_key` (replay seguro), e o `ticket_verdicts.ledger_transaction_id` fecha o rastro ticket → dinheiro.
- Pedido em **lote** (`LOT-01`): o estorno usa a **alocação por delivery** de `trip_quotes` — a fatia do pedido problemático volta ao cliente; as demais fatias e o repasse do motoboy pelos outros pedidos ficam intocados. O motoboy **não** perde o repasse dos pedidos entregues bem. Estorno de lote **sempre com verificação do `trip_stops` e do `eta_forecast` persistido**, nunca no relato.
- Motoboy **não** é penalizado financeiramente por falha que ele comprovadamente não causou (ex.: endereço errado pelo cliente) — mas tem o índice de confiabilidade protegido pelo dossiê (§3.1).
- **Clawback pós-payout (futuro, `PAY-02`):** crédito do motoboy só vira pagável após **janela de contestação (48–72 h)** ou percentual de retenção; cláusula de clawback no termo do motoboy. Sem isso, reclamação de dano no 3º dia pagaria a plataforma duas vezes.

### Impacto no índice do motoboy

| Fato | Efeito no índice |
|---|---|
| Reclamação procedente com prova (foto entregue ausente, atraso real > 15 min) | desconta `on_time_rate_30d` / confiabilidade; rebaixa prioridade de fila (herdado de `R5.5`) |
| Reclamação improcedente (dossiê completo contra) | **nenhum efeito** + proteção visível ao motoboy ("reclamação verificada como improcedente") |
| Reclamação procedente sem prova (dossiê parcial) | conta só depois de veredito humano; motoboy pode contestar |
| Assédio confirmado | suspensão imediata do app (`block_flags`); reincidência → descredenciamento |
| 3 reclamações procedentes em 30 dias | alerta no dashboard + entrevista de revisão |

### Fraude e limites por cliente

- Limite de reclamações por cliente: **3 em 30 dias** → a 3ª vira análise manual; **5 em 60 dias** ou 2 improcedentes com dossiê completo contra → revisão de conta (`fraud_flags`), reembolso automático desligado por 90 dias.
- Cliente com histórico de "recebi e reclamou" (pedido entregue com foto + GPS no raio e reclamação de não-recebimento) → análise manual obrigatória.
- **Bloqueio temporário de conta** (cliente ou motoboy): suporte pode bloquear por 7/30/90 dias com motivo auditado; bloqueio não apaga histórico e é reversível.
- **Fraude de auto-entrega** (motoboy cria cliente fake e "entrega" para receber repasse): correlação cliente-novo × motoboy-novo × mesmo dispositivo/IP na criação + teto de estorno por conta antes de telefone verificado (`B2C-04`).

## 7. Painel do admin para suporte

Referência de estrutura geral e permissões: `PLANO_ADMIN.md`. Papel `SUPPORT` (leitura/escrita em tickets; sem acesso financeiro além do estorno regrado; estorno manual acima do teto só `ADMIN`).

| Área | Conteúdo |
|---|---|
| **Fila** | tickets por prioridade (P1 vermelho), colunas: `SUP-xxxxx`, tipo, autor, delivery, tempo aberto, SLA restante (barra), veredito automático sugerido. Filtros: tipo, status, cliente/motoboy, período, valor. |
| **Detalhe do ticket** | dossiê completo (timeline com fotos/GPS/horários), mensagens em chat com ações rápidas (estornar, bloquear, ajustar índice, contestar dossiê), botão "julgar como humano" |
| **Decisões em lote** | reembolsar N tickets do mesmo tipo/regra com um clique (cada um com ledger idempotente) |
| **Alertas** | SLA estourando, reincidência de motoboy/cliente, `FROTA-01` transformando alerta operacional em sugestão de ticket (ex.: motoboy parado 30 min em `AT_PICKUP` → botão "criar ticket de coleta") |
| **Extrato do suporte** | total estornado/dia, custo médio por ticket, NPS de resolução |

Permissões: acesso a tickets é **separado** de "ver frota" e de "ver entregas" (mesma lógica de `canAccess` do `PLANO_FROTA_DASHBOARD.md`); tudo auditado em `ticket_events`.

## 8. Comunicação com o cliente

Canais: **push in-app primeiro** (barato, rico em botões), **SMS fallback** se o app não respondeu em 15 min (depende do gate `B2C-04`), **WhatsApp** apenas quando houver provider aprovado (decisão pendente). Toda mensagem sobre o ticket carrega o **dossiê** (link "ver linha do tempo").

| Momento | Canal | Template (pt-BR) |
|---|---|---|
| Abertura | push | `Recebemos sua reclamação do pedido #AQL-1234 (motivo: atraso). Estamos analisando — resposta em instantes.` + link dossiê |
| Auto-resolução tentada | push (botões) | `O pedido está X min atrasado. O que prefere? [Cancelar sem custo] [Desconto 20%] [Continuar]` |
| Veredito automático (reembolso) | push | `Resolvido! Reembolsamos R$ 24,90 no seu pedido #AQL-1234. Veja como foi calculado:` + dossiê |
| Nota de confiança | push | `Aqui Log se adiantou: seu pedido atrasou 22 min e por isso R$ 4,90 voltaram para sua carteira. Sem precisar pedir.` |
| Improcedente | push + e-mail/SMS | `Verificamos a entrega do #AQL-1234: entregue às 14:07, dentro do prazo, com foto e GPS no endereço. Veja a linha do tempo:` + dossiê |
| Escalado | push | `Seu caso #SUP-00042 foi escalado para análise especializada. Resposta em até 24 h.` |
| Aguardando ação do cliente | push | `Precisamos de você: 1 foto do pacote para concluir a análise (48 h).` |
| Resolução final + NPS | push | `Tudo certo por aqui? Como foi resolver com a gente? 1–5` |

Nenhuma mensagem de status fica **sem link para o dossiê** — transparência é o produto. Motoboy recebe comunicados análogos (dossiê dele) sem expor dados do cliente.

## 9. Métricas

| Métrica | Definição | Meta v1 |
|---|---|---|
| Tempo até 1ª resposta | ack ou resposta humana (`first_response_at − opened_at`) | **p95 < 60 s** (auto inclui); humano p95 < 5 min |
| Tempo de resolução | `resolved_at − opened_at` | **70% < 2 h**; p95 < 24 h |
| NPS de resolução | pesquisa pós-resolução (1–5) | ≥ 4,2 média |
| Taxa de reincidência | cliente/motoboy com novo ticket em 30 dias | < 15% |
| Custo médio por reclamação | estorno total + horas humanas ÷ tickets | decrescente; meta < R$ 12 |
| Auto-resolução rate | tickets resolvidos sem humano | ≥ 60% |
| Improcedência por dossiê | reclamações contra motoboy com dossiê completo a favor | sem meta, monitorar para calibrar proteção |
| Fraude detectada | tickets de fraude ÷ tickets | < 3% |

Alimenta o mesmo pipeline de relatórios do dashboard (`B2C-01B`) e os guardrails de lote (`PLANO_TRANSPORTADORA.md` §11: "incidentes e suporte não aumentam de forma material").

## 10. Edge cases

| Caso | Resolução |
|---|---|
| **Reclamação falsa** | dossiê completo contra + reincidência → análise manual, fraude flag, reembolso automático desligado por 90 dias (§6) |
| **Cliente nunca busca o pedido** (não recebe na parada) | motoboy registra `CLIENTE_AUSENTE` (foto + 10 min); reoferta/redespacho conforme `R7`; se cliente sumiu, ticket de motoboy → taxa de nova tentativa (decisão pendente do `PLANO_TRANSPORTADORA.md` §12 #7) decide quem paga |
| **Reembolso em pedido agrupado/lote** | estorno **só da fatia** alocada em `trip_quotes`; demais pedidos e repasses intactos (§6); viagem re-sequenciada sem tocar o resto; verificação do `trip_stops` e do `eta_forecast` |
| **Reclamação depois de 30 dias** | fora do prazo (§2) → rejeitada com explicação automática; aceita só por exceção do admin (fraude de motoboy conhecida) |
| **Entrega não concluída** (`FAILED`) | status vira reembolso automático na hora (se elegível) + pedido re-oferecido ou cancelado sem custo (`D-R13`); motoboy não é punido se dossiê mostrar motivo alheio |
| **Motoboy banido com saldo a receber** | saldo fica retido no ledger; ticket de suporte pendente do motoboy é arbitrado primeiro; pagamento segue política de payout futura (`PAY-02`) — banido não perde saldo por isso, mas não saca até encerrar pendências |
| **Pedido antigo sem telemetria** | sem dossiê (`confidence=NONE`) → fluxo humano direto; nunca inventar veredito |
| **Reclamação duplicada** | dedupe por `(delivery_id, type, author)` em 72 h; segunda vira mensagem no ticket original |
| **Assédio denunciado no papel errado** (motoboy que acusa cliente) | ambos têm canal; flag privada, sem exposição pública, P1, humano |
| **Cliente reclama e depois desiste** | cancelamento do ticket com motivo; histórico mantido para métrica |
| **Estorno falha no meio** | ledger com transação atômica: ou estorna inteiro ou nada; idempotência evita duplicidade; erro aparece no painel para retry manual |
| **Fim de semana/noite** | auto-resolução e juiz rápido rodam 24/7; análise humana acima do teto tem SLA por horário comercial + backlog noturno com prazo prometido ao cliente |
| **Payout já feito quando chega reclamação** | janela de contestação (48–72 h) antes do payout ou retenção percentual; clawback contratual (futuro `PAY-02`) |

## 11. Fases de implementação

| ID | Entrega | Dependências | Conteúdo |
|---|---|---|---|
| `SUP-01` | **Fundação de dados e dossiê** | `B2C-01` (campos de encomenda), telemetria atual | schema `tickets/ticket_messages/ticket_attachments/ticket_events/ticket_verdicts/delivery_dossiers`; coletor de dossiê a partir dos eventos existentes (timestamps server-side); abertura pelo app do cliente (botões por tipo + perguntas + prazos); ack < 5 s; fila simples no dashboard |
| `SUP-02` | **Auto-resolução guiada + juiz rápido** | `SUP-01`, `B2C-02` (preço v2 p/ vereditos), **`PAY-01`** (estorno idempotente) | árvores de auto-resolução (§3.2); motor de vereditos + tabela parametrizável (§3.3); nota de confiança; estorno via ledger com idempotência; triagem em 3 níveis; painel de vereditos e contestações |
| `SUP-03` | **Reclamação do motoboy + reputação** | `SUP-02`, **`B2C-03`** (avaliação mútua) | tipos do motoboy (§2.2); proteção por dossiê no índice de pontualidade/confiabilidade; `courier_metrics` com confiabilidade; fraude flags e limites por cliente (§6) |
| `SUP-04` | **Painel de suporte completo** | `SUP-02/03`, `PLANO_ADMIN.md` (papéis/permissões) | fila com prioridade e SLA, chat, decisões em lote, extrato do suporte, bloqueio temporário, ligação com alertas **`FROTA-01`** |
| `SUP-05` | **Comunicação de fora do app** | `SUP-04`, `B2C-04` (SMS) / provider de WhatsApp (decisão) | SMS fallback e WhatsApp (se aprovado) em todos os templates (§8); pesquisa NPS automatizada |

**Vínculos com o roadmap:** `SUP-01` entra depois de `B2C-01B` (dashboard B2C) e pode rodar em paralelo com `DISP-*`; `SUP-02` é **bloqueado por `PAY-01`** (sem ledger, sem estorno automático); `SUP-03` depende de `B2C-03`; `SUP-04` ganha muito com `FROTA-01`; reclamações de lote só funcionam plenamente após `LOT-01/02` (antes disso, ticket de lote cai em `OUTRO` com tratamento manual). Nada deste plano autoriza cloud, gateway, SMS pago ou WhatsApp.

**Definition of Done:** mesma regra do roadmap — migrations aditivas reversíveis, autorização por papel testada, unitários de regras puras (vereditos, SLAs, dedupe), integração de estorno com ledger idempotente, `pnpm build/lint/test/smoke` verdes, fluxo real exercitado (abrir → dossiê → veredito → estorno → NPS), `MVP_COVERAGE.md` e changelog atualizados.

## Decisões pendentes

| # | Decisão | Recomendação |
|---|---|---|
| S-1 | Prazos de reclamação (48 h dano/erro, 72 h atraso, 7 d cobrança) | validar com piloto |
| S-2 | Tetos do juiz rápido (R$ 50 reembolso, R$ 30/50% atraso, R$ 10 nota, R$ 100/mês) | começar conservador; subir com dados |
| S-3 | Percentuais da nota de confiança (10/20%) | parametrizável; medir efeito na reincidência |
| S-4 | Limites de fraude (3/30d, 5/60d, 90 d de desligamento) | confirmar com dono |
| S-5 | WhatsApp como canal (provider + custo) | só após `B2C-04` e OPS-02 |
| S-6 | Taxa de nova tentativa por ausência do cliente (herdado de `PLANO_TRANSPORTADORA` §12 #7) | decidir junto — afeta `CLIENTE_AUSENTE` |
| S-7 | Janela de contestação do payout (48–72 h) e retenção percentual | definir com `PAY-02` |
| S-8 | SLA humano noturno/fim de semana (horário comercial + backlog com prazo prometido) | confirmar cobertura do suporte |
