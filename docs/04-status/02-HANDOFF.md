# Handoff vigente

- **Data:** 2026-08-07
- **Agente:** Codex
- **Tarefa:** reorganização documental e melhoria do planejamento
- **Branch:** `main`
- **Escopo:** somente documentação, checklists e planejamento; sem desenvolvimento

## Resultado

A documentação foi separada por responsabilidade e ganhou protocolo de trabalho,
fila executável e templates para agentes. O histórico antigo deixou de competir
com o roadmap vigente.

## Alterações principais

- `AGENTS.md`: regras, leitura obrigatória, limites e evidência.
- `docs/README.md`: índice único e hierarquia de fontes.
- `docs/00-governanca/`: fluxo numerado, checklist e templates.
- `docs/02-planejamento/02-BACKLOG.md`: fila por ID, estado, dependência e aceite.
- `docs/02-planejamento/03-DECISOES.md`: estado canônico de gates do dono.
- `docs/04-status/01-ESTADO-ATUAL.md`: fatos observados e validações pendentes.
- `docs/99-arquivo/`: prompts/planos antigos isolados como não executáveis.
- READMEs de backend, dashboard, apps e pacotes: mapa e limites por componente.

## Evidências desta sessão

| Verificação | Resultado | Observação |
| --- | --- | --- |
| Alterações funcionais | NÃO HOUVE | somente Markdown e um path em comentário YAML |
| Testes de aplicação | NÃO EXECUTADOS | código/runtime não foram alterados |
| Links Markdown | PASS | 42 arquivos verificados; 0 links locais quebrados |
| Consistência | PASS | único `READY`/`▶️`; buscas de termos obsoletos limpas |
| `git diff --check` | PASS | nenhuma falha após ajuste final |
| Push | AUTORIZADO | executar em `main` após o commit documental |

## Não feito

- Nenhuma feature, migration, correção, deploy ou alteração de infraestrutura.
- O estado técnico vivo não foi revalidado; resultados técnicos continuam herdados
  da rodada anterior e estão identificados como tal.

## Próximo passo recomendado

1. `BASE-04` — subir o ambiente local, aplicar migrations e executar o smoke B2C.
2. Se `BASE-04` passar, promover e executar `B2C-01B` em sessão separada.
3. Executar `UX-01C` somente em outro pacote, sem misturar regra de negócio e visual.

## Mensagem de retomada

> Leia `AGENTS.md` e a fila em `docs/02-planejamento/02-BACKLOG.md`. Execute apenas
> `BASE-04`; não implemente feature durante a validação do baseline e não ligue cloud.
