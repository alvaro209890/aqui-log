# Alvos de deploy (estrutura — sem vínculo ativo)

> **Atualizado:** 2026-08-07
> **Decisão canônica:** `DEC-25` — API **Render**, dashboard **Vercel**, banco
> cloud **Firebase** (Firestore) + Storage/FCM.
> **Status:** scaffold apenas. Nenhum projeto Render, Vercel ou Firebase está
> ligado a este repositório com credenciais. Secrets **não** devem ser commitados.
> Plano: [`PLANO_HOSPEDAGEM.md`](../02-planejamento/planos/PLANO_HOSPEDAGEM.md).

## Decisão de arquitetura cloud (Álvaro)

| Camada | Alvo | Estado |
| --- | --- | --- |
| API NestJS | **Render** (Web Service) | Blueprint `infra/render.yaml` |
| Dashboard React | **Vercel** | `vercel.json` + `apps/dashboard/vercel.json` |
| Banco de dados (produção) | **Firebase Firestore** | Alvo travado (`DEC-25`); migração = `OPS-DB-01` |
| Storage / Push | **Firebase** Storage + FCM | `infra/firebase/*` + stub Nest `src/firebase/` |
| Locks / jobs | **Redis** (Render Redis ou Upstash) | Auxiliar |
| Runtime **local** atual | Docker Compose **PostgreSQL** + Redis | Continua no acer até Firestore validado |

### Importante sobre banco

- **Local/dev:** PostgreSQL (TypeORM + migrations) permanece a fonte de verdade
  no PC de desenvolvimento (`INV-02` atualizado).
- **Produção cloud:** o banco alvo é **Firebase Firestore** — decisão do Álvaro
  em 2026-08-07 (`DEC-25`). Não é mais “talvez no futuro”.
- O blueprint Render ainda pode listar `DATABASE_*` como **transição** até
  `OPS-DB-01` concluir a troca de persistência; o plano de hospedagem manda.
- Storage e FCM seguem no mesmo projeto Firebase do Aqui Log (não reutilizar o
  do AquiResolve).

Se o próximo agente executar a migração (`OPS-DB-01`):

1. Desenhar coleções espelhando o domínio atual (entregas, usuários, ledger…).
2. Regras de segurança + índices; dual-write ou cutover com rollback.
3. Atualizar smoke, mobile e dashboard; só então desligar Postgres do runtime cloud.

## Diagrama alvo (não provisionado)

```text
[ Flutter apps ] ──HTTPS──► [ Render: Nest API ]
[ Vercel: Dashboard ] ──►        │
                                 ├── Firebase Firestore   ← banco cloud (DEC-25)
                                 ├── Redis (locks/settings)
                                 └── Firebase Storage + FCM
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
| `docs/02-planejamento/planos/PLANO_HOSPEDAGEM.md` | Plano e pacotes OPS |

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

- Não criar/conectar projetos nas UIs sem o dono (Álvaro) **e** pacote OPS ativo.
- Não commitar service account JSON.
- Não setar `FIREBASE_ENABLED=true` até adapters reais.
- Não apagar Postgres local/migrations antes de `OPS-DB-01` verde.
- Não usar o Firebase project do AquiResolve neste produto.
