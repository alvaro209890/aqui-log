# Sessão de implementação — Dashboard completo + apps Flutter + gráficos

**Data:** 2026-07-15 / 2026-07-16  
**Repositório:** https://github.com/alvaro209890/aqui-log.git  
**Branch:** `main`  
**Mensagem de commit:** `feat: dashboard completo + apps Flutter + gráficos + testes`

## Objetivo

Completar o que faltava do MVP operacional: endpoints de tendências/gráficos no backend, painel React com recharts e páginas do sidebar, apps Flutter empresa e entregador com navegação real, gates de qualidade e documentação.

## O que foi entregue

### Backend (NestJS, porta **3001**)

| Endpoint | Descrição |
| --- | --- |
| `GET /dashboard/trends` | 7 métricas com `value`, `previous`, `changePercent` (vs dia anterior) |
| `GET /dashboard/charts/deliveries-by-hour` | Série horária 0–23 |
| `GET /dashboard/charts/deliveries-by-status` | Contagem por status |
| `GET /dashboard/performance` | Score 0–100 + indicadores (prazo, aceite, satisfação) |
| `GET /deliveries?status=&company=&courier=&date=` | Filtros reais na listagem |
| `GET /deliveries/ratings` | Lista de avaliações (página Ratings do painel) |

Agregações puras em `dashboard-metrics.ts` cobertas por testes unitários (sem mock do serviço sob teste). Seed admin (`pnpm db:admin`) agora **atualiza** a senha se o admin já existir.

### Dashboard (React + Vite)

- Dependências: `recharts`, `sonner` (+ `react-router-dom` já presente)
- Header com **7 métricas** e variação % vs ontem
- Gráficos: LineChart (hora), PieChart (status), Gauge de desempenho
- Sidebar completa com rotas; páginas: Deliveries, Companies, Couriers, Finance, Ratings, Reports, Alerts (+ Overview e Map)
- UX: skeletons de loading, toasts Sonner, badge de notificações, layout responsivo mobile

### Flutter — Company (`apps/company_app`)

Telas: login, dashboard, new_delivery, deliveries, delivery_detail, reports, settings — integradas ao `aqui_log_core`.

### Flutter — Courier (`apps/courier_app`)

Telas: login, available_deliveries (mapa UI), my_deliveries, delivery_detail, proof (câmera simulada), wallet, profile.

### Qualidade

- `pnpm build` / `pnpm lint` (zero warnings/errors) / `pnpm test`
- `pnpm smoke` ×2 → “Smoke test aprovado”
- `flutter analyze` + `flutter test` nos dois apps; `dart test` em `aqui_log_core`

## Ambiente local

| Serviço | Porta |
| --- | --- |
| API | 3001 |
| Postgres | 5433 |
| Redis | 6379 |
| Dashboard Vite (dev) | 5173 |

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm db:migrate && pnpm db:admin
pnpm dev:api
pnpm dev:dashboard
```

Credenciais admin (alinhas com smoke e `pnpm db:admin`):

| Campo | Valor |
| --- | --- |
| E-mail | `admin@aquilog.com.br` |
| Senha | `admin123` (`.env` `ADMIN_PASSWORD`) |

`pnpm db:admin` faz upsert da senha a partir do `.env` (não só cria se faltar).  
`GET /dashboard/charts/deliveries-by-hour` usa a **mesma janela de dia local** que `GET /dashboard/trends` (`[startOfLocalDay, nextDay)` em JS), evitando divergência com `CURRENT_DATE` do Postgres (UTC).

## Fora de escopo (mantido)

IA de rotas/ML, heatmap, gateway de pagamento, push nativo, upload privado, App Store signing, locks Redis de despacho.
