# Aqui Log

Plataforma de logistica urbana: empresas, entregadores, despacho e operacao em tempo real.

## Documentacao principal

| Doc | Conteudo |
| --- | --- |
| [ROADMAP](docs/ROADMAP.md) | Decisoes e sprints |
| [HANDOFF](docs/HANDOFF.md) | **Continuidade para outro agente** |
| [DEPLOY_TARGETS](docs/DEPLOY_TARGETS.md) | Render / Vercel / Firebase (estrutura) |
| [MVP_COVERAGE](docs/MVP_COVERAGE.md) | O que esta funcional vs planejado |
| [DEVELOPMENT](docs/DEVELOPMENT.md) | Ambiente local |
| [API](docs/API.md) | Endpoints |
| [CHANGELOG_SPRINTS](docs/CHANGELOG_SPRINTS.md) | Historico resumido |

## Entregue (piloto local)

- API NestJS (JWT, refresh, pricing, Redis locks, jobs, storage, geo, dashboard APIs)
- Dashboard React (KPIs, mapa, gestao users/audit/settings, acoes operacionais)
- Apps Flutter empresa + entregador (mapa OSM, prova, GPS)
- Postgres + Redis (Docker Compose), smoke ponta a ponta, CI

## Alvo cloud (estrutura apenas — nao vinculado)

```text
API          → Render   (infra/render.yaml)
Dashboard    → Vercel   (vercel.json)
Storage/Push → Firebase (infra/firebase + stubs Nest)
```

Nenhum projeto/credencial esta conectado. Ver [HANDOFF](docs/HANDOFF.md).

## Estrutura do monorepo

```text
apps/
  backend/          API NestJS
  dashboard/        Painel React + TypeScript
  company_app/      Flutter empresa
  courier_app/      Flutter entregador
packages/
  aqui_log_core/    Cliente HTTP mobile
  aqui_log_ui/      Design system mobile
infra/
  docker-compose.yml
  render.yaml
  firebase/         Scaffold (sem projeto)
scripts/            smoke-test
docs/
```

## Primeira execucao

Detalhes em [Desenvolvimento](docs/DEVELOPMENT.md).

```bash
cp .env.example .env
pnpm install
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:admin
pnpm dev
```

- Dashboard: `http://localhost:5173`
- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/docs`

## Qualidade

```bash
pnpm build
pnpm lint
pnpm test
pnpm smoke
```

Flutter:

```bash
cd apps/company_app && flutter analyze && flutter test
cd apps/courier_app && flutter analyze && flutter test
cd packages/aqui_log_core && dart analyze && dart test
```

Antes de deploy real: secrets, `DATABASE_SYNC=false`, migrations, storage Firebase privado.
