# Central de documentação — Aqui Log

Esta pasta separa instruções vigentes, produto, planejamento, referência, estado
observado e histórico. O objetivo é permitir que qualquer agente retome o projeto
sem reconstruir contexto a partir de commits antigos.

## Ordem de leitura para uma nova sessão

1. [`AGENTS.md`](../AGENTS.md) — regras do repositório.
2. [`01-ESTADO-ATUAL.md`](04-status/01-ESTADO-ATUAL.md) — o que existe e o que não foi validado.
3. [`02-BACKLOG.md`](02-planejamento/02-BACKLOG.md) — próxima tarefa executável.
4. [`01-ROADMAP.md`](02-planejamento/01-ROADMAP.md) — prioridades, dependências e gates.
5. Plano específico em [`planos/`](02-planejamento/planos/).
6. Referências técnicas necessárias em [`03-referencia/`](03-referencia/).
7. [`02-CHECKLIST-DE-SESSAO.md`](00-governanca/02-CHECKLIST-DE-SESSAO.md) antes de encerrar.

## Mapa das pastas

| Pasta | Responsabilidade | Atualizar quando |
| --- | --- | --- |
| [`00-governanca/`](00-governanca/) | Fluxo dos agentes, checklists e templates | O processo de trabalho mudar |
| [`01-produto/`](01-produto/) | Jornadas e identidade do produto | Uma decisão de experiência mudar |
| [`02-planejamento/`](02-planejamento/) | Roadmap, backlog e planos detalhados | Prioridade, gate ou requisito mudar |
| [`03-referencia/`](03-referencia/) | Arquitetura, API, ambiente e deploy | O sistema observado mudar |
| [`04-status/`](04-status/) | Estado atual, handoff, cobertura e changelog | Toda sessão relevante |
| [`99-arquivo/`](99-arquivo/) | Material histórico não executável | Somente para preservar contexto |

## Fonte de verdade por pergunta

| Pergunta | Documento |
| --- | --- |
| O que o agente deve fazer agora? | [`02-BACKLOG.md`](02-planejamento/02-BACKLOG.md) |
| Qual é a ordem geral e o que está bloqueado? | [`01-ROADMAP.md`](02-planejamento/01-ROADMAP.md) |
| Qual decisão do dono ainda falta? | [`03-DECISOES.md`](02-planejamento/03-DECISOES.md) |
| Qual é o requisito completo de uma fase? | [`planos/`](02-planejamento/planos/) |
| O que está comprovadamente funcionando? | [`01-ESTADO-ATUAL.md`](04-status/01-ESTADO-ATUAL.md) |
| O que a última sessão deixou para a próxima? | [`02-HANDOFF.md`](04-status/02-HANDOFF.md) |
| Como rodar o projeto? | [`03-DESENVOLVIMENTO.md`](03-referencia/03-DESENVOLVIMENTO.md) |
| O que já foi entregue no tempo? | [`04-CHANGELOG.md`](04-status/04-CHANGELOG.md) |

## Regra anti-drift

- Roadmap define direção; backlog transforma direção em tarefas pequenas.
- Plano detalhado não altera prioridade por conta própria.
- Estado atual contém fatos observados, não intenção.
- Handoff contém apenas a última passagem de contexto.
- Arquivo histórico nunca entra na fila de execução.
