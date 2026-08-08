# Fluxo de trabalho dos agentes

Use este fluxo para qualquer sessão de análise, implementação, correção ou deploy.

## Passo 1 — Entender a autorização

1. Resuma o objetivo em uma frase.
2. Liste o que está dentro e fora do escopo.
3. Separe ações locais de ações externas, como push, deploy e serviços cloud.
4. Pare se uma ação externa necessária não estiver autorizada.

## Passo 2 — Verificar o baseline

1. Leia os documentos obrigatórios de `AGENTS.md`.
2. Rode `git status --short --branch`.
3. Confirme branch, alterações preexistentes e paths citados na tarefa.
4. Consulte o código para validar fatos; documentação antiga não substitui o disco.

## Passo 3 — Selecionar uma tarefa

1. Escolha um único item `READY` de `docs/02-planejamento/02-BACKLOG.md`.
2. Confirme dependências e gates no roadmap.
3. Copie o template de tarefa para suas notas de trabalho.
4. Se o item for grande demais para uma sessão verificável, divida-o antes de editar.

## Passo 4 — Planejar a mudança

1. Identifique contratos e invariantes afetados.
2. Liste arquivos prováveis e testes de prova.
3. Defina rollback ou estratégia de compatibilidade.
4. Registre riscos e o que não será alterado.

## Passo 5 — Executar com escopo fechado

1. Faça a menor mudança que satisfaça o aceite.
2. Preserve compatibilidade declarada pelo plano.
3. Não faça melhorias laterais sem criar outra tarefa.
4. Nunca introduza segredo ou dependência cloud escondida.

## Passo 6 — Validar por camadas

1. Rode testes focados durante o trabalho.
2. Rode build, lint e testes da superfície alterada.
3. Rode smoke/integração quando a tarefa tocar fluxo ponta a ponta.
4. Faça QA visual real quando houver UI.
5. Registre também tudo que não pôde ser executado.

## Passo 7 — Atualizar a verdade documental

1. Atualize o estado atual com fatos e evidências.
2. Atualize o backlog e o roadmap somente se o estado mudou.
3. Atualize contrato/referência se a interface mudou.
4. Atualize o changelog com resumo e evidência.
5. Substitua o handoff vigente; não acrescente um diário infinito.

## Passo 8 — Entregar

1. Revise `git diff --check` e `git diff --stat`.
2. Verifique links e referências da documentação alterada.
3. Confirme que não há arquivo fora do escopo.
4. Commit/push somente quando autorizados.
5. Informe resultado, evidência, pendências e próximo ID recomendado.
