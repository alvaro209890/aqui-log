# Histórico de entregas (Sprints 1–4 scaffold)

Linha do tempo do monorepo `aqui-log` em `main` (2026-07-16).

## `COUR-02`: cancelamento do prestador com taxa — 2026-08-19

- **Regra:** só `ACCEPTED`, antes da coleta, dentro do cutoff (`FLOW-DEC-01`:
  5 min após o aceite no imediato; 60 min antes da janela no agendado). Fora
  disso, `409`; pós-coleta continua só suporte.
- **Dinheiro:** debita `courier_cancel_fee_cents` (congelada no aceite) do
  saldo disponível do motoboy, com contrapartida na receita da plataforma.
  Saldo insuficiente recusa sem saldo negativo (`DEC-22`). A reserva do
  cliente **não** é solta — o pedido volta a `REQUESTED` e redespacha.
- **Atalho fechado:** `PATCH /deliveries/:id/status CANCELED` pelo entregador
  agora é `400` (teria cancelado o pedido e estornado o cliente sem taxa).
- **App:** botão *Cancelar corrida* no detalhe, com confirmação do valor;
  recusa do servidor aparece em SnackBar. Cartão da lista segue sem botão.
- **Trilha:** auditoria `COURIER_CANCELED` + evento no pedido. Índice de
  confiabilidade (`courier_metrics`) ainda não existe — é `LOT-01`/`SUP-03`.
- Migration aditiva: valor `COURIER_CANCEL_FEE` no enum do ledger.

Evidência: `docs/04-status/entregas/2026-08-19-EVIDENCIA-COUR-02.md`.

## Fluxo cliente↔prestador nos planos — 2026-08-07

## `ADMIN-02A`: fila de aprovação de entregadores no painel — 2026-08-11

- **O backlog dizia "é só tela". Não era.** A rota `PATCH /couriers/:id/approve`
  existia e a página já tinha os botões, mas `GET /couriers` devolvia só as
  colunas de `couriers`: **sem nome e sem e-mail**. Quem aprovava via um UUID,
  um CPF e um tipo de veículo — e aprovar cadastro é revisão humana
  (`PLANO_ADMIN` §7 proíbe aprovação em lote justamente porque "documentos
  exigem olho humano").
- **Também não havia fila**: a lista era dos 87 entregadores do banco, ordenada
  por data e paginada em 20, sem filtro e sem contador. Um cadastro novo entrava
  no topo hoje e afundava amanhã. E a tela ignorava `documentUrls` e
  `createdAt`, que **já vinham** no payload.
- **Backend**: `findAll` passou a juntar `users` para trazer nome e e-mail,
  ganhou filtro `?status=` (status inválido é **ignorado** em vez de virar um
  500 que esvaziaria a página) e um `GET /couriers/pending-count`.
  `approve`/`reject` não foram tocados — já gravavam auditoria e notificação.
- **Painel**: seção *Fila de aprovação* em cartões, com nome, e-mail, CPF
  formatado, veículo, placa, **tempo de espera** e **documentos abríveis**;
  contador no cabeçalho; **confirmação individual** com o resumo do cadastro
  antes de aprovar ou recusar; filtro por status e colunas de identidade na
  lista completa; e erro com "tentar de novo" em vez de tabela vazia e um toast.
- **Achado que virou texto na tela**: aprovar deixa `status=ACTIVE` mas
  `available=false` e posição `null` — o entregador ainda precisa abrir o app e
  ficar online para receber oferta. A confirmação diz isso com todas as letras:
  *"aprovar não coloca ninguém na rua"*.
- `pnpm build`/`lint` verdes; `pnpm --filter backend test` em **26 suítes / 224
  testes** (+1 suíte, +5 testes travando o contrato da fila); `pnpm smoke`
  aprovado pelo domínio público.
- **Pendente**: QA de navegador **logado** (o painel exige login de admin) — a
  receita está na evidência §6, e dois cadastros pendentes ficaram no banco de
  propósito. A **recusa não aceita motivo**: o `PLANO_ADMIN` pede, a rota não
  suporta, e a tela não finge — o campo é `ADMIN-02`.

Evidência: `docs/04-status/entregas/2026-08-11-EVIDENCIA-ADMIN-02A.md`.

## App do entregador completo e distribuível — 2026-08-11

- **O mesmo achado crítico do app cliente estava aqui**: a URL padrão da API era
  `http://10.0.2.2:3001/api/v1`, o loopback do **emulador**. Um APK instalado
  num celular real não falaria com nada. Agora é o domínio público, travado por
  teste e conferido dentro do `libapp.so`.
- **O entregador não tinha como criar conta pelo app** — só existia login. Tela
  de cadastro nova (nome, e-mail, senha, CPF, veículo, placa). E **sem
  auto-login de propósito**: a API cria a conta com `status: PENDING` e o login
  responde `401 Cadastro ainda nao aprovado` até um admin aprovar. A tela
  termina dizendo isso, em vez de fingir uma entrada que falharia em seguida.
  Bicicleta não pede placa.
- **Auto-login** com sessão persistida (chave própria, para cliente e entregador
  coexistirem no mesmo aparelho) e refresh do par de tokens na abertura. Para
  não duplicar código, `SessionStore`/`StoredSession`/`MemorySessionStore`
  foram para o `aqui_log_core` (Dart puro, coberto por `dart test`); em cada app
  ficou só a ligação com `shared_preferences`, que é plugin Flutter.
- **O card da oferta não dizia quanto o entregador ganha.** `courierFeeCents` já
  vinha no payload (o corte de papel de `present()` não remove esse campo do
  `COURIER`), mas a tela não mostrava — ele aceitava no escuro. Bloco "Você
  recebe" no card da oferta e no detalhe da corrida.
- **Erros deixaram de ser silenciosos**: oferta expirada ou tomada por outro
  (`404`/`409`) vira "Essa oferta não está mais disponível." e o card trava
  enquanto decide (antes, toque duplo disparava duas chamadas); a recusa do
  servidor numa transição de status (`409` fora da janela do agendado) aparece
  na tela; disponibilidade recusada reverte o switch; offline, a tela explica
  por que não chega oferta.
- **Carteira** migrada para o extrato tipado do ledger — imprimia `R$ 18.00`,
  com ponto. O texto passou a dizer a verdade: o saque é feito pela equipe,
  porque payout automático não existe no servidor.
- **Contratos preservados e travados**: `pickupCode` e `priceBoostProposal`
  continuam sem chegar ao app do entregador — verificado no runtime real depois
  de um aceite (`pickupCodeRequired: true`, `pickupCode` ausente) e com teste
  novo no app.
- **APK release arm64** em `dist/aqui-log-entregador-2026-08-11.apk` (19,3 MB).
- Verificação: `flutter analyze`/`test` verdes (entregador **28** testes, eram
  18; cliente 21 sem regressão), `dart analyze`/`test` no core (**29**, eram
  23), `pnpm build`/`lint`/`test` (25 suítes / 219 testes) e `pnpm smoke` pelo
  domínio público. O fluxo de cadastro → `401` → aprovação → login → oferta com
  repasse foi exercitado ao vivo contra `aquilog-api.cursar.space`.

Evidência: `docs/04-status/entregas/2026-08-11-EVIDENCIA-APP-ENTREGADOR.md`.

## `PAY-01` fechado, app cliente distribuível e `OPS-01A` no ar — 2026-08-11

- **`PAY-01` DONE.** O ledger já estava implementado no `8b05bf2`, mas duas
  coisas deixavam o CI vermelho: a asserção final do smoke comparava o
  `GET /finance/summary` (que agrega o ledger **inteiro do banco**) com o
  repasse de **uma** entrega — só passava em banco recém-criado; e havia um erro
  de lint (`no-unsafe-enum-comparison`) em `finance.controller.ts`. A asserção
  passou a comparar o **delta da execução** contra uma baseline capturada no
  início, o que vale tanto no CI (banco novo) quanto no acer (banco acumulado).
- **O app do cliente não era distribuível.** A URL padrão da API era
  `http://10.0.2.2:3001/api/v1` — o loopback do **emulador**: um APK instalado
  num celular de verdade não falaria com nada. Agora o padrão é o domínio
  público (`DEC-26`), travado por teste e conferido dentro do `libapp.so`.
- **Auto-login**: a sessão passa a sobreviver ao fechamento do app
  (`session_store.dart` com `shared_preferences`), e a abertura **troca o
  refresh token por um par novo** — restaurar só o access token deixaria o app
  com um token vencido. Enquanto isso, splash em vez de piscar o login.
- **Carteira do cliente**: com o pré-pago do `PAY-01`, criar pedido responde
  `402` sem saldo e não havia onde conferir isso. Nova tela com saldo
  disponível/reservado/total + extrato, entrada no perfil, e o `402` na criação
  agora aponta para ela. Recarga por PIX/cartão continua sendo `PAY-02`.
- **`OPS-01A` DONE** (`DEC-26`): API (`aquilog-api.cursar.space`) e dashboard
  (`aquilog.cursar.space`) rodando no acer por três units systemd de usuário com
  `linger`, atrás de túnel Cloudflare dedicado; dados do Postgres migrados do
  volume Docker para `~/Documentos/Bando_de_dados/Aqui_Log` sem perder nada
  (258 entregas, 14 migrations). Nenhum serviço pré-existente do PC foi tocado.
- **Achado do caminho**: `cloudflared tunnel route dns <nome>` gravou o CNAME
  apontando para o túnel **errado** (`auracore-local-api`). Corrigido com o UUID
  explícito e registrado como armadilha na referência de runtime.
- **APK release arm64** do cliente em `dist/aqui-log-cliente-2026-08-11.apk`
  (19,4 MB).
- `pnpm build`/`lint`/`test` verdes (**25 suítes / 219 testes**); `pnpm smoke`
  aprovado 3× no localhost **e 1× pelo domínio público**; Flutter/Dart verdes
  nos dois apps (cliente **21** testes) e no core (23).

Evidência: `docs/04-status/entregas/2026-08-11-EVIDENCIA-APK-E-RUNTIME.md`.
Operação: `docs/03-referencia/05-RUNTIME-ACER.md`.

## `DISP-02`: aviso de demora e ações do cliente na busca — 2026-08-10

- **O cliente passa a ser avisado quando a busca demora** (plano §6.1.4): o job
  de 10 s marca `dispatch_warning_at` (uma vez por ciclo, índice próprio) após
  `dispatchFirstWarningMinutes` (default 5; 0 = imediato), com evento,
  notificação e WebSocket `delivery:warning`. Conta do início do ciclo, não da
  criação do pedido.
- **Busca esgotada virou ação, não beco sem saída** (plano §6.1.5): o cliente
  vê o motivo e pode **tentar de novo** (`POST /deliveries/:id/retry`, mesmo
  caminho de recuperação do admin — quem recusou continua excluído e o preço
  não muda), **editar** (`PATCH /deliveries/:id` — só endereços, destinatário,
  telefone, observação e janelas; preço/peso/tipo/foto são recusados com `400`)
  ou **cancelar**.
- **Aumento de valor com consentimento explícito** (`DEC-03` §3.3, agora
  completo): a busca esgotada devolve `priceBoostProposal` (anterior → novo,
  `+dispatchPriceBoostPercent`, default 20; 0 desliga) e só
  `POST /deliveries/:id/price-boost/consent` aplica — com evento, auditoria
  (anterior → novo) e reabertura da busca. **Nenhum aumento é silencioso.**
- **Painel admin**: "Aviso de demora (minutos)" e "Aumento para destravar a
  busca (%)" na seção "Reoferta por aneis" (`DEC-02` — provisórios, sem deploy).
- **App cliente**: tela de detalhe com o status da busca (procurando → aviso de
  demora → esgotada com ações) e card da proposta de aumento com aceite;
  diálogos de edição e cancelamento.
- **13 migrations** (nova: `DispatchClientNotice`, revertida e reaplicada com
  o banco vivo); `pnpm build`/`lint`/`test` verdes (**205 testes**); `pnpm smoke`
  aprovado 3× com o cenário DISP-02; `flutter analyze`/`flutter test` verdes
  nos dois apps e `dart analyze` no core.

Evidência: `docs/04-status/entregas/2026-08-10-EVIDENCIA-DISP-02.md`.

## `DISP-01`: reoferta por anéis de raio — 2026-08-09

- **O pedido sem aceite ganhou um ciclo com fim** (`DEC-03`, plano §6.1). Cada
  rodada oferta ao mais próximo dentro de um anel de raio, e o anel cresce a
  cada rodada: `inicial + (rodada − 1) × incremento`. Valores provisórios e
  editáveis no painel — 3 km, +3 km, 4 rodadas, 20 minutos (último anel: 12 km).
- **Quem já foi tentado não recebe de volta.** Recusa e expiração contam igual:
  reofertar a quem recusou só queima o TTL outra vez.
- **Anel vazio não consome rodada.** O job roda a cada 10 s e queimaria o limite
  em menos de um minuto com a cidade offline; quem freia esse caso é a duração
  total.
- **O ciclo termina com motivo gravado no pedido** — `ACCEPTED`, `MAX_ROUNDS`,
  `TIMEBOX`, `NO_CANDIDATE` ou `CANCELED` — e o pedido **continua `REQUESTED`**:
  encerrar a busca não é cancelar. O despacho manual do admin reabre o ciclo do
  zero, mantendo a exclusão de quem recusou.
- **Preço não muda em nenhuma rodada** (`DEC-03`/`DEC-19`): a reoferta usa o
  snapshot congelado. Aumento com consentimento explícito continua sendo
  `DISP-02`.
- **Idempotência em duas camadas** (plano §6.2): lock por pedido e índice único
  parcial `(delivery_id, courier_id, dispatch_round)`, provado no banco.
- **Cada rodada registra raio, elegíveis e tentados** na própria oferta — a
  matéria-prima do `DISP-03`, que ainda não existe.
- Correções que o pacote exigiu: pedido **imediato recusado** ficava parado para
  sempre (nenhum job olhava para ele) e o **agendado** passou a reabrir o ciclo
  uma única vez quando a janela chega.

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-DISP-01.md`.

## `COUR-01`: agenda do prestador no app do motoboy — 2026-08-09

- **A aba *Corridas* virou três abas** (`DEC-21`, plano §5.2): *Em andamento*
  (imediata aceita/em execução e agendada cuja janela já abriu), *Agenda*
  (agendada aceita com o início da janela ainda no futuro — o aceite antecipado
  do `DEC-20`) e *Concluídas*, que preserva o histórico que a lista antiga
  mostrava. Cada aba traz sua própria contagem e seu próprio estado vazio.
- **O critério é a janela, não o modo.** Um agendado com a janela já aberta é
  trabalho de agora. Só uma corrida ainda parada em `ACCEPTED` pode estar na
  agenda: se o status andou (coleta liberada por suporte, por exemplo), ela está
  acontecendo.
- **A regra é pura e compartilhada** (`packages/aqui_log_core/.../courier_board.dart`),
  recebe o "agora" por parâmetro e tem 9 testes — a fronteira entre as duas
  seções é um instante, e teste que lê o relógio real não prova os dois lados.
- **Cartão da corrida** com código público, modo, janelas de coleta e entrega,
  os dois endereços, a encomenda (tipo, tamanho, peso e foto) e o repasse. Tocar
  abre o detalhe/execução **existente**; nenhuma tela foi recriada.
- **Sem botão de cancelar:** a taxa de cancelamento é `COUR-02` e depende de
  `PAY-01`. Botão desabilitado prometeria uma saída que não existe.
- **O backend não mudou.** `GET /deliveries` já entregava modo, janelas,
  endereços, encomenda e repasse ao prestador desde `SCHED-01`; não houve rota,
  DTO nem migration nova. Acrescentou-se um teste que **trava esse contrato** —
  sem ele, uma listagem que parasse de mandar a janela quebraria a separação em
  silêncio. `pickupCode` continua fora do app do prestador (`PICK-01`).
- Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md`
  (18 suítes / 153 testes no backend, motoboy 18, core 23, smoke e sonda em
  HTTP vivo). QA em emulador/dispositivo **não executado** — segue em `UX-02`.

## `SCHED-01` + `B2C-06`: modo agendado individual — 2026-08-09

- **Todo pedido novo declara o modo** (`DEC-18`). `fulfillmentMode` virou campo
  **obrigatório** na criação, sem default: pedido sem modo é recusado com `400`.
  A coluna já existia desde `B2C-02A`; o que faltava era o cliente escolher.
- **Janela de coleta no agendado** (`FLOW-DEC-02`): início ao menos **30 min** à
  frente, fim depois do início, duração de 15 min até o máximo configurado (480)
  e horizonte de 30 dias. Janela de entrega é opcional — mas se vier, vem
  inteira, e não pode começar antes da coleta. Janela enviada em pedido
  **imediato** é recusada.
- **Tarifa dual efetiva** (`B2C-06` / `DEC-19`): a cotação e a criação usam o km
  do modo (250 imediato × **180** agendado, valores provisórios do `DEC-02`) e o
  congelam no pedido, agora também em coluna própria (`km_rate_cents`), além do
  `pricing_breakdown`. Mudar settings **não** altera pedido criado.
- **Aceite antecipado** (`DEC-20`): o agendado entra na fila de ofertas na hora
  da criação. O aceite congela `courier_cancel_fee_cents` e **não** marca o
  prestador como indisponível — a janela dele é lá na frente. A cobrança da taxa
  continua em `COUR-02`/`PAY-01`.
- **Reserva de agenda** (plano §5.1): prestador com agendado aceito não recebe
  oferta cuja execução colida com a janela reservada, com folga configurável.
  Sem ninguém livre, o despacho devolve `404` com motivo em português.
- **Execução abre na janela:** `ACCEPTED → AT_PICKUP` antes do início devolve
  `409`, com o horário em `America/Sao_Paulo`. Admin e suporte passam.
- **4 settings novos no admin:** `minScheduleLeadMinutes` (30),
  `scheduleMaxWindowMinutes` (480), `scheduleCapacitySlackMinutes` (15) e
  `immediateExecutionEstimateMinutes` (45) — os três últimos provisórios.
- **Painel:** seção "Modo agendado" nas configurações, filtro por modo e coluna
  MODO na lista de entregas (o agendado mostra dia e faixa de horário).
- **App cliente:** escolha "Agora / Agendar", seletor de dia e hora da janela,
  duração ajustável e validação local antes de chamar a API.
  **App motoboy:** a oferta agendada mostra a janela antes do aceite, e o botão
  de chegada fica desabilitado até a janela abrir.
- Migration `1785500000000` aditiva (6 colunas opcionais + 2 índices), revertida
  e reaplicada com uma linha legada dentro da tabela. Pedido legado sem modo
  segue legível e vale como imediato; fallback de `notes` intacto.
- Smoke ganhou o cenário agendado ponta a ponta, com 4 casos negativos.
- Testes: backend 96 → **149**; core Dart 10 → 14; cliente 13 → 15; motoboy 11 → 14.
- Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md`.

## `PICK-01`: código de recolhimento na coleta — 2026-08-09

- **`AT_PICKUP → PICKED_UP` exige código válido + foto do prestador** (`DEC-24`).
  A foto tem de ser do prestador: reapresentar a foto que o cliente enviou na
  criação é recusada com `400`.
- **Código de 4 dígitos** (`FLOW-DEC-03`) gerado no servidor **no aceite**, com
  `crypto.randomInt`. Vai na notificação de aceite e no detalhe do pedido do
  cliente; **o app do entregador nunca recebe o valor** — só
  `pickupCodeRequired`, `pickupCodeAttemptsLeft` e `pickupCodeBlockedUntil`.
  O valor também não entra na auditoria.
- **Rate limit:** 4 erros devolvem `400` com as tentativas restantes; o 5º
  bloqueia por 15 min com `429`, alerta ao cliente e auditoria
  (`DELIVERY_PICKUP_CODE_FAILED` / `_BLOCKED`). Durante o bloqueio nem o código
  certo passa.
- **Fallback de código perdido:** `POST /deliveries/:id/pickup-code/override`,
  só admin/suporte, motivo obrigatório (≥ 10 caracteres), prova alternativa
  opcional, auditado. Ele destrava a coleta, não avança o status.
- **Pedido legado sem código** continua avançando só com a foto — leitura e
  escrita legadas intactas. Migration `1785400000000` aditiva, revertida e
  reaplicada com uma linha legada dentro da tabela.
- App do motoboy: a tela de coleta pede os 4 dígitos e só libera o envio com a
  foto e o código completos; bloqueada, ela recusa nova tentativa. App do
  cliente: o código aparece em destaque no detalhe do pedido.
- Smoke passou a reprovar se o entregador receber o campo `pickupCode`.
- Testes: backend 70 → **96**; core Dart 6 → 10; motoboy 7 → 11; cliente 11 → 13.
- Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md`.

## `DEC-02` + `B2C-02`: preço v2 e tema escuro — 2026-08-08

- **`DEC-02` DECIDIDA** pelo Álvaro com valores **provisórios**, todos editáveis
  no painel admin sem deploy: base R$ 7,00, mínimo R$ 9,00, plataforma 20%,
  km imediato R$ 2,50 / agendado R$ 1,80, faixas de peso até 2/5/10/20 kg,
  tamanho P/M/G, multa do prestador R$ 3,00 e cutoffs.
- **Preço v2 (`B2C-02`/`B2C-02A`):** `base + km × tarifa_do_modo + peso +
  tamanho`, com piso. `pricingVersion`, `pricingBreakdown` e `fulfillmentMode`
  persistidos no pedido — mudar settings **não** altera pedido criado (`DEC-19`).
  Migration aditiva `1785300000000`, revertida e reaplicada em teste.
- **Settings do admin** ganharam 9 campos novos (tarifa dual, faixas de peso,
  adicionais de tamanho, multas e cutoffs), com validação `DEC-19` na escrita.
- **Tema escuro** do painel, derivado por tokens (regra 7 das diretrizes), com
  alternador na `TopBar`, persistência e respeito ao `prefers-color-scheme`.
  No escuro o laranja claro `#FB923C` assume o texto; `#C54B07` sumiria.
- Correção: **patch parcial de settings apagava valores personalizados** —
  o DTO chega com as chaves ausentes em `undefined` e elas sobrescreviam o
  estado salvo; como `JSON.stringify` descarta `undefined`, a perda era
  silenciosa. Também cegava a validação do `DEC-19`. Dois testes de regressão.
- Correção: o formulário de configurações **não submetia** — `min=0.001` com
  `step=0.5` invalida todo peso inteiro e o navegador bloqueia o submit inteiro
  sem mensagem.
- Pendência registrada: o gráfico de pizza não renderiza setores (Recharts 3.9
  + React 19); pré-existente, reproduzido sem `Cell`, sem `label` e com as cores
  originais.
- Testes: backend 44 → **70**. Contraste AA: 0 reprovações em 11 telas × 2 temas.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-02-E-TEMA-ESCURO.md`.

## `UX-01C`: identidade laranja no dashboard — 2026-08-08

- `styles.css` ganha uma camada de tokens em `:root` e vira a **fonte única** de
  cor de marca do painel; o verde/menta saiu, inclusive dos neutros que eram
  tingidos de verde. Sidebar passa a ser escura neutra com destaque laranja.
- `theme.ts` (novo) leva os tokens para Recharts e Leaflet exportando **nome** de
  token (`var(--...)`), não valor. Resultado: 0 hexadecimais fora do tema.
- **Dois laranjas, uma marca:** `--color-primary` `#F97316` para acentos, ícones
  e séries de gráfico; `--color-primary-strong` `#C54B07` (4,8:1 sobre branco)
  para botões, links e texto — branco sobre `#F97316` dá 2,8:1 e reprova no AA.
  `#C2410C` foi testado e revertido: passa no contraste, mas lê como vermelho.
- `StatusBadge`: `DELIVERED` e `CANCELED` usavam **o mesmo cinza** — entrega
  concluída ficava indistinguível de cancelada. Agora verde e vermelho;
  `IN_TRANSIT` vira azul (rastreamento) e `REJECTED` vermelho. Criada `.status.red`.
- Vocabulário: placeholder da busca deixa de citar "empresa" (B2B removido do
  produto) e a ação "Assign" vira "Atribuir".
- QA em Chrome real: 11 telas sem verde de marca, 7 pares de texto ≥ 4,5:1,
  foco de teclado visível e mobile 430px sem overflow horizontal.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

## `B2C-05`: foto e campos obrigatórios na criação — 2026-08-08

- `CreateDeliveryDto`: `productType`, `packageSize`, `weightKg` e
  `productPhotoUrls` (≥ 1) deixam de ser opcionais (`DEC-01`, `DEC-18`).
  Mensagens de erro passam a ser em português e específicas por campo.
- Endereços e nome do destinatário ganham `@IsNotEmpty` com aparo de espaços:
  `"   "` deixa de ser aceito como endereço.
- App cliente: a foto vira obrigatória na tela de novo pedido — botão em
  vermelho, mensagem inline e envio bloqueado antes de chamar a API.
- `scripts/smoke-test.sh`: o cliente sobe a foto por `presign purpose=product`,
  o pedido vai completo e um **assert negativo** garante que o payload legado é
  recusado com `400` (validado invertendo a expectativa: `exit=1`).
- Leitura de pedido legado **não** mudou: linha sem campos B2C continua abrindo
  em lista, detalhe, histórico e visão de admin. Fallback de `notes` intacto.
- Testes: backend 36 → **44**; app cliente 10 → **11**.
- `PICK-01` promovido a `READY` (dependia de `B2C-05`; `DEC-24` já decidida).
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

## `BASE-04` e `B2C-01B` fechados com evidência de runtime — 2026-08-08

- `BASE-04` `DONE`: banco descartável `aqui_log_base04`, 8 migrations sem
  `synchronize=true`, `RemoveCompanyModel` revertida e reaplicada, health com
  `db`/`redis` `ok`, smoke B2C aprovado em 6 execuções com códigos distintos.
- `B2C-01B` `DONE`: QA de navegador em Chrome real cobrindo os quatro filtros,
  combinação, estado vazio, paginação com filtro e escopo por papel
  (`CUSTOMER` ignora `customerId` alheio; não-UUID → 400; sem token → 401).
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (backend 10 suítes / 36 testes).
- Achados de UI registrados para `UX-01C`/`UX-02`: busca decorativa na `TopBar`
  com vocabulário B2B ("empresa"), ação "Assign" em inglês, painel ainda verde.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

## Smoke deixa de aprovar com upload de prova quebrado — 2026-08-08

- `scripts/smoke-test.sh`: a falha do `PUT` da prova era engolida dentro de `$( )`,
  onde `set -e` não aborta; o script imprimia `Smoke test aprovado` mesmo com o
  arquivo nunca subindo.
- Agora `upload_proof` retorna erro e a chamada usa `|| exit 1`, com mensagem que
  nomeia a prova, a URL tentada e explica o alinhamento de `PUBLIC_API_URL`.
- Verificado nos dois sentidos: falha com `exit=1` quando desalinhado, aprova com
  `exit=0` quando alinhado.
- Consequência: evidências de smoke anteriores a esta data não comprovam upload.

## B2C-01B fatia 4 (`customerId`) — 2026-08-08

- `GET /deliveries?customerId=` com validação UUID (`400` se inválido).
- Filtro aplicado só a papéis admin; outros ignoram o param.
- Dashboard: input Cliente + coluna (prefixo UUID); predicados + testes.
- Backend 36 testes; builds/lints verdes. Falta QA browser.

## B2C-01B fatia 3 (faixa de peso) — 2026-08-08

- `GET /deliveries?weightMin=&weightMax=` com validação (>=0, min≤max).
- Dashboard: inputs peso min/max + coluna Peso; legado sem peso fora do filtro.
- Backend 35 testes; builds/lints verdes.

## B2C-01B fatia 2 (`packageSize`) — 2026-08-08


- `GET /deliveries?packageSize=` com validação (`SMALL`/`MEDIUM`/`LARGE`).
- Dashboard: select Tamanho + coluna; combo com `productType` nos testes.
- Backend 34 testes; builds/lints verdes. `B2C-01B` ainda `IN_PROGRESS`.

## B2C-01B fatia 1 (`productType`) — 2026-08-08


- `GET /deliveries?productType=` com validação de catálogo (`400` se inválido).
- Predicados puros + testes; dashboard: select Categoria + coluna na tabela.
- Pedidos legados sem categoria não entram no filtro.
- Evidência: backend 33 testes, builds/lints backend+dashboard verdes.
- QA navegador / smoke vivo: não executados. `B2C-01B` permanece `IN_PROGRESS`.

## Hospedagem cloud travada — 2026-08-07


- `DEC-25`: API **Render**, dashboard **Vercel**, banco **Firebase Firestore**
  (+ Storage/FCM). Plano `PLANO_HOSPEDAGEM.md`; `OPS-DB-01`/`OPS-02`/`OPS-03`.
- `INV-02`/`INV-05` atualizados: Postgres local permanece; cloud não provisionada
  nesta sessão (só documentação + comentários do blueprint).
- Sessão docs-only; push em `main`.

## Fluxo cliente↔prestador nos planos — 2026-08-07

- Novo plano `PLANO_FLUXO_CLIENTE_PRESTADOR.md` com modos IMMEDIATE/SCHEDULED,
  km dual, aceite antecipado, Agenda, taxa de cancelamento no saldo do prestador,
  saldo sacável e `pickup_code`.
- Decisões `DEC-01` e `DEC-18`…`DEC-24` registradas como `DECIDIDA`.
- Roadmap/backlog ganharam IDs `B2C-05`, `B2C-06`, `SCHED-01`, `COUR-01/02`, `PICK-01`.
- Contradições removidas: foto “opcional até decidir”, “desistência sem penalidade
  dura”, preço único por km, ausência de código de recolhimento.
- Sessão somente documental; `BASE-04` continua o próximo trabalho técnico.

## Organização documental para agentes — 2026-08-07

- Documentação separada em governança, produto, planejamento, referência, estado e arquivo.
- Criados `AGENTS.md`, índice, backlog único, registro de decisões, estado atual,
  handoff substituível, fluxo numerado, checklist e templates.
- Próximo item normalizado para `BASE-04`; `B2C-01B` aguarda validação do baseline.
- Contradições removidas: B2B residual, reversão de `DELIVERED`, custódia pós-coleta,
  IDs colidentes e Redis como autoridade única de reserva.
- Sessão somente documental: nenhum teste de aplicação ou runtime foi executado.

## B2C-01 e identidade mobile — 2026-08-07

- Encomenda estruturada em colunas proprias, com migration aditiva e rollback coberto por teste.
- DTO/API validam catalogos estaveis, peso e fotos hospedadas pelo storage do Aqui Log.
- `OrderMeta` serializa o contrato novo e mantem leitura de `notes` legado.
- Apps cliente e motoboy exibem tipo, tamanho, peso, alcance, observacao e foto pelo contrato novo.
- Tema compartilhado mudou de verde/menta para laranja `#F97316`; status continuam semanticos.
- Testes locais: backend 32/32, core 6/6, UI 2/2, cliente 10/10, motoboy 7/7; build backend/dashboard verde.
- Encerrado sem migration/smoke ao vivo, APK ou QA visual: host sem `.env`/Docker e AVD Android offline no ADB.

## Planejamento consolidado — 2026-08-07 (documentação local)

- `ROADMAP.md` refeito como fila executiva do produto B2C atual.
- Próximo pacote definido: `B2C-01`, dados estruturados da encomenda com fallback legado.
- Planos de confiança/preço, pagamentos e lote multi-pedido ganharam dependências,
  invariantes, gates e critérios de aceite.
- `PLANO_IMPLEMENTACOES.md` e `PROMPT_AGENTE.md` marcados como históricos para
  evitar reexecução de trabalho já entregue.
- Identidade laranja mantida como trilha paralela `UX-01/02`, ainda sem mudança de código.

## Sprint 1 — Backend robusto
- Redis: health + lock aceite
- Jobs: expirar oferta / re-despacho / scheduled
- Pricing server-side
- Refresh token, logout, forgot/reset
- Alertas mark-read
- Timezone America/Sao_Paulo

## Sprint 2 — Mobile piloto
- Storage local + policy proofUrl
- Geocode API
- Device tokens skeleton
- Flutter: mapas OSM, câmera/upload, GPS, geocode, refresh client

## Sprint 3 — Dashboard gestão
- Users / Audit / Settings pages
- Dispatch, assign, cancel deliveries
- Reject/suspend companies & couriers
- Reports from/to
- Pagination admin lists

## Sprint 4 (parcial) — Estrutura cloud, sem vínculo
- Render blueprint (`infra/render.yaml`)
- Vercel config (`vercel.json`)
- Firebase folder + Nest stubs (`FIREBASE_ENABLED=false`)
- Docs: `DEPLOY_TARGETS.md`, `HANDOFF.md`

## Fora de escopo (ainda)
- Pagamentos, MFA, deploy real, Firebase ligado, FKs, load test
