# Evidência — App do entregador completo + APK

> **Data:** 2026-08-11
> **Agente:** Claude (Opus 5), continuação da sessão do app do cliente
> **Ambiente:** PC `acer`; runtime de distribuição no ar
> (`https://aquilog-api.cursar.space/api/v1`), Flutter stable, Node v22.22.2
> **Base:** `main` @ `5ca60e0` (OPS-01A) sobre `3d66fd0` (app cliente)
> **Escopo:** terminar a parte principal do `courier_app` e exportar o APK, no
> mesmo padrão do app do cliente

---

## 0. Resumo

| Item | Resultado |
| --- | --- |
| App do entregador | ✅ URL pública, auto-login, **cadastro no app**, repasse na oferta, carteira do ledger, erros tratados |
| APK | ✅ `dist/aqui-log-entregador-2026-08-11.apk` (arm64, 19,3 MB) |
| Fluxo de aprovação | ✅ documentado e **provado ao vivo** contra a API pública |
| Contratos `COUR-01` / `PICK-01` / `DISP-02` | ✅ intactos, com trava nova de teste |

---

## 1. O que faltava no app do entregador

As telas de execução já existiam (ofertas com mapa, abas Em andamento / Agenda /
Concluídas de `COUR-01`, detalhe, comprovante com código de `PICK-01`, carteira,
perfil). O que faltava era, em ordem de gravidade:

### 1.1 A URL da API impedia o APK de funcionar (mesmo achado do app cliente)

`app_state.dart` tinha `http://10.0.2.2:3001/api/v1` — o loopback do
**emulador**. Um APK instalado num celular real não alcança isso. Corrigido para
o domínio público, com override preservado e travado por teste:

```dart
const String kDefaultApiBaseUrl = String.fromEnvironment(
  'AQUI_LOG_API',
  defaultValue: 'https://aquilog-api.cursar.space/api/v1',
);
```

Conferido **dentro do APK gerado**:

```
$ strings lib/arm64-v8a/libapp.so | grep -o "https://aquilog-api.cursar.space[a-z/0-9]*" | sort -u
https://aquilog-api.cursar.space/api/v1
```

### 1.2 Não havia como um entregador criar conta pelo app

O app só tinha login. Um motoboy que instalasse o APK **não tinha nenhum caminho
para se cadastrar** — dependia de alguém criar a conta por fora. Adicionada a
tela `register_screen.dart` com nome, e-mail, senha, CPF, tipo de veículo
(`VehicleType` da API) e placa.

Duas decisões que vieram do comportamento real do servidor (§2):

- **não existe auto-login aqui.** Diferente do cliente, a API cria a conta com
  `status: PENDING`, sem tokens, e o login responde `401 Cadastro ainda nao
  aprovado` até um admin aprovar. A tela termina numa confirmação que diz isso
  ("Cadastro enviado! Sua conta está em análise…"). Fingir uma entrada direta só
  produziria um erro logo depois;
- **bicicleta não pede placa** — exigir uma travaria o cadastro de quem entrega
  de bike.

### 1.3 Auto-login

A sessão vivia só em memória: toda abertura caía no login. Mesmo padrão do app
do cliente — sessão persistida + refresh do par de tokens na abertura + splash
enquanto restaura. O `PrefsSessionStore` do entregador usa **chave própria**
(`aqui_log_entregador.sessao`): os dois apps podem estar no mesmo aparelho e não
podem trocar de sessão entre si.

Para não duplicar código, o **contrato** (`SessionStore`), o **modelo**
(`StoredSession`) e o `MemorySessionStore` foram para o `aqui_log_core`, que é
Dart puro e roda em `dart test`; em cada app ficou só a ligação com o
`shared_preferences`, que é plugin Flutter e não pode entrar no core. O
`session_store.dart` do app cliente virou reexport — nenhum import existente
mudou.

### 1.4 O card da oferta não dizia quanto o entregador ganha

`courierFeeCents` **já vinha** no payload da oferta (o corte de papel em
`present()` não remove esse campo para o `COURIER`), mas o card não mostrava: o
entregador aceitava sem saber o valor. Adicionado o bloco "Você recebe" no card
da oferta e no detalhe da corrida. Provado ao vivo em §2.3.

### 1.5 Aceitar/recusar e mudar status eram "dispara e esquece"

- **Oferta**: sem trava, um toque duplo dispara duas chamadas; e a oferta tem
  TTL, podendo ser aceita por outro entregador no meio do caminho. Agora o card
  trava enquanto decide, e `404`/`409` viram *"Essa oferta não está mais
  disponível."* em vez de sumirem sem explicação.
- **Status** (`AT_PICKUP`/`IN_TRANSIT`): o servidor recusa transição fora da
  janela do agendado com `409` (`DEC-20`), e essa recusa não aparecia em lugar
  nenhum — o entregador achava que tinha dado certo. Agora há confirmação e
  mensagem de erro.
- **Disponibilidade**: se o servidor recusar a troca, o switch volta ao estado
  anterior em vez de mostrar um estado que a operação não conhece. E, offline, a
  tela explica que é por isso que não chega oferta.

### 1.6 Carteira

Usava `Map` cru e imprimia **`R$ 18.00`, com ponto** — errado em pt-BR.
Migrada para o `WalletStatement` tipado do core e `formatCents`. O texto agora
diz o que é verdade: o repasse fica registrado e **o saque é feito pela equipe**
— payout automático não existe no servidor (não foi inventado botão).

---

## 2. Verificação contra o runtime real

Tudo abaixo rodou contra `https://aquilog-api.cursar.space/api/v1`.

### 2.1 Fluxo de cadastro e aprovação do entregador (provado)

```
POST /auth/register/courier
→ {"id":"025ae778-…","courierId":"c7834883-…","status":"PENDING"}

POST /auth/login (antes da aprovação)
→ HTTP 401 {"message":"Cadastro ainda nao aprovado"}

PATCH /couriers/c7834883-…/approve   (admin)
→ {"id":"c7834883-…","status":"ACTIVE"}

POST /auth/login (depois)
→ {"ok":true,"role":"COURIER"}
```

**Conclusão operacional: a aprovação é manual e é um passo obrigatório.** Um
motoboy que instala o APK e se cadastra **não recebe ofertas** até alguém
aprovar. Hoje isso se faz por API (`PATCH /couriers/:id/approve`, papéis
admin) — a fila de aprovação **não tem tela no painel**, então o operador
precisa da chamada direta. Criar essa tela é trabalho de `ADMIN-*` e não foi
feito aqui.

### 2.2 Rotas do app respondendo para um entregador aprovado

```
PATCH /couriers/me/availability   → 200
PATCH /couriers/me/location       → 200
GET   /deliveries/offers/mine     → 200
GET   /deliveries                 → 200
GET   /finance/statement          → 200
```

### 2.3 Uma oferta de verdade, como o app do entregador a recebe

Cliente com saldo criou um pedido (R$ 19,83) e o admin despachou:

```json
{
  "ofertaId": "dc0dcf37-…",
  "entrega": {
    "code": "AQL-MSO3U6XN8L7",
    "courierFeeCents": 1586,          // ← alimenta o "Você recebe R$ 15,86"
    "priceCents": 1983,
    "fulfillmentMode": "IMMEDIATE",
    "temPickupCode": false,           // PICK-01 intacto
    "temPropostaAumento": false       // DISP-02 intacto
  }
}
```

Depois do aceite (`PATCH /deliveries/offers/:id/accept` → 200), a corrida como o
entregador a vê:

```json
{
  "code": "AQL-MSO3U6XN8L7", "status": "ACCEPTED",
  "courierFeeCents": 1586,
  "pickupCodeRequired": true, "pickupCodeAttemptsLeft": 5,
  "VAZOU_pickupCode": false, "VAZOU_priceBoost": false
}
```

Ou seja: o app recebe **a exigência** do código e as tentativas restantes, e
**nunca o código** — que é do cliente. Um teste novo (`o app do entregador nao
expoe o codigo de recolhimento`) trava esse contrato no lado do app, além do
smoke que já o trava no servidor.

---

## 3. Comandos e contagens

```
$ cd apps/courier_app && flutter analyze
No issues found! (ran in 3.1s)

$ flutter test
00:06 +28: All tests passed!            (eram 18 testes; +10 nesta rodada)

$ cd packages/aqui_log_core && dart analyze && dart test
No issues found!
00:00 +29: All tests passed!            (eram 23; +6 do session_store_test.dart)

$ cd apps/customer_app && flutter analyze && flutter test
No issues found! (ran in 7.9s)
00:04 +21: All tests passed!            (sem regressão pela mudança do core)

$ pnpm build && pnpm lint && pnpm test
Test Suites: 25 passed, 25 total
Tests:       219 passed, 219 total

$ API_URL=https://aquilog-api.cursar.space/api/v1 pnpm smoke
Smoke test aprovado: AQL-MSO3WTKW5FY + agendado AQL-MSO3WXRDRWB + reoferta 8ceef243-…
```

Testes novos do app do entregador: auto-login restaura a sessão · logout apaga a
sessão · URL padrão é o domínio público · cadastro coleta os dados e confirma a
análise (CPF só com dígitos, `vehicleType` correto) · bicicleta não pede placa ·
repasse aparece no card da oferta · oferta que sumiu vira frase legível · aviso
de offline · recusa do servidor aparece na tela · o código de recolhimento não
vaza. No core: round-trip de `StoredSession`, sessão sem token inválida, sessão
sem refresh válida, `MemorySessionStore` e `formatCents`.

## 4. APK

```
$ cd apps/courier_app && flutter build apk --release --target-platform android-arm64
✓ Built build/app/outputs/flutter-apk/app-release.apk (19.3MB)
```

| Item | Valor |
| --- | --- |
| **Caminho** | `/home/acer/Documentos/aqui-log/dist/aqui-log-entregador-2026-08-11.apk` |
| Tamanho | 19,3 MB (arm64-v8a) |
| SHA-256 | `2a00d4d25a351af3977b8864d42d50a88893a8ccc7555edec863f3c21fdc6320` |
| applicationId | `br.com.aquilog.aqui_log_entregador` |
| Label | Aqui Log Entregador |
| API embutida | `https://aquilog-api.cursar.space/api/v1` (conferida no binário) |

`dist/` está no `.gitignore` — o APK não vai para o repositório, de propósito.

---

## 5. Limitações e o que **não** foi feito

- **A aprovação do entregador é manual e não tem tela.** É o passo que trava um
  motoboy novo. Hoje só por API (`PATCH /couriers/:id/approve`). Fila de
  aprovação no painel é `ADMIN-*`.
- **O entregador não avalia o cliente.** A rota de avaliação
  (`POST /deliveries/:id/rate`) grava `customerId` do usuário autenticado — é
  do cliente. Avaliação mútua é `B2C-03`, que está `BLOCKED`; não foi inventada
  uma rota nova.
- **Não há cancelamento pelo entregador** — é `COUR-02` (com taxa), fora do
  escopo desta rodada por instrução.
- **Não existe saque/payout.** O saldo do ledger fica registrado; sacar é
  operação manual da equipe. A tela diz isso.
- **QA visual em aparelho/emulador não foi feito** (`UX-02`): o APK foi gerado e
  teve a URL conferida no binário, mas ninguém o instalou.
- **A lista do entregador não pagina** (pendência aberta de `COUR-01`: a aba
  *Concluídas* cresce sem limite) e a classificação das abas usa o relógio do
  aparelho — nada disso mudou aqui.
- O app **não consome WebSocket**: ofertas e status chegam por
  polling/*pull-to-refresh*, como antes.
- Fora de escopo por instrução: `PAY-02`, `COUR-02`, `B2C-04`, `DISP-03`, lote,
  frota e cloud.
