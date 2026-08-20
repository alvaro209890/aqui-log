# Ordem de execução — todas as tarefas até o fim do Aqui Log

> **Fonte única da ordem.** Percorra de cima para baixo e pegue a primeira tarefa
> cujas dependências estão `DONE`. A regra completa está no
> [`00-COMO-USAR.md`](00-COMO-USAR.md) §2.
>
> A ordem **não precisa ser perfeita**: o filtro de dependência corrige sozinho.
> Se uma tarefa aparece cedo mas depende de algo que ainda não fechou, ela é
> pulada e volta a ser candidata quando a dependência fechar.

## Legenda

`READY` pronta para pegar · `BLOCKED` esperando item do
[`90-RUNBOOK-ALVARO.md`](90-RUNBOOK-ALVARO.md) ou outro ID · `DONE` fechada com
evidência. O estado que vale é o do
[`../02-planejamento/02-BACKLOG.md`](../02-planejamento/02-BACKLOG.md) — esta
tabela dá a **ordem**, não o estado.

## Onda 1 — QA automatizado

Constrói o que substitui o olho humano. **Tudo depende dela**: a partir do
`QA-03`, o portão de verificação passa a exigir QA de app e de navegador, e
nenhuma tarefa das ondas seguintes fecha sem isso. Detalhe em
[`10-ONDA-1-QA-AUTOMATIZADO.md`](10-ONDA-1-QA-AUTOMATIZADO.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 1 | `QA-01` | — | `integration_test` nos dois apps + emulador headless dirigível + screenshot como artefato |
| 2 | `QA-02` | — | Playwright no dashboard com login real; as 11 páginas varridas em claro e escuro |
| 3 | `QA-03` | `QA-01`, `QA-02` | `scripts/migration-roundtrip.sh`, `pnpm qa` na raiz, portão atualizado e jobs no CI |

`UX-02` **deixa de existir como tarefa** e é absorvida aqui: em vez de acumular
dívida visual para uma auditoria no fim, cada onda faz o próprio QA no portão.
Ao fechar `QA-03`, marcar `UX-02` como `DONE` no backlog apontando para esta onda.

## Onda 2 — Painel admin

Maior superfície parada e a única grande que **não depende de credencial nenhuma**.
Detalhe em [`11-ONDA-2-PAINEL-ADMIN.md`](11-ONDA-2-PAINEL-ADMIN.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 4 | `ADMIN-01` | `QA-03` | Fundação: motivo obrigatório, `audit_logs` completo, matriz de permissões no backend, confirmação dupla |
| 5 | `ADMIN-02` | `ADMIN-01` | Comandos de domínio + **motivo na recusa de motoboy** (dívida do `ADMIN-02A`) + **tela do fallback de `pickup_code`** (dívida do `PICK-01`) |
| 6 | `ADMIN-07` | `ADMIN-01`, `B2C-03` | Configurações versionadas, templates de notificação, moderação de avaliação |

## Onda 3 — App cliente

Detalhe em [`12-ONDA-3-APP-CLIENTE.md`](12-ONDA-3-APP-CLIENTE.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 7 | `B2C-02B` | `QA-03` | Prévia de preço antes de confirmar, sem confiar em valor vindo do app |
| 8 | `B2C-03` | `QA-03` | Avaliação mútua, uma por papel e por entrega |
| 9 | `B2C-03A` | `B2C-03` | Média, contagem e contexto expostos sem vazar dado sensível |
| 10 | `CLI-01` | `QA-03` | App cliente consome o WebSocket (hoje é polling) — os eventos já existem no gateway |
| 11 | `CLI-02` | `CLI-01` | Cliente escolhe o valor do aumento dentro de um teto, em vez de aceitar só o percentual da settings |

## Onda 4 — App prestador

Detalhe em [`13-ONDA-4-APP-PRESTADOR.md`](13-ONDA-4-APP-PRESTADOR.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 12 | `COUR-03` | `B2C-03` | Prestador avalia o cliente (o outro lado da avaliação mútua) |
| 13 | `COUR-04` | `QA-03` | Paginação da aba *Concluídas*, que hoje cresce sem limite |
| 14 | `COUR-05` | `QA-03` | Abrir navegação no app de mapas do aparelho |
| 15 | `COUR-07` | `QA-03` | Classificação das abas pelo relógio **do servidor**, não do aparelho |
| 16 | `COUR-06` | `PAY-02` | Saque do saldo sacável (`DEC-23`, janela de 24 h da `DEC-17`) |

## Onda 5 — Pagamento

Detalhe em [`14-ONDA-5-PAGAMENTO.md`](14-ONDA-5-PAGAMENTO.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 17 | `PAY-01A` | `QA-03` | Política de cancelamento do **cliente** e liquidação idempotente |
| 18 | `PAY-01B` | `PAY-01A` | Operação administrativa auditada de crédito manual |
| 19 | `ADMIN-03` | `PAY-01B`, `ADMIN-01` | Financeiro no painel: ledger, estorno, gate, conciliação |
| 20 | `PAY-02` | `PAY-01A`, **runbook: conta Pagar.me** | Recarga PIX por Pagar.me v5, webhook assinado, reconciliação |

## Onda 6 — Suporte e reclamações

Usa `DEC-13` (estorno até R$ 30, só do frete) e `DEC-16` (juiz rápido até R$ 25),
ambas decididas. Detalhe em [`15-ONDA-6-SUPORTE.md`](15-ONDA-6-SUPORTE.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 21 | `SUP-01` | `ADMIN-01` | Schema de tickets + dossiê automático + abertura no app + ack < 5 s |
| 22 | `SUP-02` | `SUP-01`, `PAY-01A` | Auto-resolução guiada + juiz rápido + nota de confiança + triagem em 3 níveis |
| 23 | `SUP-03` | `SUP-02`, `B2C-03` | Reclamação do motoboy + reputação por dossiê + flags de fraude |
| 24 | `ADMIN-06` | `SUP-03`, `ADMIN-03` | Fila de suporte no painel: SLA, atribuição, estorno, penalização |
| 25 | `SUP-04` | `ADMIN-06` | Painel de suporte completo: chat, extrato, bloqueio, decisões em lote |
| 26 | `SUP-05` | `SUP-04` | NPS automatizado. SMS/WhatsApp fica `BLOCKED` (provedor é item de runbook) |

## Onda 7 — Lote manual e frota

Usa `DEC-09` (candidatura livre), `DEC-12` (retenção 7/30/90 d), `DEC-14` (ocioso
coarsificado) e `DEC-15` (longa distância no lugar de deadhead). Detalhe em
[`16-ONDA-7-LOTE-E-FROTA.md`](16-ONDA-7-LOTE-E-FROTA.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 27 | `FROTA-01` | `DISP-03` | Heartbeat desacoplado, `courier_positions`, mapa, trilha e `FROTA-ALERTA-01..07` |
| 28 | `LOT-01` | `B2C-02B`, `B2C-03A`, `DISP-03` | Aceite atômico de lote manual, reserva e anti-atraso |
| 29 | `LOT-02` | `LOT-01` | Blocos agendados intermunicipais com candidatura livre e adicional de longa distância |
| 30 | `FROTA-02` | `FROTA-01`, `LOT-01` | Progresso de viagem multi-parada no painel |
| 31 | `ADMIN-04` | `FROTA-02`, `ADMIN-01` | Frota no painel: mapa, ack de alerta, ações forçadas |
| 32 | `ADMIN-05` | `LOT-02`, `ADMIN-01` | Viagens e lotes no painel: reordenar parada, remover, cancelar |

> ⚠️ **`TRIP-00`, `TRIP-01` e `TRIP-02` foram cortados** pela `DEC-07`
> (2026-08-19): não haverá agrupamento automático de rotas. Não reimplementar,
> não "preparar terreno" para eles. Lote é sempre manual.

## Onda 8 — Telemetria, prontidão e cloud

Detalhe em [`17-ONDA-8-OPS-E-CLOUD.md`](17-ONDA-8-OPS-E-CLOUD.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 33 | `DISP-03` | `QA-03` | Telemetria: tempo até aceite, recusa, expiração, anel sem candidato |
| 34 | `OPS-01` | `B2C-02B`, `B2C-03A`, `DISP-03` | FKs, índices, logs, auditoria, retenção, **backup automatizado e restauração testada** |
| 35 | `OPS-02` | **runbook: Firebase** | Firestore, Storage e FCM reais; adapters com fallback local |
| 36 | `OPS-DB-01` | `OPS-02` | Modelo de coleções e migração/dual-write Postgres → Firestore |
| 37 | `OPS-03` | `OPS-01`, `OPS-02`, **runbook: Render + Vercel** | Deploy da API no Render, painel no Vercel, smoke público |

## Onda 9 — iOS

`DEC-27`: código agora, compilação quando o MacBook chegar. Detalhe em
[`18-ONDA-9-IOS.md`](18-ONDA-9-IOS.md).

| Ordem | ID | Depende de | Entrega |
| ---: | --- | --- | --- |
| 38 | `IOS-01` | `QA-03` | Paridade de configuração: permissões, ícones, splash, capabilities, `Info.plist` completo |
| 39 | `IOS-02` | `IOS-01` | Workflow de CI pronto para compilar no dia do Mac, sem editar nada |
| 40 | `IOS-03` | **runbook: MacBook + conta Apple** | Compilar, assinar e subir para TestFlight |

## Visão por superfície

Mesma lista, outra pergunta: "o que falta *nesta* tela?".

| Superfície | Tarefas | Fecha quando |
| --- | --- | --- |
| **Painel admin (web)** | `QA-02`, `ADMIN-01`…`ADMIN-07` | `ADMIN-06` fechar — é a última que depende de tudo |
| **App cliente (Flutter)** | `QA-01`, `B2C-02B`, `B2C-03`, `B2C-03A`, `CLI-01`, `CLI-02`, `SUP-01` (abertura de reclamação), `IOS-01` | `CLI-02` + `SUP-01` |
| **App prestador (Flutter)** | `QA-01`, `COUR-03`…`COUR-07`, `SUP-03` (reclamação do motoboy), `IOS-01` | `COUR-06` (saque) |
| **Backend / plataforma** | `QA-03`, `PAY-01A/01B/02`, `DISP-03`, `LOT-*`, `FROTA-*`, `SUP-*`, `OPS-*` | `OPS-03` |

## Tarefas descobertas no caminho

Achou algo que precisa ser feito e não está acima? **Não implemente agora.**
Acrescente uma linha aqui, com ID novo no padrão da superfície, dependências e
uma frase de entrega — e siga com a tarefa que você já tinha escolhido.

| ID | Descoberto em | Depende de | Entrega |
| --- | --- | --- | --- |
| — | — | — | *(vazio; preencha em vez de desviar do escopo)* |
