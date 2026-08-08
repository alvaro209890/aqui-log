# Template de handoff

O arquivo `docs/04-status/02-HANDOFF.md` deve ser substituído por este formato ao
fim de cada sessão relevante.

```md
# Handoff vigente

- Data/hora:
- Agente:
- Tarefa:
- Branch/commit:
- Escopo autorizado:

## Resultado

- resultado observável

## Alterações

- paths e finalidade

## Evidências executadas

| Verificação | Resultado | Observação |
| --- | --- | --- |
| comando/inspeção | PASS/FAIL/NÃO EXECUTADO | detalhe factual |

## Não feito e bloqueios

- pendência, motivo e autoridade necessária

## Riscos conhecidos

- risco ainda aberto

## Próximo passo recomendado

1. `[ID]` — ação concreta

## Mensagem de retomada

> resumo curto para o próximo agente
```

Não use o handoff como changelog. Histórico encerrado pertence a
`docs/04-status/04-CHANGELOG.md` ou `docs/04-status/entregas/`.
