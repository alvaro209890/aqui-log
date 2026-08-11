# Auditoria de bugs — 2026-08-10 (pós-DISP-02)

> **Data:** 2026-08-10
> **Ambiente:** PC `acer`, worktree isolado (`worktree-agent-abd910d9abb067377`);
> banco descartável `aqui_log_audit0810` local (Postgres 5433) + Redis 6379;
> API viva em `PORT=3011`, `PUBLIC_API_URL=http://localhost:3011/api/v1`.
> **Base do trabalho:** `3a48f6c` (docs DISP-02 DONE no `main`), sobre `41edcc8`
> (feat DISP-02) e `b57cfb6` (docs DEC-26).
> **Motivação:** CI vermelho no run `31443312246` (push do commit `3a48f6c`) —
> a API sobe (health ok, rotas mapeadas), mas `pnpm smoke` saía com exit 1.
> Escopo: auditoria de bugs sobre o que o OpenCode entregou em `DISP-02`, mais
> os itens já registrados como abertos em `01-ESTADO-ATUAL.md`.

## 1. Bugs encontrados e corrigidos

### 1.1 Causa raiz do CI vermelho — aviso de demora nunca disparava com oferta pendente

- **Sintoma:** `pnpm smoke` falhava na asserção `.dispatchWarningAt != null`
  depois de aguardar 13 s (job de 10 s), tanto no CI quanto reproduzido
  localmente com banco descartável e API viva.
- **Causa raiz:** `DeliveriesService.warnSlowDispatch()` consultava só pedidos
  com `status: DeliveryStatus.REQUESTED`. Mas o despacho (`POST
  /deliveries/:id/dispatch`, chamado logo na criação do pedido) muda o status
  para `OFFERED` assim que existe uma oferta pendente — que é o caso comum,
  já que o ciclo passa a maior parte do tempo com uma oferta ativa aguardando
  o motoboy aceitar/recusar/expirar. Com o filtro restrito a `REQUESTED`, o
  aviso de demora só teria chance de disparar nas janelas raras entre
  rodadas, sem oferta pendente — no cenário do smoke (despacho manual
  imediato), nunca acontecia.
- **Correção:** `apps/backend/src/deliveries/deliveries.service.ts` —
  `status: In([DeliveryStatus.REQUESTED, DeliveryStatus.OFFERED])` no lugar
  de `status: DeliveryStatus.REQUESTED`, mantendo o filtro por
  `dispatchEndReason: IsNull()` (ciclo ainda ativo).
- **Evidência:** reproduzido localmente com o mesmo sintoma do CI antes da
  correção; teste novo (`dispatch-warning-offered.spec.ts`) trava os dois
  casos (`OFFERED` recebe o aviso; ciclo já encerrado não recebe); `pnpm
  smoke` aprovado 3× depois da correção.
- **Commit:** `fix(DISP-02): aviso de demora nunca disparava com oferta
  pendente (causa do CI vermelho)`.

### 1.2 `priceBoostProposal` vazava para o app do motoboy

- **Sintoma:** encontrado por leitura de código (item pedido na tarefa:
  vazamento de dado sensível entre papéis), não pelo smoke.
- **Causa raiz:** em `present()`, o bloco que calcula `priceBoostProposal` era
  executado **antes** do corte por papel do motoboy (`if (user.role ===
  UserRole.COURIER) return shared`). O objeto `shared` retornado ao COURIER
  já incluía `priceBoostProposal` quando o pedido estava em busca esgotada
  recuperável. Isso deixava o app do entregador saber, antes de qualquer
  consentimento do cliente, que um aumento de valor estava disponível — o que
  cria incentivo para recusa estratégica (recusar de propósito para forçar o
  valor subir e faturar mais na rodada seguinte). O mesmo cuidado já existia
  para `pickupCode` (excluído do objeto via destructuring antes do corte de
  papel) mas não tinha sido replicado para a proposta de aumento.
- **Correção:** move o cálculo de `priceBoostProposal` para depois do
  `return shared` do `COURIER`, no mesmo espírito do corte de `pickupCode`.
- **Evidência:** teste novo (`present-price-boost-role.spec.ts`) prova que o
  motoboy não recebe `priceBoostProposal` nem `pickupCode`, e que o cliente
  continua recebendo a proposta normalmente.
- **Commit:** `fix(DISP-02): proposta de aumento (priceBoostProposal) vazava
  para o app do motoboy`.

### 1.3 Gráfico de pizza e gauge não renderizavam setores (Recharts 3.9 + React 19)

- **Sintoma:** bug pré-existente já registrado em `01-ESTADO-ATUAL.md` (seção
  4, `UX-02`) e na evidência `B2C-02`. Confirmado em Chrome real: "Entregas
  por status" (`DeliveriesByStatus.tsx`) e "Desempenho geral"
  (`PerformanceGauge.tsx`) — os dois usam `<Pie>`/`<PieChart>` — renderizavam
  só uma linha quase invisível no lugar do círculo. A legenda aparecia com as
  cores certas; nenhum setor.
- **Causa raiz:** `main.tsx` monta a aplicação em `<StrictMode>`. Em React 19
  com StrictMode, o double-invoke de efeitos de desenvolvimento corrompe a
  máquina de animação por raio interpolado que o `Pie` do Recharts 3.9 usa
  por padrão (`isAnimationActive` default `true`), colapsando os setores.
- **Correção:** `isAnimationActive={false}` nos dois componentes
  (`DeliveriesByStatus.tsx` e `PerformanceGauge.tsx`) — evita a máquina de
  animação problemática; os gráficos são pequenos o bastante para a perda de
  animação não ser sentida.
- **Evidência:** QA em Chrome real (login no painel com dados reais do
  smoke): antes da correção, os dois gráficos mostravam só uma linha; depois,
  os setores coloridos aparecem corretamente. Screenshot comparativo feito
  durante a sessão (não anexado a este documento).
- **Commit:** `fix(dashboard): grafico de pizza e gauge nao renderizavam
  setores (Recharts 3.9 + React 19)`.

## 2. Observações registradas sem correção (fora de escopo ou decisão de produto)

### 2.1 Busca da TopBar é decorativa

- **Achado:** `apps/dashboard/src/components/TopBar.tsx` renderiza
  `<input placeholder="Buscar entrega, cliente ou entregador" />` sem
  `value`, `onChange`, `name` ou qualquer handler — o campo não filtra nada e,
  na prática, nem a digitação fica visível de forma confiável ao interagir
  via automação. Confirmado em Chrome real: digitar no campo não produz
  nenhum efeito.
- **Por que não foi corrigido:** já está registrado como "limitação aberta"
  (não como regressão) em `01-ESTADO-ATUAL.md`, seção 2. Implementar a busca
  de verdade exigiria uma superfície nova (endpoint ou filtro client-side
  cruzando entregas/clientes/entregadores, navegação para o resultado, estado
  de carregamento/erro) — é uma feature nova, não um bug de comportamento
  regressivo, e o escopo desta sessão é auditoria e correção de bugs, não
  desenvolvimento de funcionalidade.

### 2.2 Janela de corrida (race) no consentimento do aumento de preço

- **Achado:** `consentPriceBoost()` lê o pedido, recalcula o preço, salva e só
  depois chama `dispatch(..., { reopen: true })`. Entre o `getById` inicial e
  o `save()`, não há lock (diferente do fluxo de aceite de oferta, que usa
  `RedisService.acquireLock`). Duas chamadas concorrentes ao mesmo endpoint
  (ex.: duplo toque no botão "Aceitar aumento" no app) poderiam, em teoria,
  ambas passar pela validação inicial antes de qualquer uma commitar a
  mudança, resultando em auditoria duplicada ou preço incorretamente
  recalculado sobre um valor já alterado.
- **Por que não foi corrigido:** a janela é muito estreita (checagem +
  gravação ocorrem em sequência síncrona de `await`s, sem I/O externo entre
  elas além do próprio banco) e exigiria adicionar um lock distribuído novo
  só para este caminho — mudança de infraestrutura, não correção pontual, e
  fora do escopo desta auditoria (não há evidência de que isso already
  ocorreu em produção; é um risco teórico). Registrado aqui para uma sessão
  futura decidir se vale a pena.

### 2.3 Pendências já documentadas em `01-ESTADO-ATUAL.md` seção 5 (revisadas, não são bugs)

- **Varredura de anel sem candidato não gera evento:** decisão de design
  documentada explicitamente ("para não inundar `delivery_events` a cada
  10 s"), não um bug.
- **Relógio do aparelho usado nas abas do app do prestador:** o servidor
  continua sendo a autoridade (recusa `AT_PICKUP` fora da janela com `409`);
  o cliente só usa o relógio local para decidir em qual aba mostrar o cartão,
  o que é cosmético, não uma falha de segurança ou de dado. Decisão de
  produto documentada, não bug.
- **Lista "Concluídas" do app do prestador não pagina:** cresce sem limite.
  Isso é uma limitação de escala, não uma regressão de comportamento —
  implementar paginação é uma feature nova (câmbio de contrato de API e de
  UI), fora do escopo desta auditoria.

## 3. Comandos executados e resultados

| Comando | Antes da sessão (evidência DISP-02) | Depois desta auditoria |
| --- | --- | --- |
| `pnpm build` | PASS | PASS |
| `pnpm lint` | PASS | PASS |
| `pnpm --filter backend test` | PASS — 21 suítes / 205 testes | PASS — **23 suítes / 209 testes** (+2 suítes, +4 testes desta auditoria) |
| `pnpm test` (raiz) | PASS — 205 testes | PASS — 209 testes |
| `pnpm smoke` (API viva, `PORT=3011`) | **FALHAVA no CI** (achado 1.1); localmente reproduzido com o mesmo sintoma antes da correção | PASS — **3 execuções consecutivas** depois de todas as correções combinadas |
| `flutter analyze` + `flutter test` (customer_app) | PASS — 15 testes | PASS — 15 testes (app não tocado) |
| `flutter analyze` + `flutter test` (courier_app) | PASS — 18 testes | PASS — 18 testes (app não tocado) |
| `dart analyze` + `dart test` (aqui_log_core) | PASS — 23 testes | PASS — 23 testes (pacote não tocado) |
| QA de navegador (Chrome real, dashboard) | não executado nesta função | Login, dashboard com dados reais do smoke, gráfico de pizza e gauge conferidos visualmente antes/depois da correção; busca da TopBar testada e confirmada decorativa |

### 3.1 Reprodução do sintoma do CI (antes da correção)

Banco descartável `aqui_log_audit0810`, API em `PORT=3011`:

```
+ jq -e '.dispatchWarningAt != null'
+ curl -fsS -X GET http://localhost:3011/api/v1/deliveries/... 
 ELIFECYCLE  Command failed with exit code 1.
```

`GET /deliveries/:id` confirmado com `"status":"OFFERED"`, `"dispatchWarningAt":null`
mesmo depois de 13 s — o mesmo sintoma do CI.

### 3.2 Depois da correção 1.1 (isolada)

`pnpm smoke` aprovado 3× consecutivas em `PORT=3011`.

### 3.3 Depois de todas as correções combinadas (estado final antes do push)

- `pnpm build`, `pnpm lint`, `pnpm test` (raiz) — PASS.
- `pnpm --filter backend test` — **23 suítes / 209 testes** PASS.
- Migration `DispatchClientNotice` (e as demais 12) aplicadas sem
  `synchronize=true` em banco descartável novo (`aqui_log_audit0810`) —
  nenhuma migration foi tocada nesta auditoria, então não houve novo ensaio
  de revert/reapply além do já registrado em `2026-08-10-EVIDENCIA-DISP-02.md`.
- `pnpm smoke` aprovado **3× consecutivas** contra a API viva em `PORT=3011`.
- `flutter analyze`/`flutter test` nos dois apps e `dart analyze`/`dart test`
  no core — PASS (nenhum arquivo Dart/Flutter foi tocado nesta auditoria).

## 4. Limitações e pendências

- A busca da TopBar do dashboard continua decorativa (item 2.1) — decisão de
  não implementar, não esquecimento.
- A janela de corrida teórica no consentimento de aumento (item 2.2) continua
  sem lock — registrado como risco, não corrigido.
- Nenhuma migration foi criada ou alterada nesta sessão.
- Nenhuma feature nova foi implementada (PAY-01, COUR-02, DISP-03,
  telemetria, cloud, geração de APK) — fora de escopo, como instruído.
- QA de navegador cobriu só o que era necessário para confirmar/corrigir os
  dois achados de UI (gráfico de pizza/gauge e busca da TopBar); não é uma
  varredura completa de UX-02.

## 5. Commits desta sessão

1. `fix(DISP-02): aviso de demora nunca disparava com oferta pendente (causa do CI vermelho)`
2. `fix(DISP-02): proposta de aumento (priceBoostProposal) vazava para o app do motoboy`
3. `fix(dashboard): grafico de pizza e gauge nao renderizavam setores (Recharts 3.9 + React 19)`
4. docs: esta auditoria + atualização de `01-ESTADO-ATUAL.md` e `02-HANDOFF.md`.
