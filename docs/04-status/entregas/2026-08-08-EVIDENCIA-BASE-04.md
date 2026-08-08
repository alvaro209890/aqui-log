# Evidência — `BASE-04` (baseline em runtime local) e QA de `B2C-01B`

> **Data:** 2026-08-08 (15:00–15:20 BRT)
> **Ambiente:** PC `acer` (Linux 7.0.0-28-generic), desenvolvimento local
> **Commit inicial:** `b85d69f` em `main`
> **Runtimes:** Node v22.22.2 · pnpm 10.34.4 · Docker 29.1.3
> **Banco descartável:** `aqui_log_base04` em `localhost:5433`
>   (container `aqui-log-postgres`, `postgres:17-alpine`) — criado nesta sessão,
>   **não** é o banco `aqui_log` de desenvolvimento, que ficou intacto
> **Redis:** container `aqui-log-redis` (`redis:7-alpine`) em `localhost:6379`
> **API sob teste:** `PORT=3011` (a 3000 estava ocupada por outro processo do PC)
> **`.env`:** usado como está, **sem edição**; overrides só por variável de
>   ambiente na linha de comando (`DATABASE_NAME`, `PORT`, `PUBLIC_API_URL`)

## 1. Migrations

`DATABASE_NAME=aqui_log_base04 pnpm db:migrate` — 8 migrations aplicadas, nesta ordem,
com `synchronize=false`:

1. `InitialSchema1784082573425`
2. `NormalizeTimestamps1784083392800`
3. `Sprint1AuthTokens1784200000000`
4. `Sprint2DeviceTokens1784300000000`
5. `B2CCustomers1785000000000`
6. `AddCustomerRole1785000000001`
7. `DeliveryPackageFields1785100000000`
8. `RemoveCompanyModel1785200000000`

### Ensaio de rollback (só no banco descartável)

| Passo | Comando | Resultado observado |
| --- | --- | --- |
| Reverter | `pnpm migration:revert` | `RemoveCompanyModel1785200000000 has been reverted successfully`; tabela `companies` volta a existir e `deliveries.company_id` reaparece com o índice `IDX_b34ed58a2acbcb7254dad0b877` |
| Reaplicar | `pnpm migration:run` | `RemoveCompanyModel1785200000000 has been executed successfully` |

### Schema final conferido

| Verificação | Consulta | Resultado |
| --- | --- | --- |
| Tabela `companies` removida | `information_schema.tables` | `0` |
| Nenhuma coluna `company_id` restante | `information_schema.columns` | vazio (nenhuma tabela) |
| Campos B2C em `deliveries` | `information_schema.columns` | `customer_id` uuid · `product_type` varchar · `package_size` varchar · `weight_kg` numeric · `delivery_scope` varchar · `product_photo_urls` jsonb |

## 2. Health e smoke

`GET /api/v1/health` com a API rodando sobre o banco descartável:

```json
{"service":"Aqui Log API","status":"ok","timezone":"America/Sao_Paulo",
 "checks":{"db":"ok","redis":"ok"}}
```

`pnpm db:admin` criou `admin@aquilog.com.br` (`SUPER_ADMIN`).

Quatro execuções do smoke B2C concluíram o fluxo cliente → oferta → aceite → coleta →
trânsito → entrega → avaliação, cada uma com código distinto (sem replay):

| Execução | Código | Observação |
| --- | --- | --- |
| 1 | `AQL-MSKOLKWBVKG` | `PUBLIC_API_URL` divergente — ver §4 |
| 2 | `AQL-MSKOLMHE2OB` | idem |
| 3 | `AQL-MSKOMHM76T2` | `PUBLIC_API_URL` alinhado à API sob teste |
| 4 | `AQL-MSKOML7604K` | idem |
| 5 | `AQL-MSKOUQZGW79` | após a correção do script (§4) |
| 6 | `AQL-MSKOUU66CSP` | após a correção do script (§4) |

Banco após as execuções: 4 entregas do smoke em `DELIVERED`, 28 `delivery_events`,
provas gravadas em `apps/backend/uploads/`.

## 3. Build, lint e testes

| Comando | Resultado | Data |
| --- | --- | --- |
| `pnpm build` | PASS (backend + dashboard) | 2026-08-08 |
| `pnpm lint` | PASS (backend `lint:check` + dashboard `tsc -b`) | 2026-08-08 |
| `pnpm test` | PASS — backend 10 suítes / 36 testes; build do dashboard | 2026-08-08 |
| `flutter analyze` / `flutter test` (2 apps) e `dart test` (core) | **N/A** — nenhum arquivo Flutter/Dart foi tocado nesta sessão | — |

## 4. Defeito encontrado pelo `BASE-04` — smoke aprovava com upload quebrado

**Sintoma:** nas execuções 1 e 2 o smoke imprimiu `Smoke test aprovado` mesmo com
`curl: (7) Failed to connect to localhost port 3001` aparecendo duas vezes por rodada.

**Causa raiz:** duas camadas.

1. A URL de upload da prova vem de `PUBLIC_API_URL` **no servidor**, não do `API_URL`
   do script. Com a API subida em outra porta, a presign devolve um endereço que não
   existe e o `PUT` da prova falha.
2. `upload_proof` era chamada dentro de `$( )` numa atribuição, e nesse contexto o
   `set -e` **não** aborta o script. A falha do `curl` era silenciosamente engolida e
   o pedido seguia para `PICKED_UP`/`DELIVERED` com `proofUrl` apontando para um
   arquivo que nunca subiu.

**Correção aplicada** (`scripts/smoke-test.sh`): a função devolve status de erro e a
chamada usa `|| exit 1`; a mensagem nomeia a prova, a URL tentada e explica que
`PUBLIC_API_URL` precisa apontar para a mesma API de `API_URL`.

**Verificação da correção:**

| Cenário | Resultado |
| --- | --- |
| `PUBLIC_API_URL` divergente (3001 ≠ 3011) | script **falha** com `exit=1` e mensagem explicativa |
| `PUBLIC_API_URL` alinhado | execuções 5 e 6 aprovadas, `exit=0`, sem erro de `curl` |

Efeito prático: as evidências de smoke anteriores a esta sessão **não** comprovam que
o upload de prova funcionou — apenas que as transições de status foram aceitas.

## 5. QA do navegador — `B2C-01B`

**Como foi feito:** Chrome real (perfil espelho, CDP :9222) contra o dashboard em
`vite --port 5199` com `VITE_API_URL=http://localhost:3011/api/v1`, logado como
`SUPER_ADMIN`. Massa de teste: 6 entregas com campos B2C, de 2 clientes distintos
(`Ana QA` `70413dab…`, `Bruno QA` `a02a3168…`), mais as 4 entregas legadas do smoke
(sem categoria/tamanho/peso).

| Verificação | Query enviada à API | Resultado observado |
| --- | --- | --- |
| Categoria isolada | `/deliveries?productType=ELECTRONICS&page=1&limit=20` | 1 linha (`AQL-MSKOO8P8DPX`, Eletronico/G/12 kg) |
| Categoria `FOOD` | `productType=FOOD` | 1 linha (Alimento/M/3.2 kg) |
| Tamanho isolado | `packageSize=LARGE` | 2 linhas (25 kg e 12 kg) |
| Combo tamanho + status | `status=OFFERED&packageSize=LARGE` | as mesmas 2 linhas |
| Zero resultados | `status=DELIVERED&packageSize=LARGE` | tabela vazia com "Nenhuma entrega com esses filtros." |
| Faixa de peso inclusiva | `weightMin=1&weightMax=8` | 3 linhas (7.5 · 1.1 · 3.2 kg); 0.5, 12 e 25 kg fora |
| Legado sem peso | mesma query acima | as 4 entregas legadas **não** aparecem |
| Filtro por cliente | `customerId=70413dab-…` | as 3 entregas da Ana |
| Colunas na tabela | — | Categoria/Tamanho/Peso/Cliente preenchidas; legado mostra `—` |

### Autorização e paginação (HTTP vivo, `curl`)

| Verificação | Resultado |
| --- | --- |
| `CUSTOMER` (Ana) pedindo `customerId` do Bruno | param ignorado; retorna só `70413dab…` |
| `SUPER_ADMIN` pedindo `customerId` do Bruno | retorna só `a02a3168…` |
| `customerId` não-UUID | `HTTP 400` |
| Sem token | `HTTP 401` |
| Paginação com filtro | `customerId=70413dab…&limit=2` → página 1: `total 3`, `totalPages 2`, 2 códigos; página 2: o 3º código |

**Conclusão:** `B2C-01B` cumpre os critérios de aceite. Encerrado como `DONE`.

## 6. Achados de UI registrados (não corrigidos aqui)

Pertencem a `UX-01C`/`UX-02`; não foram tocados para não misturar escopo.

1. `TopBar` tem um campo de busca **decorativo** — sem estado nem handler — e o
   placeholder ainda diz "Buscar entrega, **empresa** ou entregador", vocabulário do
   modelo B2B removido em 2026-08-07 (`src/components/TopBar.tsx:21`).
2. A ação da tabela de entregas aparece como **"Assign"**, em inglês, no meio de uma
   interface toda em português (`src/pages/DeliveriesPage.tsx`).
3. O dashboard continua com a identidade **verde**; a paleta laranja das diretrizes
   visuais é exatamente o escopo de `UX-01C`.

## 7. Limitações desta evidência

- Roda apenas na máquina `acer`; nada foi publicado em nuvem.
- O banco `aqui_log_base04` é descartável e permanece no container — pode ser
  removido a qualquer momento com `DROP DATABASE`.
- APK e QA visual em emulador/dispositivo continuam **não executados**.
- A API foi exercitada em `PORT=3011`; a porta padrão 3000 estava ocupada por outro
  processo não relacionado ao Aqui Log.
