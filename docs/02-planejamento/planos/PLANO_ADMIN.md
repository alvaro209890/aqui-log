# Plano — Painel Admin Aqui Log (controle operacional total)

> **Atualizado:** 2026-08-07
> **Status:** design aprovado para planejamento (sem implementar ainda — documentação apenas)
> **Documentos base:** [roadmap](../01-ROADMAP.md), [B2C](PLANO_B2C.md),
> [lotes](PLANO_LOTE_MULTI_PEDIDO.md), [frota](PLANO_FROTA_DASHBOARD.md),
> [pagamentos](PLANO_PAGAMENTOS.md) e [suporte](PLANO_SUPORTE_RECLAMACOES.md).
> **Objetivo:** o dono consegue operar e corrigir quase tudo pelo painel, sem depender de dev.
> **Roadmap:** `ADMIN-01` … `ADMIN-07` (seção 6), dependentes de `B2C-01B`, `FROTA-01/02`, `LOT-01/02`, `PAY-01`.

---

## 1. Princípios do painel

| # | Princípio | Consequência concreta |
|---|---|---|
| P1 | **Controle total, operável sem dev** | Toda ação de correção que hoje exige SQL/migration tem tela própria: mudar status, reatribuir, ajustar valor, suspender, bloquear. |
| P2 | **Toda ação tem trilha** | Nenhuma escrita administrativa acontece sem gravar quem, o quê, quando, por quê e o estado antes/depois em `audit_logs`. Isso inclui leitura de dados sensíveis (frota, documentos). |
| P3 | **Destrutivo exige confirmação dupla** | Ações irreversíveis (cancelar pedido, banir, remover avaliação, estorno manual) abrem modal com: aviso em texto claro, digitação do motivo (obrigatório, mínimo 20 caracteres) e confirmação em duas etapas. A primeira confirmação pode ter cooldown (3 s). |
| P4 | **Dinheiro é quase sagrado** | Edição de valores nunca é livre: ajuste de preço/estorno/crédito usa operação financeira com tipo próprio, motivo e papel restrito (ver matriz). Correção é por **transação reversa**, nunca update mudo (regra do ledger). |
| P5 | **Estado por regra, não por caroço** | O painel dispara **ações de domínio** (chamadas aos mesmos services que os apps usam), nunca escreve estado direto no banco. **Guards da máquina de estados valem igual:** cancelar exige pedido ≤ `AT_PICKUP` (pós-coleta só com fluxo de devolução obrigatório), reordenar paradas roda o sequenciador e revalida D-R1..D-R13. O que não for representável como ação de domínio não existe no painel. |
| P6 | **LGPD e minimização** | Dados pessoais são exibidos só com papel adequado; posição de motoboy ocioso é coarsificada, exata só em viagem ativa; auditoria registra quem viu o quê; retenção definida por tipo de dado. |
| P7 | **Tudo configurável, versionado** | Feature flags, preços, tolerâncias e limiares ficam em `app_settings` versionados (quem mudou, quando, valor anterior → novo), com rollback de 1 clique e validade no servidor. |

---

## 2. Módulos

### 2.1 Visão geral (KPIs) — já existe como `OverviewPage`

- **Mostra:** cards em tempo real — pedidos hoje (criados/aceitos/entregues/cancelados), taxa de aceite, tempo médio até aceite, NPS/rating médio, motoboys online/em viagem/sem sinal, ticket médio, receita diária (pós-`PAY-01`), fila de reclamações e alertas abertos; gráficos por hora/dia e por categoria (herda `B2C-01B`).
- **Permite:** clicar num KPI para abrir a lista correspondente já filtrada. Nenhuma escrita aqui — visão somente.
- **Confirmação:** nenhuma.

### 2.2 Pedidos — `DeliveriesPage` + `ReportsPage` (filtros B2C)

- **Mostra:** lista completa com filtros por status, data, cliente, motoboy, categoria/tamanho/peso (complemento de `B2C-01B`), município, valor, e busca por código/CPF/telefone. Detalhe com tudo: encomenda (foto, tipo, peso), endereços, preço (base, km, taxa — breakdown), ofertas/aceites, provas de coleta/entrega, timeline de eventos, tracking, reclamações vinculadas, lançamentos financeiros.
- **Permite fazer:**
  - Alterar status manualmente (ex.: `ACCEPTED → AT_PICKUP`) — com motivo obrigatório; o sistema valida a transição pela máquina de estados oficial e bloqueia estados ilegais (ex.: `DELIVERED → REQUESTED` sem fluxo reverso);
  - Cancelar pedido (motivo + efeito financeiro previsto exibido antes de confirmar; **guard:** só ≤ `AT_PICKUP`, pós-coleta só com fluxo de devolução);
  - Redespachar (pedido volta a `REQUESTED` e re-entra no auto-dispatch);
  - Reatribuir motoboy manualmente (selecionar courier, validar capacidade/posição; motivo);
  - Ajustar preço **com auditoria e gate** (item 4): gera nova versão de preço + evento `price_adjustment`, cliente é notificado e precisa consentir (regra do roadmap: preço congelado no aceite não muda silenciosamente);
  - Corrigir erro operacional por comando compensatório, ticket e evento auditado;
    `DELIVERED` é terminal e nunca volta para `IN_TRANSIT`.
- **Ações com confirmação dupla:** cancelar, redespachar, reatribuir, ajustar preço, qualquer reversão de status. Alterações de status simples: confirmação única + motivo.

### 2.3 Motoboys — `CouriersPage` + `UsersPage`

- **Mostra:** lista com status (pendente/aprovado/suspenso/rejeitado/offline), documentos enviados (RG, CNH, foto, comprovante) com visualização, capacidade (`capacity_kg/volume/max_packages`, de `LOT-01`), índice de pontualidade 30 dias e confiabilidade (`courier_metrics`), avaliação média, carteira/extrato, posição atual (coarsificada se ocioso; exata em viagem ativa, via `FROTA-01`), histórico completo de entregas (código, data, status, atraso, provas, reclamações, ratings).
- **Permite fazer:**
  - Aprovar/rejeitar cadastro (motivo ao rejeitar, notifica motoboy);
  - Suspender com motivo e prazo (opcional) / reativar;
  - Editar perfil de capacidade (gate: validado contra viagens ativas — não pode reduzir abaixo da carga corrente);
  - Ver documentos; forçar reenvio de documento;
  - Encerrar cadastro (v2: apenas inativar na v1).
- **Ações com confirmação dupla:** suspender, reativar após suspensão, rejeitar, alterar capacidade quando há viagem ativa, encerrar conta.

### 2.4 Clientes — extensão para gestão B2C (`B2C-01B`)

- **Mostra:** lista com busca/filtros (status, cadastro, município, volume de pedidos), detalhe completo: dados de cadastro (com máscara LGPD), pedidos, valores pagos/reservados (pós-`PAY-01`), avaliações dadas, reclamações (com histórico de fraude/limites), histórico de bloqueios.
- **Permite fazer:**
  - Suspender (impede novos pedidos; em andamento não é afetado) e banir (v2; na v1 suspensão permanente) com motivo;
  - Reembolso manual via estorno no ledger (pós-`PAY-01`) — sempre transação reversa, com tipo `MANUAL_REFUND`, motivo e papel restrito;
  - Reativar conta;
  - Editar dados cadastrais com motivo (telefone/endereço mal digitados) — cada edição vira evento de auditoria.
- **Ações com confirmação dupla:** suspender/banir, reembolso manual, reativar, editar CPF/telefone.

### 2.5 Frota em tempo real — novo, herda `FROTA-01/02`

Referência completa: [plano de frota](PLANO_FROTA_DASHBOARD.md). No painel admin:

- **Mostra:** mapa operacional, lista, coleta, trilha e alertas
  `FROTA-ALERTA-01..07`. Tudo restrito à permissão "ver frota".
- **Permite fazer:**
  - Ack de alerta (auditado, registra quem e quando);
  - Forçar ação sugerida por `FROTA-ALERTA-05` para pedido não recolhido,
    sempre pelos guards; suporte não executa essa ação;
  - Ver trilha histórica do dia com retenção LGPD.
- **Ações com confirmação dupla:** ack de alerta vermelho com mais de 15 min, cancelar/reofertar via alerta.

### 2.6 Viagens e lotes (LOT) — novo, após `LOT-01/02`

- **Mostra:** lista de viagens/lotes (estado, motoboy, nº de pedidos, origem/destino, janelas, ETAs por parada, progresso, alertas `AT_RISK`/`LATE`), detalhe com paradas numeradas `PICKUP/DELIVERY`, `trip_events`, `composition_snapshot` (composição congelada no aceite), valores e repasses por pacote (`trip_quotes`).
- **Permite fazer:**
  - Reordenar paradas (o servidor roda o sequenciador e revalida os invariantes: coleta antes de entrega, janelas, folgas D-R1..D-R3 — e registra evento `reorder`);
  - Remover pedido ainda não coletado do lote (associação marcada como removida,
    pedido volta a `REQUESTED`, re-sequenciamento e efeito financeiro exibido antes);
  - Cancelar lote inteiro: somente pedidos sem coleta voltam à fila; itens sob
    custódia exigem devolução ou transferência registrada antes de qualquer encerramento;
  - Intervenção geral com **motivo obrigatório** (desistência pós-coleta, desvio, falha) — libera ações de suporte previstas em `PLANO_LOTE_MULTI_PEDIDO.md` R6/R7.
- **Ações com confirmação dupla:** remover pedido do lote, cancelar lote, qualquer intervenção em viagem `IN_PROGRESS`.

### 2.7 Reclamações e suporte — módulo novo

A especificação completa está no [plano de suporte](PLANO_SUPORTE_RECLAMACOES.md).

- **Mostra:** fila de reclamações (aberta/em análise/resolvida/estornada) com prioridade (P1 vermelho) e SLA restante (barra), detalhe com pedido, partes, conversa, **dossiê completo** (timeline com fotos/GPS/horários), veredito automático sugerido, histórico financeiro; painel de métricas (tempo de resposta, resolução, recorrência por motoboy/cliente, custo médio por ticket).
- **Permite fazer:**
  - Atribuir a um agente (`SUPPORT`/`ADMIN`);
  - Responder pela plataforma (template ou texto livre, registrado como mensagem);
  - Resolver (com tipo de desfecho);
  - Estornar (aciona estorno no ledger com motivo; gate financeiro; abaixo do teto é automático, acima exige humano);
  - Penalizar motoboy (impacto no índice de pontualidade/confiabilidade com efeito exibido antes — na v1 só prioridade de fila, não pagamento);
  - Bloqueio temporário de conta (7/30/90 dias com motivo auditado);
  - Escalar para `SUPER_ADMIN`.
- **Ações com confirmação dupla:** estorno, penalizar motoboy, resolver com desfecho financeiro, bloqueio.

### 2.8 Financeiro — `FinancePage`, evolui com `PAY-01`, `PAY-01A` e `PAY-01B`

- **Mostra:** ledger (imutável, com saldo por conta, extrato por participante), saldos disponível/reservado de clientes e motoboys, transações com chave idempotente e status, reservas por pedido (RESERVED/SETTLED/RELEASED), pendências de liquidação, relatórios exportáveis (receita, repasses, estornos, por período/categoria/região), conciliação (gateway vazio até `PAY-02`).
- **Permite fazer:**
  - Crédito manual de teste (`PAY-01B`): operação administrativa auditada, apenas `SUPER_ADMIN`, tipo próprio, motivo obrigatório;
  - Estorno manual (transação reversa, nunca update);
  - Ajuste administrativo de saldo com dupla confirmação e motivo;
  - Exportar relatórios (CSV/PDF com auditoria de exportação).
- **Ações com confirmação dupla:** todo crédito/estorno/ajuste manual. **Bloqueado por padrão:** editar valores de pedido diretamente no ledger.

### 2.9 Avaliações — `RatingsPage`

- **Mostra:** avaliações mútuas (cliente ↔ motoboy, após `B2C-03`), média, contagem, contexto por papel, flag de lote (`trip_id`), sinalização de abuso (repetição, linguagem ofensiva, vingança cruzada).
- **Permite fazer:** remover avaliação com motivo (fica marcada como `removed` com razão, não deletada fisicamente — trilha), restaurar remoção equivocada, ver padrões por motoboy/cliente.
- **Confirmação dupla:** remoção.

### 2.10 Configurações — `SettingsPage`

- **Mostra:** catálogo de `app_settings` versionados com valor atual, autor, data e anterior.
- **Permite fazer (tudo editável no painel, com efeito imediato validado no servidor):**
  - Feature flags (foto obrigatória `DEC-01`, lote, avaliação mútua, módulo de frota);
  - Preços e faixas de peso/tamanho (`B2C-02`: base, por km, %, faixas) com **prévia do efeito** e versão da regra;
  - Tolerâncias anti-atraso D-R1..D-R13 (folgas 10/15/45 min, timeout 120 s, tolerância 15 min, cancelamento grátis 45 min);
  - Limiares `FROTA-ALERTA-01..07` (amarelo/vermelho, tempos de "sem sinal");
  - Limites de lote (`LOT-DEC-04`) e janela de agrupamento (`DEC-10`);
  - Suporte: tetos do juiz rápido (reembolso R$ 50, atraso R$ 30, nota R$ 10, limite mensal R$ 100), prazos de reclamação, limites de fraude;
  - Canais/limites de notificação e reoferta (anéis de raio `DISP-01`);
  - Toda mudança salva uma versão nova; **rollback de 1 clique** restaura a anterior.
- **Confirmação:** dupla quando a mudança é de preço/tolerância com pedidos ativos em voo.

### 2.11 Permissões e auditoria — `UsersPage` + `AuditPage`

- **Mostra:** usuários do painel, papéis, permissões efetivas por papel; log completo de auditoria com filtros (ator, ação, entidade, período, motivo) e exportação.
- **Permite fazer:** criar/desativar usuário do painel, atribuir papel, ajustar permissões granulares (ex.: só "ver frota" sem "editar pedido"). **Nenhuma ação destrutiva:** não se remove histórico, não se edita log.
- **Confirmação:** dupla ao alterar papel de um `SUPER_ADMIN` ou desativar usuário; mudanças de permissão são elas mesmas auditadas.

### 2.12 Notificações — novo

- **Mostra:** templates por tipo (pedido aceito, ETA, alerta, reclamação, resultado de cadastro) com variáveis e histórico de envios.
- **Permite fazer:** editar template (com revisão anterior), testar envio para si mesmo, **disparo manual** (push/email) para um motoboy, cliente ou grupo (ex.: aviso de operação) com motivo auditado.
- **Confirmação:** dupla para disparo em massa (> 50 destinatários).

---

## 3. Matriz de permissões por papel × ação

Legenda: ✅ pode · 🟡 pode com confirmação dupla · 🚫 não pode · 🔒 gate financeiro extra (senha/OTP ou papel)

| Ação | SUPER_ADMIN | ADMIN | SUPPORT |
|---|---|---|---|
| Ver KPIs / relatórios | ✅ | ✅ | ✅ |
| Listar/detalhar pedido | ✅ | ✅ | ✅ |
| Alterar status não terminal | ✅ | 🟡 | 🚫 |
| Cancelar pedido antes da coleta | 🟡 | 🟡 | 🚫 |
| Redespachar / reatribuir motoboy | 🟡 | 🟡 | 🚫 |
| Ajustar preço de pedido | 🔒🟡 | 🔒🟡 | 🚫 |
| Aprovar/rejeitar/suspender motoboy | ✅ | 🟡 | 🚫 |
| Suspender/banir cliente | 🟡 | 🟡 | 🚫 |
| Reembolso manual ao cliente | 🔒🟡 | 🚫 | 🚫 |
| Ver frota em tempo real | ✅ | ✅ | ✅ somente leitura |
| Ack de alerta de frota | ✅ | ✅ | 🚫 |
| Cancelar/reofertar via alerta | 🟡 | 🟡 | 🚫 |
| Ver viagens/lotes | ✅ | ✅ | ✅ somente leitura |
| Reordenar/remover/cancelar lote | 🟡 | 🟡 | 🚫 |
| Atender/responder reclamação | ✅ | ✅ | ✅ |
| Estornar por reclamação | 🔒🟡 | 🔒🟡 | 🚫 |
| Penalizar motoboy | 🟡 | 🟡 | 🚫 |
| Crédito/estorno manual no ledger | 🔒🟡 | 🚫 | 🚫 |
| Exportar relatórios financeiros | ✅ | ✅ | 🚫 |
| Remover avaliação | 🟡 | 🟡 | 🚫 |
| Editar configurações | 🟡 | 🟡 | 🚫 |
| Criar usuário / atribuir papel | 🟡 | 🚫 | 🚫 |
| Ver log de auditoria | ✅ | ✅ | ✅ |
| Disparo manual de notificação | 🟡 | 🟡 | 🟡 |

Regras da matriz: existem somente os papéis técnicos atuais. `SUPPORT` pode atuar
em tickets e consultar o contexto mínimo, mas não altera pedido, frota, lote ou
dinheiro. Toda ampliação de permissão exige tarefa própria, migration/seed quando
aplicável e testes de autorização.

---

## 4. Regras de segurança

1. **Confirmação dupla e cooldown** para toda ação marcada 🟡 na matriz: modal com descrição do impacto (inclusive efeito financeiro estimado), campo "motivo" obrigatório (mínimo 20 caracteres) e botão de confirmação habilitado só após 3 s.
2. **Motivo obrigatório gravado em auditoria** — toda escrita administrativa gera `audit_logs { actor, action, entity, entityId, before, after, reason, ip, ts }`. Rejeição de escrita sem motivo é erro de API.
3. **Valores monetários:** nenhum ajuste direto de valor. Todo movimento é transação de ledger (reversa) com tipo, chave idempotente e invariante soma-zero. Gate 🔒 exige reautenticação (senha/OTP) do `SUPER_ADMIN` e nunca é delegável.
4. **Estado sempre via serviço de domínio:** o painel não possui endpoint de "update genérico"; cada ação mapeia para um comando de domínio que valida a máquina de estados. Impossível criar estado ilegal via UI. Guards: cancelar exige ≤ `AT_PICKUP` (pós-coleta só com fluxo de devolução), reordenar revalida D-R1..D-R13.
5. **LGPD:** visualização de CPF/telefone/documento é mascarada por padrão (revela com justificativa auditada, opcional v1); posição de frota exata só em viagem ativa (ocioso coarsificado); exportação de dados pessoais registrada; retenção: auditoria 2 anos, trilha de posição conforme `FROTA` (crua 7 d / agregada 30 d / diária 90 d), logs de acesso sensível 1 ano.
6. **Idempotência e replay:** botões enviam chave de operação; duplo clique ou retry não duplicam lançamento nem evento.
7. **Estado terminal não se desfaz:** `DELIVERED` e `CANCELED` não são revertidos.
   Correções usam evento compensatório, ticket e transação reversa quando houver dinheiro.

---

## 5. O que NÃO deve existir no painel

- **Editor livre de SQL/dados** — "consola" ou bulk-update genérico (mataria a trilha e a máquina de estados).
- **Edição direta de preço sem consentimento do cliente** — preço congelado no aceite só muda com nova oferta + consentimento (regra do roadmap).
- **Deletar usuários/motoboys/pedidos** — apenas suspender/banir/inativar.
- **Editar o próprio log de auditoria ou o próprio papel.**
- **Criar pedido em nome do cliente** (anti-fraude; correção existe só via status/cancelamento).
- **Aprovação em lote de cadastros sem revisão individual** (documentos exigem olho humano).
- **Mensagens em nome do cliente ou do motoboy sem histórico.**

**Fora para v2:** banir com retenção de documentos, edição de cadastro com justificativa digital, reordenação de paradas em voo, reconciliação automática com gateway (`PAY-02`), suporte ao cliente final (chat público), penalidades financeiras reais e agrupamento automático operacional (`TRIP-01/02`).

---

## 6. Ordem de implementação

| ID | Entrega | Dependências | Conteúdo |
|---|---|---|---|
| `ADMIN-01` | Fundação do painel | `B2C-01B` (filtros B2C) | Framework de ações com motivo obrigatório + `audit_logs` completo + matriz de permissões real no backend + modo "confirmação dupla". Todas as páginas existentes passam a registrar auditoria. |
| `ADMIN-02` | Pedidos, motoboys, clientes | `ADMIN-01` | Comandos de domínio: mudança de status manual, cancelar (guard ≤ `AT_PICKUP`), redespachar, reatribuir, aprovar/suspender/rejeitar motoboy, suspender/banir cliente, edição de cadastro auditada. |
| `ADMIN-03` | Financeiro admin | `PAY-01`, `PAY-01A`, `PAY-01B` | Ledger no painel, crédito manual de teste, estorno reverso, gate 🔒, relatórios e conciliação interna. |
| `ADMIN-04` | Frota no painel | `FROTA-01`, depois `FROTA-02` | Páginas Frota/Alertas, ack auditado e ações de `FROTA-ALERTA-05`; progresso multi-parada com `FROTA-02`. |
| `ADMIN-05` | Viagens e lotes | `LOT-01`, depois `LOT-02` | Ver/reordenar paradas (revalidando invariantes), remover pedido do lote, cancelar lote, intervenção com motivo; blocos agendados após `LOT-02`. |
| `ADMIN-06` | Reclamações/suporte | `ADMIN-02`, `ADMIN-03`, `SUP-01..03` | Fila, atribuição, resposta, resolução, estorno e penalização (fluxo detalhado em `PLANO_SUPORTE_RECLAMACOES.md`). |
| `ADMIN-07` | Configurações, notificações, avaliações | `B2C-02` (preços v2), `B2C-03` (avaliação mútua) | Editor de `app_settings` versionado com rollback, templates e disparos manuais, moderação de avaliações. |

Cada fase fecha com: testes de autorização por papel, teste de confirmação dupla (motivo vazio rejeitado), `pnpm build/lint/test/smoke` verdes e `Definition of Done` do roadmap seção 9.

---

## 7. Decisões que o dono precisa fechar antes de `ADMIN-01`

| # | Decisão | Recomendação |
|---|---|---|
| `ADMIN-DEC-01` | Gate 🔒 usa OTP ou senha do operador? | OTP no celular do `SUPER_ADMIN` (v1: reautenticação simples) |
| `ADMIN-DEC-02` | Quem tem papel `SUPER_ADMIN`? | Somente o dono; jamais múltiplas pessoas sem registro |
| `ADMIN-DEC-03` | Retenção do `audit_logs` | 2 anos; exportação trimestral |
| `ADMIN-DEC-04` | SUPPORT pode alterar status simples de pedido? | Não; suporte atua em tickets e consulta contexto |
| `ADMIN-DEC-05` | Edição de cadastro de cliente exige prova? | Sim, documento/print anexado ao evento de auditoria |
| `ADMIN-DEC-06` | Quem cancela pedido pós-coleta? | Só `SUPER_ADMIN/ADMIN`, após devolução/transferência registrada |
