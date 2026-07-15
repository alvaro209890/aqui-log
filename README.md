# Aqui Log

Base executavel de uma plataforma de logistica urbana para conectar empresas e entregadores, despachar corridas e acompanhar a operacao em tempo real.

## Entregue nesta fase

- Dois aplicativos Flutter independentes para Android e iOS, com design system e cliente de API compartilhados.
- Dashboard React/TypeScript com login real, KPIs e entregas consumidos da API.
- API NestJS com JWT, perfis, aprovacao cadastral, rate limit e cabecalhos de seguranca.
- Solicitacao/agendamento, despacho por proximidade, oferta, aceite/recusa e ciclo protegido de entrega.
- Historico imutavel de estados, comprovantes por URL, avaliacao e notificacoes persistidas.
- Gestao de usuarios da empresa, auditoria e carteira/extrato basicos do entregador.
- WebSocket autenticado para rastreamento e autorizacao por entrega.
- PostgreSQL com migration inicial, Redis, Docker Compose, Swagger e smoke test ponta a ponta.

Consulte a [matriz do MVP](docs/MVP_COVERAGE.md) para diferenciar o que esta funcional, o que tem apenas fundacao e o que permanece planejado.

## Estrutura

```text
apps/
  backend/          API NestJS
  dashboard/        Painel React + TypeScript
  company_app/      Aplicativo Flutter da empresa
  courier_app/      Aplicativo Flutter do entregador
packages/
  aqui_log_core/    Cliente HTTP e contratos mobile
  aqui_log_ui/      Tema e componentes mobile
infra/              PostgreSQL e Redis
scripts/            Validacao integrada do fluxo operacional
docs/               Arquitetura, API, ambiente e cobertura
```

## Primeira execucao

Requisitos e instalacao detalhada estao em [Desenvolvimento](docs/DEVELOPMENT.md). Com as ferramentas prontas:

```bash
cp .env.example .env
pnpm install
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:admin
pnpm dev
```

Dashboard: `http://localhost:5173`

API: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/docs`

## Qualidade

Com o monorepo instalado e, para o smoke, API + Postgres em execucao:

```bash
pnpm build
pnpm lint
pnpm test
pnpm smoke
```

O smoke cria cadastros isolados, aprova empresa/entregador, despacha, aceita, avanca o ciclo de estados, avalia e confere historico, carteira, notificacoes e auditoria. Sucesso imprime `Smoke test aprovado: ...`.

Aplicativos e pacote Dart:

```bash
cd apps/company_app && flutter analyze && flutter test
cd apps/courier_app && flutter analyze && flutter test
cd packages/aqui_log_core && dart analyze && dart test
```

Detalhes de ambiente, porta do Postgres e migrations em [Desenvolvimento](docs/DEVELOPMENT.md). A [matriz do MVP](docs/MVP_COVERAGE.md) separa o que e funcional do que permanece planejado.

## Aplicativos

```bash
cd apps/company_app && flutter run
cd apps/courier_app && flutter run
```

Linux pode desenvolver e testar Android. Para compilar e assinar iOS e obrigatorio usar macOS com Xcode e uma conta Apple Developer.

Antes de qualquer deploy, troque todos os segredos, mantenha `DATABASE_SYNC=false`, use as migrations e configure armazenamento privado real para documentos e comprovantes.
