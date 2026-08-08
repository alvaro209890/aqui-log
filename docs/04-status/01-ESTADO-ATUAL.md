# Estado atual observado

> **Data de referência:** 2026-08-08
> **Ambiente:** desenvolvimento local no PC `acer`; nada produtivo roda aqui.
> **Baseline de código:** `f987e26` no início da sessão (`B2C-05` + `UX-01C`).

## 1. Produto vigente

O Aqui Log é B2C direto: cliente pessoa física solicita e o motoboy executa. Há
cinco roles técnicas: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
O modelo empresa/B2B foi removido do código em 2026-08-07 e a remoção está
**confirmada em banco** desde 2026-08-08 (nenhuma tabela `companies`, nenhuma
coluna `company_id`).

## 2. Capacidade existente

| Superfície | Estado observado na última rodada técnica | Limitação aberta |
| --- | --- | --- |
| Backend NestJS | Auth, cliente, entregas (**criação exige foto/tipo/tamanho/peso**), ofertas, tracking, pricing básico, dashboard e storage local | — migrations revalidadas em banco vivo em 2026-08-08 |
| App cliente Flutter | Cadastro/login, pedido estruturado **com foto obrigatória**, histórico e acompanhamento | QA recente em dispositivo/emulador pendente |
| App motoboy Flutter | Cadastro, disponibilidade, oferta, coleta, prova, entrega e carteira básica | QA recente em dispositivo/emulador pendente |
| Dashboard React | KPIs, entregas (+ categoria/tamanho/peso/cliente com QA de navegador feito), mapa, motoboys, usuários, auditoria, configurações e relatórios | **identidade laranja aplicada** (`UX-01C`); busca da `TopBar` continua decorativa (`UX-02`) |
| Postgres/Redis | Containers `aqui-log-postgres` (5433) e `aqui-log-redis` (6379) ativos | banco de teste é descartável; nenhum dado tem valor |
| Cloud | Scaffolds Render/Vercel/Firebase; alvos **decididos** (`DEC-25`) | nenhum projeto ou credencial conectado |

## 3. Evidência das rodadas técnicas de 2026-08-08

### `B2C-05` (esta rodada)

Executado no banco descartável `aqui_log_b2c05` com API em `PORT=3011`:

- criação de pedido rejeita, com `400` e mensagem em português, a ausência de
  foto, tipo, tamanho, peso e de cada endereço — 10 casos negativos em HTTP vivo;
- endereço só com espaços deixou de passar (o DTO apara antes de validar);
- pedido legado inserido direto no banco continua legível em lista, detalhe,
  histórico e na visão de admin, e segue fora dos filtros de `B2C-01B`;
- `pnpm build`, `pnpm lint` e `pnpm test` verdes (backend 10 suítes / 44 testes);
- `pnpm smoke` aprovado 5×, agora com upload de foto do cliente e assert negativo;
- `flutter analyze`/`flutter test` verdes nos dois apps e `dart analyze`/`dart test`
  no core.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-B2C-05.md`.

### `UX-01C` (esta rodada)

QA em Chrome real contra a API viva, com dashboard em `vite --port 5199`:

- varredura de cor computada em 11 telas: **0 verdes de marca**;
- 0 hexadecimais de marca fora de `styles.css`;
- 7 pares de texto reais medidos, todos ≥ 4,5:1 (WCAG AA);
- layout mobile (430px) sem overflow horizontal;
- achado corrigido: `DELIVERED` e `CANCELED` usavam o mesmo cinza.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-UX-01C.md`.

### `BASE-04` e `B2C-01B` (rodada anterior)

Executado no banco descartável `aqui_log_base04` com API em `PORT=3011`:

- 8 migrations aplicadas sem `synchronize=true`, incluindo `DeliveryPackageFields`
  e `RemoveCompanyModel`;
- `RemoveCompanyModel` revertida e reaplicada; schema final conferido;
- `/health` com `db: ok` e `redis: ok`;
- smoke B2C ponta a ponta aprovado em 6 execuções, com códigos distintos;
- QA do dashboard no navegador (Chrome real) cobrindo os quatro filtros B2C,
  combinação, estado vazio, paginação e escopo por papel.

Documento de evidência: `docs/04-status/entregas/2026-08-08-EVIDENCIA-BASE-04.md`.

Evidência anterior (mobile, 2026-08-07):
`docs/04-status/entregas/2026-08-07-ENTREGA-MOBILE-B2C.md`.

## 4. Validações ainda não comprovadas

- [x] Subir Postgres/Redis locais com `.env` válido.
- [x] Aplicar `1785100000000-DeliveryPackageFields` em banco de teste.
- [x] Aplicar `1785200000000-RemoveCompanyModel` em banco de teste.
- [x] Executar smoke B2C vivo após as migrations.
- [x] Exercitar rollback de migration aplicável em banco descartável.
- [x] Fazer QA do dashboard no navegador (filtros B2C de `B2C-01B`).
- [x] Rodar `flutter analyze`/`flutter test` após a mudança mobile de `B2C-05`.
- [ ] Gerar APKs atuais.
- [ ] Fazer QA visual dos apps em emulador/dispositivo — pendente **e agora mais
      relevante**, porque `B2C-05` mudou a tela de novo pedido do app cliente.

## 5. Próximo passo

`BASE-04`, `B2C-01B`, `B2C-05` e `UX-01C` estão `DONE`. A fila libera `PICK-01`
(código de recolhimento), `UX-02` (QA visual dos fluxos — a parte mobile exige
dispositivo/emulador) e `B2C-02` (preço v2, com valores finais atrás de
`DEC-02`). Escolher um único ID, conforme o backlog.

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
