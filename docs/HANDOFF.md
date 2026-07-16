# HANDOFF — Continuidade para o próximo agente

> **Repo:** `https://github.com/alvaro209890/aqui-log` · branch **`main`**  
> **Último trabalho estrutural de deploy:** 2026-07-16  
> **Owner:** Álvaro · comunicação em **português (BR)**  
> **Ambiente local:** Linux · API porta **3001** · Postgres **5433** · Redis **6379** · Vite **5173**

Leia isto **antes** de mudar código. Fonte de produto: `docs/ROADMAP.md`.

---

## 1. O que foi feito (Sprints 1–3 + scaffold Sprint 4)

### Sprint 1 — Backend robusto ✅
- Redis real: health + **lock** no aceite de oferta
- Job expirar ofertas + re-despacho; despacho de `scheduledAt`
- **Pricing server-side** (Haversine + env/`settings` Redis)
- Auth: **refresh token**, logout, forgot/reset (token no log local)
- Dashboard mark-read de alertas
- Timezone `America/Sao_Paulo`

### Sprint 2 — Mobile piloto ✅
- Storage local Firebase-ready (presign/upload/files + policy de `proofUrl`)
- Geo `POST /geo/geocode` (local / nominatim opcional)
- `POST /devices` (skeleton FCM)
- Flutter: mapa OSM embutido, geocode na nova entrega, câmera+upload, GPS, refresh no `aqui_log_core`

### Sprint 3 — Dashboard gestão ✅
- Páginas **Usuários**, **Auditoria**, **Configurações**
- Entregas: despachar / assign / cancelar
- Empresas/couriers: approve / reject / suspend / reativar
- Relatórios `GET /dashboard/reports?from=&to=`
- Paginação `page`/`limit` nas listagens admin

### Sprint 4 (parcial) — só **estrutura**, sem vincular ✅
- Alvo cloud: **API → Render**, **Dashboard → Vercel**, **Storage/Push (e futuro dados) → Firebase**
- **Nada provisionado/conectado** (pedido explícito do Álvaro)
- Ver `docs/DEPLOY_TARGETS.md`, `infra/render.yaml`, `vercel.json`, `infra/firebase/`, `apps/backend/src/firebase/firebase.scaffold.ts`

---

## 2. Decisões travadas (não reabrir sem o Álvaro)

| Tema | Decisão |
| --- | --- |
| Pagamentos | **Fora de escopo** |
| Mapas | OSM embutido; provedor pago em aberto |
| Storage prod | **Firebase Storage** |
| Push | **Firebase FCM** |
| Pricing | **Só servidor** |
| Auth piloto | Refresh + reset senha (sem MFA) |
| Deploy cloud | Estrutura Render/Vercel/Firebase; **ligar depois** |
| DB runtime **hoje** | **PostgreSQL** (TypeORM). Firebase DB = futuro; não migrar às cegas |

---

## 3. Como rodar local (golden path)

```bash
cp .env.example .env   # se ainda não existir
pnpm install
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:admin
pnpm --filter backend start:prod   # ou start:dev
pnpm --filter dashboard dev
pnpm smoke
```

- API: `http://localhost:3001/api/v1` · Swagger: `/docs`
- Dashboard: `http://localhost:5173` · login admin do `.env`
- **Portas:** se Postgres host for 5432 ocupado, local usa **5433**

Qualidade:

```bash
pnpm build && pnpm lint && pnpm test && pnpm smoke
# Flutter (opcional nesta máquina):
cd apps/company_app && flutter analyze && flutter test
cd apps/courier_app && flutter analyze && flutter test
cd packages/aqui_log_core && dart test
```

---

## 4. Mapa do código (onde mexer)

| Área | Paths |
| --- | --- |
| API | `apps/backend/src/` |
| Deliveries / locks / jobs | `deliveries/` |
| Storage local | `storage/storage.module.ts` |
| Firebase stub | `firebase/firebase.scaffold.ts` (**não** no AppModule) |
| Settings runtime | `settings/` (Redis) |
| Dashboard | `apps/dashboard/src/` |
| Mobile core | `packages/aqui_log_core/` |
| Company / Courier apps | `apps/company_app`, `apps/courier_app` |
| Smoke | `scripts/smoke-test.sh` |
| Docs | `docs/*` |

`FIREBASE_ENABLED` default **false**. Stub **não** está importado em `AppModule` de propósito — local não depende de Firebase.

---

## 5. Próximos passos recomendados (ordem)

### A) Ligar Firebase de verdade (sem quebrar local)
1. Criar projeto Firebase; Storage + FCM.
2. Service account só em secrets Render.
3. Implementar adapter real substituindo stub; `STORAGE_DRIVER=firebase`.
4. FCM: ler `device_tokens`, enviar no `NotificationsService` (ou paralelo).
5. Testes com emulador ou projeto dev separado.

### B) Deploy Render (API)
1. Conectar repo ao Render usando `infra/render.yaml` como base.
2. Provisionar Postgres + Redis (Render ou externos).
3. Setar `PUBLIC_API_URL`, JWT, admin, `DATABASE_*`, `REDIS_URL`.
4. `migration:run` no release command.
5. Health: `GET /api/v1/health` com db+redis ok.

### C) Deploy Vercel (dashboard)
1. Import monorepo; root `vercel.json` ou app `apps/dashboard`.
2. Env: `VITE_API_URL=https://<render-api>/api/v1`.
3. CORS no Nest já `origin: true` — endurecer em prod se necessário.

### D) Endurecimento (ainda no ROADMAP Sprint 4)
- FKs nas migrations Postgres
- Logs estruturados (pino/winston)
- Retenção de provas
- Load test / backup

### E) Explicitamente **não** fazer agora
- Pagamentos / PIX
- MFA admin
- Migrar todo o domínio para Firestore sem plano de dados
- Commits de `.env` / chaves

---

## 6. Armadilhas conhecidas

1. **Portas:** docs antigos citam 3000; runtime local é **3001**.
2. **Pricing:** body `priceCents` do client é ignorado; smoke já valida fee do servidor.
3. **proofUrl:** só host do storage (`PUBLIC_API_URL/.../storage/files/`).
4. **Paginação:** sem `page`/`limit` a API ainda devolve **array** (compat mobile); com query devolve `{ items, total, page, limit, totalPages }`.
5. **Docker:** neste host às vezes precisa de permissão para o socket; Postgres/Redis já podem estar rodando nativamente.
6. **Sudo:** se precisar de docker root, pedir ao usuário — não inventar secrets.
7. **Settings** em Redis: se Redis cair, volta defaults do env.
8. **Firebase scaffold** lança se alguém chamar stub com enabled incompleto — deixe desligado.

---

## 7. Commits relevantes (main)

| Commit | Conteúdo |
| --- | --- |
| `fb4f55a` | Sprint 1 backend |
| `550b194` | Sprint 2 mobile |
| `e0dff26` / `bf36b4a` | Sprint 3 dashboard + docs |
| *(este)* | Scaffold Render/Vercel/Firebase + HANDOFF |

---

## 8. Mensagem sugerida ao Álvaro ao retomar

> Ambiente local está estável (smoke verde). Cloud é só estrutura.
> Posso (1) implementar Firebase Storage/FCM de verdade, (2) preparar
> deploy Render+Vercel com secrets que você criar, ou (3) FKs/logs.
> Qual prioridade?

---

## 9. Checklist de aceitação ao “ligar” cloud

- [ ] Nenhum secret no git  
- [ ] `FIREBASE_ENABLED=false` em local continua funcionando  
- [ ] Smoke local verde  
- [ ] Health na API Render com db+redis  
- [ ] Dashboard Vercel chama API Render  
- [ ] Upload de prova via Firebase (ou dual-write documentado)  
- [ ] Push FCM em device real ou emulador  

**Fim do handoff.** Qualquer dúvida de produto: Álvaro. Código e planos: `docs/ROADMAP.md` + este arquivo.
