# Handoff vigente

- **Data/hora:** 2026-08-08 (~16:10 BRT)
- **Agente:** Claude Code (Opus 5)
- **Tarefas:** `B2C-05` (foto e campos obrigatórios) e `UX-01C` (identidade laranja)
- **Branch/commit inicial:** `main` @ `f987e26`

> Duas tarefas na mesma sessão por autorização explícita do Álvaro ("faça o que
> der pra você"). Foram executadas **em sequência**, com commits separados e
> evidência própria — não misturadas.

## Resultado

`B2C-05` e `UX-01C` estão `DONE`, ambas com evidência executada.

**`B2C-05`** — a criação de pedido passa a exigir foto (≥ 1), tipo, tamanho, peso
e os dois endereços (`DEC-01`, `DEC-18`). A obrigatoriedade vale só para criação:
pedido legado continua legível e o fallback de `notes` está intacto.

**`UX-01C`** — o dashboard deixou de ser verde. `styles.css` virou a fonte única
de cor de marca do painel, com camada de tokens; `theme.ts` (novo) leva os tokens
para Recharts e Leaflet exportando **nome** de token, então não sobrou nenhum
hexadecimal de marca fora do tema.

## Duas decisões que valem registro

1. **Dois laranjas, uma marca.** Branco sobre o `#F97316` canônico dá 2,8:1 e
   reprova no WCAG AA. Por isso acentos/ícones/gráficos usam `#F97316` e
   botões/links usam `--color-primary-strong` `#C54B07` (4,8:1 sobre branco).
   A primeira tentativa foi `#C2410C`: passa com folga no contraste, mas na tela
   **lê como vermelho** — foi revertido depois de olhar o screenshot, não o número.
2. **Mensagens de erro.** Um campo obrigatório ausente dispara *todas* as
   constraints dele no `class-validator`. Sem mensagem própria em cada uma, o
   cliente recebia ruído em inglês ("weightKg must not be greater than 1000")
   para um peso que nem foi enviado.

## Evidências

| Verificação | Resultado |
| --- | --- |
| `pnpm build` | PASS (backend + dashboard) |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — backend 10 suítes / **44 testes** (eram 36) |
| `pnpm smoke` (API `:3011`) | PASS — 6 execuções no total |
| smoke com expectativa invertida | FALHA esperada — `exit=1`; o assert negativo é vivo |
| Rejeição de criação em HTTP vivo | PASS — 10 casos, todos `400` em português |
| Leitura de pedido legado | PASS — lista, detalhe, histórico e visão admin em `200` |
| `flutter analyze` + `flutter test` (customer_app) | PASS — 11 testes (era 10) |
| `flutter analyze` + `flutter test` (courier_app) | PASS — 7 testes |
| `dart analyze` + `dart test` (aqui_log_core) | PASS — 6 testes |
| QA de navegador do dashboard (Chrome real) | PASS — 11 telas sem verde de marca |
| Contraste AA (7 pares de texto reais) | PASS — todos ≥ 4,5:1 |
| Layout mobile 430px | PASS — sem overflow horizontal |
| APK e QA em emulador/dispositivo | **NÃO EXECUTADO** |

Documentos: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md` e
`docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

## Achado corrigido no QA

`StatusBadge` violava a regra 1 das diretrizes visuais: `DELIVERED` e `CANCELED`
usavam **o mesmo cinza**, deixando entrega concluída indistinguível de cancelada
na tabela; `IN_TRANSIT` usava o verde que pertence ao sucesso. Corrigido para
verde / vermelho / azul, com a classe `.status.red` que não existia.

## Ambiente usado

Bancos descartáveis `aqui_log_b2c05` e `aqui_log_ux01c` (container
`aqui-log-postgres`, porta 5433), Redis em 6379, API em `PORT=3011` com
`PUBLIC_API_URL` alinhado, dashboard em `vite --port 5199`. O `.env` **não** foi
alterado; todos os overrides foram por variável de ambiente. Processos de teste
encerrados e bancos descartáveis removidos ao fim da sessão.

## Próximo

Escolher **um** ID:

1. `PICK-01` — `pickup_code` na coleta (P1, `DEC-24` decidida). Exige migration,
   backend e app do motoboy; **ou**
2. `UX-02` — QA visual/acessibilidade dos fluxos. A parte do dashboard já saiu em
   `UX-01C`; o que resta depende de dispositivo/emulador; **ou**
3. `B2C-02` — preço v2 versionado, com os valores finais atrás de `DEC-02`.

## Pendências herdadas

- APK atual e QA visual em emulador/dispositivo continuam não executados — e
  ficaram mais relevantes, porque `B2C-05` mudou a tela de novo pedido do app
  cliente. A mudança está provada por teste de widget, não por uso real.
- A busca da `TopBar` continua **decorativa**: nesta rodada só o vocabulário B2B
  ("empresa") foi corrigido. Torná-la funcional é `UX-02`.
- O dashboard não tem runner de teste, então a identidade não tem teste
  automatizado — a garantia é o QA de navegador e a regra "zero hexadecimal fora
  do tema", verificável por `grep`.
- Cloud, SMS e pagamentos reais continuam atrás de credenciais e autorização.

## Mensagem de retomada

> `B2C-05` e `UX-01C` fechados com evidência. Criação de pedido agora exige foto,
> tipo, tamanho, peso e endereços (10 casos negativos em HTTP vivo, legado ainda
> legível). O dashboard deixou de ser verde: tokens em `styles.css`, zero
> hexadecimal fora do tema, 11 telas conferidas em Chrome real e contraste AA
> medido. Bônus do QA: "Entregue" e "Cancelada" não são mais o mesmo cinza.
> Próximo: `PICK-01`, `UX-02` ou `B2C-02`.
