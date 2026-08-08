# Plano — Aqui Log B2C (cliente direto → motoboy)

> **Status geral:** ✅ **MVP B2C funcional** (2026-08-04) — fluxo cliente → motoboy
> rodando de ponta a ponta, sem empresa no meio. Próximas fases planejadas abaixo.
> **Data de criação:** 2026-08-03 · **Última atualização:** 2026-08-07
> **Planos derivados:** `PLANO_PAGAMENTOS.md` · `PLANO_LOTE_MULTI_PEDIDO.md` · `PLANO_CONFIANCA_E_PRECO.md`
> **Prioridade e ordem de execução:** `ROADMAP.md` é a fonte de verdade; este documento descreve o domínio e o estado funcional.

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
| Rota multi-pedido (lote) | ⏳ futuro → `PLANO_LOTE_MULTI_PEDIDO.md` |

---

## 2. Quem é quem no modelo B2C

| Papel | Descrição | Aprovação |
|---|---|---|
| **Cliente** | Pessoa física (`customers`), pede e acompanha | **Nenhuma** (auto-aprovado) |
| **Motoboy** | Executa as entregas (`couriers`) | Admin (documentos) — inalterado |
| **Admin** | Aprova motoboys, vê relatórios | — |

A empresa foi **removida** do produto (2026-08-07): código, rotas e colunas B2B
não existem mais no backend. O produto é o B2C com três perfis: prestador, cliente e admin.

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
| **DB/API** | Campos próprios de encomenda + migration aditiva `1785100000000` | ✅ código/testes; aplicação em banco pendente |
| **API** | `POST /deliveries` por cliente (campos próprios; `notes` livre; preço server-side) | ✅ |
| **API** | **Auto-dispatch** no create (oferta direta p/ motoboys disponíveis) | ✅ |
| **API** | Cliente lista/cancela/avalia **só os próprios pedidos** | ✅ |
| **API** | JWT/WS tracking com `customerId` no payload | ✅ |
| **App cliente** | Cadastro (nome/CPF/telefone), login, 4 abas (Início/Pedir/Entregas/Perfil) | ✅ |
| **App cliente** | Pedido: tipo (7 categorias), tamanho P/M/G, peso kg, alcance, foto, destinatário | ✅ |
| **App cliente** | Lista/detalhe mostram a encomenda (com foto) | ✅ |
| **App motoboy** | Card da oferta mostra a encomenda (tipo · tamanho · peso · alcance · foto) | ✅ |
| **Core** | `OrderMeta` lê campos próprios e mantém encode/parse de `notes` legado | ✅ |
| **UI mobile** | Tokens laranja compartilhados e status com cores semânticas | ✅ |
| **Qualidade desta entrega** | Backend 32/32 · core 6/6 · UI 2/2 · cliente 10/10 · motoboy 7/7 | ✅ testes locais |

**Compatibilidade:** pedidos novos enviam `productType`, `packageSize`, `weightKg`,
`deliveryScope` e `productPhotoUrls`; `notes` é observação livre. Pedidos antigos
continuam legíveis por `OrderMeta.fromNotes`, sem backfill textual arriscado.

---

## 5. Decisões de produto

### ✅ Decididas e aplicadas

| # | Tema | Decisão |
|---|---|---|
| 2 | Peso | Kg livre no formulário (faixas só no preço, quando houver) |
| 4 | Tipo de produto | Categorias fixas (Documento, Alimento, Eletrônico, Frágil, Roupas, Medicamento, Outro) |
| 7 | Alcance | Cliente declara: mesma cidade / outra cidade ou município |
| 10 | App do cliente | Reformular o `customer_app` (não criar app novo) |
| — | Preço | Sempre calculado no servidor (sem valor vindo do app) |
| — | Despacho | Publicação automática para motoboys disponíveis (auto-dispatch) |

### 🟠 Pendentes (gates do roadmap)

| Gate | Tema | Recomendação | Consequência |
|---|---|---|---|
| `DEC-01` | Foto do produto | Obrigatória antes de publicar oferta; feature flag desligada durante a migração | Não bloqueia schema aditivo, bloqueia ativação da regra |
| `DEC-02` | Faixas de peso/tamanho | Configuração server-side versionada; valores definidos com dados do piloto | Estrutura pode avançar, valores finais não |
| `DEC-03` | Oferta sem aceite | Ampliar raio com limite, avisar cliente e pedir consentimento para aumento | Bloqueia a estratégia de reoferta |
| `DEC-04` | Validação de telefone | Código SMS com provider adapter, TTL e rate limit | Gate para cadastro público em produção |
| `DEC-05/06` | Carteira e gateway | Provar ledger interno antes de escolher/ligar PIX | Nenhuma cobrança real antes dos gates |
| `DEC-07` | Rota compartilhada | Opt-in no primeiro piloto e somente após medir densidade | Bloqueia piloto multi-pedido, não o MVP simples |
| `DEC-08/09/10/11` | Lote multi-pedido e blocos agendados intermunicipais | Motoboy aceita vários pedidos juntos com lógica anti-atraso; decisões detalhadas em `PLANO_LOTE_MULTI_PEDIDO.md` §12 | Define `LOT-01/02` |
| `DEC-12` | Mapa de frota no dashboard | Exposição de posição só em viagem ativa, retenção e LGPD | Define `FROTA-01` |

---

## 6. Próximas fases (ordem subordinada ao roadmap)

| Ordem | ID | Entrega vertical | Gate/Dependência | Doc |
|---|---|---|---|---|
| 1 | `B2C-01B` | Gestão de clientes e relatórios por categoria/tamanho/peso | `B2C-01` entregue | `ROADMAP.md` |
| 3 | `B2C-02` | Preço v2 com breakdown/versionamento e prévia | `B2C-01`, `DEC-02` para valores finais | `PLANO_CONFIANCA_E_PRECO.md` §3 |
| 4 | `B2C-03` | Avaliação mútua por papel | migração de ratings legados | `PLANO_CONFIANCA_E_PRECO.md` §4 |
| 5 | `DISP-01/03` | Reoferta por anéis, aviso e telemetria | `B2C-02`, `DEC-03` | `PLANO_CONFIANCA_E_PRECO.md` §6 |
| 6 | `PAY-01` | Ledger interno, reserva e estorno, sem gateway | autorização explícita + preço v2 | `PLANO_PAGAMENTOS.md` |
| 7 | `B2C-04` | Validação SMS | provedor/sandbox | `PLANO_CONFIANCA_E_PRECO.md` §5 |
| 8 | `OPS-*` | Endurecimento e eventual publicação | gates operacionais + pedido explícito | `ROADMAP.md` |
| 9 | `TRIP-00` | Medir viabilidade do agrupamento automático de pedidos | telemetria e operação estável | `PLANO_LOTE_MULTI_PEDIDO.md` |
| 10 | `LOT-01/02` | **Lote multi-pedido pelo motoboy** (aceite de vários juntos, blocos agendados intermunicipais) e anti-atraso | decisão do dono 2026-08-07; sem código ainda | `PLANO_LOTE_MULTI_PEDIDO.md` |
| 11 | `FROTA-01/02` | **Dashboard monitora frota**: localização dos prestadores, coleta recolhida ou não, trajeto em viagem | decisão do dono 2026-08-07; sem código ainda | `PLANO_FROTA_DASHBOARD.md` |
| 12 | `ADMIN-01..07` | **Painel admin com controle máximo**: pedidos, motoboys, clientes, lotes, financeiro, configurações | decisão do dono 2026-08-07; sem código ainda | `PLANO_ADMIN.md` |
| 13 | `SUP-01..05` | **Suporte/reclamações**: dossiê automático, auto-resolução, juiz rápido, nota de confiança | decisão do dono 2026-08-07; sem código ainda | `PLANO_SUPORTE_RECLAMACOES.md` |
| — | Guia didático | Lógica do app ponta a ponta explicada | pronto (doc) | `FLUXO_APP.md` |

Trilha paralela, quando autorizada: `UX-01/02`, identidade laranja e QA visual conforme `DIRETRIZES_VISUAIS.md`.

Regra de ouro: **nada de cloud, gateway ou rota multi-pedido operacional** sem cumprir o gate correspondente no `ROADMAP.md`.

---

## 7. Riscos e limitações conhecidas

| Limitação | Impacto | Mitigação |
|---|---|---|
| Dashboard ainda não usa os campos próprios | Relatórios/consultas por categoria não existem | `B2C-01B` é a prioridade |
| Foto opcional no app | Motoboy aceita sem ver o produto | Feature flag na Fase 1; ativar obrigatoriedade após `DEC-01` |
| Sem pagamento | Ninguém paga nada ainda | `PLANO_PAGAMENTOS.md` |
| Despacho por "motoboy mais próximo" (1 oferta por vez) | Sem concorrência de ofertas visíveis | Aceite/recusa já existe; anéis de raio futuros |
| Sem validação de telefone | Contas lixo possíveis | `PLANO_CONFIANCA_E_PRECO.md` §5 |
| Modelo empresa/B2B removido | — | Limpeza concluída em 2026-08-07 (migration `RemoveCompanyModel`); só existem prestador, cliente e admin |

---

## 8. Como rodar e testar

```bash
cd /home/acer/Documentos/aqui-log
# infra (Postgres :5433, Redis :6379) — já rodando neste PC
pnpm install
pnpm db:migrate && pnpm db:admin
pnpm build && pnpm test          # backend
pnpm smoke                        # e2e: cliente + motoboy (fluxo B2C)
# apps
cd apps/customer_app && flutter analyze && flutter test
cd ../courier_app  && flutter analyze && flutter test
# APK do cliente (release, arm64):
cd apps/customer_app && flutter build apk --release --target-platform android-arm64
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
- Agendamento avançado, rotas multi-parada, IA — em design: lote multi-pedido e blocos agendados em `PLANO_LOTE_MULTI_PEDIDO.md`; monitoramento de frota em `PLANO_FROTA_DASHBOARD.md`; painel admin em `PLANO_ADMIN.md`; suporte/reclamações em `PLANO_SUPORTE_RECLAMACOES.md` (sem código nesta rodada)
- Entregas para empresas (se voltar, entra como "cliente tipo empresa")
