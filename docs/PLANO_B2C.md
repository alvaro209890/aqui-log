# Plano — Aqui Log B2C (cliente direto → motoboy)

> **Status geral:** ✅ **MVP B2C funcional** (2026-08-04) — fluxo cliente → motoboy
> rodando de ponta a ponta, sem empresa no meio. Próximas fases planejadas abaixo.
> **Data de criação:** 2026-08-03 · **Última atualização:** 2026-08-04
> **Planos derivados:** `PLANO_PAGAMENTOS.md` · `PLANO_TRANSPORTADORA.md` · `PLANO_CONFIANCA_E_PRECO.md`

---

## 1. Resumo executivo

O Aqui Log deixou de ser B2B (empresa cria entrega, admin despacha) e virou
**B2C direto**: a pessoa física se cadastra sozinha, descreve a encomenda
(tipo, tamanho, peso, foto, alcance) e **o motoboy vê o pedido e decide se aceita**.

| Dimensão | Estado |
|---|---|
| Cadastro/login do cliente | ✅ auto-aprovado, auto-login |
| Pedido com encomenda (tipo/tamanho/peso/foto/alcance) | ✅ app cliente |
| Publicação para motoboys (auto-dispatch) | ✅ sem admin no meio |
| Motoboy vê a encomenda e aceita/recusa | ✅ app motoboy |
| Acompanhamento/avaliação | ✅ lista/detalhe + rating |
| Pagamento do cliente | 🟠 pendente → `PLANO_PAGAMENTOS.md` |
| Rota multi-pedido (transportadora) | ⏳ futuro → `PLANO_TRANSPORTADORA.md` |

---

## 2. Quem é quem no modelo B2C

| Papel | Descrição | Aprovação |
|---|---|---|
| **Cliente** | Pessoa física (`customers`), pede e acompanha | **Nenhuma** (auto-aprovado) |
| **Motoboy** | Executa as entregas (`couriers`) | Admin (documentos) — inalterado |
| **Admin** | Aprova motoboys, vê relatórios | — |

A empresa desaparece do fluxo de pedidos. O modelo antigo (B2B) continua
suportado no backend por compatibilidade, mas o produto novo é o B2C.

---

## 3. Fluxo ponta a ponta (implementado)

```
cliente ──cadastra──▶ POST /auth/register/customer   (auto-aprovado, devolve tokens)
cliente ──pede──────▶ POST /deliveries               (encomenda + endereços + geocode)
sistema ──publica───▶ auto-dispatch: oferta PENDING para motoboys disponíveis
                      próximos da retirada (sem motoboy → REQUESTED, redespacha)
motoboy ──vê────────▶ GET /deliveries/offers/mine    (card com a encomenda)
motoboy ──aceita────▶ PATCH /deliveries/offers/:id/accept → ACCEPTED
motoboy ──executa───▶ status: AT_PICKUP → PICKED_UP (prova) → IN_TRANSIT → DELIVERED (prova)
cliente ──avalia────▶ POST /deliveries/:id/rating
```

Estados da entrega: `REQUESTED → OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP →
IN_TRANSIT → DELIVERED` (ou `CANCELED` pelo cliente/admin).

**Preço:** calculado **sempre no servidor** (base + km + % plataforma — `PricingService`);
o app nunca envia valor.

---

## 4. O que já está implementado (matriz camada × estado)

| Camada | Item | Estado |
|---|---|---|
| **DB** | Tabela `customers` + `users.customer_id` + role `CUSTOMER` no enum | ✅ migrations `1785000000000/1` |
| **DB** | `deliveries.company_id` opcional + `deliveries.customer_id` | ✅ |
| **DB** | `ratings.company_id` opcional + `ratings.customer_id` | ✅ |
| **API** | `POST /auth/register/customer` (auto-aprovado, auto-login) | ✅ |
| **API** | `POST /deliveries` por cliente (encomenda vai no `notes`; preço server-side) | ✅ |
| **API** | **Auto-dispatch** no create (oferta direta p/ motoboys disponíveis) | ✅ |
| **API** | Cliente lista/cancela/avalia **só os próprios pedidos** | ✅ |
| **API** | JWT/WS tracking com `customerId` no payload | ✅ |
| **App cliente** | Cadastro (nome/CPF/telefone), login, 4 abas (Início/Pedir/Entregas/Perfil) | ✅ |
| **App cliente** | Pedido: tipo (7 categorias), tamanho P/M/G, peso kg, alcance, foto, destinatário | ✅ |
| **App cliente** | Lista/detalhe mostram a encomenda (com foto) | ✅ |
| **App motoboy** | Card da oferta mostra a encomenda (tipo · tamanho · peso · alcance · foto) | ✅ |
| **Core** | `OrderMeta` (encode/parse da encomenda no `notes`) em `aqui_log_core` | ✅ |
| **Qualidade** | Backend 27/27 · cliente 10/10 · motoboy 7/7 · smoke e2e verde · CI verde | ✅ |

**Detalhe da encomenda no `notes` (workaround atual):** o backend ainda não tem
colunas próprias (`weight_kg`, `product_type`, `product_photo_urls`). O app cliente
serializa os metadados num bloco estruturado dentro do campo `notes`
(→ `OrderMeta.encodeNotes`), e o app motoboy parseia (`OrderMeta.fromNotes`).
A migração para colunas próprias é transparente para os apps (Fase 1 abaixo).

---

## 5. Decisões de produto

### ✅ Decididas e aplicadas

| # | Tema | Decisão |
|---|---|---|
| 2 | Peso | Kg livre no formulário (faixas só no preço, quando houver) |
| 4 | Tipo de produto | Categorias fixas (Documento, Alimento, Eletrônico, Frágil, Roupas, Medicamento, Outro) |
| 7 | Alcance | Cliente declara: mesma cidade / outra cidade ou município |
| 10 | App do cliente | Reformular o `company_app` (não criar app novo) |
| — | Preço | Sempre calculado no servidor (sem valor vindo do app) |
| — | Despacho | Publicação automática para motoboys disponíveis (auto-dispatch) |

### 🟠 Pendentes (precisam da palavra do Álvaro)

| # | Tema | Opções | Recomendação |
|---|---|---|---|
| 1 | Preço | (a) sistema calcula sempre — estilo Uber; (b) cliente sugere valor + contra-proposta — estilo frete | **(a)** — simples, evita briga de preço |
| 3 | Foto do produto | Obrigatória / opcional / obrigatória acima de X kg | **Obrigatória** — dá confiança pro motoboy aceitar |
| 5 | Pagamento | (a) carteira interna com recarga (PIX/cartão); (b) PIX na confirmação; (c) dinheiro na entrega | **(a)** carteira com recarga — sem gateway externo na v1 (ver `PLANO_PAGAMENTOS.md`) |
| 6 | Oferta sem aceite | Re-ofertar / subir valor / avisar cliente | **Avisar o cliente** na v1 |
| 8 | Validação de telefone | 100% automático / código SMS | **SMS** pra reduzir lixo (ver `PLANO_CONFIANCA_E_PRECO.md`) |
| 9 | Avaliação | Só cliente avalia / **mútua** | **Mútua** — protege os dois lados |

---

## 6. Próximas fases (priorizadas)

| Prio | Fase | Entrega | Esforço | Doc |
|---|---|---|---|---|
| 1 | **Encomenda no backend** | Colunas `weight_kg`/`product_type`/`product_photo_urls` + foto obrigatória | Médio | `PLANO_CONFIANCA_E_PRECO.md` §2 |
| 2 | **Preço por faixa** | Peso/tamanho somam R$ no preço; aumento automático se ninguém aceitar | Médio | `PLANO_CONFIANCA_E_PRECO.md` §1 |
| 3 | **Avaliação mútua** | `ratings.from_role` (cliente ↔ motoboy) | Baixo | `PLANO_CONFIANCA_E_PRECO.md` §4 |
| 4 | **Validação SMS** | Código no cadastro (provedor a definir) | Médio | `PLANO_CONFIANCA_E_PRECO.md` §3 |
| 5 | **Carteira do cliente** | Reserva/estorno, depois PIX via gateway | Médio-Alto | `PLANO_PAGAMENTOS.md` |
| 6 | **Transportadora** | Rota multi-pedido por proximidade (origem/destino próximos) | Alto | `PLANO_TRANSPORTADORA.md` |
| 7 | **Dashboard** | Gestão de clientes + relatórios por categoria/peso | Baixo | — |

Regra de ouro: **nada de cloud** (Render/Vercel/Firebase) sem pedido explícito.

---

## 7. Riscos e limitações conhecidas

| Limitação | Impacto | Mitigação |
|---|---|---|
| Encomenda no `notes` (sem colunas próprias) | Relatórios/consultas por categoria não existem | Fase 1 (colunas) é a prioridade |
| Foto opcional no app | Motoboy aceita sem ver o produto | Fase 1 torna obrigatória |
| Sem pagamento | Ninguém paga nada ainda | `PLANO_PAGAMENTOS.md` |
| Despacho por "motoboy mais próximo" (1 oferta por vez) | Sem concorrência de ofertas visíveis | Aceite/recusa já existe; anéis de raio futuros |
| Sem validação de telefone | Contas lixo possíveis | `PLANO_CONFIANCA_E_PRECO.md` §3 |
| Empresas ainda existem no backend | Dois modelos convivendo | B2B fica como legado; produto é B2C |

---

## 8. Como rodar e testar

```bash
cd /home/acer/Documentos/aqui-log
# infra (Postgres :5433, Redis :6379) — já rodando neste PC
pnpm install
pnpm db:migrate && pnpm db:admin
pnpm build && pnpm test          # backend
pnpm smoke                        # e2e: empresa + motoboy (B2B legado segue verde)
# apps
cd apps/company_app && flutter analyze && flutter test
cd ../courier_app  && flutter analyze && flutter test
# APK do cliente (release, arm64):
cd apps/company_app && flutter build apk --release --target-platform android-arm64
```

**Fluxo B2C manual (curl):**

```bash
# 1. cliente se cadastra (auto-aprovado, já loga)
curl -X POST localhost:3001/api/v1/auth/register/customer -H 'Content-Type: application/json' \
  -d '{"name":"Maria","email":"m@x.com","password":"TesteSeguro123!","document":"12345678909","phone":"+5566999999999"}'
# 2. motoboy: registrar + admin aprovar + localização + disponível
# 3. cliente cria pedido → status OFFERED (auto-dispatch) se houver motoboy online
# 4. motoboy: GET /deliveries/offers/mine → vê a encomenda → PATCH .../accept → ACCEPTED
```

---

## 9. O que NÃO muda (herdado do B2B)

- Motoboy com aprovação admin e documentos
- GPS ao vivo + foto de prova na coleta/entrega
- Carteira/extrato do motoboy
- Dashboard, relatórios, auditoria
- Stack e infra (NestJS/React/Flutter, Postgres/Redis, local primeiro, cloud depois)

---

## 10. Fora de escopo (por enquanto)

- Gateway de pagamento externo real (PIX/cartão processado)
- Agendamento avançado, rotas multi-parada, IA
- Entregas para empresas (se voltar, entra como "cliente tipo empresa")
