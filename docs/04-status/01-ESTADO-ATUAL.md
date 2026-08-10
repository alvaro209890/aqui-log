# Estado atual observado

> **Data de referência:** 2026-08-10
> **Ambiente:** desenvolvimento local no PC `acer`; nada produtivo roda aqui
> (runtime de distribuição do Aqui Log no acer = `OPS-01A`, decidido em
> `DEC-26`).
> **Baseline de código:** `bc0d553` (DISP-01) + `DISP-02` em andamento.

## 1. Produto vigente

O Aqui Log é B2C direto: cliente pessoa física solicita e o motoboy executa. Há
cinco roles técnicas: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
O modelo empresa/B2B foi removido do código em 2026-08-07 e a remoção está
**confirmada em banco** desde 2026-08-08 (nenhuma tabela `companies`, nenhuma
coluna `company_id`).

## 2. Capacidade existente

| Superfície | Estado observado na última rodada técnica | Limitação aberta |
| --- | --- | --- |
| Backend NestJS | Auth, cliente, entregas (**criação exige foto/tipo/tamanho/peso/modo**), **modo agendado com janela e aceite antecipado**, ofertas com **reserva de agenda** e **reoferta por anéis de raio com limite de rodadas e de tempo**, tracking, **preço v2 versionado com breakdown congelado**, **código de recolhimento na coleta**, dashboard e storage local | migrations revalidadas em banco vivo em 2026-08-09 (**12 migrations**) |
| App cliente Flutter | Cadastro/login, pedido estruturado **com foto obrigatória**, **escolha entre agora e agendar (com janela)**, **código de recolhimento visível após o aceite**, histórico e acompanhamento | QA recente em dispositivo/emulador pendente |
| App motoboy Flutter | Cadastro, disponibilidade, oferta (**agendada mostra a janela e aceita antecipado**), **abas Em andamento / Agenda / Concluídas**, **coleta com código de recolhimento**, prova, entrega e carteira básica | sem botão de cancelar (é `COUR-02`); QA em dispositivo/emulador pendente |
| Dashboard React | KPIs, entregas (**filtro e coluna de modo**), mapa, motoboys, usuários, auditoria, **configurações completas de preço/multas/agendamento/reoferta** e relatórios; identidade laranja + **tema claro/escuro** | seções "Modo agendado" e **"Reoferta por aneis"** ainda **sem QA de navegador**; busca da `TopBar` decorativa; **gráfico de pizza não renderiza setores** (Recharts 3.9 + React 19) — em `UX-02` |
| Postgres/Redis | Containers `aqui-log-postgres` (5433) e `aqui-log-redis` (6379) ativos | banco de teste é descartável; nenhum dado tem valor |
| Cloud | Scaffolds Render/Vercel/Firebase; alvos **decididos** (`DEC-25`) | nenhum projeto ou credencial conectado |

## 3. Evidência das rodadas técnicas

### `DISP-01` (rodada de 2026-08-09)

Executado no banco descartável `aqui_log_disp01` com API em `PORT=3011`:

- **12 migrations**, com a nova (`DispatchRounds`) revertida e reaplicada **com
  um pedido legado, um motoboy e 4 ofertas dentro das tabelas**, todos
  sobreviventes; todas as colunas novas são opcionais (nenhum `NOT NULL`,
  nenhum `DEFAULT`);
- o pedido sem aceite agora tem **ciclo de reoferta**: rodada = oferta que
  existiu, anel = `inicial + (rodada − 1) × incremento` (provisórios: 3 km,
  +3 km, 4 rodadas, 20 min — último anel 12 km, tudo editável no admin);
- **quem já foi tentado não recebe de volta** — recusa e expiração contam igual,
  mesmo quando o excluído é o único disponível;
- **anel vazio não consome rodada**; provado em HTTP vivo: ~60 s de tentativas a
  cada 10 s sem candidato terminaram com `dispatchRound = 0` e
  `dispatchEndReason = NO_CANDIDATE`. Com uma oferta expirada no meio, o mesmo
  relógio terminou em `TIMEBOX` com `dispatchRound = 1`;
- **o ciclo termina em estado recuperável**: o pedido continua `REQUESTED`, com
  motivo gravado, e nenhum job insiste; `POST /deliveries/:id/dispatch` (admin)
  reabre do zero mantendo a exclusão de quem recusou;
- **preço não muda em nenhuma rodada** (`DEC-03`/`DEC-19`): a reoferta usa o
  snapshot congelado;
- idempotência provada nas duas camadas: `409` no despacho repetido com oferta
  pendente e **erro do banco** na duplicata de `(pedido, motoboy, rodada)`,
  barrada pelo índice único parcial;
- duas correções que o pacote exigiu: pedido **imediato recusado** ficava parado
  para sempre (nenhum job olhava para ele) e o **agendado** passou a reabrir o
  ciclo uma única vez quando a janela chega;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (**21 suítes / 197 testes**);
- `pnpm smoke` aprovado 3×, agora com o cenário DISP-01;
- `flutter analyze`/`flutter test` verdes nos dois apps e `dart analyze`/`dart test`
  no core — **nenhum arquivo Dart foi tocado**.

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-DISP-01.md`.

### `COUR-01` (rodada de 2026-08-09)

Executado no banco descartável `aqui_log_cour01` com API em `PORT=3011`:

- as corridas do prestador são separadas por uma regra pura no pacote
  compartilhado (`courier_board.dart`): agendada `ACCEPTED` com janela no futuro
  vai para **Agenda**; imediata e agendada com a janela já aberta vão para
  **Em andamento**; entregue/cancelada vai para uma terceira aba,
  **Concluídas**, que preserva o histórico que a lista antiga mostrava;
- em HTTP vivo, com dois agendados de **mesmo modo e mesmo status** separados
  só pela janela: 1 caiu em *Agenda* e 1 em *Em andamento*, junto da imediata
  em `IN_TRANSIT`;
- **o backend não mudou**: `GET /deliveries` já devolvia `fulfillmentMode`,
  janelas, endereços, encomenda e repasse ao prestador desde `SCHED-01`.
  Nenhuma rota, DTO ou migration foi criada; acrescentou-se um teste que trava
  esse contrato;
- `pickupCode` continua não chegando ao app do prestador (`PICK-01` intacto);
- tocar num cartão abre o `DeliveryDetailScreen` existente — nenhuma tela de
  coleta/entrega foi recriada; a aba *Ofertas* segue separada;
- **sem botão de cancelar**: a taxa é `COUR-02` e depende de `PAY-01`;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (18 suítes / 153 testes);
- `pnpm smoke` aprovado contra a API viva;
- `flutter analyze`/`flutter test` verdes nos dois apps (motoboy 18) e
  `dart analyze`/`dart test` no core (23).

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md`.

### `SCHED-01` + `B2C-06` (rodada de 2026-08-09)

Executado no banco descartável `aqui_log_sched01` com API em `PORT=3011`:

- 11 migrations, com a nova (`DeliveryScheduling`) revertida e reaplicada **com
  um pedido legado dentro da tabela**, que sobreviveu ao ciclo; todas as colunas
  novas são opcionais (nenhum `NOT NULL`, nenhum `DEFAULT`);
- criação exige `fulfillmentMode`; janela no passado, com menos de 30 min de
  antecedência (`FLOW-DEC-02`), invertida, ou enviada junto do modo imediato são
  recusadas com `400` em HTTP vivo;
- mesma rota, só o modo mudando: imediato R$ 13,80 (km 250) × agendado
  R$ 12,73 (km **180**); o `km_rate` fica congelado no pedido e alterar settings
  não o altera;
- aceite antecipado (`DEC-20`): agendado aceito na criação, com
  `courier_cancel_fee_cents` congelada, **e o prestador continua disponível**;
- `AT_PICKUP` antes do início da janela devolve `409` para o prestador; admin e
  suporte passam;
- capacidade (plano §5.1): com o prestador reservado como único disponível, o
  despacho de um imediato colidente devolve `404`
  ("Nenhum entregador com agenda livre para esta janela"); com dois prestadores,
  a oferta foi para o **outro**, mesmo o reservado sendo o mais próximo;
- pedido legado sem modo continua legível e vale como `IMMEDIATE`;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (17 suítes / 149 testes);
- `pnpm smoke` aprovado 3×, agora com o cenário agendado e 4 casos negativos;
- `flutter analyze`/`flutter test` verdes nos dois apps e `dart analyze`/`dart test`
  no core.

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md`.

### `PICK-01` (rodada de 2026-08-09)

Executado no banco descartável `aqui_log_pick01` com API em `PORT=3011`:

- 10 migrations, com a nova (`DeliveryPickupCode`) revertida e reaplicada **com
  um pedido legado dentro da tabela**, que sobreviveu ao ciclo;
- `AT_PICKUP → PICKED_UP` só passa com **código de 4 dígitos válido e foto do
  prestador**; reapresentar a foto do cliente é recusada com `400`;
- rate limit provado em HTTP vivo: `400` nas 4 primeiras tentativas erradas,
  `429` na 5ª, com bloqueio de 15 min, alerta ao cliente e auditoria
  (`DELIVERY_PICKUP_CODE_FAILED` ×4 + `DELIVERY_PICKUP_CODE_BLOCKED`);
- durante o bloqueio, **nem o código certo passa**;
- fallback só admin/suporte: `403` para o entregador, motivo curto recusado,
  liberação auditada com o motivo escrito;
- o app do entregador **nunca** recebe o valor do código — o smoke reprova se
  receber;
- pedido legado sem código continua avançando só com a foto;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (14 suítes / 96 testes);
- `pnpm smoke` aprovado 3×, agora com as asserções do código de recolhimento;
- `flutter analyze`/`flutter test` verdes nos dois apps e `dart analyze`/`dart test`
  no core.

Documento: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md`.

### `B2C-05` (rodada de 2026-08-08)

Executado no banco descartável `aqui_log_b2c05` com API em `PORT=3011`:

- criação de pedido rejeita, com `400` e mensagem em português, a ausência de
  foto, tipo, tamanho, peso e de cada endereço — 10 casos negativos em HTTP vivo;
- endereço só com espaços deixou de passar (o DTO apara antes de validar);
- pedido legado inserido direto no banco continua legível em lista, detalhe,
  histórico e na visão de admin, e segue fora dos filtros de `B2C-01B`;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (backend 10 suítes / 44 testes);
- `pnpm smoke` aprovado 5×, agora com upload de foto do cliente e assert negativo;
- `flutter analyze`/`flutter test` verdes nos dois apps e `dart analyze`/`dart test`
  no core.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

### `B2C-02` + tema escuro (rodada de 2026-08-08)

Executado no banco descartável `aqui_log_b2c02` com API em `PORT=3011`:

- 9 migrations, com a nova (`DeliveryPricingV2Fields`) revertida e reaplicada;
- preço v2 conferido em 4 cenários de peso/tamanho em HTTP vivo;
- congelamento provado: alterar a taxa base não mexeu em pedido já criado;
- `DEC-19` recusa agendado ≥ imediato (`400`) na escrita de settings;
- 14 campos editáveis no admin, salvos pela UI e auditados;
- contraste AA: **0 reprovações** em 11 telas × 2 temas;
- 70 testes, smoke 3×.

Documento: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-02-E-TEMA-ESCURO.md`.

### `UX-01C` (rodada de 2026-08-08)

QA em Chrome real contra a API viva, com dashboard em `vite --port 5199`:

- varredura de cor computada em 11 telas: **0 verdes de marca**;
- 0 hexadecimais de marca fora de `styles.css`;
- 7 pares de texto reais medidos, todos ≥ 4,5:1 (WCAG AA);
- layout mobile (430px) sem overflow horizontal;
- achado corrigido: `DELIVERED` e `CANCELED` usavam o mesmo cinza.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

### `BASE-04` e `B2C-01B` (rodada anterior)

Executado no banco descartável `aqui_log_base04` com API em `PORT=3011`:

- 8 migrations aplicadas sem `synchronize=true`, incluindo `DeliveryPackageFields`
  e `RemoveCompanyModel`;
- `RemoveCompanyModel` revertida e reaplicada; schema final conferido;
- `/health` com `db: ok` e `redis: ok`;
- smoke B2C ponta a ponta aprovado em 6 execuções, com códigos distintos;
- QA do dashboard no navegador (Chrome real) cobrindo os quatro filtros B2C,
  combinação, estado vazio, paginação e escopo por papel.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

Evidência anterior (mobile, 2026-08-07):
`docs/04-status/entregas/2026-08-07-ENTREGA-MOBILE-B2C.md`.

## 4. Validações ainda não comprovadas

- [x] Subir Postgres/Redis locais com `.env` válido.
- [x] Aplicar `1785100000000-DeliveryPackageFields` em banco de teste.
- [x] Aplicar `1785200000000-RemoveCompanyModel` em banco de teste.
- [x] Executar smoke B2C vivo após as migrations.
- [x] Exercitar rollback de migration aplicável em banco descartável.
- [x] Fazer QA do dashboard no navegador (filtros B2C de `B2C-01B`).
- [x] Rodar `flutter analyze`/`flutter test` após a mudança mobile de `B2C-05`.
- [x] Aplicar e reverter a migration do preço v2 em banco descartável.
- [x] Aplicar e reverter `1785400000000-DeliveryPickupCode` em banco descartável.
- [x] Aplicar e reverter `1785500000000-DeliveryScheduling` em banco descartável.
- [x] Aplicar e reverter `1785600000000-DispatchRounds` em banco descartável.
- [ ] Fazer QA de navegador das seções "Modo agendado" e "Reoferta por aneis" do painel.
- [ ] Gerar APKs atuais.
- [ ] Fazer QA visual dos apps em emulador/dispositivo — pendente **e agora mais
      relevante**, porque `B2C-05` mudou a tela de novo pedido do app cliente.

## 5. Próximo passo

`BASE-04`, `B2C-01B`, `B2C-05`, `UX-01C`, `B2C-02`, `PICK-01`, `B2C-06`,
`SCHED-01`, `COUR-01` e `DISP-01` estão `DONE`. `DISP-02` (avisar o cliente da
demora e oferecer ação explícita, incluindo o aumento com consentimento do
`DEC-03`) ficou `READY`: sua única dependência era `DISP-01`. `COUR-02` continua
esperando só `PAY-01`, o ledger interno, que está `READY`. A fila também tem
`UX-02` (QA visual — a parte mobile exige dispositivo/emulador e inclui o
gráfico de pizza quebrado). Escolher um único ID, conforme o backlog.

Pendência aberta de `DISP-01`: varredura de anel **sem candidato** não vira
linha em lugar nenhum (não cria oferta e não gera evento, para não inundar
`delivery_events` a cada 10 s). Contar essas varreduras exige a telemetria do
`DISP-03`. O raio também é distância **em linha reta**, não rota real.

Pendência aberta de `COUR-01`: a classificação das abas roda no **relógio do
aparelho**. O servidor continua sendo a autoridade (recusa `AT_PICKUP` fora da
janela com `409`), então um relógio adiantado muda o cartão de aba antes da hora
mas não libera a coleta. A lista do prestador também **não pagina**: a aba
*Concluídas* cresce sem limite.

Pendência aberta de `SCHED-01`: a folga de capacidade usa uma **estimativa fixa**
de duração do imediato (45 min, editável no admin), não a rota real; calibrar
depende da telemetria de `DISP-03`.

Pendência aberta de `PICK-01`: o painel admin **não tem tela** para o fallback de
código perdido — hoje ele é chamado por API (`POST /deliveries/:id/pickup-code/override`).
A tela é trabalho de `SUP-*`/`ADMIN-*` e não foi criada aqui.

## 6. Bloqueios externos

- **Distribuição inicial = runtime local no acer via Cloudflare Tunnel**
  (`DEC-26`, 2026-08-10): antes de publicar/distribuir o app, backend + banco +
  pilha rodam neste PC sob domínio próprio (`*.cursar.space`), sem derrubar
  nada que já roda; banco em `~/Documentos/Bando_de_dados/Aqui_Log`. Gate
  `OPS-01A` (só planejado — nada implementado).
- Firebase/Render/Vercel: alvos decididos (`DEC-25`); ligar exige credenciais + `OPS-*` — evolução posterior ao runtime local.
- Verificação de telefone: por **código no app** (`DEC-04`, 2026-08-09); SMS/WhatsApp seguem como opção futura.
- Pagamentos/PIX: `DEC-05` (ledger sem gateway) e `DEC-06` (**Pagar.me v5**) decididas 2026-08-09; falta conta/credenciais Pagar.me e `PAY-01`.
- Cutoffs/taxa de cancelamento do prestador: `FLOW-DEC-01` decidida (R$ 3,00; 5/60 min).
- Código de recolhimento: `DEC-24` + `FLOW-DEC-03` implementados em `PICK-01`
  (2026-08-09). A duração do bloqueio (15 min) é fixa em código e não foi
  exposta no admin.
- Reoferta sem aceite: `DEC-03` implementada **em parte** por `DISP-01`
  (2026-08-09) — a ampliação de raio com limite está de pé; o aumento de preço
  com consentimento explícito continua em `DISP-02` e **não existe** no código.
- Migração banco cloud Firestore: `OPS-DB-01`.
- Modo agendado: `DEC-18`/`DEC-19`/`DEC-20` + `FLOW-DEC-02` implementados em
  `SCHED-01`+`B2C-06` (2026-08-09). Janela mínima de 15 min e horizonte de 30
  dias são constantes de código, não settings.

## 7. Armadilha conhecida do ambiente local

`PUBLIC_API_URL` (servidor) define a URL de upload devolvida pela presign. Se ela
não apontar para a mesma API que o smoke chama (`API_URL`), o upload de prova falha.
Desde 2026-08-08 o `scripts/smoke-test.sh` **aborta** nesse caso em vez de aprovar;
antes disso, ele aprovava silenciosamente. A porta 3000 costuma estar ocupada neste
PC por outro processo — usar uma porta livre e alinhar `PORT` e `PUBLIC_API_URL`.
