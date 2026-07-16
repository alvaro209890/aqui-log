# Ambiente de desenvolvimento

## Ferramentas

- Node.js 22, pnpm 10 e GitHub CLI.
- Flutter estavel, Java 21, Android Studio/SDK, emulador e licencas Android.
- Docker Engine, Docker Compose, PostgreSQL client, Redis CLI e `jq`.
- `clang`, CMake, Ninja, pkg-config e GTK 3 para o toolchain Flutter Linux.

No Linux Mint 22 / Ubuntu 24.04, os pacotes de sistema podem ser instalados com:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 postgresql-client redis-tools jq clang cmake ninja-build libgtk-3-dev
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker
```

Encerre e abra a sessao depois de entrar no grupo `docker`.

## Inicializacao

```bash
cp .env.example .env
pnpm install
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:admin
pnpm dev
```

Se a porta PostgreSQL `5432` ja estiver ocupada, altere `DATABASE_PORT=5433` no `.env`; o mesmo arquivo deve ser passado ao Compose como no comando acima.

## Comandos de qualidade

```bash
pnpm build
pnpm lint
pnpm test
pnpm smoke                 # exige API e banco em execucao

cd apps/company_app && flutter pub get && flutter analyze && flutter test
cd apps/courier_app && flutter pub get && flutter analyze && flutter test
cd packages/aqui_log_core && dart pub get && dart analyze && dart test
```

### Smoke ponta a ponta

1. Suba Postgres/Redis (`docker compose --env-file .env -f infra/docker-compose.yml up -d`).
2. Aplique `pnpm db:migrate` e `pnpm db:admin`.
3. Inicie a API real (`pnpm --filter backend start` ou `start:prod` apos `pnpm build`).
4. Confirme `GET http://localhost:3001/api/v1/health` com `status: ok` e `checks.db/redis: ok`.
5. Execute `pnpm smoke` (idealmente duas vezes). A saida deve conter `Smoke test aprovado:` e sair com codigo 0.

O script em `scripts/smoke-test.sh` cobre registro, aprovacao, despacho, aceite, ciclo de status, historico, avaliacao, carteira (fee server-side), notificacoes, auditoria e **refresh token**. Redis e usado em runtime para lock de aceite de oferta e jobs de expiracao/re-despacho.

Timezone padrao: `America/Sao_Paulo` (`APP_TIMEZONE`).

Continuidade multi-agente e alvos cloud: [HANDOFF](./HANDOFF.md), [DEPLOY_TARGETS](./DEPLOY_TARGETS.md).

## Banco

- `pnpm db:migrate`: aplica migrations pendentes (inclui `refresh_tokens` e `password_reset_tokens`).
- `pnpm db:admin`: cria o primeiro administrador de forma idempotente.
- `pnpm --filter backend migration:generate src/database/migrations/NomeDaAlteracao`: gera a proxima migration apos alterar entidades.
- `pnpm --filter backend migration:revert`: reverte a ultima migration.

Nunca habilite `DATABASE_SYNC` fora de um experimento descartavel.

## Plataformas Apple

O Flutter gera e versiona os projetos iOS neste monorepo, mas Linux nao possui Xcode. Build, assinatura, simulador iOS, certificados e publicacao na App Store devem ser executados em macOS.
