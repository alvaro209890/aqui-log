# Onda 2 — Painel admin

> **Objetivo:** o operador controla a plataforma pela tela, com trilha de
> auditoria, em vez de depender de `curl` e de um agente disponível.

Plano de requisitos: [`../02-planejamento/planos/PLANO_ADMIN.md`](../02-planejamento/planos/PLANO_ADMIN.md).
Este arquivo cobre **todos** os `ADMIN-*`; a ordem entre eles está no
[`01-ONDAS.md`](01-ONDAS.md), porque `ADMIN-03` a `ADMIN-06` dependem de ondas
posteriores.

## Estado de onde se parte

O painel já tem 11 páginas funcionando, identidade laranja, tema claro/escuro,
filtros B2C, mapa em tempo real e configurações completas de preço. O que falta
não é tela — é **poder com trilha**: hoje uma ação administrativa não exige
motivo, a matriz de permissões é grosseira (cinco papéis, sem granularidade) e
várias operações reais só existem por API.

Dívidas explícitas que esta onda quita:

- `ADMIN-02A` entregou a fila de aprovação, mas **a recusa não aceita motivo** —
  a rota não suporta. Fica em `ADMIN-02`.
- `PICK-01` entregou o fallback de código de recolhimento **só por API**
  (`POST /deliveries/:id/pickup-code/override`). Não tem tela. Fica em `ADMIN-02`.
- A busca da `TopBar` é **decorativa** desde sempre. Ou funciona em `ADMIN-01`, ou
  sai da tela — o que não pode é continuar fingindo.
- Seções "Modo agendado" e "Reoferta por anéis" nunca passaram por QA de
  navegador; com o `QA-02` pronto, isso deixa de ser dívida.

## Decisões do plano adotadas como provisórias

O `PLANO_ADMIN` §7 lista três decisões "que o dono precisa fechar" **e já traz a
recomendação de cada uma**. Para não travar a cadeia, adote a recomendação e
registre em [`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md) como confirmação
pendente — igual ao que a `DEC-02` fez com os preços:

| # | Adotado | Onde muda depois |
| --- | --- | --- |
| `ADMIN-DEC-01` | Gate 🔒 por **reautenticação simples** (senha do operador) na v1; OTP fica para quando houver provedor | configuração, sem migration |
| `ADMIN-DEC-02` | `SUPER_ADMIN` **só o Álvaro**; qualquer outro é `ADMIN` | dado, não código |
| `ADMIN-DEC-03` | `audit_logs` retidos por **2 anos**, exportação trimestral | job de limpeza |

---

## `ADMIN-01` — fundação

**Depende de:** `QA-03`. **Superfície:** backend + painel.

- [ ] Framework de ação administrativa: **toda** operação de escrita exige
      `reason` não-vazio (aparado — `@IsNotEmpty` aceita `"   "`, este repo já
      levou esse susto) e grava em `audit_logs`.
- [ ] `audit_logs` completo: ator, papel, alvo, ação, motivo, antes/depois,
      IP e carimbo **server-side**.
- [ ] Matriz de permissões real no backend, por capacidade e não só por papel —
      guard reutilizável, testado nos cinco papéis (`CUSTOMER`, `COURIER`,
      `SUPER_ADMIN`, `ADMIN`, `SUPPORT`).
- [ ] Confirmação dupla no painel para ação destrutiva: resumo do efeito +
      motivo obrigatório antes de habilitar o botão.
- [ ] Todas as páginas existentes passam a registrar auditoria.
- [ ] Busca da `TopBar`: implementar (pedido, cliente, motoboy) **ou remover**.

**Aceite:** motivo vazio recusado com `400` em toda rota administrativa; papel sem
capacidade recebe `403` (não `404`, não `500`); auditoria contém antes/depois
legível; `QA-02` cobre a confirmação dupla.

---

## `ADMIN-02` — comandos de domínio

**Depende de:** `ADMIN-01`.

- [ ] Mudança manual de status, respeitando a máquina de estados (não burlando).
- [ ] Cancelar pedido com guard `≤ AT_PICKUP`; depois disso é caso de suporte.
- [ ] Redespachar e reatribuir, reusando `dispatch(..., { reopen: true })` — o
      mesmo caminho de recuperação do `DISP-02`, não um segundo caminho paralelo.
- [ ] **Recusa de motoboy com motivo** (dívida do `ADMIN-02A`): rota passa a
      aceitar `reason`, o motivo chega na notificação e fica na auditoria.
- [ ] Suspender/reativar motoboy e cliente, com motivo.
- [ ] **Tela do fallback de `pickup_code`** (dívida do `PICK-01`): só admin e
      suporte, motivo obrigatório, auditoria — a rota já existe.
- [ ] Edição de cadastro auditada.

**Aceite:** cada comando com teste de autorização e de guard; cancelar depois de
`AT_PICKUP` recusado com `409`; a confirmação da tela diz o **efeito real** — o
precedente é a fila do `ADMIN-02A`, que avisa "aprovar não coloca ninguém na rua"
porque aprovar deixa `available=false`.

---

## `ADMIN-07` — configurações, notificações e avaliações

**Depende de:** `ADMIN-01`, `B2C-03`.

- [ ] Editor de `app_settings` **versionado**, com histórico de quem mudou o quê.
- [ ] Todos os valores provisórios editáveis sem deploy, inclusive os novos:
      teto do estorno automático (`DEC-13`, R$ 30), teto do juiz rápido
      (`DEC-16`, R$ 25), retenção da trilha (`DEC-12`), limiar e percentual de
      longa distância (`DEC-15`, 15 km / +20%).
- [ ] Templates de notificação editáveis.
- [ ] Moderação de avaliação (depende de `B2C-03`).

**Aceite:** `DEC-19` continua valendo na escrita (km imediato **>** agendado,
`400` nos dois casos inválidos); mudar settings **não altera pedido já criado**;
patch parcial **não apaga valor salvo** — o `class-transformer` entrega o DTO com
todas as propriedades e as ausentes chegam `undefined`; sem filtrar `undefined`
antes do spread, o valor personalizado some sem aviso. Este bug já aconteceu aqui
uma vez.

---

## `ADMIN-03` — financeiro *(depende da onda 5)*

- [ ] Ledger no painel: extrato por conta, saldo, reserva e liquidação.
- [ ] Crédito manual de teste e estorno reverso, atrás do gate 🔒, com motivo.
- [ ] Relatórios e conciliação interna.

**Aceite:** nenhuma operação financeira sem idempotência; estorno duplicado
recusado; papel `SUPPORT` lê mas não move dinheiro.

---

## `ADMIN-04` — frota *(depende da onda 7)*

- [ ] Página de frota com mapa e trilha, respeitando `DEC-14`: ocioso
      coarsificado (~1 km) na zona operacional, **oculto fora dela**; posição
      exata só em viagem ativa.
- [ ] Alertas `FROTA-ALERTA-01..07` com **ack auditado**.
- [ ] Ações forçadas do `FROTA-ALERTA-05` (pedido não recolhido).

**Aceite:** permissão "ver frota" é **distinta** de ser admin, e acesso à posição
fica no audit log — é dado pessoal de trabalhador, não painel de vigilância.

---

## `ADMIN-05` — viagens e lotes *(depende da onda 7)*

- [ ] Ver e reordenar paradas, **revalidando os invariantes** do sequenciador
      (carga cresce na coleta e decresce na entrega; entrega nunca antes da
      própria coleta).
- [ ] Remover pedido do lote, cancelar lote, intervir com motivo.

---

## `ADMIN-06` — reclamações *(depende da onda 6)*

- [ ] Fila com SLA, atribuição, resposta, resolução.
- [ ] Estorno e penalização dentro dos tetos da `DEC-13` e `DEC-16`.
- [ ] Contestação de veredito automático visível e acionável.

---

## O que NÃO fazer em nenhuma tarefa desta onda

- Não criar caminho paralelo ao `dispatch()` nem à máquina de estados. Comando de
  admin **atravessa** as mesmas regras, com privilégio e trilha — não por fora.
- Não expor `pickupCode` nem `priceBoostProposal` em rota nova sem passar pelo
  recorte de `present()`. Já vazou uma vez para o app do prestador.
- Não recriar a aprovação em lote de motoboy: o `PLANO_ADMIN` §7 proíbe, porque
  documento exige olho humano. Aprovação é individual, com resumo antes.
