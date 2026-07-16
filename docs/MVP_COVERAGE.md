# Cobertura funcional do MVP

Legenda: **funcional** = fluxo exercitado pela API/smoke test ou painel/apps; **fundacao** = contrato/cliente ou interface existe, mas falta completar a experiencia; **planejado** = fora desta entrega.

## Empresa

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, aprovacao e login | Funcional | API, perfis e app Flutter com tela de login |
| Usuarios da empresa | Funcional | Proprietario lista e cria operadores |
| Solicitar e agendar entrega | Funcional | App: tela `new_delivery` + API |
| Rastreamento em tempo real | Funcional no backend | Painel com mapa Leaflet; app empresa sem mapa GPS nativo |
| Historico | Funcional | Eventos cronologicos; detalhe no app |
| Financeiro e relatorios | Funcional basico | Totais API + tela `reports` no app empresa |
| Notificacoes | Funcional na API | Push nativo ainda planejado |
| Avaliacao | Funcional | Uma avaliacao por entrega concluida |
| Configuracoes | Fundacao | Tela `settings` no app; politicas avancadas ainda leves |

## Entregador

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, veiculo e documentos | Funcional | URLs persistidas; upload privado pendente |
| Aprovacao e disponibilidade | Funcional | App com toggle + API |
| Oferta, aceite e recusa | Funcional | Tela `available_deliveries` com mapa UI |
| Navegacao GPS | Fundacao | Mapa ilustrativo no app; abrir app de mapas externo pendente |
| Coleta, entrega e comprovantes | Funcional | Tela `proof` (camera simulada) + maquina de estados |
| Historico | Funcional | Tela `my_deliveries` + detalhe |
| Carteira e extrato | Funcional basico | Tela `wallet` + credito idempotente |
| Avaliacoes, perfil e suporte | Fundacao | Perfil no app; suporte ainda informativo |

## Dashboard e plataforma

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Login, KPIs e entregas | Funcional | 7 metricas com variacao % + tabela |
| Graficos (hora, status, gauge) | Funcional | recharts + endpoints `/dashboard/charts/*` e `/performance` |
| Empresas, entregadores e usuarios | Funcional | Paginas Companies e Couriers no sidebar |
| Entregas com filtros | Funcional | Pagina Deliveries + query params na API |
| Mapa em tempo real | Funcional | Leaflet + WebSocket no painel |
| Financeiro, relatorios e avaliacoes | Funcional basico | Paginas Finance, Reports, Ratings |
| Alertas / notificacoes | Funcional basico | Pagina Alerts + badge no topbar |
| Permissoes | Funcional basico | Seis perfis; permissoes granulares futuras |
| Motor de despacho | Funcional MVP | Proximidade, disponibilidade e exclusao de recusas |
| API publica e integracoes | Planejado | ERP, e-commerce e marketplaces ficam para fase futura |
| IA, BI, calor, roteirizacao e agrupamento | Planejado | Explicitamente fora do MVP estrutural |

## Bloqueios antes de producao

- Upload privado e validacao de documentos/comprovantes (**Firebase Storage** no plano prod).
- Push notification (**Firebase FCM**).
- Provedor de mapas/geocoding definitivo (mapa embutido OSM no Sprint 2).
- Observabilidade, FKs, retencao e rotinas de saneamento do banco.
- Gateway de pagamento, conciliacao, saque e regras fiscais (**fora do escopo atual**).
- MFA administrativo e gestao avancada de sessoes (refresh + reset **ja no Sprint 1**).
- Testes de carga, pentest, LGPD formal, backups e infraestrutura cloud.

## Sprint 1 (2026-07-16) — entregue

- Redis em runtime (health + lock de aceite).
- Expiracao de ofertas + re-despacho e despacho agendado (cron 10s).
- Precificacao server-side (km + base + % plataforma).
- Refresh token, logout, forgot/reset password (token no log local).
- Dashboard: marcar alertas como lidos.
- Timezone `America/Sao_Paulo` no health e env.

## Sprint 2 (2026-07-16) — entregue

- Storage local Firebase-ready (`POST /storage/presign`, `PUT /storage/upload/:key`, `GET /storage/files/:key`)
- Policy de `proofUrl` (host do storage)
- Geo `POST /geo/geocode` (local deterministic + cache Redis; `GEO_PROVIDER=nominatim` opcional)
- Devices `POST /devices` (skeleton FCM)
- Apps: mapa embutido OSM, geocode na nova entrega, camera/upload, GPS periodico, detalhe com historico/avaliacao, refresh token no core

## Sprint 3 (2026-07-16) — entregue

- Paginas Usuarios, Auditoria, Configuracoes (settings em Redis)
- Entregas: despachar / assign / cancelar no painel
- Empresas e entregadores: reject / suspend / reativar
- Relatorios com `from`/`to` via `GET /dashboard/reports`
- Paginacao opcional (`page`/`limit`) em listagens admin

## Sprint 4 (2026-07-16) — estrutura cloud (sem vinculo)

- Blueprint Render + Vercel (sem projetos conectados)
- Scaffold Firebase (rules/examples + Nest stubs; `FIREBASE_ENABLED=false`)
- Documentacao: `docs/DEPLOY_TARGETS.md`, `docs/HANDOFF.md`, `docs/CHANGELOG_SPRINTS.md`
- Runtime local continua Postgres + Redis + storage filesystem
