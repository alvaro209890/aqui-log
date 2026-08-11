# Handoff vigente

- **Data/hora:** 2026-08-11 (2ª rodada do dia)
- **Agente:** Claude (Opus 5)
- **Tarefa:** terminar a parte principal do **app do entregador**
  (`apps/courier_app`) e exportar o APK, no padrão do app do cliente
- **Branch/commit inicial:** `main` @ `5ca60e0` (`OPS-01A`)
- **Estado:** ✅ entregue, commitado e pushado; CI verde

## Resultado

Evidência: `docs/04-status/entregas/2026-08-11-EVIDENCIA-APP-ENTREGADOR.md`.

- **URL da API**: era `http://10.0.2.2:3001/api/v1` (loopback do emulador) — o
  APK não falaria com nada. Agora é o domínio público, travado por teste e
  conferido dentro do `libapp.so`.
- **Cadastro no app**: não existia; o entregador só conseguia entrar se alguém
  criasse a conta por fora. Tela nova, **sem auto-login de propósito** — a API
  cria a conta `PENDING` e o login responde `401` até um admin aprovar.
- **Auto-login**, repasse visível na oferta, tratamento de erro em
  oferta/status/disponibilidade e carteira do ledger tipada.
- **APK**: `dist/aqui-log-entregador-2026-08-11.apk` (arm64, 19,3 MB, SHA-256
  `2a00d4d2…`). O do cliente segue em `dist/aqui-log-cliente-2026-08-11.apk`.
- **Refatoração compartilhada**: `SessionStore`/`StoredSession`/
  `MemorySessionStore` foram para o `aqui_log_core`; em cada app ficou só o
  `PrefsSessionStore`. O `session_store.dart` do app cliente virou reexport —
  nenhum import existente mudou.

Verificação: `flutter analyze`/`test` verdes (entregador **28**, cliente 21),
`dart analyze`/`test` no core (**29**), `pnpm build`/`lint`/`test` (25 suítes /
219 testes) e `pnpm smoke` pelo domínio público. O fluxo cadastro → `401` →
aprovação → login → oferta com repasse foi exercitado ao vivo.

## Coisas que o próximo agente precisa saber

1. **A aprovação de entregador é manual e não tem tela.** É a trava operacional
   do app do motoboy: quem instala o APK e se cadastra fica parado até alguém
   chamar `PATCH /couriers/:id/approve`. Virou `ADMIN-02A` no backlog.
2. **`courierFeeCents` chega ao app do motoboy** (o corte de papel de
   `present()` não remove esse campo do `COURIER`) — é o que alimenta o "Você
   recebe". Já `pickupCode` e `priceBoostProposal` **não chegam**, e há teste
   travando isso nos dois lados. Não afrouxar.
3. **O app do entregador tem chave de sessão própria**
   (`aqui_log_entregador.sessao`): os dois apps podem coexistir no aparelho.
4. **`shared_preferences` é plugin Flutter** e por isso não entra no
   `aqui_log_core`, que é Dart puro e roda em `dart test`. Só o contrato e o
   modelo moram lá.
5. Timer periódico de localização: teste de widget que chega ao shell
   autenticado **não pode usar `pumpAndSettle`** — timer periódico nunca
   assenta. Usar `pump()` e `stopLocationUpdates()`.
6. Continuam valendo as armadilhas do runtime
   (`docs/03-referencia/05-RUNTIME-ACER.md`): `pnpm build` na raiz publica o
   dashboard apontando para `localhost`; o smoke tem que rodar contra o domínio
   público.

## Não feito e bloqueios

- **`ADMIN-02A`** (fila de aprovação no painel): `READY`, não feito aqui.
- **Entregador não avalia o cliente**: `B2C-03` está `BLOCKED` e
  `POST /deliveries/:id/rate` é do cliente. Nenhuma rota foi inventada.
- **`COUR-02`** (cancelamento com taxa) e **`PAY-02`** (recarga/payout): fora de
  escopo por instrução; `PAY-02` segue bloqueado por credenciais.
- **Saque/payout não existe** no servidor — a carteira do entregador diz isso.
- **QA visual em aparelho** (`UX-02`): os dois APKs existem, ninguém instalou.
- App não consome WebSocket: ofertas e status por polling.
- Pendências antigas de `COUR-01` intactas: aba *Concluídas* não pagina e a
  classificação das abas usa o relógio do aparelho.

## Próximo passo recomendado

1. **`ADMIN-02A`** — fila de aprovação de entregadores no painel. É o que falta
   para o APK do motoboy funcionar sem alguém chamar API na mão.
2. Ou **`UX-02`** — QA visual com os dois APKs instalados num aparelho.
3. **`COUR-02`** segue destravado pelo `PAY-01`, quando o dono quiser.

## Mensagem de retomada

> Os dois apps estão distribuíveis e com APK em `dist/` (cliente e entregador),
> apontando para <https://aquilog-api.cursar.space/api/v1>, que roda neste PC.
> Duas travas operacionais em aberto: **`PAY-02`** (sem recarga, cliente novo
> não publica pedido) e **`ADMIN-02A`** (sem tela de aprovação, motoboy novo não
> recebe oferta). As duas são de produto, não de código quebrado.
