# Plano — Hospedagem (runtime local via Cloudflare Tunnel → cloud)

> **Atualizado:** 2026-08-10
> **Papel:** especificação subordinada ao [roadmap](../01-ROADMAP.md)
> **Decisões:** `DEC-26` (distribuição inicial no acer via CF Tunnel) e `DEC-25`
> (alvos cloud) em [`03-DECISOES.md`](../03-DECISOES.md)
> **Referência operacional:** [`04-ALVOS-DE-DEPLOY.md`](../../03-referencia/04-ALVOS-DE-DEPLOY.md)
> **Não autoriza:** criar projetos, colar secrets, ligar `FIREBASE_ENABLED` ou
> publicar URL pública sem credenciais e pedido de execução do Álvaro

## 0. Runtime de distribuição — acer via Cloudflare Tunnel (`DEC-26`, 2026-08-10)

> **Status: `OPS-01A` ENTREGUE em 2026-08-11.** O que esta seção descrevia como
> alvo está no ar. A **referência operacional** (subir, verificar, reiniciar,
> instalar do zero e as armadilhas) fica em
> [`docs/03-referencia/05-RUNTIME-ACER.md`](../../03-referencia/05-RUNTIME-ACER.md);
> a evidência, em
> [`2026-08-11-EVIDENCIA-APK-E-RUNTIME.md`](../../04-status/entregas/2026-08-11-EVIDENCIA-APK-E-RUNTIME.md).
>
> | Peça | Endereço |
> | --- | --- |
> | API NestJS | <https://aquilog-api.cursar.space/api/v1> (systemd user `aqui-log-api`, 3011) |
> | Dashboard admin | <https://aquilog.cursar.space> (systemd user `aqui-log-dashboard`, 3012) |
> | Túnel dedicado | `cloudflared-aqui-log` (`66aa2d7d-9ff9-46ae-9c77-de3c7c205b51`) |
> | Postgres 17 | container `aqui-log-postgres` (5433), dados em `~/Documentos/Bando_de_dados/Aqui_Log` |
> | Redis 7 | container `aqui-log-redis` (6379) |
>
> Units versionadas em `infra/systemd/`; segredos em `~/.config/aqui-log/env`
> (fora do repo). As três units estão `enabled` com `linger` ligado: **sobem com
> o PC, sem login**. Nenhum serviço pré-existente do acer foi tocado.

**Antes de publicar/distribuir o aplicativo**, o backend, o banco de dados e a
pilha inteira devem rodar **neste PC (acer)** — expostos por **Cloudflare
Tunnel** sob o domínio próprio já comprado (`*.cursar.space`) — **sem derrubar
nada que já roda atualmente** no acer (serviços existentes seguem intactos:
túneis, ports, systemd, etc.).

- **Banco de dados:** PostgreSQL do Aqui Log em
  `~/Documentos/Bando_de_dados/Aqui_Log` (padrão das pastas de dados do acer;
  ver `INV-02` — Postgres continua a fonte de verdade local).
- **Exposição:** `cloudflared` com rota para API e dashboard do Aqui Log no
  domínio próprio; portas/serviços já ocupados não são tocados.
- **Gate de distribuição:** `OPS-01A` — só fecha com health real no domínio do
  túnel, API + dashboard + Postgres/Redis + storage no acer, e serviços
  pré-existentes do PC intactos.
- **Cloud (`DEC-25`)**: continua como **evolução posterior** (Render/Vercel/
  Firebase), atrás de credenciais + pacotes `OPS-*` — nada de cloud antes do
  runtime local de distribuição estar de pé.

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
| `OPS-01A` | ✅ **2026-08-11** | **Runtime de distribuição no acer** (CF Tunnel, domínio próprio, banco em `~/Documentos/Bando_de_dados/Aqui_Log`) — no ar, com início automático | `DEC-26` ✅, `OPS-01` parcial |
| `OPS-DB-01` | ⏸️ | Desenho + migração/dual-write Postgres → Firestore | `DEC-25`, modelo de coleções, aceite do dono |
| `OPS-02` | ⏸️ | Firebase: projeto, Firestore rules, Storage, FCM; adapters reais | pedido + credenciais |
| `OPS-03` | ⏸️ | Deploy API Render + dashboard Vercel + smoke público | `OPS-01`, `OPS-02`, URL API estável |

Ordem: local estável → **runtime de distribuição no acer via CF Tunnel
(`OPS-01A` ✅ 2026-08-11)** → desenho Firestore → ligar Firebase → publicar
Render/Vercel.

## 4. Diagramas

### Fase 0 — distribuição inicial (acer, `DEC-26`)

```text
[ customer_app / courier_app ] ──HTTPS──► [ *.cursar.space — Cloudflare Tunnel ]
[ Vercel: Dashboard (futuro) ] ─────────►        │
                                                  ├── [ acer: Nest API ] (porta local)
                                                  ├── PostgreSQL  ← ~/Documentos/Bando_de_dados/Aqui_Log
                                                  ├── Redis (locks/jobs)
                                                  └── Storage local (adapter local)
```

### Fase 1 — cloud (alvo, `DEC-25`)

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
