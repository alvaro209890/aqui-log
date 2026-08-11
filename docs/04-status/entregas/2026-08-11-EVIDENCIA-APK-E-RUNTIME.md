# Evidência — `PAY-01` fechado, app cliente completo + APK, e `OPS-01A` no ar

> **Data:** 2026-08-11
> **Agente:** Claude (Opus 5), sessão única
> **Ambiente:** PC `acer` (Linux 7.0.0-28-generic), Node v22.22.2, pnpm 10.x,
> Flutter stable, Docker (Postgres 17 / Redis 7), cloudflared 2026.3.0
> **Base:** `main` @ `8b05bf2` (PAY-01 parcial, CI vermelho)
> **Escopo:** 3 frentes — (1) app cliente + APK, (2) runtime de distribuição no
> acer, (3) fechamento do `PAY-01` e documentação

---

## 0. Resumo

| Frente | Resultado |
| --- | --- |
| `PAY-01` (ledger) | ✅ **DONE** — smoke fechado, CI destravado |
| App cliente + APK | ✅ auto-login, carteira e URL pública; APK arm64 gerado |
| `OPS-01A` (runtime no acer) | ✅ API + dashboard + banco no ar sob `*.cursar.space`, com início automático |

---

## 1. `PAY-01` — o que faltava e o que foi feito

O `8b05bf2` deixou o ledger implementado mas com **duas** coisas quebrando o CI:

### 1.1 Asserção final do smoke (`GET /finance/summary`)

`GET /finance/summary` agrega o ledger **inteiro do banco** — todas as contas,
de todas as execuções. A asserção comparava esse total com o repasse de **uma**
entrega, o que só funciona em banco recém-criado. No banco local do acer, que
acumula execuções, ela falhava sempre.

Correção (`scripts/smoke-test.sh`): capturar a **baseline** logo depois do login
do admin, antes de qualquer pedido, e comparar o **delta** da execução:

```bash
summary_baseline="$(api GET /finance/summary "$admin_token")"
baseline_courier_obligation="$(jq -er '.courierObligationCents' <<<"$summary_baseline")"
# ...
'(.courierObligationCents - $base) == $fee and .platformRevenueCents > 0'
```

Funciona nos dois mundos: no CI a baseline é `0` (banco novo do service
container) e o delta continua sendo o repasse da única entrega concluída; no
acer a baseline é o acumulado e o delta continua exato. A falha agora imprime
baseline e valor observado, em vez de morrer muda no `jq -e`.

### 1.2 Erro de lint (`finance.controller.ts:57`)

```
error  The two values in this comparison do not have a shared enum type
       @typescript-eslint/no-unsafe-enum-comparison
```

`ownerType` vem cru da query string e `owner.ownerType` é `LedgerOwnerType`.
Comparação feita como string explícita (`owner.ownerType as string`) — mesma
regra, sem o erro. **Este erro também deixaria o CI vermelho** e não estava
listado no documento de estado do `PAY-01`.

### 1.3 Verificação

| Comando | Resultado |
| --- | --- |
| `pnpm build` | ✅ PASS (backend + dashboard) |
| `pnpm lint` | ✅ PASS (0 problemas) |
| `pnpm test` | ✅ **25 suítes / 219 testes** |
| `pnpm smoke` (localhost:3011) | ✅ **3× consecutivas** |
| `pnpm smoke` (domínio público) | ✅ PASS — ver §3.5 |

Execuções do smoke local (códigos distintos, banco acumulado):

```
Smoke test aprovado: AQL-MSO0PZU47LP (68abbbbb-…) + agendado AQL-MSO0Q0OTRGH + reoferta 54bbd886-…
Smoke test aprovado: AQL-MSO0QKJND5J (ef59020a-…) + agendado AQL-MSO0QLDXR40 + reoferta fe70ce56-…
Smoke test aprovado: AQL-MSO0R2G75ZQ (c98bb5f2-…) + agendado AQL-MSO0R3AEN83 + reoferta 164efdef-…
```

---

## 2. App do cliente — o que faltava para ser distribuível

As telas do fluxo principal já existiam (cadastro/login, pedido com foto +
tipo/tamanho/peso + endereços + agora/agendar, lista, detalhe com código de
recolhimento, histórico e avaliação). O que **faltava para o app funcionar na
mão de alguém** eram três coisas, todas corrigidas nesta rodada.

### 2.1 A URL da API impedia o APK de funcionar (achado crítico)

`app_state.dart` tinha como padrão `http://10.0.2.2:3001/api/v1` — o loopback
do **emulador Android**. Um APK instalado num celular de verdade não alcança
nem `10.0.2.2` nem `localhost`: o app sairia da fábrica sem conseguir falar com
a API. Corrigido para o domínio público do runtime (`DEC-26`), com override
preservado:

```dart
const String kDefaultApiBaseUrl = String.fromEnvironment(
  'AQUI_LOG_API',
  defaultValue: 'https://aquilog-api.cursar.space/api/v1',
);
```

Travado por teste (`a URL padrao da API e o dominio publico`) e **conferido
dentro do APK gerado**:

```
$ strings lib/arm64-v8a/libapp.so | grep -o "https://aquilog-api.cursar.space[a-z/0-9]*" | sort -u
https://aquilog-api.cursar.space/api/v1
```

### 2.2 Auto-login (sessão não sobrevivia a fechar o app)

A sessão vivia só em memória: toda abertura caía no login. Implementado:

- `lib/session_store.dart` — `SessionStore` (interface) + `PrefsSessionStore`
  (`shared_preferences`) + `MemorySessionStore` (testes). Guarda os dois tokens
  e os dados de exibição do usuário; **nenhuma senha é gravada**.
- `CustomerAppState.bootstrap()` — restaura a sessão e **troca o refresh token
  por um par novo**. Restaurar só o access token deixaria o app com um token
  vencido (`JWT_EXPIRES_IN=1d`) e todas as telas em erro. Refresh inválido
  (expirado, revogado no logout, servidor recriado) descarta a sessão e o app
  cai no login normalmente.
- `main.dart` — enquanto `booted == false`, a `home` é a abertura
  (`_SplashScreen`), não o login: sem isso o usuário logado veria o login
  piscar em toda abertura.
- `logout()` apaga o que estava gravado (coberto por teste).

### 2.3 Carteira — o `402` do `PAY-01` não tinha para onde apontar

Com o `PAY-01`, criar pedido **reserva o preço** e a API responde `402` sem
saldo. O app mostrava isso como
`Não foi possível publicar o pedido: Saldo insuficiente…` e não havia nenhuma
tela onde o cliente conferisse o próprio saldo. Adicionado:

- `lib/screens/wallet_screen.dart` — saldo disponível, reservado e total, mais
  o extrato (`GET /finance/statement`), com pull-to-refresh. O texto explica que
  o valor é **reservado** na criação e cobrado na entrega, e que a recarga por
  PIX/cartão é `PAY-02` — em vez de oferecer um botão que ainda não faz nada.
- Entrada "Minha carteira" no perfil.
- `WalletStatement`/`WalletEntry`/`formatCents` em `aqui_log_core` (adição
  não-quebrante; o app do motoboy não foi tocado) e `api.walletStatement()`.
- `new_order_screen.dart` trata `ApiException` por código: `402` vira
  `"<mensagem da API>\nConfira o saldo em Perfil › Minha carteira."`.

### 2.4 Verificação do app

```
$ cd apps/customer_app && flutter analyze
No issues found! (ran in 12.9s)

$ flutter test
00:05 +21: All tests passed!          (eram 15 testes; +6 nesta rodada)

$ cd packages/aqui_log_core && dart analyze && dart test
No issues found!
00:00 +23: All tests passed!

$ cd apps/courier_app && flutter analyze && flutter test
No issues found! (ran in 3.2s)
00:05 +18: All tests passed!
```

Testes novos: auto-login restaura a sessão · logout apaga a sessão gravada ·
round-trip JSON de `StoredSession` (e sessão sem token = inválida) · URL padrão
é o domínio público · `WalletScreen` mostra saldo/reservado/extrato ·
`formatCents` no padrão brasileiro.

### 2.5 APK

```
$ cd apps/customer_app && flutter build apk --release --target-platform android-arm64
✓ Built build/app/outputs/flutter-apk/app-release.apk (19.4MB)
```

| Item | Valor |
| --- | --- |
| **Caminho** | `/home/acer/Documentos/aqui-log/dist/aqui-log-cliente-2026-08-11.apk` |
| Tamanho | 19,4 MB (arm64-v8a) |
| SHA-256 | `47d0ddd248f76cbb689a6bac250d32e672a65cc48197f8cbc8cbcbf674268297` |
| applicationId | `br.com.aquilog.aqui_log_cliente` |
| API embutida | `https://aquilog-api.cursar.space/api/v1` (conferida no binário) |

`dist/` está no `.gitignore` — o APK **não** vai para o repositório, de
propósito.

---

## 3. `OPS-01A` — runtime de distribuição no acer

### 3.1 Banco no caminho da `DEC-26`

O container usava o volume Docker `infra_postgres_data`, não a pasta exigida.
Migração com backup antes e conferência depois:

```bash
docker exec aqui-log-postgres pg_dumpall -U aqui_log > backup-pre-migracao.sql   # 4,6 MB
docker stop aqui-log-postgres
docker run --rm -v infra_postgres_data:/from \
  -v ~/Documentos/Bando_de_dados/Aqui_Log:/to alpine sh -c 'cp -a /from/. /to/'  # preserva uid/gid
# infra/docker-compose.yml passou a usar bind mount; container recriado
```

Resultado:

```
/aqui-log-postgres restart=unless-stopped health=healthy
mount=bind:/home/acer/Documentos/Bando_de_dados/Aqui_Log
258 entregas
14 migrations
```

Nada foi perdido. O volume `infra_postgres_data` **continua existindo** como
cópia de segurança. `aqui-log-redis` já estava com `restart=unless-stopped`.

### 3.2 Units systemd (usuário `acer`, com linger)

Versionadas em `infra/systemd/` e instaladas em `~/.config/systemd/user/`:

| Unit | O que faz |
| --- | --- |
| `aqui-log-api.service` | `node dist/main`, `PORT=3011`, `EnvironmentFile=~/.config/aqui-log/env`, `Restart=always`, `MemoryMax=1G` |
| `aqui-log-dashboard.service` | `node infra/static-server.mjs apps/dashboard/dist` em `127.0.0.1:3012` |
| `cloudflared-aqui-log.service` | túnel dedicado com config própria |

```
$ systemctl --user is-active  aqui-log-api aqui-log-dashboard cloudflared-aqui-log
active / active / active
$ systemctl --user is-enabled aqui-log-api aqui-log-dashboard cloudflared-aqui-log
enabled / enabled / enabled
$ loginctl show-user acer -p Linger
Linger=yes
```

`linger` já estava ligado de antes; as três units estão em `default.target`,
então sobem com o PC **sem login**.

O dashboard **não** usa `vite preview` (o próprio Vite avisa que preview é
ferramenta de desenvolvimento). `infra/static-server.mjs` é um servidor sem
nenhuma dependência, com o fallback de SPA que o `BrowserRouter` exige,
`no-store` no `index.html` e cache imutável nos bundles com hash.

### 3.3 Cloudflare Tunnel

```
$ cloudflared tunnel create aqui-log
Created tunnel aqui-log with id 66aa2d7d-9ff9-46ae-9c77-de3c7c205b51
```

**Achado (importante):** `cloudflared tunnel route dns aqui-log <host>` gravou o
CNAME apontando para o túnel **errado** — `auracore-local-api`
(`e759f152-…`), outro sistema do acer:

```
INF Added CNAME aquilog-api.cursar.space which will route to this tunnel tunnelID=e759f152-…
```

Corrigido na hora com o UUID explícito, e a regra está registrada na referência
de runtime (§6.3): **sempre usar o UUID e conferir a saída**.

```
$ cloudflared tunnel route dns --overwrite-dns 66aa2d7d-… aquilog-api.cursar.space
INF Added CNAME aquilog-api.cursar.space … tunnelID=66aa2d7d-9ff9-46ae-9c77-de3c7c205b51
$ cloudflared tunnel route dns --overwrite-dns 66aa2d7d-… aquilog.cursar.space
INF Added CNAME aquilog.cursar.space … tunnelID=66aa2d7d-9ff9-46ae-9c77-de3c7c205b51
```

Túnel com 4 conexões (gru08, gru11 ×2, gru18). **Nada manual ficou pendente no
painel da Cloudflare** — DNS inteiro resolvido por CLI.

Nenhum serviço pré-existente do acer foi tocado: os outros túneis
(`hermes-acer`, `codingpro`, `mapasfacil`, `alertacar`, `cerebro`, `pareceres-api`,
`opencode-mobile`, `servidor-ia`, `geoserver-wms`, `aquiresolve-financeiro`)
continuam com seus configs e units intactos; o Aqui Log tem config própria
(`~/.cloudflared/aqui-log-config.yml`) e portas livres (3011/3012).

### 3.4 Verificação pelo domínio público

```
$ curl -s https://aquilog-api.cursar.space/api/v1/health
{"service":"Aqui Log API","status":"ok","timezone":"America/Sao_Paulo",
 "checks":{"db":"ok","redis":"ok"},"timestamp":"2026-08-11T02:10:35.826Z"}

$ curl -s -o /dev/null -w "%{http_code}" https://aquilog.cursar.space/          → 200
$ curl -s -o /dev/null -w "%{http_code}" https://aquilog.cursar.space/entregas  → 200  (fallback de SPA)
```

**Criação de conta funcionando pelo domínio** (era o critério do dono):

```
POST https://aquilog-api.cursar.space/api/v1/auth/register/customer
{"user":{"id":"1cb0fb64-…","name":"Cliente Runtime Publico","role":"CUSTOMER",
 "customerId":"0a337a59-…"},"temAccessToken":true,"temRefreshToken":true}

POST /auth/login  → {"login":true,"nome":"Cliente Runtime Publico"}
GET  /deliveries (Bearer) → "0 entregas do cliente novo"
```

**Dashboard em navegador real** (Chrome, pelo domínio):

- título `Aqui Log | Operacoes`, React montado, tela "Entre na sua conta"
  renderizada com a identidade laranja;
- a página, a partir da origem `aquilog.cursar.space`, alcançou
  `https://aquilog-api.cursar.space/api/v1/health` com sucesso — prova de CORS e
  roteamento de ponta a ponta no navegador;
- **não foi feito login no painel**: digitar senha em formulário está fora do
  que este agente faz. O login de admin em navegador continua para o Álvaro.

### 3.5 Reinicialização

```
$ systemctl --user restart aqui-log-api aqui-log-dashboard cloudflared-aqui-log
$ systemctl --user is-active aqui-log-api aqui-log-dashboard cloudflared-aqui-log
active / active / active
$ curl -s https://aquilog-api.cursar.space/api/v1/health   → status ok, db ok, redis ok
$ curl -s -o /dev/null -w "%{http_code}" https://aquilog.cursar.space/  → 200
```

E o **smoke completo rodou contra o domínio público**, com o runtime definitivo
(inclusive upload de foto pela URL da presign pública):

```
$ API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke
Smoke test aprovado: AQL-MSO1AV33B4V (797bef41-…) + agendado AQL-MSO1AZMBHLL + reoferta 2c04b9ce-…
```

### 3.6 Correção de caminho no dashboard

`pnpm build` na raiz não passa `VITE_API_URL`, então qualquer build "normal"
publicava um dashboard apontando para `localhost:3001` — e a tela quebraria em
silêncio para quem abrisse pelo domínio. `apps/dashboard/src/api.ts` ganhou uma
rede de proteção: sem a variável, se a página não estiver em `localhost`, usa a
API pública do mesmo túnel. A variável continua sendo o caminho certo no build
de produção.

---

## 4. Limitações e o que **não** foi feito

- **Recarga de saldo não existe** (`PAY-02`/Pagar.me, `DEC-06`). Um cliente que
  instalar o APK e criar conta **não consegue publicar pedido** até um admin
  creditar saldo (`POST /finance/accounts/customer/:id/adjust`). A carteira do
  app explica isso; o produto só fica auto-suficiente com `PAY-02`.
- **QA visual do app em aparelho/emulador não foi feito** — segue em `UX-02`. O
  APK foi gerado e teve a URL conferida no binário, mas ninguém o instalou.
- **Login de admin no painel pelo navegador não foi executado** (senha em
  formulário está fora do escopo deste agente). O carregamento, o roteamento de
  SPA e o acesso à API a partir da origem pública foram provados.
- QA de navegador das seções "Modo agendado" e "Reoferta por aneis" continua
  pendente (`UX-02`).
- **Sem backup automatizado** do banco no caminho novo — é `OPS-01`. O dump
  pré-migração é pontual e ficou fora do repositório.
- `PAY-DEC-02` (política de cancelamento do cliente após aceite/coleta) segue
  sem decisão — nada foi inventado.
- Fora de escopo por instrução: `PAY-02`, `COUR-02`, `B2C-04`, `DISP-03`, lote,
  frota e qualquer coisa de cloud (Render/Vercel/Firebase).
