# API (Sprint 1)

Base local: `http://localhost:3001/api/v1`

Swagger: `http://localhost:3001/docs`

Timezone operacional: **`America/Sao_Paulo`** (trends, “dia local”, jobs).

Rotas protegidas: `Authorization: Bearer <accessToken>`

## Autenticacao e cadastros

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST` | `/auth/register/company` | Empresa e proprietario pendentes |
| `POST` | `/auth/register/courier` | Entregador, veiculo e URLs de documentos pendentes |
| `POST` | `/auth/login` | Access + **refresh** token |
| `POST` | `/auth/refresh` | Troca refresh valido por novo par (refresh antigo revogado) |
| `POST` | `/auth/logout` | Revoga refresh token |
| `POST` | `/auth/forgot-password` | Sempre 200; em local o token vai no log do backend |
| `POST` | `/auth/reset-password` | Body `{ token, password }` |
| `GET` | `/auth/me` | Contexto autenticado |
| `GET/POST` | `/users` | Lista/cria usuarios da empresa |
| `GET` | `/companies` | Lista administrativa |
| `PATCH` | `/companies/:id/approve` | Aprova empresa e usuarios |
| `GET` | `/couriers` | Lista administrativa |
| `PATCH` | `/couriers/:id/approve` | Aprova entregador |
| `PATCH` | `/couriers/me/availability` | Disponibilidade do entregador |
| `PATCH` | `/couriers/me/location` | Ultima coordenada conhecida |

## Entregas

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST/GET` | `/deliveries` | Cria ou lista conforme o perfil |
| `POST` | `/deliveries/:id/dispatch` | Despacho automatico por proximidade |
| `PATCH` | `/deliveries/:id/assign` | Despacho manual administrativo |
| `GET` | `/deliveries/offers/mine` | Ofertas pendentes do entregador |
| `PATCH` | `/deliveries/offers/:offerId/accept` | Aceita (com **lock Redis**) |
| `PATCH` | `/deliveries/offers/:offerId/reject` | Recusa e devolve ao despacho |
| `PATCH` | `/deliveries/:id/status` | Avanca estado ou cancela |
| `GET` | `/deliveries/:id/history` | Historico cronologico |
| `POST` | `/deliveries/:id/rating` | Avaliacao pela empresa |
| `GET` | `/deliveries/ratings` | Lista de avaliacoes (admin) |

`POST /deliveries` calcula **priceCents** e **courierFeeCents** no servidor (km + base + % plataforma). Campos de preco no body sao ignorados.

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
2. Empresa/admin envia `delivery:watch` com `{ deliveryId }`.
3. Entregador vinculado envia `courier:location` com `{ deliveryId, latitude, longitude }`.
4. Observadores recebem `delivery:location`.

## Precificacao (env)

| Variavel | Default | Significado |
| --- | --- | --- |
| `PRICING_BASE_FEE_CENTS` | 1000 | Taxa base |
| `PRICING_PER_KM_CENTS` | 500 | Por km (Haversine) |
| `PRICING_PLATFORM_FEE_PERCENT` | 20 | % da plataforma sobre o total |
| `PRICING_MIN_FEE_CENTS` | 800 | Piso |
| `OFFER_TTL_SECONDS` | 120 | Validade da oferta |
| `REDIS_URL` | redis://localhost:6379 | Locks e jobs |
| `JWT_REFRESH_EXPIRES_DAYS` | 30 | Validade do refresh |
| `APP_TIMEZONE` | America/Sao_Paulo | Dia local |
