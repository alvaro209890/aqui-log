# Registro canônico de decisões

> **Atualizado:** 2026-08-07
> **Fonte de verdade:** este arquivo é o único lugar para o estado de `DEC-*`.

Recomendação não é decisão. Um agente não pode mudar `PENDENTE` para `DECIDIDA`
sem resposta explícita do Álvaro. Ao decidir, registrar data, autor, escolha e
consequência; os planos passam apenas a apontar para este registro.

## 1. Invariantes já decididos

| ID | Estado | Decisão |
| --- | --- | --- |
| `INV-01` | `DECIDIDA` | Produto B2C direto; empresa/B2B removido |
| `INV-02` | `DECIDIDA` (atualizada 2026-08-07) | **Local/dev:** PostgreSQL é fonte de verdade; Redis é auxiliar. **Produção cloud:** banco alvo = **Firebase Firestore** (`DEC-25`); Storage/FCM no mesmo Firebase. Migração = `OPS-DB-01` — não remover Postgres local antes disso. |
| `INV-03` | `DECIDIDA` | Preço calculado e congelado pelo servidor |
| `INV-04` | `DECIDIDA` | Mobile usa identidade laranja; dashboard ainda pendente |
| `INV-05` | `DECIDIDA` (atualizada 2026-08-07) | Alvos cloud **decididos** (`DEC-25`: Render + Vercel + Firebase). **Provisionar/ligar** ainda exige pedido explícito + credenciais. SMS e pagamentos/gateway idem. |
| `INV-06` | `DECIDIDA` | Persistência UTC; regras locais em `America/Sao_Paulo` |

## 2. Decisões do roadmap

| ID | Estado | Dono | Decisão | Bloqueia / libera |
| --- | --- | --- | --- | --- |
| `DEC-01` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Foto da encomenda **obrigatória** na criação de pedido novo (mín. 1). Pedidos legados sem foto continuam legíveis; criação sem foto é rejeitada. | Libera ativação em `B2C-05`; flag alinhada a true para novos |
| `DEC-02` | `DECIDIDA` (2026-08-08, Álvaro) | Álvaro | Valores **provisórios** definidos para destravar a implementação: base R$ 7,00; mínimo R$ 9,00; plataforma 20%; km imediato R$ 2,50 / agendado R$ 1,80; faixas de peso até 2/5/10/20 kg (+R$ 0 / 2 / 4,50 / 9) e +R$ 15 acima; tamanho P/M/G = +R$ 0 / 1,50 / 4. Multa do prestador R$ 3,00, do cliente R$ 0, cutoffs 5 min (imediato) e 60 min (agendado). **Tudo editável no painel admin**, sem deploy; calibragem real fica na tela de configurações. | Destrava `B2C-02` ✅ e `B2C-06` |
| `DEC-03` | `PENDENTE` | Álvaro | Sem aceite: raio, preço ou cancelamento? Recomendação: ampliar raio com limite; aumento só com consentimento | `DISP-01/02` |
| `DEC-04` | `PENDENTE` | Álvaro | Provedor de SMS | `B2C-04` |
| `DEC-05` | `PENDENTE` | Álvaro | Iniciar ledger sem gateway? | `PAY-01` |
| `DEC-06` | `PENDENTE` | Álvaro | Gateway PIX | `PAY-02` |
| `DEC-07` | `PENDENTE` | Álvaro | Rota automática compartilhada ou opt-in? | `TRIP-02` |
| `DEC-08` | `PENDENTE` | Álvaro | Lote manual convive com auto-dispatch? | `LOT-01` |
| `DEC-09` | `PENDENTE` | Álvaro | Candidatura livre ou pré-alocação no lote agendado? | `LOT-02` |
| `DEC-10` | `PENDENTE` | Álvaro | Janela de espera do lote (valores) | `LOT-01` |
| `DEC-11` | `PENDENTE` | Álvaro | Tolerâncias anti-atraso (valores) | `LOT-01` |
| `DEC-12` | `PENDENTE` | Álvaro | Retenção da trilha de frota | `FROTA-01` |
| `DEC-13` | `PENDENTE` | Álvaro | Estorno após coleta (teto e fluxo) | `SUP-02`, `LOT-01` |
| `DEC-14` | `PENDENTE` | Álvaro | Posição de motoboy ocioso | `FROTA-01` |
| `DEC-15` | `PENDENTE` | Álvaro | Deadhead intermunicipal | `LOT-02` |
| `DEC-16` | `PENDENTE` | Álvaro | Tetos do juiz rápido | `SUP-02` |
| `DEC-17` | `PENDENTE` | Álvaro | Janela de contestação/clawback antes do saque (ex.: 48–72 h) | `PAY-02`, saque elegível |
| `DEC-18` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Todo pedido tem `fulfillment_mode`: `IMMEDIATE` (agora) ou `SCHEDULED` (janela futura). Criação exige endereços, peso, tipo, tamanho **e** foto (`DEC-01`). | `SCHED-01`, `B2C-05` |
| `DEC-19` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Preço/km `IMMEDIATE` **>** `SCHEDULED`; ambos no admin versionado. Valores em `DEC-02`. Preço do cliente congelado na cotação/criação; reoferta usa snapshot. | `B2C-06`, `ADMIN-07` |
| `DEC-20` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Prestador pode aceitar `SCHEDULED` na criação (aceite antecipado). No aceite congelam-se repasse **e** taxa de cancelamento aplicável. `IMMEDIATE` segue oferta sob demanda. Agendado individual ≠ `LOT-02`. | `SCHED-01` |
| `DEC-21` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | App prestador: **Em andamento** + **Agenda**. Cancelamento voluntário só **até o cutoff** configurável antes do início da janela (`SCHEDULED`) ou da corrida (`IMMEDIATE`). Após o cutoff: bloqueado (só suporte). | `COUR-01` |
| `DEC-22` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Dentro do cutoff (`DEC-21`) e antes da 1ª coleta: cancelamento debita a **taxa congelada no aceite** do saldo interno. Fora do cutoff: bloqueado. Saldo insuficiente: **recusa** (sem saldo negativo). Revoga “desistência sem penalidade dura”. Pós-coleta: só suporte. | `COUR-02`, `PAY-01A` |
| `DEC-23` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Pagamento do prestador = **saldo interno** (ledger); dinheiro real só via **saque**. Modelo decidido; implementação atrás de `DEC-05`/`DEC-06`/`PAY-*`. | `PAY-01`, `PAY-02` |
| `DEC-24` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Coleta exige **foto de prova do prestador** **e** `pickup_code` (distinto de `AQL-*`) para `AT_PICKUP→PICKED_UP`. Foto de prova ≠ foto do cliente na criação. Fallback de código só admin/suporte. | `PICK-01` |
| `DEC-25` | `DECIDIDA` (2026-08-07, Álvaro) | Álvaro | Hospedagem cloud: **backend → Render**, **frontend (dashboard) → Vercel**, **banco de dados → Firebase (Firestore)**. Storage/FCM no mesmo Firebase. Redis continua auxiliar. Provisionar/ligar ainda exige credenciais + pacotes `OPS-*`. | `OPS-02`, `OPS-03`, `OPS-DB-01` |

## 3. IDs de decisões específicas dos planos

Questões detalhadas que ainda não têm `DEC-*` usam prefixo global e estável:

- `LOT-DEC-*` — lote e viagem;
- `FROTA-DEC-*` — mapa, heartbeat e retenção;
- `ADMIN-DEC-*` — permissões e operação do painel;
- `SUP-DEC-*` — suporte e reclamações;
- `PAY-DEC-*` — ledger e pagamentos;
- `FLOW-DEC-*` — fluxo cliente↔prestador (ver plano dedicado);
- `OPS-DEC-*` — hospedagem e migração cloud.

Quando uma questão específica for promovida ao roadmap, ela recebe novo `DEC-*` e
o plano registra o alias. Nunca referenciar apenas “decisão 3” ou “item 5”.

### 3.1 Pendências numéricas do fluxo (não reabrem a decisão)

| ID | Estado | O quê |
| --- | --- | --- |
| `FLOW-DEC-01` | `PENDENTE` | Valores de `courier_cancel_cutoff_minutes_*` e `courier_cancel_fee_cents` |
| `FLOW-DEC-02` | `PENDENTE` | Antecedência mínima para agendar (`min_schedule_lead_minutes`) |
| `FLOW-DEC-03` | `PENDENTE` | Comprimento/tentativas do `pickup_code` e política exata de fallback |

## 4. Como registrar uma decisão

1. Alterar o estado para `DECIDIDA` ou `REJEITADA`.
2. Substituir a recomendação pela escolha explícita, sem apagar o contexto anterior.
3. Adicionar data e autor no texto da decisão.
4. Atualizar gates no roadmap e estado no backlog.
5. Atualizar somente os planos afetados e incluir link para este registro.
