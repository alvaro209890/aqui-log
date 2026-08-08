# Backend — Aqui Log

API NestJS do produto B2C. PostgreSQL é a fonte de verdade; Redis atende locks,
jobs, cache e configurações. Leia [`AGENTS.md`](../../AGENTS.md) antes de editar.

## Mapa rápido

| Área | Path |
| --- | --- |
| Auth e papéis | `src/auth/`, `src/users/`, `src/couriers/` |
| Entregas, ofertas e jobs | `src/deliveries/` |
| Banco e migrations | `src/database/` |
| Preço | `src/pricing/` |
| Tracking | `src/tracking/` |
| Dashboard/admin | `src/dashboard/`, `src/audit/`, `src/finance/` |
| Storage/geo/push | `src/storage/`, `src/geo/`, `src/devices/`, `src/firebase/` |

## Comandos

Execute da raiz do monorepo:

```bash
pnpm --filter backend start:dev
pnpm --filter backend build
pnpm --filter backend lint:check
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter backend migration:run
pnpm --filter backend migration:revert
```

API local: `http://localhost:3001/api/v1`; health: `/api/v1/health`; Swagger: `/docs`.

## Invariantes

- Não recriar empresa/B2B ou roles `COMPANY_*`.
- Nunca usar `synchronize=true`; schema muda por migration.
- Preço recebido do app não é confiável; o servidor calcula.
- Toda transição passa pela máquina de estados e autorização por papel.
- Migration/rollback só em banco explicitamente identificado; testes destrutivos
  usam banco descartável.
- Firebase permanece desligado até autorização explícita.

Referências: [API](../../docs/03-referencia/02-API.md),
[arquitetura](../../docs/03-referencia/01-ARQUITETURA.md) e
[desenvolvimento](../../docs/03-referencia/03-DESENVOLVIMENTO.md).
