# Aqui Log

Esqueleto funcional de uma plataforma de logistica urbana para conectar empresas e entregadores, organizar o despacho e acompanhar a operacao em tempo real.

## O que ja existe

- Dois aplicativos Flutter independentes, preparados para Android e iOS.
- Dashboard administrativo responsivo em React e TypeScript.
- API NestJS modular com autenticacao JWT e seis perfis de acesso.
- Cadastro com aprovacao administrativa de empresas e entregadores.
- Estrutura de entregas, estados operacionais, comprovante e valores em centavos.
- Rastreamento por WebSocket, Swagger e KPIs basicos.
- PostgreSQL e Redis padronizados por Docker Compose.
- Pipeline de CI para backend, dashboard e aplicativos Flutter.

## Estrutura

```text
apps/
  backend/       API NestJS
  dashboard/     Painel React + TypeScript
  company_app/   Aplicativo Flutter da empresa
  courier_app/   Aplicativo Flutter do entregador
packages/
  aqui_log_ui/   Tema e componentes mobile compartilhados
infra/           PostgreSQL e Redis para desenvolvimento
docs/            Arquitetura e contrato inicial da API
```

## Requisitos

- Node.js 22+
- pnpm 10+
- Flutter estavel com Android SDK; macOS com Xcode e necessario para compilar iOS
- Docker com Compose para executar PostgreSQL e Redis

## Primeira execucao

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm install
pnpm db:admin
pnpm dev
```

Dashboard: `http://localhost:5173`

API: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/docs`

Os apps podem ser iniciados em terminais separados:

```bash
cd apps/company_app && flutter run
cd apps/courier_app && flutter run
```

Antes de usar fora do ambiente local, altere `JWT_SECRET` e `ADMIN_PASSWORD`, mantenha `DATABASE_SYNC=false`, adicione migrations e configure armazenamento privado para documentos e comprovantes.

Leia [a arquitetura](docs/ARCHITECTURE.md) e [as rotas iniciais](docs/API.md) para continuar o desenvolvimento.
