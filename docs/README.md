# Central de documentação — Aqui Log

Esta pasta separa instruções vigentes, produto, planejamento, referência, estado
observado e histórico. O objetivo é permitir que qualquer agente retome o projeto
sem reconstruir contexto a partir de commits antigos.

## Ordem de leitura para uma nova sessão

1. [`AGENTS.md`](../AGENTS.md) — regras do repositório.
2. [`05-execucao-autonoma/00-COMO-USAR.md`](05-execucao-autonoma/00-COMO-USAR.md) — **o protocolo de execução sem humano**.
3. [`01-ESTADO-ATUAL.md`](04-status/01-ESTADO-ATUAL.md) — o que existe e o que não foi validado.
4. [`05-execucao-autonoma/01-ONDAS.md`](05-execucao-autonoma/01-ONDAS.md) — **de onde sai a próxima tarefa**.
5. [`02-BACKLOG.md`](02-planejamento/02-BACKLOG.md) — estado dos IDs.
6. [`01-ROADMAP.md`](02-planejamento/01-ROADMAP.md) — prioridades, dependências e gates.
7. Plano específico em [`planos/`](02-planejamento/planos/).
8. Referências técnicas necessárias em [`03-referencia/`](03-referencia/).
9. [`05-execucao-autonoma/02-PORTAO-DE-VERIFICACAO.md`](05-execucao-autonoma/02-PORTAO-DE-VERIFICACAO.md) antes de dizer que terminou.

## Mapa das pastas

| Pasta | Responsabilidade | Atualizar quando |
| --- | --- | --- |
| [`00-governanca/`](00-governanca/) | Fluxo dos agentes, checklists e templates | O processo de trabalho mudar |
| [`01-produto/`](01-produto/) | Jornadas e identidade do produto | Uma decisão de experiência mudar |
| [`02-planejamento/`](02-planejamento/) | Roadmap, backlog e planos detalhados | Prioridade, gate ou requisito mudar |

Planos detalhados em [`02-planejamento/planos/`](02-planejamento/planos/), incluindo
o [fluxo cliente↔prestador](02-planejamento/planos/PLANO_FLUXO_CLIENTE_PRESTADOR.md)
e a [hospedagem cloud](02-planejamento/planos/PLANO_HOSPEDAGEM.md) (Render / Vercel / Firebase).
| [`03-referencia/`](03-referencia/) | Arquitetura, API, ambiente e deploy | O sistema observado mudar |
| [`04-status/`](04-status/) | Estado atual, handoff, cobertura e changelog | Toda sessão relevante |
| [`05-execucao-autonoma/`](05-execucao-autonoma/) | Protocolo, ordem das ondas, portão de verificação, runbook do Álvaro e registro de execução | Cada tarefa fechada ou bloqueio novo |
| [`99-arquivo/`](99-arquivo/) | Material histórico não executável | Somente para preservar contexto |

## Fonte de verdade por pergunta

| Pergunta | Documento |
| --- | --- |
| O que o agente deve fazer agora? | [`05-execucao-autonoma/01-ONDAS.md`](05-execucao-autonoma/01-ONDAS.md) (ordem) + [`02-BACKLOG.md`](02-planejamento/02-BACKLOG.md) (estado) |
| Como executar sem parar para perguntar? | [`05-execucao-autonoma/00-COMO-USAR.md`](05-execucao-autonoma/00-COMO-USAR.md) |
| O que fazer quando travar? | [`05-execucao-autonoma/90-RUNBOOK-ALVARO.md`](05-execucao-autonoma/90-RUNBOOK-ALVARO.md) |
| O que o Álvaro precisa fazer para destravar? | mesma página, painel de situação |
| Qual é a ordem geral e o que está bloqueado? | [`01-ROADMAP.md`](02-planejamento/01-ROADMAP.md) |
| Qual decisão do dono ainda falta? | [`03-DECISOES.md`](02-planejamento/03-DECISOES.md) |
| Qual é o requisito completo de uma fase? | [`planos/`](02-planejamento/planos/) |
| O que está comprovadamente funcionando? | [`01-ESTADO-ATUAL.md`](04-status/01-ESTADO-ATUAL.md) |
| O que a última sessão deixou para a próxima? | [`02-HANDOFF.md`](04-status/02-HANDOFF.md) |
| Como rodar o projeto? | [`03-DESENVOLVIMENTO.md`](03-referencia/03-DESENVOLVIMENTO.md) |
| Como o sistema roda no acer (URLs públicas, systemd, reiniciar)? | [`05-RUNTIME-ACER.md`](03-referencia/05-RUNTIME-ACER.md) |
| O que já foi entregue no tempo? | [`04-CHANGELOG.md`](04-status/04-CHANGELOG.md) |

## Regra anti-drift

- Roadmap define direção; backlog transforma direção em tarefas pequenas.
- Plano detalhado não altera prioridade por conta própria.
- Estado atual contém fatos observados, não intenção.
- Handoff contém apenas a última passagem de contexto.
- Arquivo histórico nunca entra na fila de execução.
- `05-execucao-autonoma/` diz **como executar**; roadmap e planos dizem **o que o
  produto é**. Em conflito sobre regra de produto, mandam eles; em conflito sobre
  parar ou seguir, manda o protocolo.
