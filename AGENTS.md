# Instruções para agentes de IA — Aqui Log

Este repositório é mantido principalmente por agentes de IA. Trabalhe com escopo
pequeno, evidência verificável e handoff explícito. Comunicação e documentação
devem ser em português do Brasil.

## 1. Leitura obrigatória antes de agir

Leia, nesta ordem:

1. `AGENTS.md`;
2. `docs/README.md`;
3. `docs/04-status/01-ESTADO-ATUAL.md`;
4. `docs/02-planejamento/02-BACKLOG.md`;
5. `docs/02-planejamento/01-ROADMAP.md`;
6. `docs/02-planejamento/03-DECISOES.md` se houver qualquer gate `DEC-*`;
7. o plano detalhado e as referências ligados à tarefa escolhida.

Não use documentos em `docs/99-arquivo/` como instrução vigente.

## 2. Fonte de verdade por dimensão

Não existe precedência global entre intenção e fato. Use a fonte da pergunta:

- fatos observados: código e `docs/04-status/01-ESTADO-ATUAL.md`;
- prioridade, dependências e gates: `docs/02-planejamento/01-ROADMAP.md`;
- próxima tarefa executável: `docs/02-planejamento/02-BACKLOG.md`;
- estado de decisão: `docs/02-planejamento/03-DECISOES.md`;
- requisitos-alvo: plano específico em `docs/02-planejamento/planos/`;
- contratos existentes: `docs/03-referencia/` confirmado contra o código.

Decisão explícita mais recente do Álvaro prevalece e deve ser registrada na fonte
da dimensão correspondente. Se duas fontes da mesma dimensão divergirem, pare,
marque a tarefa como `BLOCKED` e normalize os documentos antes de implementar.
O backlog só escolhe itens permitidos pelo roadmap.

## 3. Regra de execução

1. Escolha somente uma tarefa com ID e estado `READY`.
2. Confirme dependências, gates e escopo antes de editar.
3. Mude para `IN_PROGRESS` apenas enquanto a tarefa estiver realmente em curso.
4. Não misture feature, refatoração oportunista, deploy e correções não relacionadas.
5. Não marque `DONE` sem critérios de aceite e evidências executadas.
6. Se faltar decisão, credencial ou autorização, marque `BLOCKED` e registre o motivo.
7. Ao encerrar, atualize estado, backlog, handoff e changelog na medida aplicável.

Estados permitidos: `READY`, `BLOCKED`, `IN_PROGRESS`, `DONE` e `CANCELED`.

## 4. Limites permanentes

- Produto B2C: cliente pessoa física → motoboy; não recriar empresa/B2B.
- Perfis: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
- PostgreSQL é a fonte de verdade; Redis auxilia locks, jobs e configurações.
- Preço é calculado no servidor; nunca confiar em preço enviado pelo cliente.
- Não remover o fallback de `notes` sem tarefa e evidência específicas.
- Não ligar Firebase, Render, Vercel, SMS ou gateway sem pedido explícito do Álvaro.
- Não commitar `.env`, tokens, chaves, dados pessoais ou credenciais.
- Não declarar deploy, migration, smoke, APK ou QA visual sem executá-los.

## 5. Qualidade e evidência

Use o conjunto aplicável à mudança. O checklist completo está em
`docs/00-governanca/02-CHECKLIST-DE-SESSAO.md`.

```bash
pnpm build
pnpm lint
pnpm test
pnpm smoke
cd apps/customer_app && flutter analyze && flutter test
cd apps/courier_app && flutter analyze && flutter test
cd packages/aqui_log_core && dart analyze && dart test
```

Registre comando, resultado, data e limitações. “Não executado” é uma evidência
válida; “deve passar” não é.

## 6. Git e handoff

- Comece verificando `git status --short --branch` e preserve mudanças alheias.
- Não reescreva histórico, não force push e não descarte trabalho de outro agente.
- Commit e push só quando pedidos ou autorizados no contexto da tarefa.
- Use o template de `docs/00-governanca/04-TEMPLATE-DE-HANDOFF.md`.
- O handoff vigente fica em `docs/04-status/02-HANDOFF.md`; não acumule diário nele.
