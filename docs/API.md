# API inicial

Base local: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/docs`

## Rotas principais

| Metodo | Rota | Uso |
| --- | --- | --- |
| `GET` | `/health` | Estado da API |
| `POST` | `/auth/register/company` | Cadastro pendente de empresa e proprietario |
| `POST` | `/auth/register/courier` | Cadastro pendente de entregador |
| `POST` | `/auth/login` | Emissao de JWT para usuario ativo |
| `GET` | `/auth/me` | Contexto do usuario autenticado |
| `GET` | `/companies` | Lista administrativa de empresas |
| `PATCH` | `/companies/:id/approve` | Aprova empresa e seus usuarios |
| `GET` | `/couriers` | Lista administrativa de entregadores |
| `PATCH` | `/couriers/:id/approve` | Aprova entregador e seu usuario |
| `PATCH` | `/couriers/me/availability` | Liga ou desliga disponibilidade |
| `POST` | `/deliveries` | Cria uma solicitacao da empresa |
| `GET` | `/deliveries` | Lista entregas conforme o perfil |
| `PATCH` | `/deliveries/:id/assign` | Oferece entrega a um entregador |
| `PATCH` | `/deliveries/:id/status` | Atualiza o andamento e comprovante |
| `GET` | `/dashboard/summary` | KPIs operacionais e receita concluida |

As rotas protegidas recebem `Authorization: Bearer <token>`. O namespace WebSocket e `/tracking`; o evento de entrada inicial e `courier:location` e o evento publicado para o acompanhamento e `delivery:location`.
