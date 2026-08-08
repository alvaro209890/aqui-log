# FLUXO_APP.md — O app Aqui Log explicado de ponta a ponta

> **Data:** 2026-08-07 · **Público:** qualquer pessoa (incluindo o dono) · **Fontes:** `PLANO_B2C.md`, `PLANO_LOTE_MULTI_PEDIDO.md`, `PLANO_FROTA_DASHBOARD.md`, `PLANO_CONFIANCA_E_PRECO.md`, `PLANO_PAGAMENTOS.md`, `PLANO_ADMIN.md`, `PLANO_SUPORTE_RECLAMACOES.md`
> **Como ler:** se você quer só entender o que funciona HOJE, leia as seções 1–4 e pule direto para a 10. Se quer entender o desenho completo (incluindo o que está planejado), leia tudo em ordem.

---

## 1. Visão geral (em 5 linhas)

1. **O Aqui Log é um app de entregas B2C**: a pessoa física se cadastra sozinha, descreve a encomenda (tipo, tamanho, peso, foto, alcance) e pede uma entrega.
2. **Não há atendente nem intermediário no meio**: o próprio sistema publica o pedido para os motoboys disponíveis, e o motoboy decide se aceita.
3. **Tudo que importa é rastreado**: status do pedido, GPS ao vivo, fotos de prova na coleta e na entrega, avaliação e extrato do motoboy.
4. **O preço é sempre calculado no servidor** — o app nunca "chuta" valor; cliente e motoboy veem o mesmo número.
5. **Para onde vai**: o motoboy poderá aceitar vários pedidos juntos (lote, inclusive entre municípios em blocos agendados), o dono acompanhará a frota num mapa em tempo real, o painel admin controlará quase tudo, e o dinheiro passará a ser controlado por uma carteira contábil (ledger) antes de qualquer gateway de pagamento real.

```
HOJE (funcional)      PLANEJADO (design aprovado)      FUTURO (atrás de gate)
cliente → pedido      aceite de lote pelo motoboy     PIX/gateway, SMS real,
→ motoboy aceita      blocos agendados                 foto obrigatória, nuvem,
→ entrega + prova     mapa de frota no dashboard      agrupamento automático,
→ avaliação           painel admin completo           payout bancário real
                      suporte/reclamações com
                      "prova reversa"
```

---

## 2. Os 4 papéis

| Papel | Quem é | O que faz | Aprovação |
|---|---|---|---|
| **Cliente** | Pessoa física | Pede, paga (futuro), acompanha, recebe, avalia e reclama | Nenhuma — se cadastra sozinho e já entra |
| **Motoboy** | Prestador de serviço | Executa coleta e entrega, com provas; decide o que aceita; recebe repasse | Admin (envia documentos e espera aprovação) |
| **Admin** | O dono/operador | Aprova motoboys, resolve problemas e reclamações, vê relatórios, (futuro) monitora a frota e controla quase tudo pelo painel | — |
| **Sistema** | O servidor (backend) | Publica ofertas, calcula preço, ETAs e rotas, bloqueia o que não pode, guarda tudo em auditoria, controla o dinheiro | — |

Regra de ouro: **o Sistema é o árbitro**. Ele não decide se a entrega acontece (isso é do motoboy), mas decide o preço, o prazo, o que é válido e o que é bloqueado. Ninguém "burla" o sistema: preço nunca vem do app, avaliação só existe após entrega concluída, e dinheiro só se move com registro.

---

## 3. Jornada do cliente (o que ele VÊ em cada passo)

### Passo 1 — Cadastro
- **O que faz:** informa nome, CPF e telefone; cria senha.
- **O que VÊ:** aprovado na hora (auto-aprovado), já entra logado, sem esperar ninguém. Abre com 4 abas: **Início / Pedir / Entregas / Perfil**.
- *Futuro:* verificação de telefone por SMS antes de contas públicas em produção (gate `DEC-04`).

### Passo 2 — Pedir
- **O que faz:** descreve a encomenda e os endereços de coleta e entrega.
- **Campos da encomenda:** tipo (7 categorias: Documento, Alimento, Eletrônico, Frágil, Roupas, Medicamento, Outro), tamanho (P/M/G), peso (kg), alcance (mesma cidade / outra cidade ou município), até 3 fotos e observação livre.
- **O que VÊ:** formulário simples; a foto aparece no card do motoboy (hoje opcional — obrigatória no futuro).
- *Planejado (agendamento):* o cliente pode escolher dia e janela de coleta para pedidos agendados (lotes intermunicipais). O preço é o do momento da criação (congelado). Se o bloco não formar, o pedido vira individual automaticamente até X min antes da janela — com aviso no app.
- **Quando pode pedir:** apenas estados permitidos — depois de aceito, não dá para mudar a encomenda.

### Passo 3 — Preço
- **O que faz:** nada — o valor é calculado no servidor (`PricingService`).
- **Hoje:** base + quilometragem + percentual da plataforma. **Planejado (preço v2):** breakdown transparente (base + distância + adicional de tamanho + adicional de peso), prévia do valor ANTES de confirmar e cotação com validade — se a cotação expirar, o app pede nova confirmação.
- **O que VÊ:** o valor total. No futuro, verá o detalhamento ("por que custa isso?") e nunca pagará a mais sem uma nova proposta com o motivo.
- **Regra de confiança:** o valor mostrado na confirmação fica **congelado** — nem atraso nem lote mudam o preço sem consentimento.

### Passo 4 — Acompanhar
- **O que VÊ:** lista de entregas + detalhe do pedido com status colorido (semântico), foto da encomenda, GPS ao vivo do motoboy e, no futuro, ETA ("chega às 15h20"), avisos de atraso e, em lote, "seu pacote está a N paradas de você" — **nunca vê** endereço/posição de paradas de outras pessoas.
- **Espera de agrupamento (lote):** se o pedido está aguardando entrar num lote, o app mostra "buscando motoboy para otimizar sua entrega" (janela de 5–15 min).
- **Aviso de atraso:** se o ETA mudar mais que 5 minutos, o sistema notifica; se o atraso passar de 45 minutos além da janela prometida, o cliente ganha a opção de **cancelar sem custo** (regra D-R13).

### Passo 5 — Receber
- **O que VÊ:** status `DELIVERED` e a foto de prova da entrega. (E na coleta: foto de prova da coleta.)

### Passo 6 — Avaliar
- **O que faz:** nota de 1 a 5 + comentário opcional.
- **Regras:** só após `DELIVERED`, só quem participou daquela entrega, uma avaliação por entrega.
- *Planejado:* avaliação **mútua** — o motoboy também avalia o cliente (nota do cliente afeta a fila de quem aceita servir). Em lote, a tela mostra o contexto ("lote de N pacotes") e avaliações de entregas com atraso sistêmico passam por revisão leve.
- **Reclamar:** logo após a avaliação aparece "Algo deu errado?" com botões rápidos por tipo (atrasou, não chegou, veio danificado, veio errado, motorista não respeitou, cobrança, outro). Detalhes no `PLANO_SUPORTE_RECLAMACOES.md`.

### Passo 7 — Reclamar / cancelar
- **Cancelar pedido:** antes do motoboy aceitar é livre (e devolve 100% do dinheiro no futuro); depois de aceito, entra em regra configurável; depois da coleta, vira análise do admin (ver seção 9).
- **Reclamação:** abertura recebe confirmação em < 5 s; o sistema tenta **auto-resolução guiada** (botões: cancelar sem custo / desconto / aguardar) e depois o **juiz rápido** (vereditos automáticos com reembolso até teto via ledger). Só o que escapa vai para o admin/suporte com SLA. Detalhes em `PLANO_SUPORTE_RECLAMACOES.md`.

```
CADASTRO → PEDIR → PREÇO → ACOMPANHAR → RECEBER → AVALIAR → RECLAMAR/CANCELAR
  auto     4 abas   servidor  status+GPS+ETA  prova   1..5      auto-resolução + admin
```

---

## 4. Jornada do motoboy (o que ele VÊ em cada passo)

### Passo 1 — Cadastro e aprovação
- Envia documentos; **fica pendente até o admin aprovar** (não é auto-aprovado como o cliente).
- *Planejado:* informa a capacidade do veículo (kg, volume, nº de pacotes).

### Passo 2 — Disponibilidade
- Liga "disponível" e manda localização GPS. É assim que entra no despacho.
- *Planejado (frota):* heartbeat de posição a cada 10 s em viagem, 30 s ocioso; o app mostra quando está com sinal fraco.

### Passo 3 — Oferta
- **O que VÊ:** um card com a encomenda — tipo · tamanho · peso · alcance · foto —, código, endereços, e o repasse. Aceita ou recusa.
- Hoje: o sistema oferece **um pedido por vez ao motoboy mais próximo** (sem concorrência de cards). *Planejado:* fila com filtro por município, janelas de coleta/entrega e ordenação por janela.

### Passo 4 — Aceite individual
- Toca "aceitar" → o servidor valida e trava (lock + revalidação) → status `ACCEPTED`. Se dois motoboys aceitam juntos, só um ganha.
- **Preço e repasse ficam congelados no aceite.**

### Passo 5 — Aceite de lote (planejado, `LOT-01`)
- Multi-select de vários pedidos → "Montar lote" → **pré-vet** no servidor:
  - capacidade (peso/volume soma ≤ 100%; 80–100% pede confirmação extra; > 100% bloqueia),
  - viabilidade da sequência (coleta antes de entrega, sempre),
  - janelas (folgas mínimas entre paradas),
  - ETAs por parada (inclui o trecho de retorno em viagem intermunicipal — deadhead).
- **Pré-vet falhou** → mostra o motivo exato ("peso total excede a capacidade da moto") e bloqueia o envio. **Pré-vet ok** → resumo com sequência sugerida (mapa), km, tempo, peso/volume somado e repasse total.
- **Aceite atômico (all-or-nothing):** todos passam para `ACCEPTED` juntos, ou nenhum. Limite do piloto: **máx. 3 pedidos por lote**.
- Se um pedido sair da fila enquanto ele monta o lote, a seleção é revalidada a cada 30 s com aviso.

### Passo 6 — Bloco agendado intermunicipal (planejado, `LOT-02`)
- Pedidos de um município para outro com data fixa viram **blocos**: "Cuiabá → Rondonópolis, 3 pedidos, coleta 07h–08h, entrega até 12h, repasse R$ 84".
- O motoboy se **candidata** ao bloco; a confirmação segue o mesmo aceite atômico. Um motoboy só tem um bloco ativo por faixa de tempo.

### Passo 7 — Coleta
- Chega na retirada (`AT_PICKUP`) → coleta (`PICKED_UP`) com **foto de prova** e código do pacote.
- Em viagem multi-parada, cada pacote tem estado e prova próprios — **falha de um não derruba os outros**.

### Passo 8 — Viagem
- `IN_TRANSIT` com GPS ao vivo. Em lote, o sequenciador do servidor define a ordem (coletas cedo, entregas respeitando coleta-antes-entrega; rota ótima para ≤ 4 paradas, heurística acima). Reordenar manualmente é permitido, mas **sempre revalidado** pelo servidor.

### Passo 9 — Anti-atraso (o que o motoboy VÊ quando atrasa)
- O servidor recalcula ETAs a cada evento. Se o ETA passar do fim da janela → flag `AT_RISK` + **push com 3 opções: seguir, pular ou reordenar**.
- Sem resposta em 120 s e pedido ainda **não coletado** → sistema oferece **redespacho** (outro motoboy). Já coletado → registra `late_delivery` e segue (política suave).
- **Índice de pontualidade** (janela de 30 dias, tolerância 15 min) rebaixa a prioridade na fila e a elegibilidade a blocos — **não corta pagamento** na v1. Atrasos com causa registrada (cliente ausente, falha de outra parada) são excluídos do índice.

### Passo 10 — Entrega e prova
- `DELIVERED` com foto de prova. Em caso de problema: parada `FAILED` com motivo + prova. Reclamação do cliente contra ele? O sistema monta o **dossiê** (timeline com fotos/GPS/horários) — se o dossiê comprovar a entrega, a reclamação é improcedente e o motoboy é protegido (não perde índice nem repasse).

### Passo 11 — Carteira
- **O que VÊ:** extrato com créditos do MVP (repasse por entrega).
- *Planejado (`PAY-01`):* conta contábil com saldo disponível/reservado, extrato nos apps e obrigação de repasse registrada em ledger. *Futuro (`PAY-02`+):* saque real via gateway/PIX, com janela de contestação (buffer de liquidação) antes do payout.

```
CADASTRO → APROVAÇÃO → DISPONÍVEL → OFERTA → ACEITE (individual ou LOTE)
→ COLETA (prova) → VIAGEM → ENTREGA (prova) → CARTEIRA
```

---

## 5. Jornada do admin (o que ele VÊ em cada passo)

### Passo 1 — Aprovar motoboys
- Vê lista de candidatos com documentos, aprova ou recusa. *(Futuro: também vê capacidade declarada.)*

### Passo 2 — Monitorar a frota (planejado, `FROTA-01/02`)
- **Mapa operacional:** um pino por motoboy, com ícone por estado derivado — ocioso (verde, coarsificado), indo para coleta (laranja), com carga (índigo), entregando (roxo), sem sinal (cinza tracejado). A coleta de cada pedido mostra selo ✓ (recolhida) ou pulsando (motoboy presente, ainda não recolheu).
- **Trilha:** trajeto real (linha azul), rota prevista (tracejada cinza), desvio em vermelho — só em detalhe durante viagem ativa.
- **Lista de prestadores:** tabela com nome, estado, pedido atual, ETA, alertas, tempo sem sinal — "sem sinal" no topo.
- **Alertas** (calculados no servidor, configuráveis): atraso de janela, parado fora da parada, desvio de rota, sem sinal, **pedido não recolhido**, bateria baixa — cada um com nível amarelo/vermelho e **ack auditado**.
- **Métricas:** contadores em tempo real (online, ocioso, em viagem, sem sinal, entregas, em atraso).
- **Privacidade:** posição exata só é exposta **durante viagem ativa**; ocioso aparece coarsificado (nunca a casa do motoboy), acesso é por permissão própria ("ver frota") e fica registrado em audit log.

### Passo 3 — Controlar quase tudo pelo painel (planejado, `PLANO_ADMIN.md`)
- **Pedidos:** mudar status (motivo obrigatório), cancelar, redespachar, reatribuir motoboy, ajustar preço (com auditoria e consentimento do cliente).
- **Motoboys:** aprovar, suspender, reativar, editar capacidade.
- **Clientes:** suspender, reativar, reembolsar via ledger.
- **Viagens/lotes:** ver paradas, reordenar (respeitando invariantes), remover pedido do lote, cancelar lote.
- **Financeiro:** ledger, estornos, crédito manual de teste, relatórios.
- **Configurações:** feature flags, preços, tolerâncias anti-atraso, limiares de alerta — tudo editável com rollback de 1 clique.
- Toda ação destrutiva tem **confirmação dupla + motivo obrigatório + audit log**; dinheiro só se move via transação de ledger.

### Passo 4 — Resolver disputas e reclamações
- Cancelamento após coleta, desistência do motoboy após a 1ª coleta, devolução de pacote: tudo passa por **suporte/admin** (nada disso é automático).
- Ação sugerida pelo sistema em pedido parado não recolhido: **"cancelar e reofertar"** — o sistema sugere, o admin decide (não é automático).
- Fila de reclamações com SLA, dossiê da entrega em mãos, decisões de estorno (automáticas até teto; humanas acima), penalização de motoboy com efeito exibido antes.

### Passo 5 — Relatórios
- Dashboard com entregas, status, auditoria de eventos. *Planejado (`B2C-01B`):* filtros por cliente, categoria, tamanho e peso da encomenda.

### Passo 6 — Configurações
- O admin (via configuração server-side, não código) ajusta: preço (base, km, percentual da plataforma e, no futuro, faixas de tamanho/peso), limites de lote, tolerâncias anti-atraso, limiares de alerta e feature flags (ex.: foto obrigatória).

---

## 6. Máquina de estados completa e unificada

Há **três estados andando em paralelo** para a mesma entrega: o do **pedido**, o da **viagem** (quando há lote) e o da **reserva de dinheiro**. Eles estão amarrados.

### 6.1 Pedido individual

```
              ┌─────────── redespacho ───────────┐
              ▼                                  │
REQUESTED ──► OFFERED ──► ACCEPTED ──► AT_PICKUP ──► PICKED_UP ──► IN_TRANSIT ──► DELIVERED
   ▲   ▲        │            │                │                │
   │   │        │            ▼                ▼                ▼
   │   │        │      (falha coleta)    (falha entrega)   (desistiu pós-coleta:
   │   │        ▼            │                 │            só com suporte)
   │   │    REMOVED_FROM_TRIP
   │   └──────────────► REDISPATCHED ──► REQUESTED
   ▼
CANCELED (cliente ou admin)   FAILED (falha com motivo + prova)
```

- **CANCELED** — cliente cancela ou admin cancela (guard: só ≤ `AT_PICKUP`; pós-coleta exige fluxo de devolução).
- **FAILED** — falha de coleta ou entrega, sempre com motivo + prova.
- **REMOVED_FROM_TRIP → REDISPATCHED → REQUESTED** — o pedido saiu de um lote e volta à fila como corrida individual.

### 6.2 Viagem (lote)

```
DRAFT ──montar lote──► PROPOSED ──aceite atômico──► ACCEPTED ──1ª coleta──► IN_PROGRESS
  │                        │  (agendado)              │                        │
  │                        │ SCHEDULED ──────► ACCEPTED│                        ├──► COMPLETED
  │                        ▼                          │                        ├──► PARTIALLY_COMPLETED
  └──────────► CANCELED (expirou / desistiu)           └──► CANCELED (restantes ──► fila)
```

### 6.3 Como viagem e pedido se relacionam

| Estado da viagem | Estado dos pedidos do lote |
|---|---|
| `ACCEPTED` | todos `ACCEPTED` |
| `IN_PROGRESS` | ≥ 1 coletado (`PICKED_UP`/`IN_TRANSIT`); demais `AT_PICKUP` ou pendentes |
| `COMPLETED` | todos `DELIVERED` |
| `PARTIALLY_COMPLETED` | ≥ 1 `DELIVERED` e ≥ 1 `CANCELED`/`FAILED`/`REMOVED_FROM_TRIP` |
| `CANCELED` | não concluídos voltam a `REQUESTED` (fila) |

Um job de **reconciliação** procura divergências entre viagem e pedidos — os dois nunca divergem silenciosamente, e qualquer mudança de janela/sequência vira evento de auditoria.

### 6.4 Reserva de dinheiro (planejado, `PAY-01`)

```
NONE ──pedido confirmado──► RESERVED ──entrega concluída──► SETTLED
                              │
                              └──cancelou/expirou──► RELEASED (devolvido ao cliente)
```

---

## 7. Decisões automáticas do sistema vs. o que é manual

### ⚙️ Automático (o Sistema faz sozinho)

| Decisão | Como funciona | Status |
|---|---|---|
| **Auto-dispatch** | Ao criar o pedido, oferta direta ao motoboy disponível mais próximo. Sem motoboy → `REQUESTED` e tenta de novo. | ✅ funcional |
| **Preço server-side** | Base + km + % plataforma (v2: + tamanho + peso, com breakdown). App nunca envia valor. | ✅ v1 / 📐 v2 |
| **Pré-vet de lote** | Capacidade, sequência, janelas e ETAs validados antes de montar; bloqueia envio com motivo específico. | 📐 |
| **ETAs e rota** | Recalculados a cada evento; divergência > 5 min vira `ETA_UPDATED` + notificação ao cliente. Sequenciador usa rota ótima para ≤ 4 paradas, heurística acima. | 📐 |
| **Anti-atraso** | `AT_RISK` quando ETA passa do fim da janela → push com 3 opções; sem resposta em 120 s e não coletado → oferece redespacho. | 📐 |
| **Redespacho** | Pedido → `REQUESTED` → nova oferta; cliente avisado quando novo motoboy aceita. | ✅ básico / 📐 anéis de raio (`DISP-01/03`) |
| **Reserva por delivery** | `SETNX` no Redis: o pedido reservado para um lote nunca coexiste com oferta individual; checado em TODOS os caminhos de aceite. | 📐 |
| **Reserva de dinheiro** | Bloqueio atômico do saldo na confirmação; liberação em cancelamento/expiração; liquidação idempotente em `DELIVERED`. | 📐 `PAY-01` |
| **Alertas de frota (A-1..A-7)** | Atraso, parado fora da parada, desvio de rota, sem sinal, não recolhido, bateria — níveis amarelo/vermelho com dedup. | 📐 |
| **Reconciliação** | Job compara viagem × pedidos; webhook/ledger reconciliado com gateway (futuro). | 📐 |
| **Índice de pontualidade** | 30 dias, tolerância 15 min; afeta prioridade de fila e elegibilidade a blocos; **não** corta pagamento; atrasos com causa registrada são excluídos. | 📐 |
| **Suporte: auto-resolução + juiz rápido** | Abertura < 5 s; árvores de auto-resolução; vereditos automáticos (reembolso ≤ teto, nota de confiança) via ledger idempotente; dossiê automático decide improcedência. | 📐 `SUP-01/02` |

### 🙋 Manual (pessoa decide)

| Decisão | Quem decide |
|---|---|
| Aceitar ou recusar oferta (individual ou lote) | Motoboy — o sistema só oferece |
| Aprovar motoboy | Admin |
| Cancelar/reofertar pedido não recolhido (sugerido pelo alerta) | Admin |
| Disputa de cancelamento **após coleta** acima do teto | Admin/suporte (automático só até R$ 30 pós-coleta) |
| Desistência do motoboy **após** a 1ª coleta | Só com autorização de suporte |
| Aumento de preço | Nunca silencioso — nova proposta com motivo + consentimento do cliente |
| Ack de alerta de frota | Admin/suporte, auditado |
| Reclamação acima do teto / assédio / fraude | Admin/suporte com SLA (nunca automático) |

---

## 8. Cadeia do dinheiro (conforme `PLANO_PAGAMENTOS.md`)

Primeiro, os conceitos — eles parecem sinônimos, mas não são:

| Conceito | Significado |
|---|---|
| **Preço** | Valor congelado do pedido, calculado pelo servidor |
| **Carteira** | Visão contábil do saldo (não é dinheiro físico) |
| **Reserva** | Saldo do cliente travado enquanto a entrega está aberta |
| **Liquidação** | A reserva vira receita da plataforma + obrigação de pagar o motoboy |
| **Pagamento** | Entrada real de dinheiro (gateway) |
| **Repasse/payout** | Saída real de dinheiro para o motoboy |

### Fluxo completo (planejado)

```
 1. PREÇO        servidor calcula (base + km + %; v2: +tamanho +peso, breakdown)
 2. OFERTA       cliente confirma → preço e repasse CONGELADOS (no lote:
                 composition_snapshot + alocação por delivery)
 3. RESERVA      cliente-disponível ──► cliente-reservado   (bloqueio atômico)
 4. EXECUÇÃO     motoboy coleta/entrega com provas
 5. LIQUIDAÇÃO   em DELIVERED: cliente-reservado ──► receita-plataforma
                                                      + pagar-motoboy
 6. REPASSE      pagar-motoboy ──► saída real (gateway) — FUTURO, com janela de
                 contestação (48–72 h) antes do payout (clawback)
 7. ESTORNO      cancelou/expirou: cliente-reservado ──► cliente-disponível
```

O ledger é **imutável**: cada evento financeiro gera lançamentos que somam zero (partidas dobradas), em centavos, com chave de idempotência. Nada é editado ou apagado — erro é corrigido com lançamento reverso. Saldo disponível nunca fica negativo.

### Regras de cancelamento e estorno

| Momento do cancelamento | Regra (recomendada, a confirmar) |
|---|---|
| Antes do aceite | libera 100% da reserva |
| Aceito, antes da coleta | regra configurável (possível taxa) — decisão explícita |
| Após coleta | automático **só até teto** (R$ 30); acima disso, análise administrativa com SLA (motoboy pode receber compensação de deslocamento) |
| Cancelado pelo sistema (sem motoboy) | libera 100% |

### Dinheiro no lote

- Cada pacote tem **fatia própria** de preço e repasse (`trip_quotes`).
- Cliente **nunca paga acima** do preço individual já mostrado.
- Fallback para corrida individual reutiliza o **preço congelado original** (nunca maior), com auditoria de motivo.
- Estorno da fatia cancelada mantém o preço dos demais — a diferença vira custo/margem da plataforma, com **piso de repasse** por viagem para evitar margem negativa (decisão pendente do `PLANO_LOTE_MULTI_PEDIDO.md`).

---

## 9. Quem faz o quê em cada situação

| Situação | Sistema faz | Cliente faz | Motoboy faz | Admin faz |
|---|---|---|---|---|
| **Cliente cancela** (antes do aceite) | `CANCELED`; libera 100% da reserva (futuro) | toca "cancelar" | — | vê no log |
| **Cliente cancela** (aceito, antes da coleta) | tira do lote, re-sequencia, estorno parcial por fatia | cancela (regra/taxa configurável) | perde a corrida; compensação conforme regra | — |
| **Cliente cancela** (após coleta) | estorno automático até teto R$ 30; acima, bloqueia e registra para análise | abre o pedido | devolve/repassa conforme política | **analisa e decide** acima do teto |
| **Motoboy desiste** (antes da 1ª coleta) | pedido volta à fila (`REQUESTED`), redespacha; registra no índice de confiabilidade | vê novo motoboy quando aceitar | desiste sem penalidade dura | — |
| **Motoboy desiste** (após 1ª coleta) | **exige autorização de suporte**; orquestra devolução | é avisado | solicita via suporte | **autoriza/recusa** |
| **Atraso** | recalcula ETA, notifica, `AT_RISK`, oferece 3 opções ao motoboy; 120 s sem resposta → redespacho (se não coletado); > 45 min → oferece cancelamento sem custo ao cliente | pode cancelar sem custo | segue/pula/reordena; se já coletou, registra `late_delivery` e segue | vê alerta vermelho + pedido atrasado na frota |
| **Falha de coleta** | parada `FAILED` com motivo + prova; se antes da coleta, pedido volta à fila; viagem re-sequenciada | é avisado | registra o motivo/prova | acompanha |
| **Falha de entrega** | `FAILED` com motivo + prova; demais pedidos do lote continuam | é avisado | registra motivo/prova | acompanha |
| **Pedido não recolhido** (`AT_PICKUP` parado) | alerta amarelo 15 min / vermelho 30 min; sugere "cancelar e reofertar" | vê status | recebe aviso | **decide** cancelar/reofertar (não automático) |
| **Reclamação aberta** | ack < 5 s; auto-resolução; juiz rápido (≤ teto); dossiê; acima do teto → fila com SLA | descreve o problema (botões rápidos + foto quando exigida) | apresenta versão/provas (dossiê o protege se improcedente) | **analisa e resolve** acima do teto, estorna, penaliza com efeito exibido |
| **Sem motoboy no sistema** | `REQUESTED`, tenta redespacho; se exaurir, mantém estado recuperável (tentar de novo, editar ou cancelar) | pode editar/cancelar | — | vê métricas de despacho |

---

## 10. O que já existe, o que está em design e o que é futuro

### ✅ Funcional HOJE (MVP B2C, rodando)

| Item | Detalhe |
|---|---|
| Cadastro/login do cliente | Auto-aprovado, auto-login, 4 abas |
| Pedido estruturado | Tipo (7 categorias), P/M/G, peso kg, alcance, foto, destinatário — código e testes prontos (aplicação da migration em banco pendente) |
| Auto-dispatch | Oferta ao motoboy disponível mais próximo; 1 oferta por vez |
| Aceite/recusa do motoboy | Card com a encomenda completa |
| Estados do pedido | `REQUESTED → OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED` (+ `CANCELED`) |
| Rastreamento | GPS ao vivo + WebSocket com `customerId` |
| Provas | Foto na coleta e na entrega |
| Preço v1 | Base + km + % plataforma, sempre no servidor |
| Avaliação | Cliente avalia a entrega (1–5 + comentário), só após `DELIVERED` |
| Carteira do motoboy | Crédito interno + extrato (não é dinheiro real) |
| Dashboard base | Mapa Leaflet com pinos e linhas, relatórios, auditoria |
| Backend B2B legado | Continua suportado por compatibilidade, mas o produto é o B2C |

### 📐 Em design (aprovado, documentado — SEM código ainda)

| ID | O quê |
|---|---|
| `LOT-01` | Aceite de lote pelo motoboy: multi-select, pré-vet, aceite atômico all-or-nothing, máx. 3 pedidos, reserva por delivery, regras anti-atraso D-R1..D-R13 |
| `LOT-02` | Blocos agendados intermunicipais (candidatura, janelas, reserva de capacidade, índice de pontualidade, deadhead no preço) |
| `FROTA-01/02` | Mapa de frota no dashboard: pinos por estado derivado, coleta recolhida ✓, trilha, alertas A-1..A-7 com ack, lista e métricas |
| `ADMIN-01..07` | Painel admin com controle total: pedidos, motoboys, clientes, viagens, financeiro, configurações, notificações — tudo com confirmação dupla + auditoria |
| `SUP-01..05` | Suporte e reclamações: dossiê automático ("prova reversa"), auto-resolução guiada, juiz rápido, nota de confiança, fila admin com SLA |
| `B2C-02` | Preço v2 com breakdown, prévia e cotação com validade |
| `B2C-03` | Avaliação mútua (motoboy também avalia o cliente) |
| `DISP-01/02/03` | Reoferta em anéis de raio, aviso ao cliente e telemetria |
| `B2C-01B` | Relatórios por categoria/tamanho/peso no dashboard |
| `PAY-01` | Ledger interno sem gateway: reserva, liquidação, estorno — **aguarda autorização** + preço v2 |
| `TRIP-00/01/02` | Agrupamento automático: primeiro o gate de descoberta, depois shadow mode, depois piloto |

### 🔒 Futuro (bloqueado por gate — nada de cloud, gateway ou rota multi-pedido operacional sem o gate)

| Item | Gate que destrava |
|---|---|
| `PAY-02` PIX via gateway | `DEC-06` + sandbox + `PAY-01` validado (Pagar.me é candidato, a validar) |
| Payout real ao motoboy | Viabilidade regulatória/operacional + janela de contestação definida |
| Validação de telefone por SMS (`B2C-04`) | `DEC-04` + provedor/sandbox — pré-requisito para cadastro público em produção |
| Foto obrigatória antes de publicar oferta | `DEC-01` (flag já existe desligada) |
| Publicação em nuvem | Gates operacionais + pedido explícito do dono |
| Cartão tokenizado | PIX estável e necessidade comprovada |
| Agrupamento automático operacional | Gate `TRIP-00` (medir densidade real) |
| Fora de escopo, ponto: | van/caminhão, hubs, rastreamento por hardware, dinheiro na entrega, saldo negativo, negociação livre de preço |

---

### Glossário rápido

- **Auto-dispatch** — publicação automática do pedido para motoboys disponíveis.
- **Pré-vet** — checagem do servidor antes do aceite de lote (capacidade, janelas, sequência).
- **Aceite atômico** — tudo junto ou nada: lote só aceita se todos os pedidos passarem.
- **Janela** — intervalo de tempo permitido para coleta/entrega.
- **`AT_RISK`** — aviso (não é estado): o ETA estourou o fim da janela.
- **Redespacho** — pedido volta à fila para outro motoboy.
- **Ledger** — livro contábil imutável em que todo lançamento soma zero.
- **Reserva** — saldo do cliente travado; vira receita na liquidação ou volta no estorno.
- **Dossiê** — linha do tempo automática da entrega (fotos, GPS, horários) que decide reclamações sem depender da palavra de ninguém.
- **Deadhead** — trecho de retorno vazio numa viagem intermunicipal; entra no preço/repasse.
- **Nota de confiança** — compensação proativa (crédito automático) quando o pedido atrasa, sem o cliente pedir.

---

Fim. Nenhum arquivo foi editado além deste documento.
