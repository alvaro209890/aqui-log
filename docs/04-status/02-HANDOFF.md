# Handoff vigente

- **Data/hora:** 2026-08-10
- **Agente:** Claude (auditoria de bugs)
- **Tarefa:** auditoria e correção de bugs sobre `DISP-02` — motivada pelo CI
  vermelho no run `31443312246` (push do commit `3a48f6c`)
- **Branch/commit inicial:** `main` @ `3a48f6c` (docs DISP-02 DONE)
- **Escopo autorizado:** só auditoria e correção de bugs reais; sem features
  novas (`PAY-01`, `COUR-02`, `DISP-03`, telemetria, cloud, APK)

## Resultado

CI corrigido e verde. Três bugs reais encontrados e corrigidos, cada um em
commit próprio:

1. **Causa raiz do CI vermelho**: `warnSlowDispatch()` só consultava pedidos
   `REQUESTED`, mas o despacho deixa o pedido em `OFFERED` assim que há
   oferta pendente (caso comum) — o aviso de demora nunca disparava com busca
   ativa. Corrigido para considerar `REQUESTED` e `OFFERED`.
2. **Vazamento de papel**: `present()` calculava `priceBoostProposal` antes
   do corte por papel do `COURIER` — o app do motoboy recebia a proposta de
   aumento que só deveria existir para o cliente (incentivo a recusa
   estratégica). Corrigido movendo o cálculo para depois do retorno
   antecipado do `COURIER`.
3. **Gráfico de pizza e gauge do dashboard** não renderizavam setores
   (Recharts 3.9 + React 19 StrictMode, bug pré-existente registrado em
   `UX-02`). Corrigido com `isAnimationActive={false}`.

Dois achados foram registrados como observação, sem correção (fora de
escopo): busca da `TopBar` decorativa (é feature nova, não regressão) e uma
janela de corrida teórica (sem lock) no consentimento de aumento de preço.

## Alterações

- `apps/backend/src/deliveries/deliveries.service.ts` — `warnSlowDispatch()`
  passa a considerar `REQUESTED` e `OFFERED`; `present()` move o cálculo de
  `priceBoostProposal` para depois do corte de papel do `COURIER`.
- `apps/backend/src/deliveries/dispatch-warning-offered.spec.ts` — novo;
  trava o caso `OFFERED` recebendo o aviso e o caso "ciclo encerrado não
  avisa".
- `apps/backend/src/deliveries/present-price-boost-role.spec.ts` — novo;
  trava que o `COURIER` nunca recebe `priceBoostProposal`/`pickupCode` e que
  o `CUSTOMER` continua recebendo a proposta.
- `apps/dashboard/src/charts/DeliveriesByStatus.tsx` e
  `PerformanceGauge.tsx` — `isAnimationActive={false}` nos componentes `Pie`.
- Docs: `docs/04-status/entregas/2026-08-10-AUDITORIA-BUGS.md` (nova),
  `01-ESTADO-ATUAL.md`, este handoff.

## Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| `pnpm build` / `pnpm lint` (raiz) | PASS | backend + dashboard |
| `pnpm --filter backend test` | PASS — **23 suítes / 209 testes** (eram 21/205) | +2 suítes / +4 testes desta auditoria |
| `pnpm smoke` (reprodução do bug, antes da correção 1) | **FALHOU** com o mesmo sintoma do CI (`dispatchWarningAt` nunca preenchido com oferta pendente) | banco `aqui_log_audit0810`, `PORT=3011` |
| `pnpm smoke` (depois de todas as correções) | PASS — **3 execuções consecutivas** | mesmo ambiente |
| `flutter analyze`/`test` (cliente / motoboy) | PASS — 15 / 18 | nenhum arquivo Dart tocado |
| `dart analyze`/`test` (core) | PASS — 23 | pacote não tocado |
| QA de navegador (Chrome real) | PASS | gráfico de pizza/gauge conferidos antes/depois; busca da TopBar confirmada decorativa |
| `gh run list` / `gh run watch` | ver seção "CI" abaixo | confirma o run do push desta sessão |

## Não feito e bloqueios

- Busca da `TopBar` continua decorativa — decisão de não implementar (feature
  nova), não esquecimento.
- Janela de corrida teórica no consentimento de aumento de preço — sem lock;
  registrado como risco para decisão futura.
- Nenhuma migration foi criada ou alterada.
- Nenhuma feature nova foi implementada.

## Riscos conhecidos

- Ver `docs/04-status/entregas/2026-08-10-AUDITORIA-BUGS.md` seção 2 para o
  detalhe dos dois achados não corrigidos.

## Próximo passo recomendado

1. `PAY-01` — ledger interno (`DEC-05`); destrava `COUR-02`. Alternativas:
   `UX-02` (QA visual — o gráfico de pizza já está corrigido; falta a parte
   mobile em dispositivo/emulador) e `OPS-01A` (runtime de distribuição no
   acer via Cloudflare Tunnel, `DEC-26`).

## Mensagem de retomada

> CI corrigido: a causa raiz era o aviso de demora nunca disparar com oferta
> pendente ativa (status `OFFERED`, não só `REQUESTED`). De caminho, corrigi
> um vazamento de `priceBoostProposal` para o motoboy e o gráfico de
> pizza/gauge quebrado do dashboard. Nada de feature nova. Ver a auditoria
> completa em `docs/04-status/entregas/2026-08-10-AUDITORIA-BUGS.md`.
