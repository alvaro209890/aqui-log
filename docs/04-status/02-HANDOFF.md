# Handoff vigente

- **Data/hora:** 2026-08-08 (~15:40 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefa:** `B2C-05` — foto e campos obrigatórios na criação do pedido
- **Branch/commit inicial:** `main` @ `f987e26`

## Resultado

`B2C-05` está `DONE`, com evidência executada em runtime local.

A criação de pedido passa a exigir foto (≥ 1), tipo, tamanho, peso e os dois
endereços (`DEC-01`, `DEC-18`). A obrigatoriedade vale **só para criação**:
pedido legado sem esses campos continua legível em lista, detalhe, histórico e
na visão de admin, e o fallback de `notes` não foi tocado.

Dois detalhes que mereciam atenção e foram resolvidos:

1. `@IsNotEmpty` aceita `"   "` como preenchido. Sem aparar antes de validar, um
   endereço só de espaços passaria pela nova obrigatoriedade. O DTO agora apara.
2. Quando um campo obrigatório vem ausente, o `class-validator` dispara **todas**
   as constraints dele. Sem mensagens próprias, o cliente recebia ruído em inglês
   do tipo "weightKg must not be greater than 1000" para um peso que nem veio.
   Todas as constraints da criação têm mensagem em português agora.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS (backend + dashboard) |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — backend 10 suítes / **44 testes** (eram 36) |
| `pnpm smoke` (API `:3011`) | PASS — 5 execuções, códigos distintos |
| smoke com expectativa invertida | FALHA esperada — `exit=1`; o assert negativo é vivo |
| Rejeição de criação em HTTP vivo | PASS — 10 casos, todos `400` com mensagem em português |
| Leitura de pedido legado | PASS — lista, detalhe, histórico e visão admin em `200` |
| `flutter analyze` + `flutter test` (customer_app) | PASS — 11 testes (era 10) |
| `flutter analyze` + `flutter test` (courier_app) | PASS — 7 testes |
| `dart analyze` + `dart test` (aqui_log_core) | PASS — 6 testes |
| `pnpm db:migrate` em banco descartável | PASS — 8 migrations |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** |
| QA de navegador do dashboard | **NÃO EXECUTADO** — nenhum arquivo do dashboard mudou |

Documento completo: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

## Ambiente usado

Banco descartável `aqui_log_b2c05` (container `aqui-log-postgres`, porta 5433),
Redis em 6379, API em `PORT=3011` com `PUBLIC_API_URL` alinhado. O `.env` **não**
foi alterado; todos os overrides foram por variável de ambiente. O processo da
API de teste foi encerrado ao fim da sessão.

## Próximo

Escolher **um** ID:

1. `UX-01C` — aplicar os tokens laranja no dashboard, que continua verde (P1); **ou**
2. `PICK-01` — `pickup_code` na coleta (P1). Passou a `READY` nesta rodada:
   dependia de `B2C-05`, agora `DONE`, e `DEC-24` já estava decidida; **ou**
3. `B2C-02` — preço v2 versionado, com os valores finais atrás de `DEC-02`.

Não misturar IDs na mesma sessão.

## Pendências herdadas

- APK atual e QA visual em emulador/dispositivo continuam não executados — e
  ficaram mais relevantes, porque `B2C-05` mudou a tela de novo pedido do app
  cliente. A mudança está provada por teste de widget, não por uso real.
- Achados de UI para `UX-01C`/`UX-02`: busca decorativa na `TopBar` com
  placeholder falando em "empresa" (vocabulário B2B removido) e ação "Assign"
  em inglês.
- Cloud, SMS e pagamentos reais continuam atrás de credenciais e autorização.

## Mensagem de retomada

> `B2C-05` fechado com evidência de runtime: criação de pedido agora exige foto,
> tipo, tamanho, peso e endereços, com 10 casos negativos provados em HTTP vivo e
> pedido legado ainda legível. Backend 44 testes, smoke 5× com upload de foto do
> cliente e assert negativo. `PICK-01` virou `READY`. Próximo: `UX-01C`,
> `PICK-01` ou `B2C-02`.
