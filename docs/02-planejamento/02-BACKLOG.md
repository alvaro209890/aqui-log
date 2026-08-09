# Backlog executável por agentes

> **Atualizado:** 2026-08-09 (2ª rodada)
> **Papel:** converter o roadmap em pacotes pequenos, ordenados e verificáveis.
> **Regra:** um agente executa um único ID por sessão, salvo autorização explícita.

## 1. Fila vigente

| Ordem | ID | Estado | Prioridade | Resultado | Dependências/gates |
| ---: | --- | --- | --- | --- | --- |
| — | `BASE-04` | `DONE` (2026-08-08) | P0 | Banco de teste migrado, rollback ensaiado e smoke B2C vivo documentado | evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md` |
| — | `B2C-01B` | `DONE` (2026-08-08) | P0 | Dashboard filtra e relata encomendas B2C | QA de navegador executado; mesma evidência |
| — | `B2C-05` | `DONE` (2026-08-08) | P0 | Foto + campos obrigatórios na criação | evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md` |
| — | `UX-01C` | `DONE` (2026-08-08) | P1 | Dashboard usa tokens laranja equivalentes | evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md` |
| 1 | `UX-02` | `READY` | P1 | Fluxos principais passam por QA visual/acessibilidade | `UX-01C` DONE; exige dispositivo/emulador para a parte mobile |
| — | `B2C-02` | `DONE` (2026-08-08) | P1 | Preço v2 versionado com breakdown congelado | `DEC-02` decidida; evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-02-E-TEMA-ESCURO.md` |
| — | `B2C-06` | `DONE` (2026-08-09) | P1 | Dual km imediato/agendado + settings admin | evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md` |
| — | `SCHED-01` | `DONE` (2026-08-09) | P1 | Modo `SCHEDULED` individual + aceite antecipado | mesmo esforço e mesma evidência de `B2C-06` |
| — | `COUR-01` | `DONE` (2026-08-09) | P1 | App prestador: Em andamento + Agenda | evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md` |
| — | `PICK-01` | `DONE` (2026-08-09) | P1 | Código de recolhimento + foto do prestador na coleta | evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md` |
| 3 | `B2C-03` | `BLOCKED` | P1 | Avaliação mútua por papel | baseline estável e migração de ratings definida |
| 4 | `DISP-01` | `READY` | P1 | Reoferta limitada por anéis e recusas | `B2C-02` DONE; `DEC-03` decidida (ampliar raio + aumento com consentimento) |
| 5 | `PAY-01` | `READY` | P2 | Ledger interno (cliente + prestador) sem gateway | autorização `DEC-05` ✅; `B2C-02` DONE; `DEC-23` |
| 6 | `COUR-02` | `BLOCKED` | P2 | Cancelamento prestador + taxa no saldo | `COUR-01` ✅ DONE; falta `PAY-01`; `DEC-22` ✅ decidida |
| 7 | `OPS-01` | `BLOCKED` | P2 | Prontidão operacional local comprovada | `B2C-02B`, `B2C-03A`, `DISP-03` (`B2C-01B` ok) |
| 8 | `OPS-DB-01` | `BLOCKED` | P2 | Modelo + migração Postgres → Firestore | `DEC-25`; credenciais Firebase |
| 9 | `OPS-02` | `BLOCKED` | P2 | Firebase Firestore/Storage/FCM reais | pedido + credenciais; ver `PLANO_HOSPEDAGEM.md` |
| 10 | `OPS-03` | `BLOCKED` | P2 | Deploy Render + Vercel + smoke público | `OPS-01`, `OPS-02`, credenciais |
| 11 | `LOT-01` | `BLOCKED` | P3 | Aceite atômico de lote manual | código: `B2C-02B`, `B2C-03A`, `DISP-03`; gates `DEC-08/10/11` ✅ decididas 2026-08-09 |

Cloud: alvos **decididos** (`DEC-25` — Render / Vercel / Firebase). Ligar projetos
ainda exige credenciais e pacote OPS. PIX (Pagar.me) definido; falta conta/credenciais. SMS e lote automático idem.

Plano do fluxo novo: `docs/02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md`.

## 2. Concluídos nesta rodada (2026-08-08)

### `BASE-04` — `DONE`

Baseline provado em runtime local: banco descartável `aqui_log_base04`, 8 migrations
aplicadas sem `synchronize=true`, `RemoveCompanyModel` revertida e reaplicada, health
com Postgres + Redis `ok`, smoke B2C aprovado em 6 execuções com códigos distintos e
`build`/`lint`/`test` verdes.

Achado do pacote: o `scripts/smoke-test.sh` aprovava mesmo com o upload de prova
falhando (a URL vem de `PUBLIC_API_URL` do servidor e o erro era engolido dentro de
`$( )`). Corrigido na mesma sessão, em commit próprio, com o cenário de falha
reproduzido antes e depois.

| Critério | Resultado |
| --- | --- |
| Banco descartável e commit inicial registrados | ✅ `aqui_log_base04` @ `b85d69f` |
| Migrations sobem sem `synchronize=true` | ✅ 8 migrations |
| Última migration reverte e reaplica; schema conferido | ✅ |
| Tabelas/colunas B2B removidas e dados B2C presentes | ✅ sem `companies`, sem `company_id` |
| Health com API, Postgres e Redis saudáveis | ✅ |
| Duas execuções do smoke concluem o fluxo | ✅ 6 execuções |
| Build, lint e testes Node passam | ✅ 36 testes |
| Evidência com comando, saída, data e ambiente | ✅ documento de evidência |

### `B2C-01B` — `DONE`

As quatro fatias de código já estavam prontas; esta rodada fechou o **QA de
navegador** em Chrome real contra a API viva.

| Critério | Resultado |
| --- | --- |
| Filtro isolado `productType` | ✅ código + navegador |
| Filtro isolado `packageSize` | ✅ código + navegador |
| Faixa de peso `weightMin`/`weightMax` (inclusiva) | ✅ 3 de 10 registros; legado sem peso fora |
| Filtro por cliente (`customerId`, UUID, só admin) | ✅ código + navegador |
| Paginação continua com os filtros | ✅ `total 3`, `totalPages 2` com `limit=2` |
| Apenas papéis administrativos aplicam o param | ✅ `CUSTOMER` ignora e segue o próprio escopo; não-UUID → 400; sem token → 401 |
| Legado sem categoria/tamanho/peso fora dos filtros | ✅ |
| Zero resultados / loading / erro | ✅ "Nenhuma entrega com esses filtros." |
| QA do navegador com evidência | ✅ |

Evidência dos dois: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

### `B2C-05` — `DONE`

Criação de pedido passa a exigir foto (≥ 1), tipo, tamanho, peso e os dois
endereços (`DEC-01`, `DEC-18`). Leitura de pedido legado permanece intacta.

| Critério | Resultado |
| --- | --- |
| Pedido novo sem foto rejeitado com erro claro (`400`) | ✅ "Envie ao menos uma foto da encomenda" |
| Pedido novo sem peso, tipo, tamanho ou endereço rejeitado | ✅ 10 casos negativos em HTTP vivo |
| App cliente impede o envio incompleto antes da API | ✅ teste de widget + UI em vermelho |
| Pedido legado continua abrindo em app e dashboard | ✅ linha legada lida em lista, detalhe, histórico e visão admin |
| Testes cobrem rejeição e leitura legada | ✅ backend +8, app cliente +1 |
| `build`/`lint`/`test`/`smoke` + Flutter/Dart executados | ✅ 44 testes backend; smoke 5× |
| APK e QA em emulador/dispositivo | ❌ NÃO EXECUTADO |

Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

### `UX-01C` — `DONE`

Dashboard passa a usar os tokens laranja das diretrizes; o verde/menta de marca
saiu por completo, e as cores semânticas foram preservadas.

| Critério | Resultado |
| --- | --- |
| Identidade verde/menta substituída por laranja | ✅ 0 verdes de marca em 11 telas (varredura de cor computada) |
| Cores semânticas preservadas | ✅ sucesso/alerta/erro/informação intactos |
| Cores de marca literais removidas do código | ✅ 0 hexadecimais fora de `styles.css` |
| Contraste, foco e estados validados | ✅ 7 pares de texto reais ≥ 4,5:1; `:focus-visible` com contorno |
| Revisão visual das telas principais | ✅ login, navegação, filtros, cards, tabelas, mapa e gráficos |
| Build, lint e validação visual real | ✅ Chrome real + mobile 430px sem overflow |

Achado corrigido no caminho: `DELIVERED` e `CANCELED` usavam **o mesmo cinza**,
deixando entrega concluída indistinguível de cancelada na tabela.

Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

### `B2C-02` + `B2C-02A` — `DONE` · tema escuro do painel

`DEC-02` foi decidida pelo Álvaro com **valores provisórios editáveis no admin**,
o que destravou o preço v2. O painel também ganhou tema escuro.

| Critério | Resultado |
| --- | --- |
| Preço com faixas de peso/tamanho e config server-side | ✅ 4 cenários conferidos em HTTP vivo |
| Breakdown e versão persistidos no pedido | ✅ migration aditiva + rollback ensaiado |
| Mudança de settings não altera pedido criado (`DEC-19`) | ✅ base alterada, pedido intacto |
| Imediato > agendado validado na escrita | ✅ 400 nos dois casos inválidos |
| Todo valor editável no admin (incl. multas) | ✅ 14 campos, salvos e auditados |
| Tema escuro derivado por tokens | ✅ 0 reprovações de contraste em 11 telas × 2 temas |
| Build, lint, testes e smoke | ✅ 70 testes; smoke 3× |

Dois defeitos corrigidos no caminho (patch parcial de settings apagava valores;
formulário não submetia por `step` inválido) e **um registrado sem correção**:
o gráfico de pizza não renderiza setores (Recharts 3.9 + React 19), defeito
pré-existente e fora do escopo.

Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-02-E-TEMA-ESCURO.md`.

## 2b. Concluído em 2026-08-09

### `PICK-01` — `DONE`

`AT_PICKUP → PICKED_UP` passa a exigir **código de recolhimento válido** e
**foto do prestador**, distinta da foto do cliente. O código nasce no aceite,
vai para o cliente (e para admin/suporte) e **nunca** para o app do motoboy.

| Critério | Resultado |
| --- | --- |
| Código de 4 dígitos gerado no servidor no aceite | ✅ CSPRNG; 500 amostras no teste |
| Cliente vê o código; prestador vê só a exigência | ✅ provado no smoke (o campo some para o entregador) |
| Coleta sem código ou com código errado é recusada | ✅ `400` em HTTP vivo |
| 5 tentativas erradas → bloqueio temporário + alerta | ✅ `429` na 5ª, notificação ao cliente e auditoria |
| Foto do prestador obrigatória e distinta da do cliente | ✅ `400` ao reapresentar a foto da criação |
| Fallback só admin/suporte, com motivo e auditoria | ✅ `403` para o entregador; motivo curto recusado |
| Pedido legado sem código segue por foto | ✅ `200` sem código, em HTTP vivo |
| Migration aditiva com rollback ensaiado | ✅ 10 migrations; revert + reapply com linha legada preservada |
| `build`/`lint`/`test`/`smoke` + Flutter/Dart | ✅ 96 testes backend; smoke 3× |
| APK e QA em emulador/dispositivo | ❌ NÃO EXECUTADO (segue em `UX-02`) |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-PICK-01.md`.

## 2c. Concluído em 2026-08-09 (2ª rodada)

### `SCHED-01` + `B2C-06` — `DONE`

Um único esforço, como o backlog previa. Todo pedido novo declara
`fulfillment_mode`; o agendado exige janela com 30 min de antecedência
(`FLOW-DEC-02`), custa o km mais barato (`DEC-19`), entra na fila de ofertas na
hora (aceite antecipado, `DEC-20`) e só abre para execução na janela.

| Critério | Resultado |
| --- | --- |
| Cliente escolhe o modo; criação sem modo é rejeitada | ✅ `400` com mensagem em português |
| Janela obrigatória no agendado, com 30 min de antecedência | ✅ 29 min recusado, 30 min aceito; passado recusado |
| Fim > início, janela razoável, entrega opcional | ✅ invertida/curta/longa recusadas; horizonte de 30 dias |
| Janela enviada no modo imediato é recusada | ✅ `400` |
| Cotação e criação usam o km do modo e o congelam | ✅ 250 × **180** na mesma rota; settings alteradas não mexem no pedido |
| `DEC-19` (imediato > agendado) na escrita de settings | ✅ `400` nos dois casos inválidos |
| Aceite antecipado congela preço, repasse e taxa de cancelamento | ✅ `courier_cancel_fee_cents` gravada no aceite |
| Aceite antecipado não tira o prestador do mercado | ✅ `available` permanece `true` |
| `AT_PICKUP` antes da janela é recusado | ✅ `409`; admin/suporte passam |
| Capacidade: agendado reservado bloqueia imediato colidente | ✅ `404` com o reservado sozinho; com dois, foi para o outro |
| Settings novos no admin, versionados e validados | ✅ 4 campos (`minScheduleLeadMinutes` = 30 + 3 provisórios) |
| Pedido legado sem modo continua legível como imediato | ✅ em HTTP vivo; fallback de `notes` intacto |
| Migration aditiva com rollback ensaiado | ✅ 11 migrations; revert + reapply com linha legada |
| `build`/`lint`/`test`/`smoke` + Flutter/Dart | ✅ 149 testes backend; smoke 3× |
| QA de navegador do painel / APK / emulador | ❌ NÃO EXECUTADO (segue em `UX-02`) |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md`.

## 2d. Concluído em 2026-08-09 (3ª rodada)

### `COUR-01` — `DONE`

As corridas do prestador deixaram de morar numa lista só: *Em andamento* mostra
o trabalho de agora e *Agenda* o que ele reservou para depois (`DEC-20`). O
critério é a janela, não o modo — agendado com a janela já aberta é trabalho de
agora. Uma terceira aba (*Concluídas*) preserva o histórico que a lista antiga
mostrava.

| Critério | Resultado |
| --- | --- |
| Agendada aceita com janela futura aparece em *Agenda* | ✅ regra pura + widget + HTTP vivo |
| Agendada cuja janela já abriu aparece em *Em andamento* | ✅ mesmos três níveis |
| Imediata aceita/em execução aparece em *Em andamento* | ✅ `IN_TRANSIT` em HTTP vivo |
| Cartão com código, modo, janelas, endereços, encomenda, repasse e status | ✅ teste de widget |
| Tocar no cartão abre o detalhe/execução **existente** | ✅ nenhuma tela recriada |
| Ofertas (auto-dispatch) seguem separadas das duas seções | ✅ aba própria intocada |
| Sem botão de cancelar funcional (é `COUR-02`) | ✅ ausente da tela, verificado em teste |
| Backend já entrega modo + janelas | ✅ nenhuma rota/DTO/migration nova; contrato travado por teste |
| `build`/`lint`/`test`/`smoke` + Flutter/Dart | ✅ 153 testes backend; motoboy 18; core 23 |
| APK e QA em emulador/dispositivo | ❌ NÃO EXECUTADO (segue em `UX-02`) |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md`.

## 3. Tarefa pronta — `UX-02` ou `DISP-01`

- **`UX-02`** — QA visual e de acessibilidade dos fluxos. O dashboard já saiu em
  `UX-01C` + tema escuro; o que resta exige **dispositivo/emulador**, ainda
  indisponível nesta máquina. Inclui o gráfico de pizza quebrado e a seção
  "Modo agendado" do admin, que não passou por Chrome real.

## 4. Pacotes do fluxo cliente↔prestador

Detalhe e aceite em
`docs/02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md`.
`B2C-05`, `PICK-01`, `B2C-06` e `SCHED-01` estão `DONE`; os demais continuam
`BLOCKED` ou `READY` conforme a fila da seção 1.

| ID | Resumo | Não misturar com |
| --- | --- | --- |
| `B2C-05` | ✅ `DONE` — foto e campos obrigatórios na criação | — |
| `B2C-06` | ✅ `DONE` — km imediato vs agendado + admin | — |
| `SCHED-01` | ✅ `DONE` — modo agendado individual + aceite antecipado | — |
| `COUR-01` | ✅ `DONE` — UI Em andamento / Agenda | — |
| `PICK-01` | ✅ `DONE` — `pickup_code` + foto do prestador na coleta | — |
| `COUR-02` | Cancelamento prestador + taxa no saldo | exige `PAY-01` |

## 5. Regras para promover uma tarefa

1. Dependências devem estar `DONE` com evidência.
2. Gates de decisão devem estar fechados no roadmap (valores pendentes não
   impedem desenho; impedem calibragem final).
3. Credenciais/serviços necessários devem estar disponíveis e autorizados.
4. O pacote deve caber em uma sessão com critérios verificáveis.
5. Somente então o estado muda de `BLOCKED` para `READY`.
