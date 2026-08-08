# Aqui Log

Plataforma B2C de logística urbana: cliente, motoboy, despacho e operação em tempo real.

> Agentes de IA: comecem por [`AGENTS.md`](AGENTS.md) e pelo
> [índice da documentação](docs/README.md). Não executem planos históricos.

## Documentação principal

| Doc | Conteudo |
| --- | --- |
| [Estado atual](docs/04-status/01-ESTADO-ATUAL.md) | **Fatos observados, evidências e lacunas de validação** |
| [Backlog](docs/02-planejamento/02-BACKLOG.md) | **Única fila executável por agentes** |
| [Roadmap](docs/02-planejamento/01-ROADMAP.md) | Prioridades, dependências, gates e decisões |
| [Handoff vigente](docs/04-status/02-HANDOFF.md) | Continuidade da última sessão |
| [Planos detalhados](docs/02-planejamento/planos/) | Requisitos de B2C, preço, pagamentos, lote, frota, admin e suporte |
| [Fluxo do produto](docs/01-produto/01-FLUXO-DO-PRODUTO.md) | Jornadas, estados e cadeia do dinheiro |
| [Desenvolvimento local](docs/03-referencia/03-DESENVOLVIMENTO.md) | Ambiente, comandos e portas |
| [API](docs/03-referencia/02-API.md) | Endpoints e contratos existentes |
| [Alvos de deploy](docs/03-referencia/04-ALVOS-DE-DEPLOY.md) | Render/Vercel/Firebase, somente scaffold |
| [Changelog](docs/04-status/04-CHANGELOG.md) | Histórico resumido |

## Entregue (piloto local)

- API NestJS (JWT, refresh, pricing, Redis locks, jobs, storage, geo, dashboard APIs)
- Dashboard React (KPIs, mapa, gestao users/audit/settings, acoes operacionais)
- Apps Flutter cliente B2C + entregador (mapa OSM, prova, GPS e identidade laranja compartilhada)
- Encomenda B2C estruturada na API (`productType`, `packageSize`, `weightKg`, `deliveryScope`, `productPhotoUrls`) com fallback para pedidos antigos em `notes`
- Postgres + Redis via Docker Compose, script de smoke e CI. O runtime local atual
  ainda precisa da revalidação `BASE-04` descrita no backlog.

## Alvo cloud (estrutura apenas — nao vinculado)

```text
API          → Render   (infra/render.yaml)
Dashboard    → Vercel   (vercel.json)
Storage/Push → Firebase (infra/firebase + stubs Nest)
```

Nenhum projeto/credencial está conectado. Ver o [estado atual](docs/04-status/01-ESTADO-ATUAL.md).

## Estrutura do monorepo

```text
apps/
  backend/          API NestJS
  dashboard/        Painel React + TypeScript
  customer_app/     Flutter cliente
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

Detalhes em [Desenvolvimento](docs/03-referencia/03-DESENVOLVIMENTO.md).

```bash
test -f .env || cp .env.example .env
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
cd apps/customer_app && flutter analyze && flutter test
cd apps/courier_app && flutter analyze && flutter test
cd packages/aqui_log_core && dart analyze && dart test
```

Antes de deploy real: secrets, `DATABASE_SYNC=false`, migrations, storage Firebase privado.
