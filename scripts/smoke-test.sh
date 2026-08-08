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

# Cliente pessoa física: registro auto-aprovado com auto-login (B2C)
customer_login="$(api POST /auth/register/customer "" "$(jq -nc --arg name 'Cliente Teste' --arg email "$CUSTOMER_EMAIL" --arg password "$TEST_PASSWORD" --arg document "$RUN_DOC" --arg phone '+5531999999999' '{name:$name,email:$email,password:$password,document:$document,phone:$phone}')")"
customer_token="$(jq -er '.accessToken' <<<"$customer_login")"

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
    '{pickupAddress:"Av. Afonso Pena, 1000 - Centro",pickupLatitude:$pickupLatitude,pickupLongitude:$pickupLongitude,deliveryAddress:"Praca da Liberdade - Savassi",deliveryLatitude:$deliveryLatitude,deliveryLongitude:$deliveryLongitude,recipientName:"Cliente Teste",recipientPhone:"+5531999999999",productType:"OTHER",packageSize:"SMALL",weightKg:1.5,deliveryScope:"SAME_CITY",productPhotoUrls:[$productPhotoUrl]}'
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
offer_id="$(jq -er --arg deliveryId "$delivery_id" 'map(select(.delivery.id == $deliveryId)) | .[0].id // empty' <<<"$offers")"
if [[ -z "$offer_id" ]]; then
  dispatch="$(api POST "/deliveries/$delivery_id/dispatch" "$admin_token")"
  offer_id="$(jq -er '.offer.id' <<<"$dispatch")"
fi
api GET /deliveries/offers/mine "$courier_token" | jq -e --arg offer "$offer_id" 'map(.id) | index($offer) != null' >/dev/null
api PATCH "/deliveries/offers/$offer_id/accept" "$courier_token" >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"AT_PICKUP"}' >/dev/null

proof_pickup="$(upload_file proof "$courier_token" pickup)" || exit 1
api PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_pickup" '{status:"PICKED_UP",proofUrl:$proofUrl}')" >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"IN_TRANSIT"}' >/dev/null
proof_delivery="$(upload_file proof "$courier_token" delivery)" || exit 1
api PATCH "/deliveries/$delivery_id/status" "$courier_token" "$(jq -nc --arg proofUrl "$proof_delivery" '{status:"DELIVERED",proofUrl:$proofUrl}')" >/dev/null

api GET "/deliveries/$delivery_id/history" "$customer_token" | jq -e 'length >= 7' >/dev/null
api POST "/deliveries/$delivery_id/rating" "$customer_token" '{"score":5,"comment":"Entrega concluida no fluxo de teste"}' >/dev/null
api GET /finance/statement "$courier_token" | jq -e --argjson fee "$courier_fee" '.balanceCents == $fee' >/dev/null
api GET /notifications "$customer_token" | jq -e 'length > 0' >/dev/null
api GET /audit "$admin_token" | jq -e 'length > 0' >/dev/null

printf 'Smoke test aprovado: %s (%s)\n' "$delivery_code" "$delivery_id"
