# Handoff vigente

- **Data/hora:** 2026-08-09 (~12:20 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `PICK-01` — código de recolhimento na coleta (`DEC-24` + `FLOW-DEC-03`)
- **Branch/commit inicial:** `main` @ `a5e5909`

## Resultado

`PICK-01` está `DONE`. A transição `AT_PICKUP → PICKED_UP` passa a exigir
**código de recolhimento válido** e **foto de prova do prestador**, distinta da
foto que o cliente enviou na criação.

- O código tem **4 dígitos**, nasce no **aceite** (CSPRNG) e vai para o cliente
  — na notificação de aceite e no detalhe do pedido.
- Cinco tentativas erradas bloqueiam a coleta por **15 minutos**, com alerta ao
  cliente e auditoria. Durante o bloqueio nem o código certo passa.
- Código perdido só é liberado por **admin/suporte**, com motivo escrito e
  auditoria: `POST /deliveries/:id/pickup-code/override`.
- **Pedido legado sem código continua avançando só com a foto.**

## Coisas que o próximo agente precisa saber

1. **O app do entregador nunca recebe o valor do código — e isso é de propósito.**
   O plano (seção 7, regra 1) diz "revelado ao prestador no fluxo de coleta"; o
   que se revela ali é a **exigência**, não o número. A regra 3 da mesma seção
   ("o prestador informa, o servidor valida") só fecha assim. O `deliveries.service`
   recorta a entrega por papel no método `present()`; qualquer rota nova que
   devolva `Delivery` cru vaza o código — passe pelo `present()`.
2. **O valor do código não entra em auditoria.** A auditoria registra que houve
   código, tentativa, bloqueio ou liberação — nunca o número.
3. **O contador e o bloqueio ficam no banco, não no Redis.** São decisão de
   negócio auditável: precisam sobreviver a restart e aparecer no dossiê.
4. **A liberação do suporte não avança o status.** Ela destrava a próxima
   coleta, que continua exigindo a foto do prestador.
5. **O smoke agora reprova se o entregador receber `pickupCode`.** Se alguma
   mudança futura devolver o campo ao motoboy, `pnpm smoke` quebra — mantenha
   assim.
6. **`ADMIN_PASSWORD` do `.env` local é `admin123`**, não o valor default do
   smoke; scripts de sessão que logam como admin precisam ler o `.env`.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 14 suítes / **96 testes** (eram 70) |
| `pnpm smoke` | PASS — 3 execuções, com as asserções do código |
| `pnpm db:migrate` em banco descartável | PASS — 10 migrations |
| Rollback + reaplicação da migration nova | PASS — com linha legada dentro da tabela |
| Bloqueio após 5 tentativas | PASS — `429`, alerta e auditoria em HTTP vivo |
| Fallback admin/suporte | PASS — `403` para o entregador; motivo curto recusado |
| Foto do cliente como prova de coleta | PASS — recusada com `400` |
| Pedido legado sem código | PASS — `200` só com a foto |
| `flutter analyze` / `flutter test` (motoboy e cliente) | PASS |
| `dart analyze` / `dart test` (core) | PASS |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** |

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md`.

## Achado do caminho

`assertAllowedProofUrl` valida **origem** da URL, não o propósito do arquivo: a
foto que o cliente subiu como `product` passava como prova de coleta. `DEC-24`
exige provas distintas, então a checagem de distinção ficou explícita no service
(a prova não pode ser uma das `productPhotoUrls` do pedido) e tem teste próprio.

## Pendências herdadas e abertas

- **Sem tela de suporte no painel** para o fallback de código perdido — hoje é
  chamada por API. Escopo de `SUP-*`/`ADMIN-*`.
- A duração do bloqueio (15 min) é **fixa em código**; `FLOW-DEC-03` decidiu as
  5 tentativas, não a duração. Não foi exposta no admin.
- APK e QA visual em emulador/dispositivo seguem não executados (`UX-02`), agora
  mais relevantes: a tela de coleta do motoboy mudou.
- Gráfico de pizza do painel continua sem renderizar setores (`UX-02`).
- Busca da `TopBar` continua decorativa.
- Cloud, SMS e pagamentos reais continuam atrás de credenciais e autorização.

## Ambiente usado

Banco descartável `aqui_log_pick01` (container `aqui-log-postgres`, 5433), Redis
em 6379, API em `PORT=3011` com `PUBLIC_API_URL` alinhado (a porta 3000 está
ocupada neste PC). O `.env` **não** foi alterado; tudo por variável de ambiente.
Processo da API encerrado ao fim da sessão.

## Próximo

Escolher **um** ID:

1. `UX-02` — QA visual/acessibilidade. Inclui o gráfico de pizza quebrado, a
   busca decorativa e agora a tela de coleta com código; a parte mobile exige
   dispositivo/emulador.
2. `B2C-06` + `SCHED-01` — falta o cliente **escolher** o modo; a tarifa dual e
   o admin dela já existem desde `B2C-02`.
3. `DISP-01` — reoferta por anéis de raio e limite de rodadas (`DEC-03` ✅).

## Mensagem de retomada

> `PICK-01` fechado com evidência: a coleta agora exige código de 4 dígitos do
> cliente **mais** foto do prestador, com bloqueio após 5 erros (15 min, alerta e
> auditoria) e liberação só por admin/suporte com motivo. O app do motoboy nunca
> vê o número — o smoke reprova se ele receber. Pedido legado sem código continua
> passando só com a foto. Migration aditiva revertida e reaplicada com linha
> legada dentro da tabela; 96 testes, smoke 3×. Falta tela de suporte no painel
> para o fallback e QA em dispositivo. Próximo: `UX-02`, `B2C-06`+`SCHED-01` ou
> `DISP-01`.
