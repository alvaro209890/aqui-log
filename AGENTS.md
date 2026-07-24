# AGENTS.md

## Cursor Cloud specific instructions

Aqui Log is a pnpm + Flutter monorepo (last-mile logistics platform). The JS/TS stack (NestJS API + React dashboard) is the primary dev/test target in Cloud; the Flutter apps under `apps/company_app` and `apps/courier_app` need an emulator/Android toolchain and are out of scope here.

### Services and how to run them
Standard commands live in `README.md` and `docs/DEVELOPMENT.md`; root scripts are in `package.json`. Quick map:
- Backend API (NestJS): `http://localhost:3001/api/v1`, Swagger at `/docs`, health at `/api/v1/health`.
- Dashboard (React/Vite): `http://localhost:5173`.
- Postgres 17 + Redis 7: via `docker compose --env-file .env -f infra/docker-compose.yml up -d`.
- `pnpm dev` runs API + dashboard in parallel; `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke` for quality.

### Non-obvious caveats
- Postgres and Redis are **required** for the API to boot and for `pnpm smoke` / the dashboard to work. Health returns `checks.db` and `checks.redis` — both must be `ok`.
- The update script installs deps only. Each session you must **start Docker and the DB/Redis containers yourself** (they are not in the update script):
  - Start the daemon if not running: `sudo dockerd > /tmp/dockerd.log 2>&1 &` (this VM uses `fuse-overlayfs` + iptables-legacy; `/etc/docker/daemon.json` disables `containerd-snapshotter`, required for Docker 29 + fuse-overlayfs).
  - Then: `docker compose --env-file .env -f infra/docker-compose.yml up -d`.
- The host Postgres port is **5433** (not 5432) per `.env` (`DATABASE_PORT=5433`). Always pass `--env-file .env` to compose so the mapping matches.
- Before first run in a fresh DB: `cp .env.example .env` (if `.env` missing), then `pnpm db:migrate` and `pnpm db:admin` (idempotent; seeds admin `admin@aquilog.com.br` / password from `ADMIN_PASSWORD`, default `TroqueEstaSenha123!`).
- Do NOT source `.env` in bash with `. ./.env` — some values (e.g. `ADMIN_NAME`) contain spaces and break. The app loads `.env` via dotenv automatically.
- The backend dev server logs every TypeORM query and runs offer-expiry/re-dispatch jobs every ~10s, so logs are very verbose — this is normal, not an error.
- Firebase is disabled by default (`STORAGE_DRIVER=local`); a `FIREBASE_ENABLED=true but credentials incomplete` warning during tests is harmless.
