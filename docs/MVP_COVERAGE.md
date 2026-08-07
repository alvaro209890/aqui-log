# Cobertura funcional do MVP

Legenda: **funcional** = fluxo exercitado pela API/smoke test ou painel/apps; **fundacao** = contrato/cliente ou interface existe, mas falta completar a experiencia; **planejado** = fora desta entrega.

> **Produto principal desde 2026-08-04:** B2C cliente → motoboy. A seção “Empresa”
> abaixo documenta compatibilidade B2B legada, não a prioridade atual. A fila de
> execução vigente está em `ROADMAP.md`.

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

## B2C-01 + identidade mobile (2026-08-07)

- Migration aditiva com `product_type`, `package_size`, `weight_kg`, `delivery_scope` e `product_photo_urls`.
- API valida catalogos, peso e ate 3 URLs do storage; foto usa finalidade `product`, separada das provas.
- App cliente grava campos proprios e mantem `notes` como observacao livre.
- Core e app motoboy preferem o contrato novo e fazem fallback automatico para pedidos antigos.
- Pacote `aqui_log_ui` e os dois apps adotam marca laranja `#F97316`, preservando cores semanticas de status.
- Validacao local: backend 32 testes; core 6; UI 2; cliente 10; motoboy 7. Build web/backend verde.
- Pendente ao encerrar: migration/smoke em banco real, APK release, QA visual em dispositivo e dashboard B2C/laranja.

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

## B2C — Fase App Cliente (2026-08-04) — marco histórico anterior ao backend B2C

- `apps/company_app` reformulado para **cliente** (label "Aqui Log Cliente", applicationId `br.com.aquilog.aqui_log_cliente`)
- Novo pedido: tipo de encomenda (7 categorias), tamanho P/M/G, peso kg, alcance (mesma cidade / outra cidade ou municipio), foto (image_picker + upload storage), enderecos com geocode, destinatario
- Metadados da encomenda serializados no campo `notes` (`lib/order_meta.dart`) — `notes` exposto no `DeliverySummary` do `aqui_log_core`
- Abas: Inicio · Pedir · Entregas · Perfil; lista/detalhe mostram a encomenda parseada (com foto)
- `flutter analyze` limpo; `flutter test` 9/9 (round-trip OrderMeta incluso)
- APK release gerado; plano B2C e pendentes: `docs/PLANO_B2C.md`

## B2C — Backend funcional (2026-08-04, 2ª rodada) ✅

- `POST /auth/register/customer`: cliente pessoa fisica auto-aprovado, devolve tokens (auto-login)
- Role `CUSTOMER` no enum (`users_role_enum` + migration), entidade/tabela `customers`, `users.customer_id`
- `deliveries.company_id` nullable + `deliveries.customer_id`; `ratings.company_id` nullable + `customer_id`
- **Auto-dispatch no create**: pedido do cliente publicado direto como oferta pros motoboys disponiveis (sem admin); sem motoboy fica REQUESTED e redespacha
- Cliente: lista/cancela/avalia so os proprios pedidos (findAll/ensureCanView/ensureCanTransition/rate por customerId)
- App cliente: cadastro + auto-login ("Criar conta de cliente")
- App motoboy: card da oferta mostra encomenda (tipo/tamanho/peso/alcance/foto) via `OrderMeta`
- `OrderMeta` movido p/ `packages/aqui_log_core` (compartilhado)
- Smoke e2e atualizado p/ auto-dispatch (fallback dispatch manual); validado ao vivo: register → create → OFFERED → accept → ACCEPTED
- Testes: backend 27/27, cliente 10/10, motoboy 7/7; planos futuros: PLANO_TRANSPORTADORA / PLANO_PAGAMENTOS / PLANO_CONFIANCA_E_PRECO
