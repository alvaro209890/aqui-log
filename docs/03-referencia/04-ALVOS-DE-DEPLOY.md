# Alvos de deploy (estrutura — sem vínculo ativo)

> **Status:** scaffold apenas. Nenhum projeto Render, Vercel ou Firebase
> está ligado a este repositório. Credenciais **não** devem ser commitadas.

Atualizado: 2026-07-16

## Decisão de arquitetura cloud (Álvaro)

| Camada | Alvo | Estado |
| --- | --- | --- |
| API NestJS | **Render** (Web Service) | Blueprint `infra/render.yaml` |
| Dashboard React | **Vercel** | `vercel.json` + `apps/dashboard/vercel.json` |
| Storage / Push / (dados cloud) | **Firebase** | `infra/firebase/*` + stub Nest `src/firebase/` |
| Runtime **local** atual | Docker Compose Postgres+Redis | Continua sendo o caminho de dev |

### Importante sobre “banco Firebase”

- **Hoje a fonte de verdade da API é PostgreSQL** (TypeORM + migrations).
- Firebase no plano: **Storage** + **FCM** primeiro.
- **Firestore** como DB principal é decisão futura (migração grande).
  O scaffold deixa regras e docs, mas **não** remove Postgres do Render
  blueprint — o serviço API ainda espera `DATABASE_*`.

Se o produto migrar 100% para Firestore, o próximo agente deve:
1. Desenhar modelo de coleções espelhando entidades TypeORM.
2. Reescrever repositórios ou dual-write.
3. Atualizar smoke e mobile clients.

## Diagrama alvo (não provisionado)

```text
[ Flutter apps ] ──HTTPS──► [ Render: Nest API ]
[ Vercel: Dashboard ] ──►        │
                                 ├── Postgres (Render DB ou externo)  ← ainda previsto no YAML
                                 ├── Redis (Render/Upstash)           ← locks/settings
                                 └── Firebase Storage + FCM           ← quando FIREBASE_ENABLED=true
```

## Arquivos de estrutura

| Path | Função |
| --- | --- |
| `infra/render.yaml` | Blueprint API no Render |
| `vercel.json` | Root monorepo → build dashboard |
| `apps/dashboard/vercel.json` | SPA rewrites |
| `infra/firebase/` | Rules/CLI examples |
| `apps/backend/src/firebase/firebase.scaffold.ts` | Config + stubs Storage/FCM |
| `.env.example` | Variáveis placeholder |

## Env (placeholders)

```bash
# Deploy targets (não usados no runtime local)
FIREBASE_ENABLED=false
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
STORAGE_DRIVER=local   # local | firebase (firebase ainda stub)

# Vercel dashboard
# VITE_API_URL=https://<api-render>.onrender.com/api/v1

# Render
# PUBLIC_API_URL=https://<api-render>.onrender.com/api/v1
```

## O que NÃO fazer ainda

- Não criar/conectar projetos nas UIs sem o dono (Álvaro).
- Não commitar service account JSON.
- Não setar `FIREBASE_ENABLED=true` até adapters reais.
- Não apagar Postgres local/migrations.
