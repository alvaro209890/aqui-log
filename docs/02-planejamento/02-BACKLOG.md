# Backlog executável por agentes

> **Atualizado:** 2026-08-08
> **Papel:** converter o roadmap em pacotes pequenos, ordenados e verificáveis.
> **Regra:** um agente executa um único ID por sessão, salvo autorização explícita.

## 1. Fila vigente

| Ordem | ID | Estado | Prioridade | Resultado | Dependências/gates |
| ---: | --- | --- | --- | --- | --- |
| — | `BASE-04` | `DONE` (2026-08-08) | P0 | Banco de teste migrado, rollback ensaiado e smoke B2C vivo documentado | evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md` |
| — | `B2C-01B` | `DONE` (2026-08-08) | P0 | Dashboard filtra e relata encomendas B2C | QA de navegador executado; mesma evidência |
| — | `B2C-05` | `DONE` (2026-08-08) | P0 | Foto + campos obrigatórios na criação | evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md` |
| 1 | `UX-01C` | `READY` | P1 | Dashboard usa tokens laranja equivalentes | `BASE-04` DONE |
| 2 | `UX-02` | `BLOCKED` | P1 | Fluxos principais passam por QA visual/acessibilidade | `UX-01C`, navegador e dispositivo/emulador |
| 3 | `B2C-02` | `READY` | P1 | Preço v2 versionado com breakdown | dep `B2C-01B` DONE; estrutura liberada, **valores finais** atrás de `DEC-02` |
| 4 | `B2C-06` | `BLOCKED` | P1 | Dual km imediato/agendado + settings admin | `B2C-02` (ou unificado); `DEC-19`; valores `DEC-02` |
| 5 | `SCHED-01` | `BLOCKED` | P1 | Modo `SCHEDULED` individual + aceite antecipado | `B2C-06`; `DEC-18`, `DEC-20` |
| 6 | `COUR-01` | `BLOCKED` | P1 | App prestador: Em andamento + Agenda | `SCHED-01`; `DEC-21` |
| 7 | `PICK-01` | `READY` | P1 | Código de recolhimento na coleta | `B2C-05` DONE; `DEC-24` decidida |
| 8 | `B2C-03` | `BLOCKED` | P1 | Avaliação mútua por papel | baseline estável e migração de ratings definida |
| 9 | `DISP-01` | `BLOCKED` | P1 | Reoferta limitada por anéis e recusas | `B2C-02`, `DEC-03` |
| 10 | `PAY-01` | `BLOCKED` | P2 | Ledger interno (cliente + prestador) sem gateway | autorização explícita + `B2C-02`; `DEC-23` |
| 11 | `COUR-02` | `BLOCKED` | P2 | Cancelamento prestador + taxa no saldo | `PAY-01`, `COUR-01`; `DEC-22` |
| 12 | `OPS-01` | `BLOCKED` | P2 | Prontidão operacional local comprovada | `B2C-02B`, `B2C-03A`, `DISP-03` (`B2C-01B` ok) |
| 13 | `OPS-DB-01` | `BLOCKED` | P2 | Modelo + migração Postgres → Firestore | `DEC-25`; credenciais Firebase |
| 14 | `OPS-02` | `BLOCKED` | P2 | Firebase Firestore/Storage/FCM reais | pedido + credenciais; ver `PLANO_HOSPEDAGEM.md` |
| 15 | `OPS-03` | `BLOCKED` | P2 | Deploy Render + Vercel + smoke público | `OPS-01`, `OPS-02`, credenciais |
| 16 | `LOT-01` | `BLOCKED` | P3 | Aceite atômico de lote manual | `B2C-02B`, `B2C-03A`, `DISP-03`, `DEC-10`, `DEC-11` (`B2C-01B` ok) |

Cloud: alvos **decididos** (`DEC-25` — Render / Vercel / Firebase). Ligar projetos
ainda exige credenciais e pacote OPS. SMS, PIX e lote automático idem.

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

## 3. Tarefa pronta — `UX-01C`

- **Objetivo:** aplicar os tokens laranja das diretrizes visuais no dashboard,
  que hoje continua verde (`docs/01-produto/02-DIRETRIZES-VISUAIS.md`).
- **Achados já levantados** para esta tarefa e para `UX-02`: busca decorativa na
  `TopBar` com placeholder falando em "empresa" (vocabulário B2B removido) e
  ação "Assign" em inglês.
- **Fora do escopo:** qualquer regra de negócio; `PICK-01`.

### Alternativas autorizadas

`PICK-01` (código de recolhimento na coleta) passou a `READY` nesta rodada:
`B2C-05` está `DONE` com evidência e `DEC-24` está decidida. `B2C-02` também
segue `READY`, com os valores finais atrás de `DEC-02`. Não misturar IDs na
mesma sessão.

## 4. Pacotes do fluxo cliente↔prestador

Detalhe e aceite em
`docs/02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md`.
`B2C-05` está `DONE`; `PICK-01` passou a `READY`; os demais continuam `BLOCKED`.

| ID | Resumo | Não misturar com |
| --- | --- | --- |
| `B2C-05` | ✅ `DONE` — foto e campos obrigatórios na criação | — |
| `B2C-06` | Km imediato vs agendado + admin | tela agenda, cancelamento |
| `SCHED-01` | Modo agendado individual + aceite antecipado | lote `LOT-02` |
| `COUR-01` | UI Em andamento / Agenda | taxa financeira |
| `PICK-01` | `pickup_code` na coleta | saque/gateway |
| `COUR-02` | Cancelamento prestador + taxa no saldo | exige `PAY-01` |

## 5. Regras para promover uma tarefa

1. Dependências devem estar `DONE` com evidência.
2. Gates de decisão devem estar fechados no roadmap (valores pendentes não
   impedem desenho; impedem calibragem final).
3. Credenciais/serviços necessários devem estar disponíveis e autorizados.
4. O pacote deve caber em uma sessão com critérios verificáveis.
5. Somente então o estado muda de `BLOCKED` para `READY`.
