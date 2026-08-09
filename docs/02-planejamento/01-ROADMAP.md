# Aqui Log — Roadmap executivo B2C

> **Atualizado:** 2026-08-09
> **Status:** fonte de verdade para prioridade, dependências e ordem de execução
> **Rodada atual:** `SCHED-01`+`B2C-06` fechados com evidência de runtime local
> (modo agendado com janela de 30 min de antecedência, tarifa dual congelada,
> aceite antecipado, reserva de agenda, migration com rollback ensaiado e smoke
> vivo com cenário agendado).
> **Próximo pacote:** `COUR-01` (Em andamento / Agenda), `UX-02` (QA visual) ou `DISP-01`.
> **Produto principal:** cliente pessoa física → motoboy, sem intermediário no fluxo
> **Regra operacional:** desenvolvimento e validação local primeiro; nenhuma cloud é ligada sem pedido explícito do Álvaro

## 1. Objetivo atual

Transformar o MVP B2C já funcional em um piloto confiável, mensurável e preparado para cobrança, sem antecipar complexidade de gateway, cloud ou rotas compartilhadas.

O fluxo que precisa permanecer íntegro em todas as fases é:

```text
cliente cadastra → descreve encomenda (foto+peso+endereços obrigatórios)
→ escolhe IMMEDIATE ou SCHEDULED → recebe preço do servidor (km conforme modo)
→ cria pedido → sistema oferece (aceite antecipado permitido no agendado)
→ motoboy aceita → agenda/em andamento → coleta (pickup_code + prova)
→ trânsito → entrega/prova → cliente e motoboy avaliam
→ saldo interno do motoboy (saque futuro)
```

Plano detalhado do fluxo: [PLANO_FLUXO_CLIENTE_PRESTADOR.md](planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md).

## 2. Como os documentos se relacionam

| Documento | Papel | Pode definir prioridade? |
| --- | --- | --- |
| [Roadmap](01-ROADMAP.md) | Ordem executiva, dependências, gates e Definition of Done | **Sim — fonte principal** |
| [Plano B2C](planos/PLANO_B2C.md) | Estado funcional e visão do domínio B2C | Não; segue este roadmap |
| [Confiança e preço](planos/PLANO_CONFIANCA_E_PRECO.md) | Encomenda, preço, avaliações, SMS e oferta | Não; detalha `B2C-01..04` |
| [Fluxo cliente↔prestador](planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md) | Modos, aceite antecipado, cancelamento, recolhimento, saldo | Não; detalha `B2C-05/06`, `SCHED-01`, `COUR-*`, `PICK-01` |
| [Hospedagem](planos/PLANO_HOSPEDAGEM.md) | Render + Vercel + Firebase (`DEC-25`) | Não; detalha `OPS-02/03`, `OPS-DB-01` |
| [Diretrizes visuais](../01-produto/02-DIRETRIZES-VISUAIS.md) | Paleta e identidade laranja | Não; detalha `UX-01` |
| [Pagamentos](planos/PLANO_PAGAMENTOS.md) | Ledger, reserva, estorno e gateway | Não; detalha `PAY-01/02` |
| [Lote](planos/PLANO_LOTE_MULTI_PEDIDO.md) | Lote, blocos, anti-atraso e agrupamento | Não; detalha `LOT-*`/`TRIP-*` |
| [Frota](planos/PLANO_FROTA_DASHBOARD.md) | Monitoramento de frota | Não; detalha `FROTA-01/02` |
| [Admin](planos/PLANO_ADMIN.md) | Painel operacional | Não; detalha `ADMIN-01..07` |
| [Suporte](planos/PLANO_SUPORTE_RECLAMACOES.md) | Reclamações e dossiê | Não; detalha `SUP-01..05` |
| [Fluxo do produto](../01-produto/01-FLUXO-DO-PRODUTO.md) | Jornadas, estados e dinheiro | Não |
| [Cobertura](../04-status/03-COBERTURA-MVP.md) | Evidência e limitações | Não |
| [Arquivo histórico](../99-arquivo/README.md) | Entregas e instruções superadas | **Não executar** |

## 3. Legenda de status

| Símbolo | Estado do backlog | Significado |
| --- | --- | --- |
| ✅ | `DONE` | Entregue com evidência registrada |
| ▶️ | `READY` | Próximo trabalho pronto para execução |
| ⏸️ | `BLOCKED` | Depende de decisão, credencial ou autorização externa |
| ⏳ | `BLOCKED` | Depende de outro ID ainda não concluído |
| 🔬 | `BLOCKED` | Exige descoberta/medição antes da implementação |

## 4. Decisões vigentes

| Tema | Decisão atual |
| --- | --- |
| Produto | Produto **B2C**: três perfis — prestador (motoboy), cliente e admin. Modelo empresa/B2B removido em 2026-08-07. |
| Preço | Calculado e congelado pelo servidor. O cliente nunca define `priceCents` ou `courierFeeCents`. Km imediato > km agendado (`DEC-19`); valores em `DEC-02`. |
| Persistência | **Local:** PostgreSQL + Redis auxiliar. **Cloud:** banco alvo Firebase Firestore (`DEC-25` / `INV-02` atualizado). |
| Mapas | OSM/Leaflet/`flutter_map` continuam no piloto; provedor pago permanece em aberto. |
| Storage e push | Firebase Storage + FCM no mesmo projeto do banco cloud; adapter local até `OPS-02`. |
| Identidade | Tema laranja inspirado no AquiResolve implementado nos dois apps Flutter; dashboard ainda segue a identidade anterior. |
| Pagamentos | Cobrança real não está ativa. Ledger interno autorizado (`DEC-05`, 09/08); gateway **Pagar.me v5** definido (`DEC-06`, 09/08, padrão AquiResolve); falta conta/credenciais. |
| Cloud | Alvos **travados** (`DEC-25`): API **Render**, dashboard **Vercel**, banco **Firebase**. Scaffold existe; **não provisionar** sem credenciais e pacote OPS. |
| Encomenda | Campos próprios entregues; **foto obrigatória** em pedidos novos (`DEC-01`). Fallback de `notes` permanece até medir legado. |
| Modos | `IMMEDIATE` vs `SCHEDULED` (`DEC-18`); aceite antecipado do agendado (`DEC-20`) — ambos **implementados em `SCHED-01`+`B2C-06`, 2026-08-09**; tela Agenda no app prestador (`DEC-21`) segue em `COUR-01`. |
| Prestador / dinheiro | Cancelamento pré-coleta com taxa no saldo (`DEC-22`); pagamento = saldo interno sacável (`DEC-23`); coleta com `pickup_code` (`DEC-24`) **implementada em `PICK-01`, 2026-08-09**. |
| Tempo | Persistência em UTC; janelas de negócio em `America/Sao_Paulo`. |

## 5. Estado atual confirmado

| Capacidade | Estado | Limitação que orienta o próximo passo |
| --- | --- | --- |
| Cadastro/login de cliente | ✅ | Telefone ainda não é verificado por SMS |
| Pedido B2C e auto-dispatch | ✅ | Pedidos novos usam campos próprios; `notes` permanece como fallback legado |
| Oferta/aceite do motoboy | ✅ | Apenas um candidato por rodada; baixa transparência quando ninguém aceita |
| Preço server-side | ✅ v2 versionado com tarifa dual (`B2C-02`/`B2C-06`) | Prévia antes de confirmar continua em `B2C-02B` |
| Modo agendado individual | ✅ (`SCHED-01`, 2026-08-09) | Sem abas Em andamento/Agenda no app (`COUR-01`); capacidade usa estimativa fixa de duração do imediato |
| Código de recolhimento | ✅ (`PICK-01`, 2026-08-09) | Fallback do suporte só por API; sem tela no painel |
| Provas, GPS e tracking | ✅ piloto | Storage local; retenção e push real pendentes |
| Avaliação | ✅ unilateral | Falta avaliação mútua com origem explícita |
| Carteira do motoboy | ✅ básica | Crédito MVP; falta ledger + taxa cancelamento + saque (`DEC-22/23`) |
| Carteira/pagamento do cliente | Não existe | Exige ledger, política de cancelamento e idempotência antes de gateway |
| Dashboard | ✅ operacional + filtros B2C + **identidade laranja** (`UX-01C`, 2026-08-08) | busca da `TopBar` é decorativa (`UX-02`) |
| Cloud | Alvos decididos (`DEC-25`); scaffold Render/Vercel/Firebase — sem credencial conectada |

## 6. Caminho crítico de implementação

### Fase 0 — baseline e gates de produto

| ID | Status | Entrega | Saída obrigatória |
| --- | --- | --- | --- |
| BASE-01 | ✅ | MVP B2C ponta a ponta | Smoke e testes anteriores documentados em `PLANO_B2C.md` |
| BASE-02 | ⏸️ | Fechar decisões mínimas de produto | Álvaro registra respostas de `DEC-01` a `DEC-03` na seção 8 |
| BASE-03 | ✅ | Congelar contratos aditivos de `B2C-01` | DTO, resposta, compatibilidade e rollback implementados/documentados |
| BASE-04 | ✅ | Validar o baseline em runtime local | 8 migrations em banco descartável + rollback ensaiado, health `db/redis ok`, smoke B2C aprovado 6× (2026-08-08) |

`BASE-02` / `DEC-01`: a **obrigatoriedade de foto** foi decidida (2026-08-07). A
ativação em código foi feita em `B2C-05` (2026-08-08). Cobrança real e
valores finais de km continuam atrás de `DEC-05`/`DEC-02`.

### Fase 1 — fundação da encomenda

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-01 | ✅ | `BASE-03` | Colunas próprias para tipo, tamanho, peso, alcance e fotos; leitura compatível com `notes` legado |
| B2C-01A | ✅ | `B2C-01` | Apps e core consomem campos próprios com fallback legado |
| B2C-01B | ✅ | `BASE-03` | Quatro filtros B2C no painel, com QA de navegador e escopo por papel verificados em HTTP vivo (2026-08-08) |
| B2C-05 | ✅ | `B2C-01B` ✅, `DEC-01` | Obrigatoriedade de foto + peso/tipo/tamanho/endereços na criação, provada em HTTP vivo; legados legíveis (2026-08-08) |

**Estratégia de migração:** mudança aditiva, leitura dupla durante a transição e remoção do parser legado somente em uma versão posterior, após medir que não existem pedidos antigos dependentes dele.

**Gate de saída:** pedido novo e pedido legado precisam abrir nos dois apps e no dashboard; migration precisa subir e reverter em banco de teste.

### Fase 2 — preço v2, modos e transparência

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-02 | ✅ | `B2C-01` ✅, `DEC-02` ✅ | Preço v2 com faixas de peso/tamanho, tarifa dual e configuração server-side editável no admin (2026-08-08) |
| B2C-02A | ✅ | `B2C-02` | Breakdown e versão persistidos no pedido; congelamento provado (2026-08-08) |
| B2C-02B | ⏳ | `B2C-02` | Prévia de preço antes da confirmação, sem confiar em valores enviados pelo app |
| B2C-06 | ✅ | `SCHED-01` (mesmo esforço); gates ✅ | Cliente escolhe o modo; cotação e criação usam e congelam o km do modo (2026-08-09) |
| SCHED-01 | ✅ | `B2C-06`, `DEC-18` ✅, `DEC-20` ✅, `FLOW-DEC-02` ✅ | Modo `SCHEDULED` individual com janela (30 min de antecedência), aceite antecipado e reserva de agenda (2026-08-09) |

O preço de uma oferta aceita é imutável. Qualquer aumento posterior exige nova oferta e consentimento do cliente; não deve ser aplicado silenciosamente. Troca de modo exige novo pedido/recotação.

**Gate de saída:** invariantes `price = courierFee + platformFee`, arredondamento, mínimo, faixas limítrofes e replay da regra antiga cobertos por testes.

### Fase 3 — confiança e segurança do piloto

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| B2C-03 | ⏳ | `B2C-01` | Avaliação mútua, uma por papel e entrega |
| B2C-03A | ⏳ | `B2C-03` | Exibir média, contagem e contexto sem revelar dados sensíveis |
| B2C-04 | ▶️ | `DEC-04` ✅ (código no app) | Verificação de telefone com expiração, limite de tentativas e ambiente local seguro (sem provedor SMS por enquanto) |

SMS não bloqueia a fundação de dados nem o preço v2, mas é gate para abrir cadastro público em produção.

### Fase 4 — oferta resiliente

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| DISP-01 | ▶️ | `B2C-02` ✅, `DEC-03` ✅ | Busca por anéis de raio, exclusão de recusas e limite de rodadas |
| DISP-02 | ⏳ | `DISP-01` | Notificar cliente sobre demora e oferecer ação explícita |
| DISP-03 | ⏳ | `DISP-02` | Telemetria de tempo até aceite, recusas, expiração e ausência de candidato |

Falha de aceite deve terminar em estado recuperável e compreensível, nunca em loop infinito de reofertas.

### Fase 5 — carteira interna (cliente e prestador)

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| PAY-01 | ▶️ | Autorização `DEC-05` ✅, `B2C-02` ✅ | Ledger imutável; saldos cliente e prestador; reserva/estorno sem gateway |
| PAY-01A | ⏳ | `PAY-01`, `DEC-22` | Políticas de cancelamento (cliente + taxa do prestador no saldo) e liquidação idempotente |
| PAY-01B | ⏳ | `PAY-01A` | Operação administrativa auditada para crédito manual de ambiente de teste |
| COUR-02 | ⏳ | `PAY-01`, `COUR-01`, `DEC-22` | Cancelamento do prestador com cutoff + débito de taxa; recusa se saldo insuficiente |

Nenhuma integração PIX/cartão entra nesta fase. O objetivo é provar a contabilidade e as transições. O **modelo** de saldo sacável do prestador está decidido (`DEC-23`); saque real continua em `PAY-02`.

### Fase 5b — agenda do prestador e recolhimento

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| COUR-01 | ▶️ | `SCHED-01` ✅, `DEC-21` ✅ | App prestador: Em andamento + Agenda |
| PICK-01 | ✅ | `B2C-05` ✅, `DEC-24` ✅, `FLOW-DEC-03` ✅ | `pickup_code` de 4 dígitos + foto do prestador em `AT_PICKUP → PICKED_UP`, com rate limit e fallback auditado (2026-08-09) |

### Fase 6 — prontidão operacional e publicação

Alvos cloud travados em `DEC-25` / [PLANO_HOSPEDAGEM.md](planos/PLANO_HOSPEDAGEM.md):
API **Render**, dashboard **Vercel**, banco **Firebase Firestore**.

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| OPS-01 | ⏳ | `B2C-01B`, `B2C-02B`, `B2C-03A`, `DISP-03` | FKs, índices, logs, auditoria, retenção, backup e restauração testada (local) |
| OPS-DB-01 | ⏸️ | `DEC-25`, modelo de coleções, aceite do dono | Migração/dual-write Postgres local → Firestore cloud |
| OPS-02 | ⏸️ | Pedido + credenciais Firebase | Projeto Firebase: Firestore, Storage, FCM; adapters reais; fallback local |
| OPS-03 | ⏸️ | Pedido + credenciais, `OPS-01`, `OPS-02` | Deploy API **Render** + dashboard **Vercel** + smoke público |
| PAY-02 | ⏳ | `DEC-06` ✅ (**Pagar.me v5**), credenciais/sandbox, `PAY-01` | PIX por gateway Pagar.me, webhook assinado e reconciliação |

Build verde não comprova deploy. `OPS-03` só fecha com health real na API Render,
dashboard Vercel apontando para ela, Firestore/Storage operacionais e smoke B2C público.

### Fase 7 — lote multi-pedido, agendamento e frota

O dono decidiu (2026-08-07) que o **motoboy pode aceitar vários pedidos juntos**,
inclusive **lotes agendados de um município para outro**, com **lógica anti-atraso**;
e que o **dashboard deve monitorar localização dos prestadores, coleta de cada pedido
e trajeto durante a viagem**. O aceite de lote manual **não** depende do gate de
densidade (é o motoboy quem busca o lote); o agrupamento automático da plataforma
continua atrás de `TRIP-00`.

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| LOT-01 | ⏳ | Código: `B2C-02B`, `B2C-03A`, `DISP-03`. Gates: `DEC-08/10/11` ✅ | Aceite de lote manual, reserva e anti-atraso |
| LOT-02 | ⏳ | `LOT-01` | Blocos agendados intermunicipais (`scheduled_lots`, candidatura, reserva de capacidade) |
| FROTA-01 | ⏳ | `DISP-03`, `DEC-12`, `DEC-14` | Desacoplar heartbeat; mapa, trilha, lista e `FROTA-ALERTA-01..07` |
| FROTA-02 | ⏳ | `FROTA-01`, `LOT-01` | Progresso de viagem multi-parada no dashboard (`/trips/:id/stops`) |
| TRIP-00 | 🔬 | Telemetria `DISP-03` + operação estável | Medir densidade de pedidos compatíveis, desvio e economia potencial — gate do **agrupamento automático** |
| TRIP-01 | ⏳ | `TRIP-00` aprovado com limiares registrados | Modelo de viagens e agrupador em shadow mode, sem afetar ofertas reais |
| TRIP-02 | ⏳ | `TRIP-01` validado | Piloto com no máximo 3 pedidos, capacidade e prova por pacote |

Não implementar CRUD/telas de rota do agrupamento automático antes de `TRIP-00`
demonstrar demanda suficiente; o lote manual (`LOT-01/02`) não espera esse gate.

### Fase 8 — painel admin e suporte/reclamações

O dono decidiu (2026-08-07) que o **painel admin deve controlar o máximo de coisas
possível** e que o **cliente precisa de um canal de reclamação eficiente** ("algo
legal": dossiê automático, auto-resolução e juiz rápido). Ambos estão em design,
**somente documentação** — sem código.

| ID | Status | Dependências | Entrega |
| --- | --- | --- | --- |
| ADMIN-01 | ⏳ | `B2C-01B` | Fundação do painel: ações com motivo obrigatório, audit log completo, matriz de permissões, confirmação dupla |
| ADMIN-02 | ⏳ | `ADMIN-01` | Comandos de domínio: status manual, cancelar (guard), redespachar, reatribuir, aprovar/suspender motoboy, suspender cliente |
| ADMIN-03 | ⏳ | `PAY-01`, `PAY-01A`, `PAY-01B` | Financeiro admin: ledger, crédito/estorno manual com gate, relatórios |
| ADMIN-04 | ⏳ | `FROTA-01`, `FROTA-02` | Frota no painel: mapa, ack de alertas, ações forçadas |
| ADMIN-05 | ⏳ | `LOT-01`, `LOT-02` | Viagens e lotes no painel: reordenar paradas, remover/cancelar lote, intervenção |
| ADMIN-06 | ⏳ | `ADMIN-02`, `ADMIN-03`, `SUP-01`, `SUP-02`, `SUP-03` | Reclamações/suporte no painel: fila, SLA, estorno, penalização |
| ADMIN-07 | ⏳ | `B2C-02`, `B2C-03` | Configurações versionadas, notificações, moderação de avaliações |
| SUP-01 | ⏳ | `B2C-01` + telemetria | Fundação de suporte: schema tickets, dossiê automático ("prova reversa"), abertura no app, ack < 5 s |
| SUP-02 | ⏳ | `SUP-01`, `B2C-02`, `PAY-01`, `DEC-13`, `DEC-16` | Auto-resolução guiada + juiz rápido + nota de confiança + triagem em 3 níveis |
| SUP-03 | ⏳ | `SUP-02`, `B2C-03` | Reclamação do motoboy + reputação por dossiê + fraude flags |
| SUP-04 | ⏳ | `SUP-02`, `SUP-03`, `ADMIN-06` | Painel de suporte completo (fila, SLA, decisões em lote) |
| SUP-05 | ⏳ | `SUP-04`, `B2C-04` | SMS fallback / WhatsApp, NPS automatizado |

Guia didático: [fluxo do produto](../01-produto/01-FLUXO-DO-PRODUTO.md).

## 7. Trilha paralela de experiência

Esta trilha pode ocorrer em paralelo às Fases 1–4 quando houver autorização, mas não deve alterar contratos de negócio.

| ID | Status | Entrega | Referência |
| --- | --- | --- | --- |
| UX-01 | ✅ | Tokens laranja e cores semânticas no `aqui_log_ui` | [diretrizes](../01-produto/02-DIRETRIZES-VISUAIS.md) |
| UX-01A | ✅ | Aplicar tema no app cliente e cobrir por testes | [diretrizes](../01-produto/02-DIRETRIZES-VISUAIS.md) |
| UX-01B | ✅ | Aplicar tema no app motoboy e cobrir por testes | [diretrizes](../01-produto/02-DIRETRIZES-VISUAIS.md) |
| UX-01C | ✅ | Tokens laranja no dashboard + **tema claro/escuro**, com contraste AA medido nas 11 telas dos 2 temas (2026-08-08) | Diretrizes visuais |
| UX-02 | ▶️ | Acessibilidade, estados, responsividade e QA visual dos fluxos; parte mobile exige dispositivo | Critérios do documento visual |

## 8. Registro de decisões pendentes

O estado canônico de todas as decisões está em
[`03-DECISOES.md`](03-DECISOES.md). Esta seção não duplica recomendações ou status.

Para a fila próxima:

- `BASE-04` e `B2C-01B` não dependem de decisão nova do dono;
- `DEC-01` está **DECIDIDA** (foto obrigatória) e **ativada em código** por `B2C-05`;
- `DEC-18`…`DEC-24` estão **DECIDIDAS** (fluxo cliente↔prestador); `FLOW-DEC-01`,
  `FLOW-DEC-02`, `FLOW-DEC-03` e `DEC-17` decididas em 2026-08-09;
- `DEC-06` está **DECIDIDA** (2026-08-09): gateway = **Pagar.me v5** (padrão
  AquiResolve); falta conta/credenciais do Aqui Log para `PAY-02`;
- `DEC-02` bloqueia os **valores finais** de `B2C-02`/`B2C-06` (estrutura liberada);
- `DEC-03` está **DECIDIDA** (2026-08-09: ampliar raio + aumento com consentimento) e libera `DISP-01`;
- cloud, SMS e pagamentos reais continuam atrás de autorização explícita.

## 9. Definition of Done comum

Uma fase só pode mudar para ✅ quando cumprir o que for aplicável:

- migration aditiva testada para frente e para trás, sem `synchronize=true`;
- contrato da API e compatibilidade documentados;
- autorização e isolamento por papel testados;
- unitários para regras puras e integração para persistência/transações;
- `pnpm build`, `pnpm lint`, `pnpm test` e `pnpm smoke` verdes;
- `flutter analyze` e `flutter test` nos dois apps e testes do `aqui_log_core`;
- fluxo real exercitado, incluindo pelo menos um erro/rollback relevante;
- validação visual em app/painel quando houver UI;
- estado atual, cobertura, handoff e changelog atualizados com evidência;
- estado comunicado corretamente como local, validado, commitado, enviado ou publicado.

Toda evidência registra comando/inspeção, resultado observado, data, ambiente e
commit. Uma etapa não aplicável deve ser marcada `N/A` com justificativa; não pode
ser simplesmente omitida.

## 10. Riscos controlados pelo plano

| Risco | Controle |
| --- | --- |
| Quebrar pedidos antigos ao sair de `notes` | Leitura dupla, migração aditiva e telemetria de fallback |
| Divergir preço entre app, oferta e cobrança | Servidor único, breakdown persistido e versão da regra |
| Crédito/estorno duplicado | Ledger imutável, chave idempotente e transação de banco |
| Reoferta infinita | Limite de anéis/rodadas e estado terminal recuperável |
| Misturar cor de marca com status | Tokens semânticos e QA conforme as [diretrizes visuais](../01-produto/02-DIRETRIZES-VISUAIS.md) |
| Ligar cloud cedo demais | Gates `OPS-02/03` dependem de pedido explícito e credenciais |
| Construir rota multi-pedido sem densidade | Gate de descoberta `TRIP-00` antes de código operacional |
| Dupla oferta do mesmo pedido (individual × lote) | Reserva global por `delivery_id` + aceite atômico com locks |
| Atraso em lote multi-pedido | Regras D-R1..D-R13, ETAs recalculados, redespacho e índice de pontualidade |
| Expor localização em tempo real sem controle | Permissão "ver frota" distinta, exposição só em viagem ativa, audit log e ciência do motoboy |
| Heartbeat sem histórico/desacoplamento | `courier:position` sem `deliveryId` + `courier_positions` + Redis pub/sub |
| Reembolso indevido/duplicado no suporte | Ledger idempotente, triagem em 3 níveis, limites por cliente, dossiê com timestamp server-side |
| Admin com poder sem trilha | Confirmação dupla + motivo obrigatório + audit log + guards da máquina de estados |
| Guarda/segurança e LGPD da frota | Pino ocioso coarsificado, exposição exata só em viagem ativa, permissão "ver frota" + audit de acesso |
| Payout duplicado após reclamação tardia | Janela de contestação (48–72 h) e clawback no termo do motoboy |
| Misturar imediato e agendado no mesmo lote | Pré-vet rejeita modos temporais mistos (`DEC-18`) |
| Cancelamento prestador gera saldo negativo | Recusar cancelamento se saldo < taxa (`DEC-22`) |
| Coleta sem prova de posse | `pickup_code` + foto obrigatórios (`DEC-24`) |
| Preço/km errado após mudança de settings | Snapshot de `km_rate` e versão no pedido (`DEC-19`) |

## 11. Próximo pacote recomendado

`BASE-04`, `B2C-01B`, `B2C-05`, `UX-01C` e `B2C-02` fecharam em 2026-08-08 e
`PICK-01` em 2026-08-09, todos com evidência de runtime local. Os `READY` agora:

- **`UX-02`** — QA visual e de acessibilidade dos fluxos; a parte do dashboard
  saiu em `UX-01C`, o que resta exige dispositivo/emulador — e agora inclui a
  tela de coleta com código;
- **`B2C-06` + `SCHED-01`** — falta o cliente **escolher** o modo; a tarifa dual
  e o admin dela já existem desde `B2C-02`;
- **`DISP-01`** — reoferta por anéis de raio e limite de rodadas (`DEC-03` ✅);
- **`PAY-01`** — ledger interno sem gateway (`DEC-05` ✅).

Ao retomar:

1. escolher **um** ID e não misturar com os outros;
2. `PICK-01` está entregue: qualquer rota nova que devolva uma entrega precisa
   passar pelo recorte por papel (`present()` em `deliveries.service.ts`), senão
   vaza o `pickup_code` para o app do prestador;
3. manter `notes` como fallback de leitura;
4. reproduzir o ambiente de teste com banco descartável, `PORT` livre e
   `PUBLIC_API_URL` alinhado à API — receita em
   `docs/03-referencia/03-DESENVOLVIMENTO.md`;
5. **não** antecipar `B2C-06`, `SCHED-01`, `COUR-*`, ledger, gateway ou cloud.

Não iniciar Firebase, deploy, gateway ou rota multi-pedido como parte desse pacote.
