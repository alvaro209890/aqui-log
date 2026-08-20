# Instruções para agentes de IA — Aqui Log

Este repositório é mantido principalmente por agentes de IA. Trabalhe com escopo
pequeno, evidência verificável e handoff explícito. Comunicação e documentação
devem ser em português do Brasil.

## 1. Leitura obrigatória antes de agir

Leia, nesta ordem:

1. `AGENTS.md`;
2. **`docs/05-execucao-autonoma/00-COMO-USAR.md`** — o protocolo de execução;
3. `docs/README.md` — mapa da documentação;
4. `docs/04-status/01-ESTADO-ATUAL.md`;
5. **`docs/05-execucao-autonoma/01-ONDAS.md`** — de onde sai a tarefa;
6. `docs/02-planejamento/02-BACKLOG.md` (estado dos IDs);
7. `docs/02-planejamento/01-ROADMAP.md`;
8. `docs/02-planejamento/03-DECISOES.md` se houver qualquer gate `DEC-*`;
9. o plano detalhado e as referências ligados à tarefa escolhida.

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

1. Escolha somente uma tarefa com ID e estado `READY`, pela ordem de `docs/05-execucao-autonoma/01-ONDAS.md`. **Você escolhe sozinho** — não espere alguém apontar o ID.
2. Confirme dependências, gates e escopo antes de editar.
3. Mude para `IN_PROGRESS` apenas enquanto a tarefa estiver realmente em curso.
4. Não misture feature, refatoração oportunista, deploy e correções não relacionadas.
5. Não marque `DONE` sem critérios de aceite e evidências executadas.
6. Se faltar decisão, credencial ou autorização: marque `BLOCKED`, **escreva o
   passo do Álvaro em `docs/05-execucao-autonoma/90-RUNBOOK-ALVARO.md`** e
   **siga para a próxima tarefa desbloqueada** — bloqueio não encerra a sessão.
7. Ao encerrar, atualize estado, backlog, handoff e changelog na medida aplicável.

Estados permitidos: `READY`, `BLOCKED`, `IN_PROGRESS`, `DONE` e `CANCELED`.

## 4. Limites permanentes

- Produto B2C: cliente pessoa física → motoboy; não recriar empresa/B2B.
- Perfis: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
- PostgreSQL é a fonte de verdade **local**; Redis auxilia locks, jobs e configurações.
  Alvo de banco **cloud**: Firebase Firestore (`DEC-25`).
- Preço é calculado no servidor; nunca confiar em preço enviado pelo cliente.
- Não remover o fallback de `notes` sem tarefa e evidência específicas.
- Alvos cloud travados: API **Render**, dashboard **Vercel**, banco/Storage/FCM
  **Firebase**. Não provisionar, conectar nem publicar sem credenciais e pacote OPS.
- Não commitar `.env`, tokens, chaves, dados pessoais ou credenciais.
- Não declarar deploy, migration, smoke, APK ou QA visual sem executá-los.
- **Sem agrupamento automático de rotas** (`DEC-07`): lote é sempre manual.
  `TRIP-00/01/02` foram cancelados — não implementar nem preparar terreno.
- **Não compilar iOS** (`DEC-27`): este PC é Linux e o MacBook ainda não chegou.
  O código iOS é escrito; o build espera o Mac.

## 5. Qualidade e evidência

Use o conjunto aplicável à mudança. O portão obrigatório — incluindo o **QA
automatizado de app e de navegador**, que substituiu a validação visual humana —
está em `docs/05-execucao-autonoma/02-PORTAO-DE-VERIFICACAO.md`. O checklist de
sessão continua em `docs/00-governanca/02-CHECKLIST-DE-SESSAO.md`.

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
- **Commit e push direto no `main` estão permanentemente autorizados** desde
  2026-08-19, sem PR — junto com reiniciar as units `aqui-log-*`, rodar migration
  no banco local de produção, subir emulador/Waydroid e gerar APK. A lista
  completa está em `docs/05-execucao-autonoma/00-COMO-USAR.md` §3. Não pergunte
  de novo o que já foi autorizado.
- Use o template de `docs/00-governanca/04-TEMPLATE-DE-HANDOFF.md`.
- O handoff vigente fica em `docs/04-status/02-HANDOFF.md`; não acumule diário nele.

## 7. Ambiente de desenvolvimento (JS/TS)

Alvo primário de dev e teste é a stack JS/TS: API NestJS (`apps/backend`) e
dashboard React/Vite (`apps/dashboard`). Os apps Flutter (`apps/customer_app`,
`apps/courier_app`) exigem toolchain Android/emulador e ficam fora de ambientes
sem esse suporte, como VMs de agente em nuvem. `apps/company_app` é legado B2B e
não recebe trabalho novo (ver limite permanente na seção 4).

Endereços e serviços:

- API: `http://localhost:3001/api/v1`, Swagger em `/docs`, health em `/api/v1/health`;
- dashboard: `http://localhost:5173`;
- Postgres 17 + Redis 7: `docker compose --env-file .env -f infra/docker-compose.yml up -d`;
- `pnpm dev` sobe API e dashboard em paralelo.

Armadilhas verificadas:

- Postgres e Redis são **obrigatórios** para a API subir e para `pnpm smoke` e o
  dashboard funcionarem. O health devolve `checks.db` e `checks.redis`; os dois
  precisam estar `ok`.
- A porta do Postgres no host é **5433**, não 5432 (`DATABASE_PORT` no `.env`).
  Passe sempre `--env-file .env` ao compose para o mapeamento bater.
- Banco novo: `cp .env.example .env` (se faltar), depois `pnpm db:migrate` e
  `pnpm db:admin` (idempotente; cria `admin@aquilog.com.br` com `ADMIN_PASSWORD`).
- Não carregue o `.env` no shell com `. ./.env` — valores como `ADMIN_NAME` têm
  espaços e quebram. A aplicação lê o `.env` via dotenv sozinha.
- O dev server loga toda query do TypeORM e roda jobs de expiração de oferta e
  redespacho a cada ~10s. Log verboso é o normal, não é erro.
- Firebase vem desligado por padrão (`STORAGE_DRIVER=local`); o aviso
  `FIREBASE_ENABLED=true but credentials incomplete` durante os testes é inócuo.
- Em VM de agente sem Docker ativo, suba o daemon antes do compose
  (`sudo dockerd > /tmp/dockerd.log 2>&1 &`). Em host com `fuse-overlayfs`, o
  `containerd-snapshotter` precisa ficar desabilitado em `/etc/docker/daemon.json`.
