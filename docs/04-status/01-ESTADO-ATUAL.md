# Estado atual observado

> **Data de referência:** 2026-08-07
> **Ambiente:** desenvolvimento local no PC `acer`; nada produtivo roda aqui.
> **Baseline de código:** `e3fff8f` antes da reorganização documental desta sessão.

## 1. Produto vigente

O Aqui Log é B2C direto: cliente pessoa física solicita e o motoboy executa. Há
cinco roles técnicas: `CUSTOMER`, `COURIER`, `SUPER_ADMIN`, `ADMIN` e `SUPPORT`.
O modelo empresa/B2B foi removido do código em 2026-08-07.

## 2. Capacidade existente

| Superfície | Estado observado na última rodada técnica | Limitação aberta |
| --- | --- | --- |
| Backend NestJS | Auth, cliente, entregas, ofertas, tracking, pricing básico, dashboard e storage local | migrations atuais ainda não revalidadas em banco vivo nesta máquina |
| App cliente Flutter | Cadastro/login, pedido estruturado, histórico e acompanhamento | QA recente em dispositivo/emulador pendente |
| App motoboy Flutter | Cadastro, disponibilidade, oferta, coleta, prova, entrega e carteira básica | QA recente em dispositivo/emulador pendente |
| Dashboard React | KPIs, entregas, mapa, motoboys, usuários, auditoria, configurações e relatórios | filtros B2C e identidade laranja pendentes |
| Postgres/Redis | Arquitetura local definida | não estavam ativos na última rodada registrada |
| Cloud | Scaffolds Render/Vercel/Firebase; alvos **decididos** (`DEC-25`) | nenhum projeto ou credencial conectado |

## 3. Evidência herdada da última rodada técnica

## 3. Evidência herdada da última rodada técnica

Estes resultados foram registrados em 2026-08-07; não foram repetidos durante a
reorganização documental:

- backend: build verde e 32 testes;
- dashboard: build verde;
- core: 6 testes;
- UI compartilhada: 2 testes;
- app cliente: 10 testes;
- app motoboy: 7 testes.

Documento de evidência: `docs/04-status/entregas/2026-08-07-ENTREGA-MOBILE-B2C.md`.

## 4. Validações ainda não comprovadas

- [ ] Subir Postgres/Redis locais com `.env` válido.
- [ ] Aplicar `1785100000000-DeliveryPackageFields` em banco de teste.
- [ ] Aplicar `1785200000000-RemoveCompanyModel` em banco de teste.
- [ ] Executar smoke B2C vivo após as migrations.
- [ ] Exercitar rollback de migration aplicável em banco descartável.
- [ ] Gerar APKs atuais.
- [ ] Fazer QA visual dos apps em emulador/dispositivo.
- [ ] Fazer QA do dashboard no navegador.

## 5. Próximo passo

`B2C-01B` está `IN_PROGRESS` (fatia `productType` entregue). Continuar fatias
restantes **ou** executar `BASE-04` (ainda `READY`, não feito) para validar banco.

## 6. Bloqueios externos

- Firebase/Render/Vercel: alvos decididos (`DEC-25`); ligar exige credenciais + `OPS-*`.
- SMS: exige escolha de provedor e sandbox (`DEC-04`).
- Pagamentos/PIX: exigem autorização explícita e gates `PAY-01/02` (`DEC-05`/`DEC-06`).
- Valores finais de preço v2 / km dual: exigem `DEC-02`.
- Cutoffs/taxa de cancelamento do prestador: `FLOW-DEC-01`.
- Migração banco cloud Firestore: `OPS-DB-01`.
