# HANDOFF — Continuidade para o próximo agente

## Atualização de produto — 2026-08-07 (somente documentação, 2ª rodada)

O Álvaro decidiu mais duas capacidades novas, **apenas em plano (nenhum código nesta rodada)**:

1. **Painel admin com controle máximo** — pedidos (status/cancelar/redespachar/reatribuir),
   motoboys, clientes, viagens/lotes, financeiro (ledger), configurações versionadas e
   notificações, tudo com confirmação dupla + motivo obrigatório + audit log.
   Plano: **`docs/PLANO_ADMIN.md`** (fases `ADMIN-01..07`).
2. **Suporte/reclamações do cliente ("algo legal")** — dossiê automático da entrega
   ("prova reversa": o sistema monta a timeline com fotos/GPS/horários server-side e
   decide sem depender da palavra de ninguém), auto-resolução guiada (botões: cancelar
   sem custo / desconto / aguardar), juiz rápido (vereditos automáticos com estorno via
   ledger até teto) e nota de confiança (compensação proativa sem o cliente pedir).
   Plano: **`docs/PLANO_SUPORTE_RECLAMACOES.md`** (fases `SUP-01..05`).
3. **Guia didático do fluxo completo**: **`docs/FLUXO_APP.md`** — jornadas do cliente,
   motoboy e admin, máquina de estados unificada, cadeia do dinheiro, "quem faz o quê"
   e o que é funcional/design/futuro.

Correções de consistência aplicadas nos planos existentes (achados da revisão adversarial):
carga corrente de lote corrigida (R4.4), estorno pós-coleta por fase com teto (R6.3),
deadhead intermunicipal no preço (R5.1A), índice de pontualidade isenta atrasos com causa
registrada, pino ocioso coarsificado no mapa de frota (LGPD), SUPPORT com somente leitura
na frota, TSP exaustivo só ≤ 4 paradas, clawback/janela de contestação do payout.

## Atualização de produto — 2026-08-07 (1ª rodada: lote + frota)

O Álvaro decidiu duas capacidades novas, **apenas em plano (nenhum código nesta rodada)**:

1. **Motoboy aceita vários pedidos juntos** — inclusive **lotes agendados de um município
   para outro**, com **lógica anti-atraso** (folgas, janelas, ETAs, alertas, redespacho,
   índice de pontualidade). Plano expandido: **`docs/PLANO_LOTE_MULTI_PEDIDO.md`** (fases
   `LOT-01`/`LOT-02` no roadmap). O agrupamento **automático** da plataforma continua
   atrás do gate `TRIP-00`.
2. **Dashboard monitora a frota** — localização dos prestadores em tempo real, se cada
   pedido foi **recolhido ou não**, e o **trajeto durante a viagem**. Novo plano:
   **`docs/PLANO_FROTA_DASHBOARD.md`** (fases `FROTA-01`/`FROTA-02`).

Pré-requisito técnico já identificado: desacoplar o heartbeat `courier:location` de
`deliveryId` e criar histórico de posição (`courier_positions`). Decisões pendentes
listadas em `PLANO_LOTE_MULTI_PEDIDO.md` §12 e `PLANO_FROTA_DASHBOARD.md` §8 (`DEC-08..12`
no roadmap).

## Atualização de entrega — 2026-08-07

`B2C-01` foi implementado em schema/API/core/apps: pedidos novos usam campos próprios de encomenda e pedidos antigos continuam legíveis pelo fallback de `notes`. Os dois apps Flutter e o pacote `aqui_log_ui` adotaram a identidade laranja. O próximo pacote é `B2C-01B` (dashboard por cliente/categoria/tamanho/peso), seguido de tema laranja e QA visual do dashboard.

Evidência local desta rodada: build backend/dashboard verde; backend 32/32, core 6/6, UI 2/2, cliente 10/10 e motoboy 7/7. Não declarar migration aplicada, smoke vivo, APK ou QA em dispositivo: não havia `.env` nem Docker disponível, e o AVD ficou offline no ADB. Detalhes em `ENTREGA_MOBILE_B2C_2026-08-07.md`.

> **Repo:** `https://github.com/alvaro209890/aqui-log` · branch **`main`**  
> **Último trabalho estrutural de deploy:** 2026-07-16  
> **Owner:** Álvaro · comunicação em **português (BR)**  
> **Ambiente local:** Linux · API porta **3001** · Postgres **5433** · Redis **6379** · Vite **5173**

Leia isto **antes** de mudar código. Fonte de produto: `docs/ROADMAP.md`.

---

## 0.1. Atualização 2026-08-07 — identidade visual laranja (somente documentação)

O tema geral futuro do Aqui Log deverá seguir uma linguagem visual próxima ao
[AquiResolve](https://github.com/alvaro209890/AquiResolve), com **laranja como cor
principal da marca**, bases neutras e cores semânticas preservadas.

- Fonte de verdade visual: **`docs/DIRETRIZES_VISUAIS.md`**.
- Laranja canônico proposto: **`#F97316`**; hover `#EA580C`; destaque suave `#FFF7ED`.
- A decisão vale para dashboard, app cliente, app motoboy e `aqui_log_ui`.
- O código atual permanece verde/menta. **Nenhum CSS, tema Flutter, componente ou
  asset foi alterado nesta atualização.**
- Quando houver autorização para implementar, centralizar as cores em tokens e
  validar contraste, estados, mapas, gráficos e os principais fluxos B2C.

---

## 0. Atualização 2026-08-04 — pivot B2C **funcional** (sem empresa no meio)

O Álvaro decidiu migrar o produto para **B2C direto** (cliente pessoa física → motoboy,
sem empresa no meio). Plano completo: **`docs/PLANO_B2C.md`** (decisões pendentes §5).
Planos futuros: `docs/PLANO_LOTE_MULTI_PEDIDO.md`, `docs/PLANO_PAGAMENTOS.md`,
`docs/PLANO_CONFIANCA_E_PRECO.md`.

**Já implementado (2 rodadas de commits `B2C`):**
- **Backend funcional:** `POST /auth/register/customer` (auto-aprovado, auto-login),
  role `CUSTOMER` (enum + entidade `customers`), `deliveries.customer_id`, **auto-dispatch**
  no create (pedido vai direto pra oferta dos motoboys disponíveis), cliente lista/cancela/avalia os próprios pedidos.
- **App cliente** (`apps/customer_app`, "Aqui Log Cliente"): cadastro de cliente,
  login, pedido com **tipo de encomenda, tamanho P/M/G, peso kg, alcance (mesma
  cidade / outro município), foto**, endereços com geocode; abas Início/Pedir/Entregas/Perfil.
- **App motoboy** (`apps/courier_app`): card da oferta mostra a **encomenda**
  (tipo · tamanho · peso · alcance · foto) antes de aceitar/recusar.
- Metadados da encomenda serializados no `notes` via `OrderMeta`
  (`packages/aqui_log_core/lib/src/order_meta.dart`, compartilhado).
- **Validado ao vivo:** register customer → create → auto-dispatch (OFFERED) →
  oferta no app do motoboy → accept (ACCEPTED). Smoke B2C segue verde.
- Testes: backend 27/27 · cliente 10/10 · motoboy 7/7 · analyze limpo.

**Próximo pacote recomendado pelo roadmap:** `B2C-01`, colunas próprias de
encomenda com migration aditiva e fallback de leitura em `notes`. Depois: preço
v2, avaliação mútua e resiliência da oferta. Pagamentos, SMS, cloud e
lote/viagens continuam atrás de gates explícitos.

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
- Couriers: approve / reject / suspend / reativar
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
| Produto principal | **B2C cliente → motoboy**; B2B permanece somente por compatibilidade |
| Pagamentos | **Não autorizados agora.** Futuro condicionado aos gates `PAY-01/02` do `ROADMAP.md` |
| Mapas | OSM embutido; provedor pago em aberto |
| Storage prod | **Firebase Storage** |
| Push | **Firebase FCM** |
| Pricing | **Só servidor** |
| Auth piloto | Refresh + reset senha (sem MFA) |
| Deploy cloud | Estrutura Render/Vercel/Firebase; **não ligar sem pedido explícito** |
| DB runtime **hoje** | **PostgreSQL** (TypeORM). Firebase DB = futuro; não migrar às cegas |
| Identidade visual | Mobile **laranja** conforme `DIRETRIZES_VISUAIS.md`; dashboard e QA visual em dispositivo pendentes |

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
cd apps/customer_app && flutter analyze && flutter test
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
| Cliente / Courier apps | `apps/customer_app`, `apps/courier_app` |
| Smoke | `scripts/smoke-test.sh` |
| Docs | `docs/*` |

`FIREBASE_ENABLED` default **false**. Stub **não** está importado em `AppModule` de propósito — local não depende de Firebase.

---

## 5. Próximos passos recomendados (ordem vigente)

O `ROADMAP.md` é a única fonte de prioridade. Próximo pacote recomendado:

### A) `B2C-01` — fundação da encomenda

1. Fechar contrato aditivo de tipo, tamanho, peso, alcance e fotos.
2. Criar migration reversível com campos inicialmente opcionais.
3. Backend grava campos próprios; `notes` passa a ser observação livre.
4. Core, app cliente e app motoboy leem campos próprios com fallback legado.
5. Dashboard ganha filtros/relatórios B2C.
6. Manter foto obrigatória atrás de feature flag até `DEC-01`.
7. Validar pedido novo e legado, smoke, testes, apps e UI real.

### B) Depois de `B2C-01`

1. `B2C-02`: preço v2 com breakdown e versão persistidos.
2. `B2C-03`: avaliação mútua por papel.
3. `DISP-01/03`: reoferta limitada por anéis + aviso + telemetria.
4. `PAY-01`: ledger interno somente se pagamentos forem explicitamente autorizados.

### C) Trilha visual paralela

Quando autorizada, aplicar a identidade laranja de `DIRETRIZES_VISUAIS.md` via
tokens compartilhados e QA visual, sem misturar mudanças de regra de negócio.

### D) Gates externos — não iniciar por conta própria

- SMS: depende de provedor/sandbox (`DEC-04`).
- Firebase/Render/Vercel: dependem de pedido explícito e `OPS-01/02/03`.
- PIX: depende de ledger validado, gateway escolhido e `PAY-02`.
- Lote/viagens: começa por medição `TRIP-00`, não por telas/CRUD.

### E) Explicitamente **não** fazer agora

- remover o fallback de `notes` na mesma entrega da migration;
- aumentar preço automaticamente sem consentimento;
- ligar cloud, gateway ou SMS sem autorização/credenciais;
- migrar o domínio para Firestore;
- commitar `.env`, chaves ou dados pessoais.

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
| `e017917` | Scaffold Render/Vercel/Firebase + HANDOFF |
| `e0dff26` / `bf36b4a` | Sprint 3 dashboard + docs |
| `e4d2ae3` | App cliente B2C com dados da encomenda |
| `58079bc` | Fluxo B2C cliente → motoboy ponta a ponta |
| `921d79b` | Plano B2C alinhado ao estado funcional |

---

## 8. Mensagem sugerida ao Álvaro ao retomar

> Ambiente local está estável (smoke verde). Cloud é só estrutura.
> O próximo pacote recomendado é `B2C-01`: tirar os dados da encomenda de
> `notes` com migration aditiva e fallback legado. Antes de ativar foto
> obrigatória, preciso fechar `DEC-01`; cloud e pagamentos continuam bloqueados.

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
