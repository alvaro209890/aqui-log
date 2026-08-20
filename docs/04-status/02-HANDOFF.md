# Handoff vigente

- **Data/hora:** 2026-08-19 (2ª rodada do dia)
- **Agente:** Claude Opus 5
- **Tarefa:** criar a pasta de execução autônoma (mudança documental, sem código)
- **Branch/commit inicial:** `main` @ `7b904fa`
- **Estado:** entregue e pushado. Nenhum arquivo de código tocado.

## Resultado

O Álvaro fechou **as 7 `DEC-*` que faltavam** e autorizou a execução autônoma do
que resta do produto. Foi criada `docs/05-execucao-autonoma/` com 14 documentos
escritos para agentes, não para humanos.

Decisões fechadas (registro canônico em `../02-planejamento/03-DECISOES.md`):

| ID | Decisão |
| --- | --- |
| `DEC-07` | **Sem agrupamento automático de rotas** — lote é sempre manual. `TRIP-00/01/02` cancelados |
| `DEC-09` | Bloco agendado por candidatura livre, filtrada por pontualidade |
| `DEC-12` | Trilha de frota: crua 7 d / agregada 30 d / diária 90 d + job de limpeza |
| `DEC-13` | Estorno pós-coleta automático até R$ 30, só do frete; acima disso, humano |
| `DEC-14` | Ocioso coarsificado (~1 km) na zona operacional, oculto fora; exato só em viagem ativa |
| `DEC-15` | Modelo Uber: sem pagamento de retorno vazio; adicional de longa distância (15 km / +20%) |
| `DEC-16` | Juiz rápido até R$ 25 por caso, acumulado R$ 100/cliente/30 d |
| `DEC-27` | iOS: código agora, compilação quando o MacBook chegar (já pedido) |

## O que mudou no processo

1. O agente **escolhe a própria tarefa** por `05-execucao-autonoma/01-ONDAS.md`.
2. **`BLOCKED` não para a cadeia**: escreve o passo do Álvaro em
   `90-RUNBOOK-ALVARO.md` e segue para a próxima desbloqueada.
3. **QA visual deixou de exigir humano** — `UX-02` foi cancelado como ID e virou a
   onda 1 (`QA-01`/`QA-02`/`QA-03`).
4. Autorizações permanentes no `AGENTS.md`: push no `main`, restart das units
   `aqui-log-*`, migration no banco local, emulador/Waydroid, APK.

## Verificação executada

- 129 links locais conferidos nos arquivos novos e alterados — **0 quebrados**.
- Toolchain de QA confirmado neste PC: AVD `Medium_Phone_API_36.0`, Waydroid,
  Chromium do Playwright em `~/.cache/ms-playwright`, JDK 17 em
  `/usr/lib/jvm/java-17-openjdk-amd64`.
- `pnpm build/lint/test/smoke` e Flutter/Dart: **N/A** — nenhum arquivo de código,
  teste, migration ou configuração de build foi tocado nesta sessão.

## Pendências que ficam para a próxima sessão

- ⚠️ **O aparato de QA ainda não existe.** Ele é o trabalho da onda 1; até
  `QA-03` fechar, vale o portão base.
- Nenhuma tarefa de produto avançou nesta sessão — de propósito.
- O runbook nasceu com **9 itens abertos**; o que mais pesa no produto continua
  sendo o item 1 (conta Pagar.me), porque sem `PAY-02` um cliente novo não
  consegue publicar pedido.

## Próximo ID

**`QA-01`** — `integration_test` nos dois apps e emulador dirigível sem humano.
Plano em `../05-execucao-autonoma/10-ONDA-1-QA-AUTOMATIZADO.md`.
