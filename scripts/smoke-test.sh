#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_value() { sed -n "s/^$1=//p" "$ROOT_DIR/.env" 2>/dev/null | tail -1; }
PORT_VALUE="${PORT:-$(env_value PORT)}"
ADMIN_EMAIL_VALUE="${ADMIN_EMAIL:-$(env_value ADMIN_EMAIL)}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
API_URL="${API_URL:-http://localhost:${PORT_VALUE:-3000}/api/v1}"
RUN_ID="$(date +%s)"
RUN_DOC="$(printf '%011d' "$RUN_ID")"
CUSTOMER_EMAIL="cliente.${RUN_ID}@aquilog.test"
COURIER_EMAIL="entregador.${RUN_ID}@aquilog.test"
TEST_PASSWORD="TesteSeguro123!"
PICKUP_LATITUDE="$(awk -v id="$RUN_ID" 'BEGIN { printf "%.6f", -20 + (id % 1000000) / 1000000 }')"
PICKUP_LONGITUDE="$(awk -v id="$RUN_ID" 'BEGIN { printf "%.6f", -44 + (id % 1000000) / 1000000 }')"
DELIVERY_LATITUDE="$(awk -v value="$PICKUP_LATITUDE" 'BEGIN { printf "%.6f", value + 0.01 }')"
DELIVERY_LONGITUDE="$(awk -v value="$PICKUP_LONGITUDE" 'BEGIN { printf "%.6f", value + 0.01 }')"

api() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-fsS -X "$method" "$API_URL$path" -H "Content-Type: application/json")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}"
}

# Igual a `api`, mas devolve "<corpo>\n<status>" em vez de falhar no 4xx.
# Usado para provar que uma requisição inválida é mesmo recusada.
api_status() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-sS -o - -w '\n%{http_code}' -X "$method" "$API_URL$path" -H "Content-Type: application/json")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}"
}

# Sobe um arquivo pelo presign e devolve a URL pública. `purpose` é
# "proof" (prova do motoboy) ou "product" (foto da encomenda do cliente).
upload_file() {
  local purpose="$1" token="$2" label="$3"
  local presign
  presign="$(api POST /storage/presign "$token" "$(jq -nc --arg purpose "$purpose" '{purpose:$purpose,contentType:"image/jpeg"}')")"
  local upload_url file_url
  upload_url="$(jq -er '.uploadUrl' <<<"$presign")"
  file_url="$(jq -er '.fileUrl' <<<"$presign")"
  if ! curl -fsS -X PUT "$upload_url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: image/jpeg" \
    --data-binary "fake-jpeg-$label-$RUN_ID" >/dev/null; then
    printf 'Falha ao enviar "%s" em %s.\n' "$label" "$upload_url" >&2
    printf 'A URL de upload vem de PUBLIC_API_URL no servidor; ela precisa apontar para a mesma API de %s.\n' "$API_URL" >&2
    return 1
  fi
  printf '%s' "$file_url"
}

api GET /health | jq -e '.status == "ok"' >/dev/null
api GET /health | jq -e '.checks.redis == "ok" and .checks.db == "ok"' >/dev/null

admin_login="$(api POST /auth/login "" "$(jq -nc --arg email "${ADMIN_EMAIL_VALUE:-admin@aquilog.com.br}" --arg password "${ADMIN_PASSWORD_VALUE:-AdminLocal123!}" '{email:$email,password:$password}')")"
admin_token="$(jq -er '.accessToken' <<<"$admin_login")"
# refresh token pair
refresh_token="$(jq -er '.refreshToken' <<<"$admin_login")"
refreshed="$(api POST /auth/refresh "" "$(jq -nc --arg refreshToken "$refresh_token" '{refreshToken:$refreshToken}')")"
jq -er '.accessToken' <<<"$refreshed" >/dev/null

# PAY-01: GET /finance/summary agrega o ledger INTEIRO do banco (todas as contas,
# de todas as execucoes anteriores). O banco local nao e zerado entre rodadas,
# entao a asserção final compara o DELTA desta execucao, nao o total acumulado.
# Baseline capturada antes de qualquer pedido deste run.
summary_baseline="$(api GET /finance/summary "$admin_token")"
baseline_courier_obligation="$(jq -er '.courierObligationCents' <<<"$summary_baseline")"

# Cliente pessoa física: registro auto-aprovado com auto-login (B2C)
customer_login="$(api POST /auth/register/customer "" "$(jq -nc --arg name 'Cliente Teste' --arg email "$CUSTOMER_EMAIL" --arg password "$TEST_PASSWORD" --arg document "$RUN_DOC" --arg phone '+5531999999999' '{name:$name,email:$email,password:$password,document:$document,phone:$phone}')")"
customer_token="$(jq -er '.accessToken' <<<"$customer_login")"
customer_id="$(jq -er '.user.customerId' <<<"$customer_login")"

# PAY-01 / DEC-05: produto pré-pago. A criação de pedido reserva o preço no
# ledger do cliente, então o smoke credita saldo de teste ANTES de qualquer
# pedido, pela operação administrativa auditada (única forma de crédito sem
# gateway). R$ 10.000,00 cobrem todos os pedidos dos blocos seguintes.
adjust_response="$(api POST "/finance/accounts/customer/$customer_id/adjust" "$admin_token" "$(jq -nc '{amountCents:1000000,reason:"Credito de teste PAY-01"}')")"
jq -e '.id != null' <<<"$adjust_response" >/dev/null
api GET /finance/statement "$customer_token" | jq -e '.availableCents == 1000000 and .reservedCents == 0 and .balanceCents == 1000000' >/dev/null
api GET /finance/statement "$customer_token" | jq -e '.entries[0].type == "ADJUSTMENT" and (.entries[0].description | test("Credito de teste PAY-01")) and .entries[0].amountCents == 1000000' >/dev/null
api GET /audit "$admin_token" | jq -e 'any(.action == "FINANCE_ADJUSTMENT" and .metadata.reason == "Credito de teste PAY-01")' >/dev/null

courier="$(api POST /auth/register/courier "" "$(jq -nc --arg name 'Entregador Teste' --arg email "$COURIER_EMAIL" --arg password "$TEST_PASSWORD" --arg document "$RUN_DOC" '{name:$name,email:$email,password:$password,document:$document,vehicleType:"MOTORCYCLE",vehiclePlate:"AQL1T23",documentUrls:["https://example.com/documento-teste.pdf"]}')")"
courier_id="$(jq -er '.courierId' <<<"$courier")"

api PATCH "/couriers/$courier_id/approve" "$admin_token" >/dev/null

courier_token="$(api POST /auth/login "" "$(jq -nc --arg email "$COURIER_EMAIL" --arg password "$TEST_PASSWORD" '{email:$email,password:$password}')" | jq -er '.accessToken')"

api PATCH /couriers/me/location "$courier_token" "$(jq -nc --argjson latitude "$PICKUP_LATITUDE" --argjson longitude "$PICKUP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null
api PATCH /couriers/me/availability "$courier_token" '{"available":true}' >/dev/null

# B2C-05 / DEC-01: a foto da encomenda é obrigatória na criação, então o
# cliente sobe a foto antes de publicar o pedido.
product_photo="$(upload_file product "$customer_token" produto)" || exit 1

new_order_payload() {
  jq -nc \
    --argjson pickupLatitude "$PICKUP_LATITUDE" \
    --argjson pickupLongitude "$PICKUP_LONGITUDE" \
    --argjson deliveryLatitude "$DELIVERY_LATITUDE" \
    --argjson deliveryLongitude "$DELIVERY_LONGITUDE" \
    --arg productPhotoUrl "$product_photo" \
    '{pickupAddress:"Av. Afonso Pena, 1000 - Centro",pickupLatitude:$pickupLatitude,pickupLongitude:$pickupLongitude,deliveryAddress:"Praca da Liberdade - Savassi",deliveryLatitude:$deliveryLatitude,deliveryLongitude:$deliveryLongitude,recipientName:"Cliente Teste",recipientPhone:"+5531999999999",productType:"OTHER",packageSize:"SMALL",weightKg:1.5,deliveryScope:"SAME_CITY",fulfillmentMode:"IMMEDIATE",productPhotoUrls:[$productPhotoUrl]}'
}

# SCHED-01: mesmo pedido, modo agendado, com janela a partir de agora.
scheduled_payload() {
  local start_minutes="$1" window_minutes="${2:-60}"
  local start end
  start="$(date -u -d "${start_minutes} minutes" +%Y-%m-%dT%H:%M:%S.000Z)"
  end="$(date -u -d "$((start_minutes + window_minutes)) minutes" +%Y-%m-%dT%H:%M:%S.000Z)"
  new_order_payload | jq -c \
    --arg start "$start" \
    --arg end "$end" \
    '.fulfillmentMode="SCHEDULED" | .pickupWindowStart=$start | .pickupWindowEnd=$end'
}

# Recusa esperada: devolve o status HTTP e aborta se nao for o esperado.
expect_rejected() {
  local label="$1" payload="$2" expected="${3:-400}"
  local response status
  response="$(api_status POST /deliveries "$customer_token" "$payload")"
  status="$(tail -n1 <<<"$response")"
  if [[ "$status" != "$expected" ]]; then
    printf '%s deveria ser recusado com %s, veio %s.\n' "$label" "$expected" "$status" >&2
    sed '$d' <<<"$response" >&2
    exit 1
  fi
  sed '$d' <<<"$response"
}

# Pedido incompleto (o payload legado, sem foto/tipo/tamanho/peso) tem de ser
# recusado com 400 e mensagem útil — este é o critério central do B2C-05.
incomplete_payload="$(new_order_payload | jq -c 'del(.productType,.packageSize,.weightKg,.productPhotoUrls,.deliveryScope)')"
rejected="$(api_status POST /deliveries "$customer_token" "$incomplete_payload")"
rejected_status="$(tail -n1 <<<"$rejected")"
rejected_body="$(sed '$d' <<<"$rejected")"
if [[ "$rejected_status" != "400" ]]; then
  printf 'Pedido sem foto/peso/tipo/tamanho deveria ser recusado com 400, veio %s.\n' "$rejected_status" >&2
  printf '%s\n' "$rejected_body" >&2
  exit 1
fi
jq -e '[.message[]] | any(. == "Envie ao menos uma foto da encomenda")' <<<"$rejected_body" >/dev/null

delivery="$(api POST /deliveries "$customer_token" "$(new_order_payload)")"
delivery_id="$(jq -er '.id' <<<"$delivery")"
delivery_code="$(jq -er '.code' <<<"$delivery")"
courier_fee="$(jq -er '.courierFeeCents' <<<"$delivery")"
price_cents="$(jq -er '.priceCents' <<<"$delivery")"
jq -en --argjson fee "$courier_fee" --argjson price "$price_cents" '$fee > 0 and $price >= $fee' >/dev/null
jq -e --arg photo "$product_photo" '.productType == "OTHER" and .packageSize == "SMALL" and (.weightKg | tonumber) == 1.5 and (.productPhotoUrls | index($photo) != null)' <<<"$delivery" >/dev/null

# B2C: o pedido do cliente é publicado automaticamente para os motoboys
# disponíveis (auto-dispatch no create). Se ninguém estava online no
# momento, cai no dispatch manual do admin.
offers="$(api GET /deliveries/offers/mine "$courier_token")"
offer_id="$(jq -r --arg deliveryId "$delivery_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty' <<<"$offers")"
if [[ -z "$offer_id" ]]; then
  dispatch="$(api POST "/deliveries/$delivery_id/dispatch" "$admin_token")"
  offer_id="$(jq -er '.offer.id' <<<"$dispatch")"
fi
api GET /deliveries/offers/mine "$courier_token" | jq -e --arg offer "$offer_id" 'map(.id) | index($offer) != null' >/dev/null
api PATCH "/deliveries/offers/$offer_id/accept" "$courier_token" >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"AT_PICKUP"}' >/dev/null

# PICK-01 / DEC-24: o código de recolhimento nasce no aceite. O cliente vê o
# número; o entregador vê só a exigência — se ele receber o código, o controle
# não vale nada e o smoke tem de reprovar.
customer_view="$(api GET "/deliveries/$delivery_id" "$customer_token")"
pickup_code="$(jq -er '.pickupCode' <<<"$customer_view")"
if [[ ! "$pickup_code" =~ ^[0-9]{4}$ ]]; then
  printf 'O cliente deveria ver um codigo de 4 digitos, veio "%s".\n' "$pickup_code" >&2
  exit 1
fi
courier_view="$(api GET "/deliveries/$delivery_id" "$courier_token")"
if jq -e 'has("pickupCode")' <<<"$courier_view" >/dev/null; then
  printf 'O app do entregador NAO pode receber o codigo de recolhimento.\n' >&2
  exit 1
fi
jq -e '.pickupCodeRequired == true and .pickupCodeAttemptsLeft == 5' <<<"$courier_view" >/dev/null

proof_pickup="$(upload_file proof "$courier_token" pickup)" || exit 1

# Sem código: a coleta tem de ser recusada mesmo com a foto correta.
sem_codigo="$(api_status PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_pickup" '{status:"PICKED_UP",proofUrl:$proofUrl}')")"
if [[ "$(tail -n1 <<<"$sem_codigo")" != "400" ]]; then
  printf 'Coleta sem codigo deveria ser recusada com 400, veio %s.\n' "$(tail -n1 <<<"$sem_codigo")" >&2
  exit 1
fi

# Código errado: recusa e consome uma tentativa (FLOW-DEC-03).
wrong_code="$(printf '%04d' $(( (10#$pickup_code + 1) % 10000 )))"
errado="$(api_status PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_pickup" --arg pickupCode "$wrong_code" '{status:"PICKED_UP",proofUrl:$proofUrl,pickupCode:$pickupCode}')")"
if [[ "$(tail -n1 <<<"$errado")" != "400" ]]; then
  printf 'Coleta com codigo errado deveria ser recusada com 400, veio %s.\n' "$(tail -n1 <<<"$errado")" >&2
  exit 1
fi
api GET "/deliveries/$delivery_id" "$courier_token" | jq -e '.pickupCodeAttemptsLeft == 4' >/dev/null

api PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_pickup" --arg pickupCode "$pickup_code" '{status:"PICKED_UP",proofUrl:$proofUrl,pickupCode:$pickupCode}')" >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"IN_TRANSIT"}' >/dev/null
proof_delivery="$(upload_file proof "$courier_token" delivery)" || exit 1
api PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_delivery" '{status:"DELIVERED",proofUrl:$proofUrl}')" >/dev/null

api GET "/deliveries/$delivery_id/history" "$customer_token" | jq -e 'length >= 7' >/dev/null
api POST "/deliveries/$delivery_id/rating" "$customer_token" '{"score":5,"comment":"Entrega concluida no fluxo de teste"}' >/dev/null
api GET /finance/statement "$courier_token" | jq -e --argjson fee "$courier_fee" '.balanceCents == $fee' >/dev/null
api GET /notifications "$customer_token" | jq -e 'length > 0' >/dev/null
api GET /audit "$admin_token" | jq -e 'length > 0' >/dev/null

# ---------------------------------------------------------------------------
# SCHED-01 / B2C-06 — modo agendado individual com aceite antecipado.
# ---------------------------------------------------------------------------

# FLOW-DEC-02: janela no passado e antecedencia menor que 30 min sao recusadas.
expect_rejected 'Agendado com janela no passado' "$(scheduled_payload -180)" >/dev/null
curto="$(expect_rejected 'Agendado com menos de 30 min de antecedencia' "$(scheduled_payload 10)")"
jq -e '(.message | if type == "array" then .[] else . end) | test("30 minutos")' <<<"$curto" >/dev/null
# Fim antes do inicio tambem nao passa.
invertida="$(scheduled_payload 120 | jq -c '.pickupWindowEnd = .pickupWindowStart')"
expect_rejected 'Agendado com janela invertida' "$invertida" >/dev/null
# Janela em modo imediato e contradicao, nao detalhe.
imediato_com_janela="$(scheduled_payload 120 | jq -c '.fulfillmentMode="IMMEDIATE"')"
expect_rejected 'Imediato com janela' "$imediato_com_janela" >/dev/null

# Janela valida: 2 h a frente, com 1 h de duracao.
scheduled="$(api POST /deliveries "$customer_token" "$(scheduled_payload 120)")"
scheduled_id="$(jq -er '.id' <<<"$scheduled")"
scheduled_code="$(jq -er '.code' <<<"$scheduled")"
jq -e '.fulfillmentMode == "SCHEDULED" and .pickupWindowStart != null and .pickupWindowEnd != null' <<<"$scheduled" >/dev/null

# DEC-19: o km do agendado e menor que o do imediato, e fica congelado no pedido.
km_imediato="$(jq -er '.pricingBreakdown.kmRateCents' <<<"$delivery")"
km_agendado="$(jq -er '.kmRateCents' <<<"$scheduled")"
jq -en --argjson imediato "$km_imediato" --argjson agendado "$km_agendado" '$agendado < $imediato' >/dev/null
jq -e --argjson km "$km_agendado" '.pricingBreakdown.kmRateCents == $km and .pricingBreakdown.fulfillmentMode == "SCHEDULED"' <<<"$scheduled" >/dev/null

# DEC-20: o agendado ja nasce na fila de ofertas e pode ser aceito agora.
scheduled_offers="$(api GET /deliveries/offers/mine "$courier_token")"
scheduled_offer_id="$(jq -r --arg deliveryId "$scheduled_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty' <<<"$scheduled_offers")"
if [[ -z "$scheduled_offer_id" ]]; then
  scheduled_dispatch="$(api POST "/deliveries/$scheduled_id/dispatch" "$admin_token")"
  scheduled_offer_id="$(jq -er '.offer.id' <<<"$scheduled_dispatch")"
fi
api PATCH "/deliveries/offers/$scheduled_offer_id/accept" "$courier_token" >/dev/null
api GET "/deliveries/$scheduled_id" "$courier_token" | jq -e '.status == "ACCEPTED"' >/dev/null

# DEC-20: aceito, mas a execucao so abre na janela — AT_PICKUP antes disso e 409.
cedo="$(api_status PATCH "/deliveries/$scheduled_id/status" "$courier_token" '{"status":"AT_PICKUP"}')"
if [[ "$(tail -n1 <<<"$cedo")" != "409" ]]; then
  printf 'AT_PICKUP antes da janela deveria dar 409, veio %s.\n' "$(tail -n1 <<<"$cedo")" >&2
  exit 1
fi

# Congelamento (DEC-19): mexer na tarifa nao altera pedido ja criado.
settings_antes="$(api GET /settings "$admin_token")"
km_original="$(jq -er '.pricingPerKmScheduledCents' <<<"$settings_antes")"
api PATCH /settings "$admin_token" "$(jq -nc --argjson value "$((km_original + 37))" '{pricingPerKmScheduledCents:$value}')" >/dev/null
api GET "/deliveries/$scheduled_id" "$customer_token" | jq -e --argjson km "$km_agendado" '.kmRateCents == $km' >/dev/null
api PATCH /settings "$admin_token" "$(jq -nc --argjson value "$km_original" '{pricingPerKmScheduledCents:$value}')" >/dev/null

# O admin consegue separar os dois modos na listagem.
api GET "/deliveries?fulfillmentMode=SCHEDULED&limit=50" "$admin_token" | jq -e --arg id "$scheduled_id" '[.items[].id] | index($id) != null' >/dev/null
api GET "/deliveries?fulfillmentMode=IMMEDIATE&limit=50" "$admin_token" | jq -e --arg id "$scheduled_id" '[.items[].id] | index($id) == null' >/dev/null

# ---------------------------------------------------------------------------
# DISP-01 — reoferta por aneis, exclusao de recusas e limite de rodadas.
# ---------------------------------------------------------------------------

# O cenario roda 55 km ao norte do ponto base e, antes de comecar, SUSPENDE os
# motoboys de execucoes anteriores do smoke. Sem isso o resultado dependeria do
# historico do banco: execucoes seguidas deixam motoboys a poucos metros uns dos
# outros, e a rodada 2 poderia cair em qualquer um deles. Como este e o ultimo
# bloco do smoke, suspender nao afeta nenhuma outra assercao.
# Os aneis vem das settings (Redis), que sobrevivem entre execucoes. Fixar aqui
# os valores do cenario torna o bloco idempotente mesmo depois de uma execucao
# interrompida no meio.
api PATCH /settings "$admin_token" '{"dispatchInitialRadiusKm":3,"dispatchRingIncrementKm":3,"dispatchMaxRounds":4,"dispatchTotalDurationMinutes":20}' >/dev/null

api GET /couriers "$admin_token" \
  | jq -r --arg atual "$courier_id" '.[] | select(.status == "ACTIVE") | select(.id != $atual) | .id' \
  | while read -r residual; do
      api PATCH "/couriers/$residual/suspend" "$admin_token" >/dev/null
    done

DISP_LATITUDE="$(awk -v value="$PICKUP_LATITUDE" 'BEGIN { printf "%.6f", value + 0.5 }')"
DISP_LONGITUDE="$PICKUP_LONGITUDE"
# ~5 km ao norte do ponto de coleta: fora do anel 1 (3 km), dentro do anel 2 (6 km).
DISP_FAR_LATITUDE="$(awk -v value="$DISP_LATITUDE" 'BEGIN { printf "%.6f", value + 0.045 }')"

disp_payload() {
  new_order_payload | jq -c \
    --argjson pickupLatitude "$DISP_LATITUDE" \
    --argjson pickupLongitude "$DISP_LONGITUDE" \
    --argjson deliveryLatitude "$DISP_FAR_LATITUDE" \
    --argjson deliveryLongitude "$DISP_LONGITUDE" \
    '.pickupLatitude=$pickupLatitude | .pickupLongitude=$pickupLongitude | .deliveryLatitude=$deliveryLatitude | .deliveryLongitude=$deliveryLongitude'
}

# O motoboy do fluxo principal vai para cima da coleta (anel 1).
api PATCH /couriers/me/location "$courier_token" "$(jq -nc --argjson latitude "$DISP_LATITUDE" --argjson longitude "$DISP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null
api PATCH /couriers/me/availability "$courier_token" '{"available":true}' >/dev/null

# Um segundo motoboy, a 5 km: so alcancavel quando o raio ampliar.
COURIER2_EMAIL="entregador2.${RUN_ID}@aquilog.test"
courier2="$(api POST /auth/register/courier "" "$(jq -nc --arg name 'Entregador Anel 2' --arg email "$COURIER2_EMAIL" --arg password "$TEST_PASSWORD" --arg document "$(printf '%011d' $((RUN_ID + 1)))" '{name:$name,email:$email,password:$password,document:$document,vehicleType:"MOTORCYCLE",vehiclePlate:"AQL2T34",documentUrls:["https://example.com/documento-teste.pdf"]}')")"
courier2_id="$(jq -er '.courierId' <<<"$courier2")"
api PATCH "/couriers/$courier2_id/approve" "$admin_token" >/dev/null
courier2_token="$(api POST /auth/login "" "$(jq -nc --arg email "$COURIER2_EMAIL" --arg password "$TEST_PASSWORD" '{email:$email,password:$password}')" | jq -er '.accessToken')"
api PATCH /couriers/me/location "$courier2_token" "$(jq -nc --argjson latitude "$DISP_FAR_LATITUDE" --argjson longitude "$DISP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null
api PATCH /couriers/me/availability "$courier2_token" '{"available":true}' >/dev/null

disp="$(api POST /deliveries "$customer_token" "$(disp_payload)")"
disp_id="$(jq -er '.id' <<<"$disp")"
disp_price="$(jq -er '.priceCents' <<<"$disp")"

# Rodada 1: a oferta tem de ir para quem esta em cima da coleta, no anel de 3 km.
disp_offer1="$(api GET /deliveries/offers/mine "$courier_token" | jq -r --arg deliveryId "$disp_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty')"
if [[ -z "$disp_offer1" ]]; then
  disp_offer1="$(api POST "/deliveries/$disp_id/dispatch" "$admin_token" | jq -er '.offer.id')"
fi
api GET /deliveries/offers/mine "$courier_token" | jq -e --arg offer "$disp_offer1" 'map(select(.id == $offer)) | .[0] | .dispatchRound == 1 and (.radiusKm | tonumber) == 3 and .eligibleCount == 1 and .attemptedCount == 1' >/dev/null
# Rodada 1 nao alcanca quem esta a 5 km: o unico elegivel era o de cima da coleta.
api GET /deliveries/offers/mine "$courier2_token" | jq -e --arg deliveryId "$disp_id" 'map(select(.delivery.id == $deliveryId)) | length == 0' >/dev/null

# Enquanto ha oferta pendente, o job repetido (aqui: um segundo despacho) nao
# pode criar outra oferta para o mesmo pedido.
duplicado="$(api_status POST "/deliveries/$disp_id/dispatch" "$admin_token")"
if [[ "$(tail -n1 <<<"$duplicado")" != "409" ]]; then
  printf 'Despacho repetido com oferta pendente deveria dar 409, veio %s.\n' "$(tail -n1 <<<"$duplicado")" >&2
  exit 1
fi

# Recusa: o mesmo motoboy nao pode receber de volta, e o raio amplia para 6 km,
# alcancando o segundo motoboy.
api PATCH "/deliveries/offers/$disp_offer1/reject" "$courier_token" >/dev/null
api GET /deliveries/offers/mine "$courier_token" | jq -e --arg deliveryId "$disp_id" 'map(select(.delivery.id == $deliveryId)) | length == 0' >/dev/null
disp_offer2="$(api GET /deliveries/offers/mine "$courier2_token" | jq -r --arg deliveryId "$disp_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty')"
if [[ -z "$disp_offer2" ]]; then
  printf 'Apos a recusa, a rodada 2 deveria ter ofertado ao motoboy de 5 km.\n' >&2
  api GET "/deliveries/$disp_id" "$admin_token" >&2
  exit 1
fi
api GET /deliveries/offers/mine "$courier2_token" | jq -e --arg offer "$disp_offer2" 'map(select(.id == $offer)) | .[0] | .dispatchRound == 2 and (.radiusKm | tonumber) == 6 and .attemptedCount == 2' >/dev/null
# DEC-03: reoferta usa o snapshot; o preco do cliente nao muda sozinho.
api GET "/deliveries/$disp_id" "$customer_token" | jq -e --argjson price "$disp_price" '.priceCents == $price and .dispatchRound == 2 and .dispatchEndReason == null' >/dev/null

# Limite de rodadas: com 1 rodada, a recusa esgota o ciclo e o pedido fica em
# estado recuperavel (continua REQUESTED, com motivo registrado).
api PATCH /settings "$admin_token" '{"dispatchMaxRounds":1}' >/dev/null
limite="$(api POST /deliveries "$customer_token" "$(disp_payload)")"
limite_id="$(jq -er '.id' <<<"$limite")"
limite_offer="$(api GET /deliveries/offers/mine "$courier_token" | jq -r --arg deliveryId "$limite_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty')"
if [[ -z "$limite_offer" ]]; then
  limite_offer="$(api POST "/deliveries/$limite_id/dispatch" "$admin_token" | jq -er '.offer.id')"
fi
api PATCH "/deliveries/offers/$limite_offer/reject" "$courier_token" >/dev/null
api GET "/deliveries/$limite_id" "$admin_token" | jq -e '.status == "REQUESTED" and .dispatchEndReason == "MAX_ROUNDS" and .dispatchEndedAt != null' >/dev/null
# Nenhum motoboy recebeu a corrida por reoferta automatica depois do limite.
api GET /deliveries/offers/mine "$courier2_token" | jq -e --arg deliveryId "$limite_id" 'map(select(.delivery.id == $deliveryId)) | length == 0' >/dev/null
# Acao de recuperacao: com o limite restaurado, o despacho do admin reabre o
# ciclo do zero — e quem recusou continua de fora.
api PATCH /settings "$admin_token" '{"dispatchMaxRounds":4}' >/dev/null
api PATCH /couriers/me/location "$courier2_token" "$(jq -nc --argjson latitude "$DISP_LATITUDE" --argjson longitude "$DISP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null
api POST "/deliveries/$limite_id/dispatch" "$admin_token" | jq -e '.offer.dispatchRound == 1 and (.offer.radiusKm | tonumber) == 3' >/dev/null
api GET "/deliveries/$limite_id" "$admin_token" | jq -e '.dispatchEndReason == null and .dispatchRound == 1' >/dev/null
api GET /deliveries/offers/mine "$courier2_token" | jq -e --arg deliveryId "$limite_id" 'map(select(.delivery.id == $deliveryId)) | length == 1' >/dev/null

# DISP-02 espera que TODAS as ofertas dos pedidos novos caiam no courier
# principal (courier_token). O courier2 foi movido para cima da coleta no
# cenario de recuperacao acima — devolver para 5 km, fora do anel 1 (3 km).
api PATCH /couriers/me/location "$courier2_token" "$(jq -nc --argjson latitude "$DISP_FAR_LATITUDE" --argjson longitude "$DISP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null

# DISP-02 — aviso de demora (plano §6.1.4), busca esgotada recuperável e
# consentimento do aumento de valor (plano §6.1.5 e DEC-03 §3.3).

# Aviso de demora: com 0 minutos, o primeiro tick do job grava o aviso — que é
# idempotente (uma vez por ciclo). O job roda a cada 10 s, então 13 s bastam.
# O despacho manual garante que o ciclo começou; sem candidato ele devolve 404
# e o pedido segue em busca — o aviso vale nos dois casos.
api PATCH /settings "$admin_token" '{"dispatchMaxRounds":1,"dispatchFirstWarningMinutes":0,"dispatchPriceBoostPercent":20}' >/dev/null
atrasado="$(api POST /deliveries "$customer_token" "$(disp_payload)")"
atrasado_id="$(jq -er '.id' <<<"$atrasado")"
api POST "/deliveries/$atrasado_id/dispatch" "$admin_token" >/dev/null 2>&1 || true
sleep 13
api GET "/deliveries/$atrasado_id" "$customer_token" | jq -e '.dispatchWarningAt != null' >/dev/null

# Com a busca ainda ativa, o cliente nao pode tentar de novo nem editar (409).
ativo_id="$(jq -er '.id' <<<"$(api POST /deliveries "$customer_token" "$(disp_payload)")")"
if [[ "$(tail -n1 <<<"$(api_status POST "/deliveries/$ativo_id/retry" "$customer_token")")" != "409" ]]; then
  printf 'Retry com busca ativa deveria dar 409.\n' >&2
  exit 1
fi
if [[ "$(tail -n1 <<<"$(api_status PATCH "/deliveries/$ativo_id" "$customer_token" '{"recipientName":"X"}')")" != "409" ]]; then
  printf 'Editar com busca ativa deveria dar 409.\n' >&2
  exit 1
fi

# Busca esgotada em MAX_ROUNDS: o cliente ve o motivo, a proposta de aumento
# (anterior -> novo, nunca aplicada sem consentimento) e consegue editar.
esgotado="$(api POST /deliveries "$customer_token" "$(disp_payload)")"
esgotado_id="$(jq -er '.id' <<<"$esgotado")"
esgotado_price="$(jq -er '.priceCents' <<<"$esgotado")"
esgotado_offer="$(api GET /deliveries/offers/mine "$courier_token" | jq -r --arg deliveryId "$esgotado_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty')"
if [[ -z "$esgotado_offer" ]]; then
  esgotado_offer="$(api POST "/deliveries/$esgotado_id/dispatch" "$admin_token" | jq -er '.offer.id')"
fi
api PATCH "/deliveries/offers/$esgotado_offer/reject" "$courier_token" >/dev/null
api GET "/deliveries/$esgotado_id" "$customer_token" | jq -e \
  --argjson price "$esgotado_price" \
  '.dispatchEndReason == "MAX_ROUNDS" and .priceBoostProposal != null and .priceBoostProposal.previousPriceCents == $price and .priceBoostProposal.newPriceCents == (($price * 1.2) | round)' >/dev/null
api PATCH "/deliveries/$esgotado_id" "$customer_token" '{"pickupAddress":"Rua Editada, 10","recipientName":"Nova Destinataria"}' \
  | jq -e --argjson price "$esgotado_price" '.pickupAddress == "Rua Editada, 10" and .recipientName == "Nova Destinataria" and .priceCents == $price' >/dev/null
# DEC-19: preco nunca vem do cliente; o servidor recusa o campo na edicao.
if [[ "$(tail -n1 <<<"$(api_status PATCH "/deliveries/$esgotado_id" "$customer_token" '{"priceCents":1}')")" != "400" ]]; then
  printf 'Editar preco pelo cliente deveria dar 400.\n' >&2
  exit 1
fi

# "Tentar novamente": reabre do zero, sem mudar o preco (DEC-19).
api POST "/deliveries/$esgotado_id/retry" "$customer_token" \
  | jq -e --argjson price "$esgotado_price" '.dispatchEndReason == null and .priceCents == $price' >/dev/null

# Consentimento do aumento: grava novo preco no snapshot e reabre a busca.
esgotado2="$(api POST /deliveries "$customer_token" "$(disp_payload)")"
esgotado2_id="$(jq -er '.id' <<<"$esgotado2")"
esgotado2_offer="$(api GET /deliveries/offers/mine "$courier_token" | jq -r --arg deliveryId "$esgotado2_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty')"
if [[ -z "$esgotado2_offer" ]]; then
  esgotado2_offer="$(api POST "/deliveries/$esgotado2_id/dispatch" "$admin_token" | jq -er '.offer.id')"
fi
api PATCH "/deliveries/offers/$esgotado2_offer/reject" "$courier_token" >/dev/null
novo_preco="$(api GET "/deliveries/$esgotado2_id" "$customer_token" | jq -er '.priceBoostProposal.newPriceCents')"
api POST "/deliveries/$esgotado2_id/price-boost/consent" "$customer_token" \
  | jq -e --argjson novo "$novo_preco" '.priceCents == $novo and .dispatchEndReason == null' >/dev/null

# Restaura as settings do cenario DISP-01 para nao vazar estado para a proxima
# execucao (o Redis sobrevive entre execucoes).
api PATCH /settings "$admin_token" '{"dispatchMaxRounds":4,"dispatchFirstWarningMinutes":5,"dispatchPriceBoostPercent":20}' >/dev/null

# A duracao total precisa caber ao menos uma oferta (validacao de settings).
curta="$(api_status PATCH /settings "$admin_token" '{"dispatchTotalDurationMinutes":1,"offerTtlSeconds":600}')"
if [[ "$(tail -n1 <<<"$curta")" != "400" ]]; then
  printf 'Duracao total menor que o TTL deveria ser recusada com 400, veio %s.\n' "$(tail -n1 <<<"$curta")" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# PAY-01 — ledger interno (DEC-05): reserva, liberacao, liquidacao e ajuste.
# ---------------------------------------------------------------------------

# 1. Pre-pago: cliente sem saldo nao consegue criar pedido (402).
sem_saldo="$(api POST /auth/register/customer "" "$(jq -nc --arg name 'Cliente Sem Saldo' --arg email "sem.saldo.${RUN_ID}@aquilog.test" --arg password "$TEST_PASSWORD" --arg document "$(printf '%011d' $((RUN_ID + 7)))" --arg phone '+5531999999998' '{name:$name,email:$email,password:$password,document:$document,phone:$phone}')")"
sem_saldo_token="$(jq -er '.accessToken' <<<"$sem_saldo")"
sem_saldo_id="$(jq -er '.user.customerId' <<<"$sem_saldo")"
faltando_saldo="$(api_status POST /deliveries "$sem_saldo_token" "$(new_order_payload)")"
if [[ "$(tail -n1 <<<"$faltando_saldo")" != "402" ]]; then
  printf 'Pedido sem saldo deveria ser recusado com 402, veio %s.\n' "$(tail -n1 <<<"$faltando_saldo")" >&2
  exit 1
fi
jq -e '.message | test("Saldo insuficiente")' < <(sed '$d' <<<"$faltando_saldo") >/dev/null

# 2. Ajuste administrativo: regras de entrada e papel.
motivo_curto="$(api_status POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$admin_token" "$(jq -nc '{amountCents:1000,reason:"abc"}')")"
if [[ "$(tail -n1 <<<"$motivo_curto")" != "400" ]]; then
  printf 'Ajuste com motivo curto deveria ser recusado com 400, veio %s.\n' "$(tail -n1 <<<"$motivo_curto")" >&2
  exit 1
fi
zero="$(api_status POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$admin_token" "$(jq -nc '{amountCents:0,reason:"Credito de teste nulo"}')")"
if [[ "$(tail -n1 <<<"$zero")" != "400" ]]; then
  printf 'Ajuste de zero centavo deveria ser recusado com 400, veio %s.\n' "$(tail -n1 <<<"$zero")" >&2
  exit 1
fi
# Debito maior que o saldo: 409 (saldo disponivel nunca fica negativo).
sem_saldo_statement="$(api GET /finance/statement "$sem_saldo_token")"
jq -e '.availableCents == 0 and .reservedCents == 0' <<<"$sem_saldo_statement" >/dev/null
debito_maior="$(api_status POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$admin_token" "$(jq -nc '{amountCents:-1000,reason:"Debito maior que o saldo"}')")"
if [[ "$(tail -n1 <<<"$debito_maior")" != "409" ]]; then
  printf 'Debito maior que o saldo deveria ser recusado com 409, veio %s.\n' "$(tail -n1 <<<"$debito_maior")" >&2
  exit 1
fi
# Papel errado: motoboy nao pode ajustar carteira (nem a propria).
sem_saldo_adjust_courier="$(api_status POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$courier_token" "$(jq -nc '{amountCents:1000,reason:"Credito de teste abusivo"}')")"
if [[ "$(tail -n1 <<<"$sem_saldo_adjust_courier")" != "403" ]]; then
  printf 'Ajuste por motoboy deveria ser recusado com 403, veio %s.\n' "$(tail -n1 <<<"$sem_saldo_adjust_courier")" >&2
  exit 1
fi

# 3. Idempotencia: ajuste repetido com a mesma chave nao duplica o credito.
# (--arg expande $RUN_ID: chave unica POR execucao — aspas simples deixariam
# literal "smoke-$RUN_ID" e a idempotencia bateria na transacao de outra rodada)
ajuste_a="$(api POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$admin_token" "$(jq -nc --arg key "smoke-$RUN_ID" '{amountCents:5000,reason:"Credito de teste idempotente",idempotencyKey:$key}')")"
ajuste_a_id="$(jq -er '.id' <<<"$ajuste_a")"
ajuste_b="$(api POST "/finance/accounts/customer/$sem_saldo_id/adjust" "$admin_token" "$(jq -nc --arg key "smoke-$RUN_ID" '{amountCents:5000,reason:"Credito de teste idempotente",idempotencyKey:$key}')")"
if [[ "$(jq -er '.id' <<<"$ajuste_b")" != "$ajuste_a_id" ]]; then
  printf 'Replay do ajuste deveria retornar a transacao anterior.\n' >&2
  exit 1
fi
api GET /finance/statement "$sem_saldo_token" | jq -e '.availableCents == 5000' >/dev/null

# 4. Reserva: cliente com saldo cria pedido e o valor sai do disponivel.
reserva="$(api POST /deliveries "$sem_saldo_token" "$(new_order_payload)")"
reserva_id="$(jq -er '.id' <<<"$reserva")"
reserva_preco="$(jq -er '.priceCents' <<<"$reserva")"
# 5000 centavos = R$ 50,00 > preco de um pedido de teste (R$ ~13).
jq -en --argjson saldo 5000 --argjson preco "$reserva_preco" '$preco < $saldo' >/dev/null
api GET /finance/statement "$sem_saldo_token" | jq -e --argjson preco "$reserva_preco" '.reservedCents == $preco and .availableCents == (5000 - $preco)' >/dev/null
api GET /finance/statement "$sem_saldo_token" | jq -e '.entries[0].type == "RESERVATION" and (.entries[0].description | test("Reserva do pedido")) and .entries[0].amountCents < 0' >/dev/null

# 5. Liberacao: cancelar devolve a reserva ao disponivel.
api PATCH "/deliveries/$reserva_id/status" "$sem_saldo_token" '{"status":"CANCELED","note":"Cancelado no smoke PAY-01"}' >/dev/null
api GET /finance/statement "$sem_saldo_token" | jq -e --argjson preco "$reserva_preco" '.reservedCents == 0 and .availableCents == 5000' >/dev/null
api GET /finance/statement "$sem_saldo_token" | jq -e --argjson preco "$reserva_preco" '.entries[0].type == "RESERVATION_RELEASE" and .entries[0].amountCents == $preco' >/dev/null

# 6. Concorrencia: duas criacoes simultaneas com saldo para UMA nao reservam
# alem do saldo — uma passa (200) e a outra e recusada (402).
race_login="$(api POST /auth/register/customer "" "$(jq -nc --arg name 'Cliente Corrida' --arg email "corrida.${RUN_ID}@aquilog.test" --arg password "$TEST_PASSWORD" --arg document "$(printf '%011d' $((RUN_ID + 8)))" --arg phone '+5531999999997' '{name:$name,email:$email,password:$password,document:$document,phone:$phone}')")"
race_id="$(jq -er '.user.customerId' <<<"$race_login")"
race_token="$(jq -er '.accessToken' <<<"$race_login")"
api POST "/finance/accounts/customer/$race_id/adjust" "$admin_token" "$(jq -nc --argjson preco "$reserva_preco" '{amountCents:$preco,reason:"Saldo exato para uma corrida"}')" >/dev/null
r1_file="$(mktemp)"
r2_file="$(mktemp)"
api_status POST /deliveries "$race_token" "$(new_order_payload)" >"$r1_file" &
p1=$!
api_status POST /deliveries "$race_token" "$(new_order_payload)" >"$r2_file" &
p2=$!
wait "$p1" "$p2"
s1="$(tail -n1 <"$r1_file")"
s2="$(tail -n1 <"$r2_file")"
# POST /deliveries devolve 201 Created (padrão Nest) — aceitar 200/201 para o vencedor.
if [[ " $s1 $s2 " != *" 200 "* && " $s1 $s2 " != *" 201 "* ]] || [[ " $s1 $s2 " != *" 402 "* ]]; then
  printf 'Corrida de reserva deveria terminar com um 201/200 e um 402, veio %s e %s.\\n' "$s1" "$s2" >&2
  exit 1
fi
rm -f "$r1_file" "$r2_file"
api GET /finance/statement "$race_token" | jq -e --argjson preco "$reserva_preco" '.reservedCents == $preco and .availableCents == 0' >/dev/null

# 7. Autorizacao de extrato: cliente nao consulta carteira alheia; admin sim.
alheio="$(api_status GET "/finance/statement?ownerType=COURIER&ownerId=$courier_id" "$sem_saldo_token")"
if [[ "$(tail -n1 <<<"$alheio")" != "403" ]]; then
  printf 'Cliente consultando carteira do motoboy deveria levar 403, veio %s.\n' "$(tail -n1 <<<"$alheio")" >&2
  exit 1
fi
api GET "/finance/statement?ownerType=COURIER&ownerId=$courier_id" "$admin_token" \
  | jq -e --argjson fee "$courier_fee" '.availableCents == $fee and .reservedCents == 0' >/dev/null

# 8. Liquidacao e obrigacao contabil com o motoboy: o extrato do motoboy vem
# do ledger (SETTLEMENT), nao mais do credito MVP — o saldo bate com o repasse
# da unica entrega concluida do fluxo principal.
api GET /finance/statement "$courier_token" | jq -e --arg code "$delivery_code" '.entries[0].type == "SETTLEMENT" and (.entries[0].description | test("Credito da entrega")) and (.entries[0].description | test($code))' >/dev/null

# 9. Resumo admin enxerga as contas do ledger (obrigacao com motoboys e
# receita retida). O summary e GLOBAL (soma todas as contas do banco, inclusive
# de execucoes anteriores), entao a asserção compara o DELTA desta execucao
# contra a baseline capturada no inicio: a unica entrega DELIVERED do fluxo
# principal deve ter acrescentado exatamente o repasse do motoboy.
summary_final="$(api GET /finance/summary "$admin_token")"
if ! jq -e \
  --argjson fee "$courier_fee" \
  --argjson base "$baseline_courier_obligation" \
  '(.courierObligationCents - $base) == $fee and .platformRevenueCents > 0' \
  <<<"$summary_final" >/dev/null; then
  printf 'Resumo admin: obrigacao com motoboys deveria crescer %s centavos nesta execucao (baseline %s), veio %s.\n' \
    "$courier_fee" "$baseline_courier_obligation" \
    "$(jq -r '.courierObligationCents' <<<"$summary_final")" >&2
  exit 1
fi

printf 'Smoke test aprovado: %s (%s) + agendado %s (%s) + reoferta %s\n' "$delivery_code" "$delivery_id" "$scheduled_code" "$scheduled_id" "$disp_id"
