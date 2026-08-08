# Backlog executável por agentes

> **Atualizado:** 2026-08-07
> **Papel:** converter o roadmap em pacotes pequenos, ordenados e verificáveis.
> **Regra:** um agente executa um único ID por sessão, salvo autorização explícita.

## 1. Fila vigente

| Ordem | ID | Estado | Prioridade | Resultado | Dependências/gates |
| ---: | --- | --- | --- | --- | --- |
| 1 | `BASE-04` | `READY` | P0 | Banco de teste migrado e smoke B2C vivo documentado | Docker/Postgres/Redis locais |
| 2 | `B2C-01B` | `IN_PROGRESS` | P0 | Dashboard filtra e relata encomendas B2C | Fatia 1 (`productType`) entregue; resto pendente. Autorizado pelo Álvaro sem esperar `BASE-04` DONE |
| 3 | `UX-01C` | `BLOCKED` | P1 | Dashboard usa tokens laranja equivalentes | concluir `BASE-04`; não misturar com `B2C-01B` |
| 4 | `UX-02` | `BLOCKED` | P1 | Fluxos principais passam por QA visual/acessibilidade | `UX-01C`, navegador e dispositivo/emulador |
| 5 | `B2C-05` | `BLOCKED` | P0 | Foto + campos obrigatórios na criação | `B2C-01B`; `DEC-01` decidida |
| 6 | `B2C-02` | `BLOCKED` | P1 | Preço v2 versionado com breakdown | `B2C-01B`; `DEC-02` bloqueia valores finais |
| 7 | `B2C-06` | `BLOCKED` | P1 | Dual km imediato/agendado + settings admin | `B2C-02` (ou unificado); `DEC-19`; valores `DEC-02` |
| 8 | `SCHED-01` | `BLOCKED` | P1 | Modo `SCHEDULED` individual + aceite antecipado | `B2C-06`; `DEC-18`, `DEC-20` |
| 9 | `COUR-01` | `BLOCKED` | P1 | App prestador: Em andamento + Agenda | `SCHED-01`; `DEC-21` |
| 10 | `PICK-01` | `BLOCKED` | P1 | Código de recolhimento na coleta | `B2C-05`; `DEC-24` |
| 11 | `B2C-03` | `BLOCKED` | P1 | Avaliação mútua por papel | baseline estável e migração de ratings definida |
| 12 | `DISP-01` | `BLOCKED` | P1 | Reoferta limitada por anéis e recusas | `B2C-02`, `DEC-03` |
| 13 | `PAY-01` | `BLOCKED` | P2 | Ledger interno (cliente + prestador) sem gateway | autorização explícita + `B2C-02`; `DEC-23` |
| 14 | `COUR-02` | `BLOCKED` | P2 | Cancelamento prestador + taxa no saldo | `PAY-01`, `COUR-01`; `DEC-22` |
| 15 | `OPS-01` | `BLOCKED` | P2 | Prontidão operacional local comprovada | `B2C-01B`, `B2C-02B`, `B2C-03A`, `DISP-03` |
| 16 | `OPS-DB-01` | `BLOCKED` | P2 | Modelo + migração Postgres → Firestore | `DEC-25`; credenciais Firebase |
| 17 | `OPS-02` | `BLOCKED` | P2 | Firebase Firestore/Storage/FCM reais | pedido + credenciais; ver `PLANO_HOSPEDAGEM.md` |
| 18 | `OPS-03` | `BLOCKED` | P2 | Deploy Render + Vercel + smoke público | `OPS-01`, `OPS-02`, credenciais |
| 19 | `LOT-01` | `BLOCKED` | P3 | Aceite atômico de lote manual | `B2C-01B`, `B2C-02B`, `B2C-03A`, `DISP-03`, `DEC-10`, `DEC-11` |

Cloud: alvos **decididos** (`DEC-25` — Render / Vercel / Firebase). Ligar projetos
ainda exige credenciais e pacote OPS. SMS, PIX e lote automático idem.

Plano do fluxo novo: `docs/02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md`.

## 2. Tarefa pronta — `BASE-04`

- **Objetivo:** provar o baseline atual em banco de teste real antes de novas features.
- **Dentro do escopo:** usar `.env` existente sem alterá-lo ou, se ele não existir,
  criar um a partir do exemplo sem commitar; subir Postgres/Redis apontando para
  banco explicitamente descartável; aplicar todas as migrations, incluindo
  `DeliveryPackageFields` e `RemoveCompanyModel`; criar admin; executar smoke B2C;
  verificar o fluxo cliente → oferta → aceite → entrega → avaliação.
- **Fora do escopo:** corrigir feature, refatorar código, ligar cloud ou alterar contrato;
  **não** implementar `B2C-05`…`PICK-01` nesta sessão.

### Passos

1. Registrar branch, commit, versões de Node/pnpm/Docker e portas disponíveis.
2. Confirmar que a conexão aponta para banco descartável; nunca apagar ou reutilizar
   banco existente sem identificar o alvo. Não sobrescrever `.env` existente.
3. Subir Postgres/Redis e registrar o nome do banco de teste.
4. Rodar `pnpm db:migrate` e registrar a lista de migrations aplicadas.
5. Em banco descartável, reverter a última migration, reaplicá-la e confirmar o
   schema final; não fazer esse ensaio em dados persistentes.
6. Rodar `pnpm build`, iniciar `pnpm --filter backend start:prod` em processo
   controlado e aguardar `/api/v1/health` confirmar Postgres + Redis saudáveis.
7. Rodar `pnpm db:admin` e `pnpm smoke` duas vezes contra a API real para detectar replay óbvio.
8. Encerrar o processo da API iniciado para o teste.
9. Executar `pnpm lint` e `pnpm test`.
10. Se algo falhar, documentar erro e abrir tarefa separada; não ampliar escopo.
11. Atualizar estado, backlog, handoff e changelog com comando, resultado, data e ambiente.

### Critérios de aceite

- [ ] Nome/host do banco descartável e commit inicial ficam registrados.
- [ ] Todas as migrations sobem sem `synchronize=true`.
- [ ] Última migration reverte e reaplica em banco descartável; schema final é conferido.
- [ ] Tabelas/colunas B2B removidas e dados B2C estruturados presentes.
- [ ] Health confirma API, Postgres e Redis saudáveis.
- [ ] Duas execuções do smoke B2C concluem o fluxo ponta a ponta.
- [ ] Build, lint e testes Node passam.
- [ ] Comandos, saídas observadas, data, ambiente e limitações ficam no handoff/changelog.

## 3. Próxima tarefa — `B2C-01B` (`IN_PROGRESS`)

- **Objetivo:** tornar os campos B2C consultáveis no painel sem mudar o fluxo mobile.
- **Plano:** `docs/02-planejamento/planos/PLANO_B2C.md` e
  `docs/02-planejamento/01-ROADMAP.md`.
- **Nota:** Álvaro autorizou iniciar sem `BASE-04 = DONE` (2026-08-07), em fatias pequenas.

### Progresso

| Fatia | Estado | Evidência |
| --- | --- | --- |
| `productType` (API + predicado + select/coluna dashboard) | ✅ | testes + build |
| `packageSize` | ✅ | testes + build |
| faixa de peso (`weightMin`/`weightMax`) | ✅ | testes + build |
| filtro por cliente | ⏳ | — |
| QA navegador | ⏳ | API local / browser não exercitados nesta fatia |

### Critérios de aceite

- [x] Filtro isolado `productType` (e combo com `status` nos predicados puros)
- [x] Filtro isolado `packageSize` (e combo com `productType`)
- [x] Faixa de peso `weightMin`/`weightMax` (inclusiva; legado sem peso fora)
- [ ] Filtro por cliente
- [x] Paginação continua com os filtros B2C (mesma `findAll` + page/limit)
- [ ] Apenas papéis administrativos autorizados acessam os dados (inalterado; não revalidado em HTTP vivo)
- [x] Pedido legado sem categoria/tamanho/peso não entra nos filtros B2C (documentado + teste)
- [x] Dashboard trata zero resultados / loading / erro (já existente; mantido)
- [ ] QA do navegador com evidência

## 4. Pacotes do fluxo cliente↔prestador (ainda não `READY`)

Detalhe e aceite em
`docs/02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md`.

| ID | Resumo | Não misturar com |
| --- | --- | --- |
| `B2C-05` | Foto e campos obrigatórios na criação | preço dual, ledger |
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
