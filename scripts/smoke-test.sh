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
COMPANY_EMAIL="empresa.${RUN_ID}@aquilog.test"
COURIER_EMAIL="entregador.${RUN_ID}@aquilog.test"
USER_EMAIL="operador.${RUN_ID}@aquilog.test"
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

api GET /health | jq -e '.status == "ok"' >/dev/null

admin_login="$(api POST /auth/login "" "$(jq -nc --arg email "${ADMIN_EMAIL_VALUE:-admin@aquilog.com.br}" --arg password "${ADMIN_PASSWORD_VALUE:-AdminLocal123!}" '{email:$email,password:$password}')")"
admin_token="$(jq -er '.accessToken' <<<"$admin_login")"

company="$(api POST /auth/register/company "" "$(jq -nc --arg ownerName 'Empresa Teste' --arg email "$COMPANY_EMAIL" --arg password "$TEST_PASSWORD" --arg legalName "Aqui Log Teste $RUN_ID LTDA" --arg tradeName 'Empresa Smoke' --arg document "99${RUN_DOC}0" '{ownerName:$ownerName,email:$email,password:$password,legalName:$legalName,tradeName:$tradeName,document:$document}')")"
company_id="$(jq -er '.companyId' <<<"$company")"

courier="$(api POST /auth/register/courier "" "$(jq -nc --arg name 'Entregador Teste' --arg email "$COURIER_EMAIL" --arg password "$TEST_PASSWORD" --arg document "$RUN_DOC" '{name:$name,email:$email,password:$password,document:$document,vehicleType:"MOTORCYCLE",vehiclePlate:"AQL1T23",documentUrls:["https://example.com/documento-teste.pdf"]}')")"
courier_id="$(jq -er '.courierId' <<<"$courier")"

api PATCH "/companies/$company_id/approve" "$admin_token" >/dev/null
api PATCH "/couriers/$courier_id/approve" "$admin_token" >/dev/null

owner_token="$(api POST /auth/login "" "$(jq -nc --arg email "$COMPANY_EMAIL" --arg password "$TEST_PASSWORD" '{email:$email,password:$password}')" | jq -er '.accessToken')"
courier_token="$(api POST /auth/login "" "$(jq -nc --arg email "$COURIER_EMAIL" --arg password "$TEST_PASSWORD" '{email:$email,password:$password}')" | jq -er '.accessToken')"

api POST /users "$owner_token" "$(jq -nc --arg name 'Operador Teste' --arg email "$USER_EMAIL" --arg password "$TEST_PASSWORD" '{name:$name,email:$email,password:$password}')" >/dev/null
api PATCH /couriers/me/location "$courier_token" "$(jq -nc --argjson latitude "$PICKUP_LATITUDE" --argjson longitude "$PICKUP_LONGITUDE" '{latitude:$latitude,longitude:$longitude}')" >/dev/null
api PATCH /couriers/me/availability "$courier_token" '{"available":true}' >/dev/null

delivery="$(api POST /deliveries "$owner_token" "$(jq -nc --argjson pickupLatitude "$PICKUP_LATITUDE" --argjson pickupLongitude "$PICKUP_LONGITUDE" --argjson deliveryLatitude "$DELIVERY_LATITUDE" --argjson deliveryLongitude "$DELIVERY_LONGITUDE" '{pickupAddress:"Av. Afonso Pena, 1000 - Centro",pickupLatitude:$pickupLatitude,pickupLongitude:$pickupLongitude,deliveryAddress:"Praca da Liberdade - Savassi",deliveryLatitude:$deliveryLatitude,deliveryLongitude:$deliveryLongitude,recipientName:"Cliente Teste",recipientPhone:"+5531999999999",priceCents:3500,courierFeeCents:1800}')")"
delivery_id="$(jq -er '.id' <<<"$delivery")"
delivery_code="$(jq -er '.code' <<<"$delivery")"

dispatch="$(api POST "/deliveries/$delivery_id/dispatch" "$admin_token")"
offer_id="$(jq -er '.offer.id' <<<"$dispatch")"
api GET /deliveries/offers/mine "$courier_token" | jq -e --arg offer "$offer_id" 'map(.id) | index($offer) != null' >/dev/null
api PATCH "/deliveries/offers/$offer_id/accept" "$courier_token" >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"AT_PICKUP"}' >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"PICKED_UP","proofUrl":"https://example.com/coleta.jpg"}' >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"IN_TRANSIT"}' >/dev/null
api PATCH "/deliveries/$delivery_id/status" "$courier_token" '{"status":"DELIVERED","proofUrl":"https://example.com/entrega.jpg"}' >/dev/null

api GET "/deliveries/$delivery_id/history" "$owner_token" | jq -e 'length >= 7' >/dev/null
api POST "/deliveries/$delivery_id/rating" "$owner_token" '{"score":5,"comment":"Entrega concluida no fluxo de teste"}' >/dev/null
api GET /finance/statement "$courier_token" | jq -e '.balanceCents == 1800' >/dev/null
api GET /notifications "$owner_token" | jq -e 'length > 0' >/dev/null
api GET /audit "$admin_token" | jq -e 'length > 0' >/dev/null

printf 'Smoke test aprovado: %s (%s)\n' "$delivery_code" "$delivery_id"
