# Arquitetura inicial

## Visao geral

O Aqui Log usa um monorepo para manter contratos, infraestrutura e produtos versionados em conjunto. O backend e um monolito modular NestJS: simples para iniciar o MVP, mas dividido por dominios para permitir extracao futura de servicos sem reescrever as regras centrais.

```text
Empresa Flutter ─┐
Entregador Flutter├── REST + WebSocket ── NestJS ── PostgreSQL
Dashboard React ──┘                         │
                                            └── Redis (cache, filas e presenca futura)
```

## Modulos de dominio

- `auth`: cadastro, login JWT, contexto do usuario e controle por perfil.
- `companies`: aprovacao e gestao das empresas.
- `couriers`: aprovacao, disponibilidade e localizacao dos entregadores.
- `deliveries`: solicitacao, despacho manual inicial, ciclo de status e comprovante.
- `tracking`: eventos WebSocket de localizacao por entrega.
- `dashboard`: indicadores operacionais e financeiro basico.

## Perfis e aprovacao

| Perfil | Responsabilidade inicial |
| --- | --- |
| `SUPER_ADMIN` | Acesso completo e aprovacao cadastral |
| `ADMIN` | Operacao, empresas, entregadores e entregas |
| `SUPPORT` | Consulta operacional |
| `COMPANY_OWNER` | Entregas e usuarios da propria empresa |
| `COMPANY_USER` | Operacao da empresa conforme permissao futura |
| `COURIER` | Disponibilidade, corridas, coleta e entrega |

Empresas e entregadores nascem com status `PENDING`. Um administrador ativa o cadastro antes do primeiro login. O primeiro `SUPER_ADMIN` e criado pelo comando `pnpm db:admin`.

## Ciclo da entrega

`REQUESTED → OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED`

`CANCELED` encerra uma solicitacao antes da conclusao. As proximas iteracoes devem adicionar uma maquina de estados explicita, historico imutavel de transicoes, upload seguro do comprovante e motor automatico de despacho.

## Decisoes para evolucao

- PostgreSQL e a fonte de verdade; Redis fica reservado a presenca, cache, filas e despacho.
- Valores financeiros sao inteiros em centavos.
- Identificadores internos sao UUIDs; codigos amigaveis de entrega entram na proxima etapa.
- A API publica futura deve ser separada em namespace e autenticada por chaves por empresa.
- Em producao, `DATABASE_SYNC` deve permanecer `false` e alteracoes de schema devem usar migrations.
