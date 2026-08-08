# Plano — Hospedagem cloud (Render + Vercel + Firebase)

> **Atualizado:** 2026-08-07
> **Papel:** especificação subordinada ao [roadmap](../01-ROADMAP.md)
> **Decisão:** `DEC-25` em [`03-DECISOES.md`](../03-DECISOES.md)
> **Referência operacional:** [`04-ALVOS-DE-DEPLOY.md`](../../03-referencia/04-ALVOS-DE-DEPLOY.md)
> **Não autoriza:** criar projetos, colar secrets, ligar `FIREBASE_ENABLED` ou
> publicar URL pública sem credenciais e pedido de execução do Álvaro

## 1. Alvos travados (2026-08-07, Álvaro)

| Camada | Plataforma | Escopo |
| --- | --- | --- |
| Backend (API NestJS) | **Render** (Web Service) | HTTP/WebSocket, jobs, health |
| Frontend (dashboard React) | **Vercel** | SPA admin; `VITE_API_URL` → API Render |
| Banco de dados (produção) | **Firebase** (Firestore) | Fonte de verdade **cloud** do domínio |
| Storage de arquivos | **Firebase Storage** | Fotos de encomenda, provas, docs |
| Push | **Firebase Cloud Messaging** | Notificações mobile |
| Locks / cache / settings quentes | **Redis** (Render Redis ou Upstash) | Continua auxiliar; não substitui o banco |

Apps Flutter (cliente/motoboy) **não** hospedam em Vercel/Render: builds APK/store;
consomem a API no Render e, quando ligados, Storage/FCM no Firebase.

## 2. O que vale onde

| Ambiente | Banco | Redis | Storage | Observação |
| --- | --- | --- | --- | --- |
| Dev local (acer) | **PostgreSQL** + migrations TypeORM | Docker/local | adapter `local` | Continua até migração cloud |
| Produção cloud (alvo) | **Firebase Firestore** | Redis gerenciado | Firebase Storage | Após `OPS-02`/`OPS-03`/`OPS-DB-01` |

Invariante atualizado (`INV-02`): Postgres permanece a fonte de verdade **local**;
o alvo de produção cloud para banco é **Firebase**. Não apagar migrations nem o
Compose local enquanto o runtime cloud Firestore não estiver validado.

## 3. Pacotes

| ID | Status | Entrega | Gate |
| --- | --- | --- | --- |
| `OPS-01` | ⏳ | Prontidão local (índices, backup, smoke) | features B2C estáveis |
| `OPS-DB-01` | ⏸️ | Desenho + migração/dual-write Postgres → Firestore | `DEC-25`, modelo de coleções, aceite do dono |
| `OPS-02` | ⏸️ | Firebase: projeto, Firestore rules, Storage, FCM; adapters reais | pedido + credenciais |
| `OPS-03` | ⏸️ | Deploy API Render + dashboard Vercel + smoke público | `OPS-01`, `OPS-02`, URL API estável |

Ordem: local estável → desenho Firestore → ligar Firebase → publicar Render/Vercel.

## 4. Diagrama alvo

```text
[ customer_app / courier_app ] ──HTTPS──► [ Render: Nest API ]
[ Vercel: Dashboard ] ─────────────────►        │
                                                ├── Firebase Firestore  ← banco cloud
                                                ├── Redis (locks/jobs)
                                                └── Firebase Storage + FCM
```

## 5. Critérios de aceite (quando executar)

- [ ] Projeto Firebase do Aqui Log criado (sem secrets no git).
- [ ] Rules Firestore/Storage revisadas; sem leitura pública de PII.
- [ ] API no Render com health OK apontando para o stack cloud decidido.
- [ ] Dashboard na Vercel chama só a API Render (`VITE_API_URL`).
- [ ] Upload de prova e (se aplicável) push FCM em dispositivo/emulador.
- [ ] Smoke B2C público documentado; rollback descrito.
- [ ] Postgres local ainda sobe para desenvolvimento.

## 6. Fora de escopo deste plano

- Provisionar contas agora.
- Migrar código TypeORM → Firestore nesta sessão.
- Trocar stack mobile para Firebase Auth sem tarefa própria.
- Usar o projeto Firebase do AquiResolve por engano.
