# Handoff vigente

- **Data/hora:** 2026-08-08 (~00:25 BRT)
- **Agente:** Cursor Grok
- **Tarefa:** `B2C-01B` fatia 4 — filtro por cliente
- **Branch/commit:** `main` @ `123067f`

## Resultado

Filtro `customerId` (UUID) em `GET /deliveries` + input/coluna no dashboard.
Param só aplica a admin/support; CUSTOMER/COURIER ignoram e seguem escopo do token.
`B2C-01B` ainda `IN_PROGRESS` (falta QA browser).

## Evidências

| Verificação | Resultado |
| --- | --- |
| jest backend | PASS 36/36 |
| build/lint backend + dashboard | PASS |
| QA browser / BASE-04 | NÃO EXECUTADO |

## Próximo

1. QA browser de `B2C-01B` (fechar pacote) **ou**
2. `BASE-04`

## Mensagem de retomada

> `B2C-01B`: quatro filtros de código ok. Falta QA browser para DONE.
