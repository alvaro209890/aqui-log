# Handoff vigente

- **Data/hora:** 2026-08-08 (~15:20 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `BASE-04` (baseline em runtime local) + fechamento do QA de `B2C-01B`
- **Branch/commit inicial:** `main` @ `b85d69f`

## Resultado

`BASE-04` e `B2C-01B` estão `DONE`, ambos com evidência executada.

O baseline foi provado no banco descartável `aqui_log_base04`: 8 migrations sem
`synchronize=true`, `RemoveCompanyModel` revertida e reaplicada, schema final
conferido (sem `companies`, sem `company_id`, com os seis campos B2C em
`deliveries`), health com Postgres e Redis `ok` e smoke B2C aprovado seis vezes
com códigos distintos.

O QA de navegador do `B2C-01B` foi feito em Chrome real contra a API viva, com massa
de 6 entregas B2C de 2 clientes + 4 entregas legadas sem campos B2C. Os quatro
filtros, a combinação com `status`, o estado vazio, a paginação e o escopo por papel
se comportaram como especificado.

O pacote revelou um defeito real: o `scripts/smoke-test.sh` **aprovava** mesmo com o
upload da prova falhando. Corrigido em commit próprio.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm db:migrate` em banco descartável | PASS — 8 migrations |
| `migration:revert` + `migration:run` da última | PASS — schema final conferido |
| `GET /api/v1/health` | PASS — `db: ok`, `redis: ok` |
| `pnpm smoke` (6 execuções) | PASS — códigos distintos, sem replay |
| smoke com `PUBLIC_API_URL` desalinhado (pós-fix) | FALHA esperada — `exit=1` com mensagem |
| `pnpm build` | PASS (backend + dashboard) |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — backend 10 suítes / 36 testes |
| QA navegador dos filtros B2C | PASS — ver documento de evidência |
| Escopo por papel em HTTP vivo | PASS — `CUSTOMER` ignora `customerId` alheio; 400/401 corretos |
| `flutter analyze` / `flutter test` / `dart test` | N/A — nenhum arquivo Flutter/Dart tocado |
| APK e QA em emulador/dispositivo | NÃO EXECUTADO |

Documento completo: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

## Ambiente usado

Banco descartável `aqui_log_base04` (container `aqui-log-postgres`, porta 5433),
Redis em 6379, API em `PORT=3011` com `PUBLIC_API_URL` alinhado, dashboard em
`vite --port 5199`. O `.env` **não** foi alterado; todos os overrides foram por
variável de ambiente. Os processos de teste (API e Vite) foram encerrados.

## Próximo

Escolher **um** ID:

1. `B2C-05` — foto e campos obrigatórios na criação (P0, `DEC-01` decidida); **ou**
2. `UX-01C` — aplicar os tokens laranja no dashboard, que continua verde (P1).

Não misturar os dois. `B2C-02` também está `READY`, mas os valores finais de preço
seguem atrás de `DEC-02`.

## Pendências herdadas

- APK atual e QA visual em emulador/dispositivo continuam não executados.
- Achados de UI para `UX-01C`/`UX-02`: busca decorativa na `TopBar` com placeholder
  falando em "empresa" (vocabulário B2B removido) e ação "Assign" em inglês.
- Cloud, SMS e pagamentos reais continuam atrás de credenciais e autorização.

## Mensagem de retomada

> `BASE-04` e `B2C-01B` fechados com evidência de runtime local (migrations +
> rollback, smoke vivo 6×, QA de navegador). O smoke ganhou uma correção: ele não
> aprova mais com o upload de prova quebrado. Próximo: `B2C-05` ou `UX-01C`.
