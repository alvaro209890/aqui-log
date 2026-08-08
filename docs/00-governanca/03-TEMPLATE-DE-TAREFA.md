# Template de tarefa para agente

Copie este bloco para planejar uma tarefa antes da implementação.

```md
# [ID] Título curto

- Estado: READY | BLOCKED | IN_PROGRESS | DONE | CANCELED
- Prioridade: P0 | P1 | P2 | P3
- Objetivo: resultado observável em uma frase
- Dependências: IDs ou "nenhuma"
- Gate/autorização: decisão, credencial ou "nenhum"
- Plano de referência: path

## Dentro do escopo

- item objetivo

## Fora do escopo

- item que não será aproveitado nesta sessão

## Invariantes

- regra que não pode quebrar

## Superfícies prováveis

- `path/real`

## Passos

1. passo pequeno e verificável
2. passo pequeno e verificável
3. atualizar documentação/evidência

## Critérios de aceite

- [ ] comportamento observável
- [ ] autorização/isolamento coberto
- [ ] compatibilidade/rollback coberto
- [ ] documentos afetados atualizados

## Evidência obrigatória

| Comando/inspeção | Resultado esperado | Resultado observado | Data/ambiente |
| --- | --- | --- | --- |
| preencher antes | preencher antes | preencher ao executar; nunca presumir | preencher ao executar |

## Riscos e rollback

- risco: mitigação
- rollback: procedimento
```

Uma tarefa não está pronta se usa termos vagos como “melhorar”, “finalizar” ou
“testar tudo” sem um resultado mensurável. Uma tarefa não está concluída enquanto
a coluna “Resultado observado” estiver vazia.
