# Plano — Aqui Log B2C (cliente direto → motoboy)

> **Status:** PROPOSTA — nada desenvolvido
> **Data:** 2026-08-03
> **Mudança:** remover o modelo de empresas; o cliente final solicita a entrega (peso, tipo de produto, foto) e o motoboy escolhe se aceita.

---

## 1. Objetivo

Hoje o Aqui Log é B2B: a **empresa** cria entregas e um **despacho automático** escolhe motoboy por proximidade.

O novo modelo é **B2C direto**:

- O **cliente** (pessoa física) pede uma entrega informando **peso, tipo de produto e foto**.
- A oferta aparece para os motoboys; **cada motoboy decide se aceita ou recusa**.
- Sem empresa intermediária, sem despacho automático forçado.

---

## 2. Quem é quem no modelo novo

| Papel | Antes | Depois |
|---|---|---|
| Quem pede | Empresa (CNPJ, aprovação admin) | **Cliente** pessoa física (cadastro simples, sem aprovação) |
| Quem entrega | Entregador (courier) | **Motoboy** (courier — continua com aprovação admin) |
| Quem controla | Admin | Admin (continua: aprovar motoboys, bloquear clientes, relatórios) |

A empresa desaparece como entidade. Vira **cliente** (`customers`).

---

## 3. Fluxo novo de ponta a ponta

1. **Cliente cadastra** (nome, telefone, CPF) — sem fila de aprovação, já opera.
2. **Cliente cria o pedido:**
   - Endereço de retirada e de entrega (com mapa)
   - Destinatário (nome + telefone)
   - **Peso** (kg)
   - **Tipo de produto** (categoria)
   - **Foto do produto/pacote** (obrigatória ou opcional — decisão)
   - Observações
3. **Sistema calcula o valor** da corrida (distância + base + ajuste por peso/faixa) — decisão pendente: preço automático ou sugestão do cliente (ver §5).
4. **Oferta publicada** para motoboys disponíveis próximos da retirada (mapa + lista).
5. **Motoboy aceita ou recusa.** Se recusa, a oferta continua viva para os outros. Se ninguém aceita em X minutos, o sistema pode re-ofertar, aumentar o valor (decisão) ou avisar o cliente.
6. **Execução:** motoboy vai à retirada → coleta → entrega, com GPS ao vivo pro cliente acompanhar.
7. **Prova:** foto na coleta e/ou na entrega (assinatura/recebimento).
8. **Pagamento:** cliente paga; motoboy recebe (ver §5).
9. **Avaliação mútua:** cliente avalia o motoboy e motoboy avalia o cliente.

---

## 4. O que muda em cada camada (referência p/ quando desenvolver)

### Banco de dados
- `companies` → **`customers`** (sem CNPJ/aprovação; CPF, telefone).
- `deliveries` ganha: `weight_kg`, `product_type` (enum), `product_photo_urls` (1+).
- `deliveries.company_id` vira `customer_id`.
- `users` da empresa deixam de existir (cliente é uma pessoa só).
- Carteira: continua, mas agora precisa de **entrada de dinheiro** do cliente (ver §5).

### API
- `POST /auth/register/company` → `POST /auth/register/customer` (auto-aprovado).
- `POST /deliveries` muda: campos novos (peso, tipo, fotos), cria pra cliente.
- Oferta: deixa de ser "despacho forçado com lock" → vira **convite visível** que o motoboy aceita/recusa (`accept`/`reject` continuam, mas sem disputa automática; recusa não re-despacha forçado, apenas mantém a oferta viva).
- `POST /deliveries/:id/rating` → avaliação **nos dois sentidos**.
- Rotas de admin: listar/bloquear clientes; empresas saem do dashboard.

### App empresa → **App cliente**
- O `company_app` é reformulado: cadastro de cliente, tela de novo pedido (mapa, peso, tipo, foto, destinatário), acompanhamento da corrida em tempo real, histórico, carteira/pagamento.
- Renomear mentalmente: "app empresa" vira "app cliente".

### App motoboy (courier_app)
- Tela de **ofertas disponíveis** (mapa + cards com peso, tipo, foto, valor, distância).
- Botão aceitar/recusar em cada oferta.
- Resto (GPS, prova, carteira) já existe e continua.

### Dashboard admin
- Substituir gestão de empresas por gestão de **clientes** (bloqueio/reativação).
- Relatórios: entregas por categoria de produto, peso médio, valor médio.
- KPIs atuais continuam válidos.

---

## 5. Decisões pendentes (preciso da sua palavra)

| # | Tema | Opções | Recomendação |
|---|---|---|---|
| 1 | **Preço** | (a) Sistema calcula sempre (km + peso) e motoboy só aceita/recusa — estilo Uber; (b) Cliente sugere um valor e motoboy aceita/recusa/contra-propõe — estilo frete | **(a)** pra começar: simples, evita briga de preço; motoboy pode recusar se achar pouco |
| 2 | **Peso** | Faixas (ex: até 2kg / 2–7kg / 7–15kg / 15kg+) que somam R$ no preço | **Faixas** — pesagem exata é fricção pro cliente |
| 3 | **Foto** | Obrigatória sempre / opcional / obrigatória só acima de X kg | **Obrigatória** — é o que dá confiança pro motoboy aceitar |
| 4 | **Tipo de produto** | Categorias fixas (documento, alimento, eletrônico, frágil, outro) | **Categorias fixas** + campo "outro" |
| 5 | **Pagamento do cliente** | (a) Carteira interna com recarga (PIX/cartão) antes de pedir; (b) PIX/cartão na confirmação; (c) pagar na entrega em dinheiro | **(a)** carteira com recarga — já temos estrutura de carteira; sem gateway externo por enquanto |
| 6 | **Oferta sem aceite** | Oferecer de novo até vencer / subir o valor automaticamente / avisar cliente pra aumentar | **Avisar o cliente** na 1ª versão; subir valor fica pra depois |
| 7 | **Ninguém aceita** | Cancelar com aviso / re-oferecer com outro raio | **Re-oferecer com raio maior** uma vez, depois cancelar |
| 8 | **Cadastro de cliente** | 100% automático (só CPF+telefone) / exige validação de telefone | **Validação de telefone** (código SMS) pra reduzir lixo |
| 9 | **Avaliação** | Só cliente avalia motoboy / avaliação mútua | **Mútua** (protege os dois lados) |
| 10 | **App do cliente** | Reformular `company_app` / criar app novo | **Reformular** o company_app — menos trabalho, mesma base |

---

## 6. Fases (quando aprovar o plano)

| Fase | Entrega | Esforço relativo |
|---|---|---|
| 0 | Fechar as 10 decisões da §5 | — (só conversa) |
| 1 | Banco + API: customers, campos de peso/tipo/foto, oferta por aceite, avaliação mútua | Médio |
| 2 | App cliente (reformular company_app) | Alto |
| 3 | App motoboy: tela de ofertas com aceite/recusa | Médio |
| 4 | Dashboard: clientes no lugar de empresas, relatórios novos | Baixo |
| 5 | Smoke/CI verdes + docs (HANDOFF/ROADMAP/MVP_COVERAGE) | Baixo |

## 7. O que NÃO muda

- Motoboy (courier) com aprovação admin e documentos
- GPS ao vivo + foto de prova na entrega
- Carteira/extrato
- Dashboard, relatórios, auditoria
- Stack e infra (NestJS/React/Flutter, local primeiro, cloud depois)

---

## 8. Fora de escopo (por enquanto)

- Gateway de pagamento externo real (PIX/cartão processado) — só recarga interna
- Agendamento avançado, rotas multi-parada, IA
- Entregas para empresas (se voltar, entra como "cliente tipo empresa" depois)

---

## 9. Status 2026-08-04 — Fase App Cliente (front) ✅

**Implementado (commit B2C):** front do app cliente reformulado em `apps/company_app`
(re-branding "Aqui Log Cliente", package id `br.com.aquilog.aqui_log_cliente`):

| Item | Situação |
| --- | --- |
| Tela **Novo pedido** (`new_order_screen.dart`) | Tipo de encomenda (7 categorias), tamanho P/M/G (até 30/60/60+ cm), **peso em kg**, **alcance** (mesma cidade / outra cidade ou município), **foto do produto** (câmera/galeria via image_picker, upload no storage), retirada/entrega com geocode, destinatário, observações |
| Abas do app | Início · Pedir · Entregas · Perfil |
| Home | Card "Fazer pedido" + resumo (em andamento/concluídas) + pedidos recentes |
| Lista/detalhe | Mostra **Encomenda** (tipo · tamanho · peso · alcance · foto) parseada do `notes` |
| Login | **Cadastro de cliente funcional** (nome/CPF/telefone) — auto-aprovado e auto-login |

**Estratégia front-only:** como o backend ainda não tem colunas de encomenda, o app
serializa os metadados num bloco estruturado dentro do campo `notes` (formato em
`apps/company_app/lib/order_meta.dart` — `encodeNotes`/`fromNotes`). O motoboy vê o
texto completo na oferta; quando a Fase 1 do backend sair, a migração é transparente.

**Decisões aplicadas (§5):** #2 peso em kg livre (não faixas) · #4 categorias fixas +
"Outro" · #7 alcance declarado pelo cliente (intra/intermunicipal) · #10 reformular
company_app (feito). **Ainda pendentes:** #1 preço, #3 foto obrigatória?, #5 pagamento,
#6 oferta sem aceite, #8 validação de telefone, #9 avaliação mútua.

**Testes:** `flutter analyze` limpo; `flutter test` 9/9 verdes (inclui round-trip do
`OrderMeta`). **APK release** em `apps/company_app/build/app/outputs/flutter-apk/app-release.apk`.

**Falta (próximas fases, com pedido):**
- Fase 1 backend: `customers`, colunas `weight_kg`/`product_type`/`product_photo_urls`, oferta por aceite (sem lock forçado), avaliação mútua, registro cliente auto-aprovado
- App motoboy: card de oferta com tipo/tamanho/peso/foto em destaque
- Dashboard: gestão de clientes no lugar de empresas + relatórios por categoria/peso

---

## 10. Status 2026-08-04 (2ª rodada) — B2C funcional ponta a ponta ✅

**Backend agora suporta o fluxo B2C real — sem empresa no meio:**

| Item | Implementado |
| --- | --- |
| `POST /auth/register/customer` | Cadastro pessoa física (nome/email/senha/CPF/telefone), **auto-aprovado**, devolve tokens (auto-login) |
| Role `CUSTOMER` + entidade `customers` | Enum `users_role_enum` ganhou `CUSTOMER`; `users.customer_id`; nova tabela `customers` |
| `POST /deliveries` por cliente | `deliveries.company_id` virou opcional; novo `customer_id`; preço continua server-side |
| **Auto-dispatch** | Pedido do cliente é **publicado automaticamente** para motoboys disponíveis próximos (sem admin no meio); sem motoboy → fica REQUESTED e redespacha quando houver |
| Listagem/detalhe | Cliente vê só os próprios pedidos; cancelar o próprio pedido permitido |
| Avaliação | Cliente avalia o motoboy (ratings com `customer_id`) |
| App cliente | Login + **cadastro** ("Criar conta de cliente"), formulário de pedido com encomenda |
| App motoboy | Card da oferta mostra **encomenda** (tipo · tamanho · peso · alcance · foto) |
| `OrderMeta` | Movido para `packages/aqui_log_core` (compartilhado pelos 2 apps) |

**Validado ao vivo (API local, Postgres+Redis):**
`register customer → create delivery (encomenda no notes) → auto-dispatch (OFFERED) →
offers/mine do motoboy mostra a encomenda → accept → ACCEPTED`.
Smoke e2e (fluxo B2B antigo) continua verde — nada quebrado.
Testes: backend 27/27 · app cliente 10/10 · app motoboy 7/7 · analyze limpo nos 3.

**Próximas fases (com pedido):** colunas próprias de encomenda no backend,
pagamentos (`docs/PLANO_PAGAMENTOS.md`), transportadora multi-pedido
(`docs/PLANO_TRANSPORTADORA.md`), confiança/preço (`docs/PLANO_CONFIANCA_E_PRECO.md`).
