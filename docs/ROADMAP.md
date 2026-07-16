# Aqui Log — Roadmap (decisões fechadas)

> **Atualizado:** 2026-07-16  
> **Repo:** `/home/acer/Documentos/aqui-log` · `main`  
> **Base técnica:** MVP operacional (`SESSAO_IMPLEMENTACAO.md`, `MVP_COVERAGE.md`)  
> **Plano detalhado Hermes:** `~/.hermes/plans/2026-07-16_161507-aqui-log-melhorias.md`

**Goal:** Endurecer backend e fechar apps mobile para piloto local, sem pagamentos e sem deploy cloud ainda.

---

## 1. Decisões do produto (Álvaro · 2026-07-16)

| # | Tema | Decisão |
| --- | --- | --- |
| 1 | Mapas / geocoding | **Provedor em aberto** por enquanto. Apps usam **mapa embutido** (não só deep-link). Implementar atrás de interface (`GeoProvider` / tiles abstratos); default dev: OSM + `flutter_map` / Leaflet até escolher Google/Mapbox. |
| 2 | Storage (comprovantes/docs) | **Firebase Storage** quando for para produção de verdade. Até lá: adapter local (filesystem ou emulador Firebase) com a **mesma interface** `StorageService`, para trocar sem reescrever apps. |
| 3 | Push | **Firebase** (FCM). Pode ficar skeleton/register token agora; envio real quando projeto Firebase estiver configurado. |
| 4 | Pagamentos | **Fora de escopo agora.** Carteira/extrato de crédito interno permanece; sem saque, gateway PIX ou conciliação. |
| 5 | Prioridade | **A depois B:** (1) backend robusto · (2) mobile piloto. Não misturar grandes mudanças de contrato no meio do app sem fechar locks/auth. |
| 6 | Precificação | **Servidor calcula** (km + taxa base + % plataforma). Cliente não manda `priceCents`/`courierFeeCents` livres em produção. |
| 7 | Geografia | **Em aberto.** Timezone padrão: **`America/Sao_Paulo`** (horário de Brasília) em trends, “dia local”, jobs e relatórios. |
| 8 | Deploy | **Só local** (Docker Compose + `pnpm` / Flutter). Sem cloud/VPS nesta fase. |
| 9 | Auth piloto | **Refresh token** + **recuperação de senha**. MFA e gestão avançada de sessões ficam depois. |
| 10 | Documentação | Este arquivo (`docs/ROADMAP.md`) é a fonte versionada no git. |

### Explicitamente fora (agora)

- Gateway de pagamento / saque / fiscal  
- Deploy AWS/GCP/Vercel/Render  
- IA de rotas, heatmap, agrupamento multi-parada  
- API pública / webhooks ERP  
- MFA administrativo  
- Escolha final Google vs Mapbox vs só OSM (mapa embutido com OSM atende dev)

---

## 2. Estado atual (resumo)

| Camada | OK | Fragilidade |
| --- | --- | --- |
| API Nest | Fluxo entrega completo, JWT, dashboard metrics, WS tracking | Redis não usado; ofertas não expiram; race no aceite; pricing no client |
| Dashboard | KPIs, charts, mapa, páginas básicas | Gestão incompleta; alertas sem mark-read; links fantasmas |
| Apps Flutter | Login + fluxos principais | Câmera simulada; coords fixas; mapa grid; sem GPS/WS contínuo |
| Infra | Postgres + Redis Compose, CI, smoke | Redis ocioso; storage/push Firebase ainda não |

Portas locais: API **3001**, Postgres **5433**, Redis **6379**, Vite **5173**.

---

## 3. Ordem de implementação

### Sprint 1 — Backend robusto (prioridade A)

| ID | Entrega | Notas |
| --- | --- | --- |
| B1 | Higiene env/docs | `.env.example` + `API.md` com portas reais; timezone `America/Sao_Paulo` documentado |
| B2 | Módulo Redis | `REDIS_URL`; health ping Redis |
| B3 | Lock no aceite de oferta | `SET NX` + revalidação; segundo aceite → 409 |
| B4 | Expiração de ofertas + re-despacho | `expiresAt` honrado; delivery volta `REQUESTED` e tenta outro courier |
| B5 | Despacho agendado | Tick para `scheduledAt <= now` |
| B6 | Pricing server-side | `PricingService`: distância (Haversine) × `price_per_km` + base + `platform_fee_percent`; settings em env ou tabela |
| B7 | Refresh token + logout | Access curto + refresh; `POST /auth/refresh`, `POST /auth/logout` |
| B8 | Recuperação de senha | `forgot` / `reset`; e-mail console em local |
| B9 | Alertas mark-read no dashboard | Usa API já existente (ganho rápido) |
| B10 | Smoke + testes | Não quebrar `pnpm smoke`; unit nos locks/pricing/expiry |

**Definition of Done Sprint 1**

- [x] `pnpm build && pnpm lint && pnpm test && pnpm smoke` verdes  
- [x] Redis usado em lock e health  
- [x] Oferta expira e re-despacha sem intervenção manual (job 10s)  
- [x] Aceite concorrente: lock Redis  
- [x] Criar entrega: preço/fee calculados no servidor  
- [x] Login emite refresh; refresh renova access; logout revoga  
- [x] Fluxo forgot/reset testável localmente (token no log)  
- [x] Docs: `ROADMAP` + `MVP_COVERAGE` + `API` alinhados  

### Sprint 2 — Mobile piloto (prioridade B)

| ID | Entrega | Notas |
| --- | --- | --- |
| M1 | Interface `StorageService` + adapter local | Contrato idêntico ao futuro **Firebase Storage** |
| M2 | Presign/upload API | Apps sobem prova/docs; `proofUrl` só de host permitido |
| M3 | Geo abstrato | Geocode atrás de interface; coords deixam de ser hardcoded no company app |
| M4 | Mapa embutido courier | `flutter_map` + OSM (default); pins das ofertas |
| M5 | Mapa embutido company (detalhe/tracking) | Quando houver coords/histórico |
| M6 | Câmera real + upload prova | `image_picker` → storage |
| M7 | GPS + envio location | REST e/ou Socket.IO `courier:location` em corrida ativa |
| M8 | Detalhe entrega rico | Endereços, histórico, status, avaliação (empresa) |
| M9 | Clients com refresh token | `aqui_log_core` renova em 401 |
| M10 | Device token register (Firebase push skeleton) | `POST /devices`; envio real quando Firebase prod existir |

**Definition of Done Sprint 2**

- [ ] `flutter analyze` + `flutter test` nos dois apps e `aqui_log_core`  
- [ ] Nova entrega sem lat/lng mágicos de BH  
- [ ] Comprovante não usa `example.com`  
- [ ] Mapa embutido mostra pins reais  
- [ ] Entregador em corrida atualiza localização  
- [ ] Smoke ainda verde (API)  

### Sprint 3 — Dashboard gestão + qualidade (quando A+B estáveis)

- Páginas reais: Usuários, Auditoria, Configurações (TTL oferta, taxas pricing)  
- Ações em entregas: despachar, cancelar, assign  
- Empresas/couriers: reject/suspend  
- Relatórios com `from`/`to` (timezone SP)  
- Paginação nas listagens  

### Sprint 4 — Produção Firebase + endurecimento

- Ligar **Firebase Storage** + **FCM** de verdade (projeto Firebase)  
- Trocar adapter de storage/push sem mudar apps  
- FKs no Postgres, retenção de provas, logs estruturados  
- Deploy (só quando #8 deixar de ser “só local”)  

### Depois (backlog)

- Pagamentos (PIX/saque)  
- Escolha final de provedor de mapas pago  
- API pública, IA, heatmap  
- MFA admin  

---

## 4. Contratos-chave a introduzir

### Pricing (servidor)

```text
inputs: pickup(lat,lng), delivery(lat,lng) [, vehicleType]
config: base_fee_cents, price_per_km_cents, platform_fee_percent, min_fee_cents
output:
  distanceKm
  courierFeeCents   // o que o entregador recebe
  priceCents        // o que a empresa paga
  platformFeeCents  // price - courierFee (ou % explícita)
```

`POST /deliveries` **ignora** ou sobrescreve `priceCents`/`courierFeeCents` do body (manter campos opcionais só para smoke legado até migrar o script).

### Auth

```text
POST /auth/login     → { accessToken, refreshToken, user, expiresIn }
POST /auth/refresh   → { accessToken, refreshToken?, expiresIn }
POST /auth/logout    → { ok: true }  // revoga refresh
POST /auth/forgot-password → { ok: true }  // sempre 200
POST /auth/reset-password  → { ok: true }
```

### Storage (Firebase-ready)

```text
POST /storage/presign { purpose: 'proof'|'document', contentType, deliveryId? }
→ { uploadUrl, fileUrl, key, expiresIn }

// Local adapter: PUT no próprio API ou path /uploads
// Prod adapter: Firebase Storage signed URL / upload token
```

### Timezone

- “Hoje”, trends e charts: janela local **`America/Sao_Paulo`**  
- Persistir timestamps em `timestamptz` (UTC no banco)  

---

## 5. Arquivos principais

| Área | Paths |
| --- | --- |
| Redis / locks / expiry | `apps/backend/src/redis/**`, `apps/backend/src/deliveries/**` |
| Pricing | `apps/backend/src/pricing/**` (novo) |
| Auth refresh/reset | `apps/backend/src/auth/**`, migration `refresh_tokens` |
| Storage | `apps/backend/src/storage/**` |
| Geo | `apps/backend/src/geo/**` |
| Dashboard quick wins | `apps/dashboard/src/pages/AlertsPage.tsx`, `api.ts` |
| Core mobile | `packages/aqui_log_core/**` |
| Apps | `apps/company_app/lib/**`, `apps/courier_app/lib/**` |
| Infra | `infra/docker-compose.yml`, `.env.example` |
| Docs | `docs/ROADMAP.md` (este), `docs/MVP_COVERAGE.md`, `docs/API.md` |

---

## 6. Verificação

```bash
cd /home/acer/Documentos/aqui-log
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm install
pnpm db:migrate && pnpm db:admin
pnpm build && pnpm lint && pnpm test
pnpm smoke
# apps
cd apps/company_app && flutter analyze && flutter test
cd ../courier_app && flutter analyze && flutter test
cd ../../packages/aqui_log_core && dart analyze && dart test
```

---

## 7. Próximo passo de execução

Quando for implementar, ordem fechada:

1. **Sprint 1 (Backend A)** completo  
2. **Sprint 2 (Mobile B)**  
3. Sprint 3 dashboard  
4. Sprint 4 Firebase prod  

Comando sugerido ao agente:

> Implementa o Sprint 1 do `docs/ROADMAP.md` (B1–B10), com TDD nos locks/pricing/expiry e smoke verde.
