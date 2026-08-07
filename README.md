# Aqui Log

Plataforma B2C de logistica urbana: cliente, motoboy, despacho e operacao em tempo real.

## Documentacao principal

| Doc | Conteudo |
| --- | --- |
| [ROADMAP](docs/ROADMAP.md) | **Fila executiva B2C, dependencias, gates e criterios de conclusao** |
| [HANDOFF](docs/HANDOFF.md) | **Continuidade para outro agente** |
| [PLANO_B2C](docs/PLANO_B2C.md) | Estado funcional e visao do produto cliente para motoboy |
| [PLANO_CONFIANCA_E_PRECO](docs/PLANO_CONFIANCA_E_PRECO.md) | Encomenda estruturada, preco v2, confianca e reoferta |
| [PLANO_PAGAMENTOS](docs/PLANO_PAGAMENTOS.md) | Ledger, reserva, estorno e futuro PIX |
| [PLANO_TRANSPORTADORA](docs/PLANO_TRANSPORTADORA.md) | Descoberta antes de rotas multi-pedido |
| [DIRETRIZES_VISUAIS](docs/DIRETRIZES_VISUAIS.md) | Tema laranja inspirado no AquiResolve; mobile implementado, dashboard pendente |
| [ENTREGA MOBILE B2C 2026-08-07](docs/ENTREGA_MOBILE_B2C_2026-08-07.md) | Escopo, contrato, testes, limites e continuidade desta entrega |
| [DEPLOY_TARGETS](docs/DEPLOY_TARGETS.md) | Render / Vercel / Firebase (estrutura) |
| [MVP_COVERAGE](docs/MVP_COVERAGE.md) | O que esta funcional vs planejado |
| [DEVELOPMENT](docs/DEVELOPMENT.md) | Ambiente local |
| [API](docs/API.md) | Endpoints |
| [CHANGELOG_SPRINTS](docs/CHANGELOG_SPRINTS.md) | Historico resumido |

## Entregue (piloto local)

- API NestJS (JWT, refresh, pricing, Redis locks, jobs, storage, geo, dashboard APIs)
- Dashboard React (KPIs, mapa, gestao users/audit/settings, acoes operacionais)
- Apps Flutter cliente B2C + entregador (mapa OSM, prova, GPS e identidade laranja compartilhada)
- Encomenda B2C estruturada na API (`productType`, `packageSize`, `weightKg`, `deliveryScope`, `productPhotoUrls`) com fallback para pedidos antigos em `notes`
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
