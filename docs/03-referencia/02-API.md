# API (Sprint 1)

Base local: `http://localhost:3001/api/v1`

Swagger: `http://localhost:3001/docs`

Timezone operacional: **`America/Sao_Paulo`** (trends, “dia local”, jobs).

Rotas protegidas: `Authorization: Bearer <accessToken>`

## Autenticacao e cadastros

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST` | `/auth/register/customer` | Cliente pessoa física, auto-aprovado, devolve tokens |
| `POST` | `/auth/register/courier` | Entregador, veiculo e URLs de documentos pendentes |
| `POST` | `/auth/login` | Access + **refresh** token |
| `POST` | `/auth/refresh` | Troca refresh valido por novo par (refresh antigo revogado) |
| `POST` | `/auth/logout` | Revoga refresh token |
| `POST` | `/auth/forgot-password` | Sempre 200; em local o token vai no log do backend |
| `POST` | `/auth/reset-password` | Body `{ token, password }` |
| `GET` | `/auth/me` | Contexto autenticado |
| `GET` | `/users` | Lista administrativa (somente admin) |
| `GET` | `/couriers` | Lista administrativa |
| `PATCH` | `/couriers/:id/approve` | Aprova entregador |
| `PATCH` | `/couriers/me/availability` | Disponibilidade do entregador |
| `PATCH` | `/couriers/me/location` | Ultima coordenada conhecida |

## Entregas

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST/GET` | `/deliveries` | Cria ou lista conforme o perfil |

### Query params de `GET /deliveries`

| Param | Uso |
| --- | --- |
| `status` | Status da entrega |
| `courier` | UUID do motoboy |
| `date` | Dia de criação (`YYYY-MM-DD`) |
| `productType` | Categoria B2C (`DOCUMENT`, `FOOD`, …). Valor inválido → `400`. Pedidos legados sem categoria **não** entram no filtro. |
| `packageSize` | Tamanho B2C (`SMALL`, `MEDIUM`, `LARGE`). Valor inválido → `400`. Legado sem tamanho **não** entra. |
| `weightMin`, `weightMax` | Faixa de peso inclusiva em kg (`>= 0`). Inválido ou min>max → `400`. Legado sem peso **não** entra. Fatias `B2C-01B`. |
| `customerId` | UUID do cliente. Formato inválido → `400`. Aplicado só a `SUPER_ADMIN`/`ADMIN`/`SUPPORT` (outros papéis ignoram o param e seguem o escopo do token). Pedido sem `customer_id` **não** entra. Fatia `B2C-01B`. |
| `page`, `limit` | Paginação |

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST` | `/deliveries/:id/dispatch` | Despacho automatico por proximidade |
| `PATCH` | `/deliveries/:id/assign` | Despacho manual administrativo |
| `GET` | `/deliveries/offers/mine` | Ofertas pendentes do entregador |
| `PATCH` | `/deliveries/offers/:offerId/accept` | Aceita (com **lock Redis**) |
| `PATCH` | `/deliveries/offers/:offerId/reject` | Recusa e devolve ao despacho |
| `PATCH` | `/deliveries/:id/status` | Avanca estado ou cancela (cliente/admin). Entregador **nao** cancela por aqui. |
| `POST` | `/deliveries/:id/courier-cancel` | COUR-02: prestador desiste (`ACCEPTED`, dentro do cutoff); debita taxa congelada; pedido volta a `REQUESTED` e redespacha |
| `GET` | `/deliveries/:id/history` | Historico cronologico |
| `POST` | `/deliveries/:id/rating` | Avaliação da entrega pelo cliente |
| `GET` | `/deliveries/ratings` | Lista de avaliacoes (admin) |

`POST /deliveries` calcula **priceCents** e **courierFeeCents** no servidor.
Campos de preco no body sao **ignorados**.

### Preço v2 (`B2C-02`, desde 2026-08-08)

```text
subtotal = base + km × tarifa_do_modo + adicional_peso + adicional_tamanho
preço    = max(mínimo, subtotal)
plataforma = preço × %;  prestador = preço − plataforma
```

A resposta traz `pricingVersion` (hoje `2`), `fulfillmentMode` e
`pricingBreakdown` — a regra e os **valores usados** ficam congelados no pedido,
então mudar as configurações **não** altera pedido já criado (`DEC-19`).
Pedido anterior ao v2 tem `pricingVersion: null` e continua legível.

Campos do `pricingBreakdown`: `version`, `fulfillmentMode`, `distanceKm`,
`kmRateCents`, `baseFeeCents`, `distanceCents`, `weightKg`, `weightBandUpToKg`,
`weightSurchargeCents`, `packageSize`, `sizeSurchargeCents`, `subtotalCents`,
`minFeeCents`, `minFeeApplied` e `platformFeePercent`.

Todos os valores vêm de `GET/PATCH /settings` (admin) e são editáveis sem
deploy. `PATCH /settings` recusa com `400` se a tarifa/km do imediato não for
**estritamente maior** que a do agendado (`DEC-19`) ou se duas faixas de peso
repetirem o mesmo `upToKg`.

### Encomenda estruturada (`B2C-01`, obrigatória desde `B2C-05`)

Desde `B2C-05` (`DEC-01`/`DEC-18`, 2026-08-08) a descrição da encomenda é
**obrigatória na criação**. `notes` continua sendo somente observação livre;
pedidos antigos que guardam a encomenda em `notes` continuam legíveis nos apps
e no dashboard — a obrigatoriedade vale para **criação**, nunca para leitura.

| Campo JSON | Obrigatório | Tipo/regra |
| --- | --- | --- |
| `pickupAddress` / `deliveryAddress` | sim | texto não vazio (espaços são aparados), até 500 caracteres |
| `pickupLatitude`/`Longitude`, `deliveryLatitude`/`Longitude` | sim | coordenadas válidas |
| `recipientName` | sim | texto não vazio, até 200 caracteres |
| `recipientPhone` | sim | telefone BR |
| `productType` | sim | `DOCUMENT`, `FOOD`, `ELECTRONICS`, `FRAGILE`, `CLOTHING`, `MEDICINE` ou `OTHER` |
| `packageSize` | sim | `SMALL`, `MEDIUM` ou `LARGE` |
| `weightKg` | sim | numero maior que zero e menor ou igual a `1000`, com ate 3 casas decimais |
| `productPhotoUrls` | sim | array com 1 a 3 URLs, sem repeticoes, emitidas pelo storage do Aqui Log |
| `deliveryScope` | não | `SAME_CITY` ou `OTHER_CITY` |
| `notes` | não | texto livre, com no maximo 1000 caracteres |

Faltando qualquer obrigatório, a API responde `400` com mensagens em português
no array `message` — por exemplo `Envie ao menos uma foto da encomenda`,
`Informe o tipo da encomenda`, `Informe o peso da encomenda em kg`. Uma URL de
foto fora do storage da plataforma também é recusada com `400`
(`productPhotoUrl deve apontar para o storage da plataforma`).

Para foto de produto, `POST /storage/presign` aceita `purpose: "product"`. Essa finalidade e distinta das provas de coleta e entrega.

Ofertas expiram em `OFFER_TTL_SECONDS` (default 120). Job a cada 10s expira e tenta re-despacho. Entregas com `scheduledAt` vencido sao despachadas pelo mesmo job.

`PICKED_UP` e `DELIVERED` exigem `proofUrl`.

## Dashboard e operacao

| Metodo | Rota | Uso |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | KPIs |
| `GET` | `/dashboard/trends` | Metricas com variacao % (dia local SP) |
| `GET` | `/dashboard/charts/deliveries-by-hour` | Serie horaria |
| `GET` | `/dashboard/charts/deliveries-by-status` | Por status |
| `GET` | `/dashboard/performance` | Score 0–100 |
| `GET` | `/finance/summary` | Receita, custo e margem |
| `GET` | `/finance/statement` | Saldo e extrato do entregador |
| `GET` | `/notifications` | Caixa do usuario |
| `PATCH` | `/notifications/:id/read` | Marca leitura |
| `GET` | `/audit` | Auditoria administrativa |
| `GET` | `/health` | `{ status, timezone, checks: { db, redis } }` |

## Tempo real

Namespace Socket.IO: `/tracking`.

1. Conecte com `auth: { token: '<jwt>' }`.
2. Cliente/admin envia `delivery:watch` com `{ deliveryId }`.
3. Entregador vinculado envia `courier:location` com `{ deliveryId, latitude, longitude }`.
4. Observadores recebem `delivery:location`.

## Precificacao (env)

Estes são apenas os **defaults de boot**: uma vez salvos pelo admin, os valores
vivem em Redis e o env deixa de mandar. As faixas de peso e os adicionais de
tamanho só existem em settings (não têm env).

| Variavel | Default | Significado |
| --- | --- | --- |
| `PRICING_BASE_FEE_CENTS` | 700 | Taxa base |
| `PRICING_MIN_FEE_CENTS` | 900 | Piso |
| `PRICING_PLATFORM_FEE_PERCENT` | 20 | % da plataforma sobre o total |
| `PRICING_PER_KM_CENTS` | 250 | Legado v1; fallback sem tarifa por modo |
| `PRICING_PER_KM_IMMEDIATE_CENTS` | 250 | Por km no modo imediato (`DEC-19`: > agendado) |
| `PRICING_PER_KM_SCHEDULED_CENTS` | 180 | Por km no modo agendado |
| `PRICING_ABOVE_TOP_BAND_CENTS` | 1500 | Adicional acima da última faixa de peso |
| `COURIER_CANCEL_FEE_CENTS` | 300 | Multa do prestador (ainda **não** cobrada) |
| `CUSTOMER_CANCEL_FEE_CENTS` | 0 | Multa do cliente (ainda **não** cobrada) |
| `COURIER_CANCEL_CUTOFF_IMMEDIATE` | 5 | Cutoff em minutos (imediato) |
| `COURIER_CANCEL_CUTOFF_SCHEDULED` | 60 | Cutoff em minutos (agendado) |
| `OFFER_TTL_SECONDS` | 120 | Validade da oferta |
| `REDIS_URL` | redis://localhost:6379 | Locks e jobs |
| `JWT_REFRESH_EXPIRES_DAYS` | 30 | Validade do refresh |
| `APP_TIMEZONE` | America/Sao_Paulo | Dia local |
