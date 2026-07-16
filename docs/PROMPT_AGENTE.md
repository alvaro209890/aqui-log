# Prompt para Agente — Implementar AquiLog

## 🎯 Objetivo
Implementar TODAS as funcionalidades faltantes do AquiLog conforme o mockup do dashboard completo, testar tudo, documentar e commitar no `main`.

## 📁 Caminho do Projeto
```
/home/acer/Documentos/aqui-log
```
Monorepo pnpm workspaces: `apps/backend` (NestJS), `apps/dashboard` (React+Vite), `apps/company_app` (Flutter), `apps/courier_app` (Flutter), `packages/aqui_log_core`, `packages/aqui_log_ui`.

## 📋 O que implementar (por prioridade)

### FASE 1 — Dashboard Completo

1. **Instalar `recharts`** no dashboard: `pnpm --filter dashboard add recharts`

2. **Novos endpoints no backend** (`apps/backend/src/`):
   - `GET /dashboard/trends` — métricas com variação % vs dia anterior (entregas, canceladas, tempo médio, gasto)
   - `GET /dashboard/charts/deliveries-by-hour?date=` — array `{hour, count}` pras últimas 24h
   - `GET /dashboard/charts/deliveries-by-status` — array `{status, count, percentage}`
   - `GET /dashboard/performance` — score 0-100, indicadores (prazo, aceite, satisfação)
   - Adicionar filtros no `GET /deliveries`: `?status=&companyId=&courierId=&dateFrom=&dateTo=`

3. **Componentes de gráfico** (`apps/dashboard/src/charts/`):
   - `DeliveriesByHour.tsx` — LineChart do recharts
   - `DeliveriesByStatus.tsx` — PieChart com labels e %
   - `PerformanceGauge.tsx` — Gauge circular 0-100%

4. **Header de métricas expandido** — substituir os 4 cards atuais por 7 cards com:
   - Entregas hoje (+variação %), Em andamento, Concluídas, Canceladas, Tempo médio, Gasto do dia, Economia gerada

5. **Sidebar completa** com ícones e seções (OPERACAO / GESTAO):
   - Visão geral, Mapa ao vivo, Entregas, Solicitações, Empresas, Entregadores, Relatórios, Financeiro, Avaliações, Alertas, Configurações, Suporte

6. **Páginas novas** (`apps/dashboard/src/pages/`):
   - `DeliveriesPage.tsx` — tabela com filtros, ações (despachar, cancelar)
   - `CompaniesPage.tsx` — CRUD empresas (listar, aprovar, bloquear)
   - `CouriersPage.tsx` — CRUD entregadores (listar, aprovar, ver docs)
   - `FinancePage.tsx` — resumo financeiro + transações
   - `RatingsPage.tsx` — avaliações com estrelas
   - `ReportsPage.tsx` — relatórios com exportação CSV
   - `AlertsPage.tsx` — central de alertas/incidentes

7. **react-router-dom** — já instalado, usar para navegação entre páginas

### FASE 2 — Apps Flutter

**Company App** (`apps/company_app/lib/`):
- `screens/login_screen.dart` — login com API
- `screens/dashboard_screen.dart` — KPIs + botão "Nova entrega"
- `screens/new_delivery_screen.dart` — formulário de entrega (endereços, coordenadas)
- `screens/deliveries_screen.dart` — lista com filtros
- `screens/delivery_detail_screen.dart` — detalhe + status + tracking
- `screens/reports_screen.dart` — relatórios básicos
- `screens/settings_screen.dart` — perfil da empresa

**Courier App** (`apps/courier_app/lib/`):
- `screens/login_screen.dart` — login
- `screens/available_deliveries_screen.dart` — mapa + lista de ofertas
- `screens/my_deliveries_screen.dart` — entregas aceitas
- `screens/delivery_detail_screen.dart` — detalhe + navegação GPS
- `screens/proof_screen.dart` — foto comprovante + upload
- `screens/wallet_screen.dart` — carteira e extrato
- `screens/profile_screen.dart` — perfil + veículo + docs

Usar os pacotes compartilhados: `package:aqui_log_core/aqui_log_core.dart` e `package:aqui_log_ui/aqui_log_ui.dart`.

### FASE 3 — Toques Finais
- Loading skeletons nos cards e tabelas
- Toast notifications com `sonner`
- Responsivo mobile (media queries)
- Badge de notificações não lidas no sininho

## 🧪 Testes
- Rodar `pnpm build` (backend + dashboard) — zero erros
- Rodar `pnpm lint` — zero warnings
- Rodar `pnpm test` — todos passando
- Rodar `pnpm smoke` — "Smoke test aprovado" no final
- Flutter: `flutter analyze` + `flutter test` em cada app
- Testar login: `admin@aquilog.com.br` / `admin123` na porta 3001

## 📝 Documentação
- Atualizar `docs/MVP_COVERAGE.md` marcando features como "Funcional"
- Criar `docs/SESSAO_IMPLEMENTACAO.md` com:
  - Tudo que foi implementado
  - Novos endpoints e seus contratos
  - Novos componentes e páginas
  - Screenshots ou descrição do resultado
  - Comandos para rodar

## 🚀 Deploy
- Commit: `feat: dashboard completo + apps Flutter + gráficos + testes`
- Push direto no `main` do GitHub (`origin` = `https://github.com/alvaro209890/aqui-log.git`)
- NÃO abrir PR, NÃO fazer rebase, push direto

## ⚠️ Importante
- **Porta do backend é 3001** (3000 é do Hermes Bridge)
- Postgres na porta **5433** (não 5432 do Atlas)
- Redis na 6379
- Subir infra: `docker compose --env-file .env -f infra/docker-compose.yml up -d`
- Migrations: `pnpm db:migrate`
- Admin seed: `pnpm db:admin`
- `.env` já configurado com todas as variáveis
- Ler `docs/PLANO_IMPLEMENTACOES.md` para detalhes completos de cada feature
- Ler `docs/DEVELOPMENT.md` para setup do ambiente
- Node >= 22, pnpm >= 10, Flutter >= 3.24
