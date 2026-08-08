# Arquitetura inicial

## Visao geral

O monorepo mantem produtos, contratos, banco e infraestrutura versionados em conjunto. O backend e um monolito modular NestJS para reduzir custo operacional no MVP sem misturar os dominios.

```text
Cliente Flutter ─┐
Entregador Flutter├── REST + WebSocket autenticado ── NestJS ── PostgreSQL
Dashboard React ──┘                                      │
                                                        └── Redis
```

## Dominios

- `auth` e `users`: cadastro, login JWT e perfis (prestador, cliente, admin).
- `couriers`: aprovacao, documentos por URL, disponibilidade e localizacao.
- `deliveries`: solicitacao, agenda, oferta persistida, despacho manual/automatico, aceite/recusa, estados, comprovantes e avaliacao.
- `tracking`: canal Socket.IO autenticado; cliente, administrador e entregador vinculado podem acompanhar uma entrega.
- `notifications`: caixa persistida por usuario, preparada para push/e-mail futuros.
- `finance`: receita da plataforma e credito basico na carteira ao concluir a entrega.
- `audit`: registro das operacoes sensiveis.
- `dashboard`: indicadores operacionais derivados do PostgreSQL.

## Persistencia

**Local/dev:** PostgreSQL e a fonte de verdade (TypeORM + migrations). Redis e
usado para locks de aceite, jobs e configuracoes.

**Producao cloud (`DEC-25`):** banco alvo = **Firebase Firestore**; Storage e FCM
no mesmo projeto Firebase; API no **Render**; dashboard na **Vercel**. A migracao
Postgres → Firestore e o pacote `OPS-DB-01` — nao remover o stack local antes
disso. Ver `docs/02-planejamento/planos/PLANO_HOSPEDAGEM.md`.

A migration inicial cria usuarios, entregadores, entregas, ofertas, eventos,
notificacoes, avaliacoes, carteira e auditoria (a tabela `companies` e as colunas
`company_id` foram removidas em 2026-08-07). Jobs de expiracao de oferta e
despacho agendado rodam via `@nestjs/schedule`. Precificacao e server-side
(Haversine + env `PRICING_*`). Auth: JWT access + refresh tokens persistidos
(hash) e recuperacao de senha.

Valores financeiros sao inteiros em centavos. Identificadores internos sao UUID;
cada entrega tambem recebe um codigo publico `AQL-*`.

## Operacao da entrega

```text
REQUESTED → OFFERED → ACCEPTED → AT_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED
     │          │
     └──────────┴──→ CANCELED
```

- O despacho automatico escolhe o entregador aprovado, disponivel, geolocalizado e mais proximo da coleta.
- Recusas ficam registradas e excluem o mesmo entregador da proxima tentativa.
- Ofertas expiram em dois minutos.
- Coleta e entrega exigem comprovante por URL.
- Cada transicao gera um evento; saltos de estado sao recusados.
- A conclusao libera o entregador e credita sua carteira de forma idempotente.

## Seguranca e limites atuais

- HTTP usa JWT, papéis, validacao de DTO, Helmet, CORS e limite global de requisicoes.
- Socket.IO exige o JWT no `auth.token` ou cabecalho `Authorization` e valida o vinculo com a entrega.
- URLs de documentos/comprovantes sao apenas metadados nesta fase; o upload privado e a verificacao de malware ainda precisam de um provedor de objetos.
- Redis participa de locks de aceite, jobs, cache e configurações; PostgreSQL
  continua sendo a fonte de verdade do domínio.
- API publica, pagamentos reais e integracoes externas permanecem fora do MVP atual.
