# AquiLog — Plano de Próximas Implementações

> Base atual: commit `6ecc189` (mapa Leaflet + tracking WebSocket no dashboard)
> Gerado em: 15/07/2026

---

## 📊 O que já existe

| Camada | Implementado |
|--------|-------------|
| **Backend** | Auth (JWT), Companies, Couriers, Deliveries (máquina de estados completa), Dashboard (KPIs), Finance, Audit, Notifications, Tracking (WebSocket), Users |
| **Dashboard** | Login, KPIs básicos (4 métricas), tabela de entregas recentes, mapa Leaflet com WebSocket |
| **Company App** | Só `main.dart` (casca vazia) |
| **Courier App** | Só `main.dart` (casca vazia) |
| **Pacotes** | `aqui_log_core` (cliente HTTP), `aqui_log_ui` (tema e componentes) |

---

## 🎯 Funcionalidades Faltantes (baseado no mockup)

### 1. DASHBOARD — Header de Métricas Expandido
**Arquivos:** `apps/dashboard/src/App.tsx`

| Métrica | Backend? | Ação |
|---------|----------|------|
| Entregas hoje: 1,248 (+18%) | ✅ `dashboard/summary` | Adicionar variação % |
| Em andamento: 356 (+8%) | ✅ `dashboard/summary` | Adicionar variação % |
| Concluídas: 892 (+16%) | ❌ Falta endpoint | Novo: `GET /dashboard/trends` |
| Canceladas: 23 (-5%) | ❌ Falta endpoint | Novo: `GET /dashboard/trends` |
| Tempo médio: 28min (-7%) | ❌ Falta tracking | Novo: calcular no backend |
| Gasto do dia: R$ 8.452,50 | ✅ `finance` | Já existe |
| Economia gerada: R$ 2.340 | ❌ Planejado | IA de rotas (futuro) |

### 2. DASHBOARD — Gráficos
**Pacote:** `recharts` (já popular com React)

| Gráfico | Backend? | Arquivo novo |
|---------|----------|-------------|
| Entregas por hora (linha) | ❌ | `apps/dashboard/src/charts/DeliveriesByHour.tsx` |
| Entregas por status (pizza) | ❌ | `apps/dashboard/src/charts/DeliveriesByStatus.tsx` |
| Desempenho geral (gauge 94%) | ❌ | `apps/dashboard/src/charts/PerformanceGauge.tsx` |

**Novos endpoints:**
- `GET /dashboard/charts/deliveries-by-hour?date=YYYY-MM-DD`
- `GET /dashboard/charts/deliveries-by-status`
- `GET /dashboard/performance`

### 3. DASHBOARD — Sidebar Completa
**Arquivo:** `apps/dashboard/src/App.tsx` (refatorar sidebar)

| Item | Estado | Ação |
|------|--------|------|
| Visão geral | ✅ | Já existe |
| Mapa ao vivo | ✅ | Já existe (Leaflet) |
| Entregas | ⚠️ Parcial | Criar página dedicada c/ filtros |
| Solicitações | ❌ | Nova página |
| Empresas | ⚠️ Backend ok | Criar página CRUD |
| Entregadores | ⚠️ Backend ok | Criar página CRUD |
| Relatórios | ❌ | Nova página com exportação |
| Financeiro | ⚠️ Backend ok | Criar página |
| Avaliações | ⚠️ Backend ok | Criar página |
| Alertas | ❌ | Nova página + notificações visuais |
| Configurações | ❌ | Políticas, preferências |
| Suporte | ❌ | Chat/FAQ (futuro) |

### 4. DASHBOARD — Páginas Novas

```
apps/dashboard/src/
├── pages/
│   ├── DeliveriesPage.tsx      # Lista + filtros + ações
│   ├── RequestsPage.tsx        # Solicitações de entrega
│   ├── CompaniesPage.tsx       # CRUD empresas
│   ├── CouriersPage.tsx        # CRUD entregadores
│   ├── ReportsPage.tsx         # Relatórios exportáveis
│   ├── FinancePage.tsx         # Financeiro
│   ├── RatingsPage.tsx         # Avaliações
│   └── AlertsPage.tsx          # Central de alertas
├── charts/
│   ├── DeliveriesByHour.tsx    # Gráfico de linha
│   ├── DeliveriesByStatus.tsx  # Gráfico de pizza
│   └── PerformanceGauge.tsx    # Gauge 0-100%
├── components/
│   ├── Sidebar.tsx             # Sidebar refatorada
│   ├── TopBar.tsx              # Barra superior
│   ├── MetricCard.tsx          # Card de métrica c/ variação
│   └── StatusBadge.tsx         # Badge de status colorido
```

### 5. COMPANY APP (Flutter) — Telas
**Base:** `apps/company_app/lib/`

```
lib/
├── main.dart                   # Já existe — expandir navegação
├── screens/
│   ├── login_screen.dart       # Login
│   ├── dashboard_screen.dart   # KPIs + atalhos
│   ├── new_delivery_screen.dart # Criar entrega
│   ├── deliveries_screen.dart  # Lista de entregas
│   ├── delivery_detail_screen.dart # Detalhe + tracking
│   ├── reports_screen.dart     # Relatórios
│   └── settings_screen.dart    # Configurações
├── widgets/
│   ├── delivery_card.dart      # Card de entrega
│   ├── status_chip.dart        # Chip de status
│   └── metric_tile.dart        # Tile de métrica
```

### 6. COURIER APP (Flutter) — Telas
**Base:** `apps/courier_app/lib/`

```
lib/
├── main.dart                   # Já existe — expandir navegação
├── screens/
│   ├── login_screen.dart       # Login
│   ├── available_deliveries_screen.dart # Entregas disponíveis (mapa)
│   ├── my_deliveries_screen.dart # Minhas entregas
│   ├── delivery_detail_screen.dart # Detalhe + navegação GPS
│   ├── proof_screen.dart       # Foto comprovante
│   ├── wallet_screen.dart      # Carteira/extrato
│   └── profile_screen.dart     # Perfil
├── widgets/
│   ├── delivery_card.dart      # Card de entrega
│   ├── offer_banner.dart       # Banner de oferta
│   └── earnings_chart.dart     # Gráfico de ganhos
```

### 7. BACKEND — Novos Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/dashboard/trends` | Métricas com variação % vs dia anterior |
| GET | `/dashboard/charts/deliveries-by-hour` | Entregas por hora |
| GET | `/dashboard/charts/deliveries-by-status` | Agrupado por status |
| GET | `/dashboard/performance` | Score 0-100 com indicadores |
| GET | `/deliveries?status=&company=&courier=&date=` | Filtros avançados |
| GET | `/companies/:id/deliveries` | Entregas da empresa |
| GET | `/couriers/:id/deliveries` | Entregas do entregador |
| GET | `/reports/summary?from=&to=` | Relatório exportável |
| GET | `/ratings` | Lista de avaliações |
| GET | `/alerts` | Central de alertas |

### 8. VISUAIS E UX

| Item | Ação |
|------|------|
| Data/hora no topo | `new Intl.DateTimeFormat` já existe |
| Foto de perfil no header | Adicionar avatar (Gravatar ou inicial) |
| Badges de notificação | Contador de alertas não lidos |
| Tema escuro unificado | CSS variables já no `styles.css` |
| Responsivo mobile | Media queries no CSS |
| Loading skeletons | Componentes de placeholder |
| Toast notifications | `react-hot-toast` ou `sonner` |

---

## 📋 Ordem Sugerida de Implementação

### Fase 1 — Dashboard Completo (prioridade máxima)
1. Instalar `recharts` no dashboard
2. Criar novos endpoints no backend (trends, charts, performance)
3. Criar componentes de gráficos
4. Expandir header de métricas (7 cards com variação %)
5. Refatorar sidebar com ícones e seções
6. Criar páginas: Entregas, Empresas, Entregadores

### Fase 2 — Apps Flutter
1. Implementar navegação e login nos 2 apps
2. Criar telas principais (dashboard, entregas, perfil)
3. Integrar mapa Leaflet/Google Maps nos apps
4. Implementar fluxo de comprovante (câmera + upload)
5. Carteira e extrato do entregador

### Fase 3 — Features Avançadas
1. Relatórios com exportação CSV/PDF
2. Central de alertas e notificações
3. Configurações e políticas
4. Mapa de calor (heatmap)
5. IA de roteirização (futuro)

---

## 🚀 Comandos Rápidos

```bash
# Dashboard com backend
cd /home/acer/Documentos/aqui-log
docker compose --env-file .env -f infra/docker-compose.yml up -d  # Postgres + Redis
pnpm db:migrate
pnpm db:admin            # admin@aquilog.com.br / admin123
pnpm dev:api             # Backend porta 3001
pnpm dev:dashboard       # Frontend porta 5173

# APKs Flutter
cd apps/company_app && flutter build apk --debug
cd apps/courier_app && flutter build apk --debug
```

---

## ⚠️ Atenção

- Porta **3000** é do Hermes WhatsApp Bridge. Backend usa **3001**.
- Postgres do AquiLog roda na porta **5433** (não conflitar com Atlas 5432).
- Redis na **6379** padrão.
- Os apps Flutter estão na pasta `apps/` e compartilham pacotes em `packages/`.
