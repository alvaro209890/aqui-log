# Estado atual observado

> **Data de referência:** 2026-08-08
> **Ambiente:** desenvolvimento local no PC `acer`; nada produtivo roda aqui.
> **Baseline de código:** `b85d69f` no início desta sessão (`BASE-04` + QA de `B2C-01B`).

## 1. Produto vigente

O Aqui Log é B2C direto: cliente pessoa física solicita e o motoboy executa. Há
cinco roles técnicas: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
O modelo empresa/B2B foi removido do código em 2026-08-07 e a remoção está
**confirmada em banco** desde 2026-08-08 (nenhuma tabela `companies`, nenhuma
coluna `company_id`).

## 2. Capacidade existente

| Superfície | Estado observado na última rodada técnica | Limitação aberta |
| --- | --- | --- |
| Backend NestJS | Auth, cliente, entregas, ofertas, tracking, pricing básico, dashboard e storage local | — migrations revalidadas em banco vivo em 2026-08-08 |
| App cliente Flutter | Cadastro/login, pedido estruturado, histórico e acompanhamento | QA recente em dispositivo/emulador pendente |
| App motoboy Flutter | Cadastro, disponibilidade, oferta, coleta, prova, entrega e carteira básica | QA recente em dispositivo/emulador pendente |
| Dashboard React | KPIs, entregas (+ categoria/tamanho/peso/cliente com QA de navegador feito), mapa, motoboys, usuários, auditoria, configurações e relatórios | identidade laranja pendente (`UX-01C`); busca da `TopBar` é decorativa |
| Postgres/Redis | Containers `aqui-log-postgres` (5433) e `aqui-log-redis` (6379) ativos | banco de teste é descartável; nenhum dado tem valor |
| Cloud | Scaffolds Render/Vercel/Firebase; alvos **decididos** (`DEC-25`) | nenhum projeto ou credencial conectado |

## 3. Evidência da rodada técnica de 2026-08-08 (`BASE-04`)

Executado no banco descartável `aqui_log_base04` com API em `PORT=3011`:

- 8 migrations aplicadas sem `synchronize=true`, incluindo `DeliveryPackageFields`
  e `RemoveCompanyModel`;
- `RemoveCompanyModel` revertida e reaplicada; schema final conferido;
- `/health` com `db: ok` e `redis: ok`;
- smoke B2C ponta a ponta aprovado em 6 execuções, com códigos distintos;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (backend 10 suítes / 36 testes);
- QA do dashboard no navegador (Chrome real) cobrindo os quatro filtros B2C,
  combinação, estado vazio, paginação e escopo por papel.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

Evidência anterior (mobile, 2026-08-07):
`docs/04-status/entregas/2026-08-07-ENTREGA-MOBILE-B2C.md` — core 6 testes,
UI 2, app cliente 10, app motoboy 7. **Não** repetida nesta sessão; nenhum arquivo
Flutter/Dart foi alterado.

## 4. Validações ainda não comprovadas

- [x] Subir Postgres/Redis locais com `.env` válido.
- [x] Aplicar `1785100000000-DeliveryPackageFields` em banco de teste.
- [x] Aplicar `1785200000000-RemoveCompanyModel` em banco de teste.
- [x] Executar smoke B2C vivo após as migrations.
- [x] Exercitar rollback de migration aplicável em banco descartável.
- [x] Fazer QA do dashboard no navegador (filtros B2C de `B2C-01B`).
- [ ] Gerar APKs atuais.
- [ ] Fazer QA visual dos apps em emulador/dispositivo.
- [ ] Rodar `flutter analyze`/`flutter test` novamente após a próxima mudança mobile.

## 5. Próximo passo

`BASE-04` e `B2C-01B` estão `DONE`. A fila libera `UX-01C` (identidade do dashboard)
e `B2C-05` (foto + campos obrigatórios na criação, `DEC-01` já decidida). Escolher
um único ID, conforme o backlog.

## 6. Bloqueios externos

- Firebase/Render/Vercel: alvos decididos (`DEC-25`); ligar exige credenciais + `OPS-*`.
- SMS: exige escolha de provedor e sandbox (`DEC-04`).
- Pagamentos/PIX: exigem autorização explícita e gates `PAY-01/02` (`DEC-05`/`DEC-06`).
- Valores finais de preço v2 / km dual: exigem `DEC-02`.
- Cutoffs/taxa de cancelamento do prestador: `FLOW-DEC-01`.
- Migração banco cloud Firestore: `OPS-DB-01`.

## 7. Armadilha conhecida do ambiente local

`PUBLIC_API_URL` (servidor) define a URL de upload devolvida pela presign. Se ela
não apontar para a mesma API que o smoke chama (`API_URL`), o upload de prova falha.
Desde 2026-08-08 o `scripts/smoke-test.sh` **aborta** nesse caso em vez de aprovar;
antes disso, ele aprovava silenciosamente. A porta 3000 costuma estar ocupada neste
PC por outro processo — usar uma porta livre e alinhar `PORT` e `PUBLIC_API_URL`.
