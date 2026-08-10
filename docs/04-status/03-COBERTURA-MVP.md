# Cobertura funcional do MVP

Legenda: **funcional** = fluxo exercitado pela API/smoke test ou painel/apps; **fundacao** = contrato/cliente ou interface existe, mas falta completar a experiencia; **planejado** = fora desta entrega.

> **Produto desde 2026-08-04:** B2C cliente → motoboy. **Em 2026-08-07 o modelo
> empresa/B2B foi removido** (código, rotas e colunas). A seção abaixo é registro
> histórico do estado de julho/2026. A fila vigente está em
> `docs/02-planejamento/02-BACKLOG.md`.

## Empresa (removida em 2026-08-07)

O modelo B2B legado — cadastro de empresa (`/auth/register/company`), perfis
`COMPANY_OWNER`/`COMPANY_USER`, página Companies no painel e colunas
`company_id` — foi **removido** na limpeza de 2026-08-07 (migration
`RemoveCompanyModel1785200000000`). Os únicos perfis são: **prestador (motoboy),
cliente e admin**.

| Funcionalidade | Estado | Observacao |
| --- | --- | --- |
| Cadastro, aprovacao e login | Removido | Perfis B2B não existem mais no enum |
| Usuarios da empresa | Removido | `POST /users` (operador) e `GET /users` só admin |
| Solicitar e agendar entrega | B2C | Cliente solicita; agendamento simples existe |
| Rastreamento em tempo real | Funcional no backend | Painel com mapa; app cliente segue via tracking |
| Historico | Funcional | Eventos cronologicos; detalhe no app |
| Financeiro e relatorios | Funcional basico | Totais API + tela `reports` no app |
| Notificacoes | Funcional na API | Push nativo ainda planejado |
| Avaliacao | Funcional | Uma avaliacao por entrega concluida (cliente) |
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
| Entregadores e usuarios | Funcional | Paginas Couriers e Users no sidebar |
| Entregas com filtros | Funcional | Pagina Deliveries + query params na API; filtros B2C com QA de navegador em 2026-08-08 |
| Mapa em tempo real | Funcional | Leaflet + WebSocket no painel |
| Financeiro, relatorios e avaliacoes | Funcional basico | Paginas Finance, Reports, Ratings |
| Alertas / notificacoes | Funcional basico | Pagina Alerts + badge no topbar |
| Permissões | Funcional básico | Cinco roles técnicas; permissões granulares futuras |
| Motor de despacho | Funcional MVP | Proximidade, disponibilidade e exclusao de recusas |
| API publica e integracoes | Planejado | ERP, e-commerce e marketplaces ficam para fase futura |
| IA, BI, calor, roteirizacao e agrupamento | Planejado | Explicitamente fora do MVP estrutural |

## `PICK-01` (2026-08-09) ✅

| Item | Estado | Evidência |
| --- | --- | --- |
| Código de recolhimento de 4 dígitos gerado no aceite | ✅ | HTTP vivo + 500 amostras no teste |
| Cliente vê o código; prestador não | ✅ | asserção no `scripts/smoke-test.sh` |
| Coleta exige código válido **e** foto do prestador | ✅ | `400` sem código, com código errado e com a foto do cliente |
| Bloqueio após 5 erros, com alerta e auditoria | ✅ | `429` na 5ª tentativa; notificação ao cliente |
| Fallback só admin/suporte, com motivo e auditoria | ✅ | `403` para o entregador; motivo curto recusado |
| Pedido legado sem código segue por foto | ✅ | `200` em HTTP vivo |
| Migration aditiva com rollback ensaiado | ✅ | revert + reapply com linha legada preservada |
| QA em emulador/dispositivo | ❌ NÃO EXECUTADO | segue em `UX-02` |
| Tela de suporte no painel para o fallback | ❌ não existe | chamada por API; escopo `SUP-*`/`ADMIN-*` |

## `BASE-04` + `B2C-01B` (2026-08-08) ✅

- Baseline provado em banco descartável (`aqui_log_base04`): 8 migrations sem
  `synchronize=true`, `RemoveCompanyModel` revertida e reaplicada, schema final
  conferido (sem `companies`, sem `company_id`).
- Health com Postgres e Redis `ok`; smoke B2C aprovado 6× com códigos distintos.
- Dashboard: filtros de categoria, tamanho, faixa de peso e cliente exercitados no
  **navegador real**, com paginação, estado vazio e escopo por papel verificados.
- `scripts/smoke-test.sh` corrigido: não aprova mais com upload de prova quebrado —
  evidências de smoke anteriores a esta data não comprovam upload.
- Continua pendente: APK release atual e QA visual em emulador/dispositivo.
- Evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

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
- Entregadores: reject / suspend / reativar
- Relatorios com `from`/`to` via `GET /dashboard/reports`
- Paginacao opcional (`page`/`limit`) em listagens admin

## Sprint 4 (2026-07-16) — estrutura cloud (sem vinculo)

- Blueprint Render + Vercel (sem projetos conectados)
- Scaffold Firebase (rules/examples + Nest stubs; `FIREBASE_ENABLED=false`)
- Documentação original reorganizada em `docs/03-referencia/`, `docs/04-status/`
  e `docs/99-arquivo/` em 2026-08-07.
- Runtime local continua Postgres + Redis + storage filesystem

## B2C — Fase App Cliente (2026-08-04) — marco histórico anterior ao backend B2C

- `apps/customer_app` (antigo `company_app`) reformulado para **cliente** (label "Aqui Log Cliente", applicationId `br.com.aquilog.aqui_log_cliente`)
- Novo pedido: tipo de encomenda (7 categorias), tamanho P/M/G, peso kg, alcance (mesma cidade / outra cidade ou municipio), foto (image_picker + upload storage), enderecos com geocode, destinatario
- Metadados da encomenda serializados no campo `notes` (`lib/order_meta.dart`) — `notes` exposto no `DeliverySummary` do `aqui_log_core`
- Abas: Inicio · Pedir · Entregas · Perfil; lista/detalhe mostram a encomenda parseada (com foto)
- `flutter analyze` limpo; `flutter test` 9/9 (round-trip OrderMeta incluso)
- APK release gerado; registro histórico anterior ao contrato B2C atual.

## B2C — Backend funcional (2026-08-04, 2ª rodada) ✅

- `POST /auth/register/customer`: cliente pessoa fisica auto-aprovado, devolve tokens (auto-login)
- Role `CUSTOMER` no enum (`users_role_enum` + migration), entidade/tabela `customers`, `users.customer_id`
- `deliveries.customer_id` + `ratings.customer_id` (colunas `company_id` do B2B removidas em 2026-08-07)
- **Auto-dispatch no create**: pedido do cliente publicado direto como oferta pros motoboys disponiveis (sem admin); sem motoboy fica REQUESTED e redespacha
- Cliente: lista/cancela/avalia so os proprios pedidos (findAll/ensureCanView/ensureCanTransition/rate por customerId)
- App cliente: cadastro + auto-login ("Criar conta de cliente")
- App motoboy: card da oferta mostra encomenda (tipo/tamanho/peso/alcance/foto) via `OrderMeta`
- `OrderMeta` movido p/ `packages/aqui_log_core` (compartilhado)
- Smoke e2e atualizado p/ auto-dispatch (fallback dispatch manual); validado ao vivo: register → create → OFFERED → accept → ACCEPTED
- Testes: backend 27/27, cliente 10/10, motoboy 7/7; planos futuros: PLANO_LOTE_MULTI_PEDIDO / PLANO_PAGAMENTOS / PLANO_CONFIANCA_E_PRECO

## `SCHED-01` + `B2C-06` — modo agendado individual (2026-08-09) ✅

Registro append-only. Nada acima foi alterado.

| Funcionalidade | Estado | Observação |
| --- | --- | --- |
| Escolha do modo pelo cliente (`IMMEDIATE`/`SCHEDULED`) | Funcional | Obrigatório na criação (`DEC-18`); sem modo → `400` |
| Janela de coleta com antecedência mínima | Funcional | 30 min (`FLOW-DEC-02`); passado, invertida, curta, longa e horizonte de 30 dias recusados em HTTP vivo |
| Janela de entrega | Funcional (opcional) | Se enviada, exige as duas pontas e não pode preceder a coleta |
| Tarifa por modo aplicada e congelada | Funcional | 250 imediato × 180 agendado; `km_rate_cents` + `pricing_breakdown` no pedido |
| Aceite antecipado do agendado | Funcional | `DEC-20`; congela repasse e `courier_cancel_fee_cents`; prestador segue disponível |
| Reserva de agenda do prestador | Funcional | Plano §5.1; folga e duração estimada editáveis no admin |
| Execução só abre na janela | Funcional | `AT_PICKUP` antes do início → `409`; admin/suporte passam |
| Settings de agendamento no admin | Funcional | 4 campos versionados e validados |
| Filtro e coluna de modo no painel | Funcional | `GET /deliveries?fulfillmentMode=…`; valor inválido → `400` |
| Pedido legado sem modo | Funcional | Legível como `IMMEDIATE`; fallback de `notes` intacto |
| Abas Em andamento / Agenda no app do prestador | Planejado | `COUR-01` |
| Cancelamento do prestador com débito da taxa | Planejado | `COUR-02`, depende de `PAY-01` |
| QA de navegador da tela nova / APK / emulador | Não executado | Segue em `UX-02` |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-SCHED-01-B2C-06.md`.

## `COUR-01` — agenda do prestador (2026-08-09) ✅

Registro append-only. Nada acima foi alterado.

| Funcionalidade | Estado | Observação |
| --- | --- | --- |
| Aba *Em andamento* no app do prestador | Funcional | Imediata aceita/em execução (`ACCEPTED`, `AT_PICKUP`, `PICKED_UP`, `IN_TRANSIT`) e agendada cuja janela já abriu |
| Aba *Agenda* no app do prestador | Funcional | `SCHEDULED` aceita com início de janela no futuro, incluindo o aceite antecipado (`DEC-20`); ordenada pelo próximo compromisso |
| Aba *Concluídas* | Funcional | `DELIVERED`/`CANCELED`; preserva o histórico que a lista única mostrava |
| Regra de separação compartilhada e testável | Funcional | `courier_board.dart` no `aqui_log_core`, com o "agora" injetável; 9 testes |
| Cartão com código, modo, janelas, endereços, encomenda e repasse | Funcional | Plano §5.2; foto e peso vindos do `OrderMeta` |
| Toque no cartão abre o detalhe/execução existente | Funcional | `DeliveryDetailScreen`; nenhuma tela recriada |
| Ofertas (auto-dispatch) separadas das duas seções | Funcional | Aba *Ofertas* intocada; oferta ainda não é corrida do prestador |
| Contrato da listagem do prestador | Funcional | `GET /deliveries` já entregava modo + janelas (`SCHED-01`); travado por teste, sem mudança de servidor |
| Botão de cancelar corrida | Planejado | `COUR-02`, depende de `PAY-01` (`DEC-22`) |
| Paginação da lista do prestador | Planejado | Sem `page`/`limit`, a aba *Concluídas* cresce sem limite |
| APK / QA em emulador ou dispositivo | Não executado | Segue em `UX-02` |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-COUR-01.md`.

## `DISP-01` — reoferta por anéis de raio (2026-08-09) ✅

Registro append-only. Nada acima foi alterado.

| Funcionalidade | Estado | Observação |
| --- | --- | --- |
| Rodadas de reoferta numeradas por pedido | Funcional | `dispatch_round` no pedido e na oferta; rodada só é consumida quando uma oferta existe |
| Anéis de raio configuráveis | Funcional | `inicial + (rodada − 1) × incremento`; provisórios 3 km / +3 km (último anel 12 km) |
| Exclusão de quem já foi tentado | Funcional | Recusa e expiração contam igual; vale mesmo se o excluído for o único disponível |
| Limite de rodadas | Funcional | `dispatchMaxRounds` = 4 (provisório, `DEC-02` pede 3–5) |
| Duração total do ciclo | Funcional | `dispatchTotalDurationMinutes` = 20 (provisório, `DEC-02` pede 15–30); é o freio quando não há candidato |
| Motivo de término no pedido | Funcional | `ACCEPTED`, `MAX_ROUNDS`, `TIMEBOX`, `NO_CANDIDATE`, `CANCELED` |
| Estado recuperável ao esgotar | Funcional | Continua `REQUESTED`, sem loop; admin reabre por `POST /deliveries/:id/dispatch` |
| Preço congelado na reoferta | Funcional | `DEC-03`/`DEC-19`: nenhuma rodada recalcula valor |
| Idempotência do job | Funcional | Lock por pedido + índice único parcial `(delivery_id, courier_id, dispatch_round)` |
| Registro por rodada (raio, elegíveis, tentados) | Funcional | Colunas na oferta; base para `DISP-03` |
| Settings de reoferta no painel | Funcional | Seção "Reoferta por aneis"; valida duração total ≥ TTL da oferta |
| Aviso ao cliente e ação explícita na demora | Planejado | `DISP-02` — depende só de `DISP-01` |
| Aumento de preço com consentimento | Planejado | `DISP-02` (`DEC-03`); a estrutura de rodadas já permite |
| Telemetria e relatórios de despacho | Planejado | `DISP-03`; varredura sem candidato ainda não vira linha |
| Raio por rota real | Planejado | Hoje é distância em linha reta; calibragem depende de `DISP-03` |
| QA de navegador da seção nova do painel | Não executado | Validada por build e API |

Evidência: `docs/04-status/entregas/2026-08-09-EVIDENCIA-DISP-01.md`.

## `DISP-02` — aviso de demora e ações do cliente na busca (2026-08-10) ✅

Registro append-only. Nada acima foi alterado.

| Funcionalidade | Estado | Observação |
| --- | --- | --- |
| Aviso de demora da busca | Funcional | `dispatchFirstWarningMinutes` (default 5; 0 = imediato); idempotente por ciclo (`dispatch_warning_at` + índice); evento + notificação + WebSocket `delivery:warning` |
| "Tentar novamente" (cliente) | Funcional | `POST /deliveries/:id/retry` → mesmo caminho do admin (`reopen: true`); `409` com busca ativa; não muda preço (`DEC-19`) |
| "Editar" (cliente) | Funcional | `PATCH /deliveries/:id`: endereços, destinatário, telefone, observação, janelas; preço/peso/tipo/foto recusados (`400`); exige busca sem oferta pendente |
| "Cancelar" (cliente) | Funcional | via `PATCH /deliveries/:id/status` existente (com motivo opcional no app); taxa de cancelamento fica em `COUR-02`/`PAY-01` |
| Aumento com consentimento (`DEC-03` §3.3) | Funcional | `POST /deliveries/:id/price-boost/consent`: proposta anterior → novo, aceite explícito, evento + auditoria, reabre a busca; `dispatchPriceBoostPercent` (default 20; 0 desliga) |
| Proposta visível no app cliente | Funcional | Card com anterior → novo (+%) e botão de aceite; nunca aumento silencioso |
| Settings no painel | Funcional | "Aviso de demora (minutos)" e "Aumento para destravar a busca (%)" na seção "Reoferta por aneis" |
| Cliente recebe o aviso em tempo real | Não executado | app acompanha por polling; eventos de socket prontos no gateway |
| QA de navegador do painel / QA visual do app | Não executado | segue em `UX-02` |

Evidência: `docs/04-status/entregas/2026-08-10-EVIDENCIA-DISP-02.md`.
