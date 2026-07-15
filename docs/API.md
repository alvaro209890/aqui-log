# API inicial

Base local: `http://localhost:3000/api/v1`

Swagger interativo: `http://localhost:3000/docs`

Rotas protegidas recebem `Authorization: Bearer <token>`.

## Autenticacao e cadastros

| Metodo | Rota | Uso |
| --- | --- | --- |
| `POST` | `/auth/register/company` | Empresa e proprietario pendentes |
| `POST` | `/auth/register/courier` | Entregador, veiculo e URLs de documentos pendentes |
| `POST` | `/auth/login` | Emissao do JWT para cadastro ativo |
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
| `PATCH` | `/deliveries/offers/:offerId/accept` | Aceita corrida |
| `PATCH` | `/deliveries/offers/:offerId/reject` | Recusa e devolve ao despacho |
| `PATCH` | `/deliveries/:id/status` | Avanca estado ou cancela conforme perfil |
| `GET` | `/deliveries/:id/history` | Historico cronologico |
| `POST` | `/deliveries/:id/rating` | Avaliacao pela empresa |

`PICKED_UP` e `DELIVERED` exigem `proofUrl`. A criacao recebe enderecos, coordenadas, destinatario, agenda opcional e valores em centavos.

## Operacao

| Metodo | Rota | Uso |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | KPIs e receita concluida |
| `GET` | `/finance/summary` | Receita, custo e margem |
| `GET` | `/finance/statement` | Saldo e extrato do entregador |
| `GET` | `/notifications` | Caixa do usuario |
| `PATCH` | `/notifications/:id/read` | Marca leitura |
| `GET` | `/audit` | Auditoria administrativa |
| `GET` | `/health` | Estado da API |

## Tempo real

Namespace Socket.IO: `/tracking`.

1. Conecte com `auth: { token: '<jwt>' }`.
2. Empresa/admin envia `delivery:watch` com `{ deliveryId }`.
3. Entregador vinculado envia `courier:location` com `{ deliveryId, latitude, longitude }`.
4. Observadores recebem `delivery:location`.
