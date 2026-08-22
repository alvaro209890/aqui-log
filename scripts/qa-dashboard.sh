#!/usr/bin/env bash
# QA-02 — varre o painel admin logado com Playwright, sem humano.
# Uso: bash scripts/qa-dashboard.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${Jre_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$PATH"

RUN_ID="$(date +%s)"
DB_NAME="aqui_log_qa_dash_${RUN_ID}"
EVID_DIR="$ROOT_DIR/docs/04-status/entregas/qa-02-${RUN_ID}"
mkdir -p "$EVID_DIR"

env_value() {
  for f in "$HOME/.config/aqui-log/env" "$ROOT_DIR/.env"; do
    v="$(sed -n "s/^$1=//p" "$f" 2>/dev/null | tail -1)"
    [ -n "$v" ] && { echo "$v"; return; }
  done
}
ADMIN_EMAIL_VALUE="${QA_ADMIN_EMAIL:-$(env_value ADMIN_EMAIL)}"
ADMIN_PASSWORD_VALUE="${QA_ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
DB_USER="${DATABASE_USER:-$(env_value DATABASE_USER)}"
DB_USER="${DB_USER:-aqui_log}"

find_free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}

API_PID=""
DASH_PID=""
cleanup() {
  local code=$?
  set +e
  [[ -n "${API_PID}" ]] && kill "$API_PID" 2>/dev/null && wait "$API_PID" 2>/dev/null || true
  [[ -n "${DASH_PID}" ]] && kill "$DASH_PID" 2>/dev/null && wait "$DASH_PID" 2>/dev/null || true
  docker exec aqui-log-postgres dropdb -U "$DB_USER" --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  echo "cleanup exit=$code db=$DB_NAME" | tee -a "$EVID_DIR/log.txt"
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "== QA-02 dashboard run=$RUN_ID ==" | tee "$EVID_DIR/log.txt"

if ! docker ps --format '{{.Names}}' | grep -q aqui-log-postgres; then
  echo "postgres não está rodando" >&2; exit 1
fi

API_PORT="$(find_free_port)"
DASH_PORT="$(find_free_port)"
echo "api=$API_PORT dash=$DASH_PORT" | tee -a "$EVID_DIR/log.txt"

docker exec aqui-log-postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};" >/dev/null

(
  cd "$ROOT_DIR/apps/backend"
  export PORT="$API_PORT"
  export DATABASE_NAME="$DB_NAME"
  export PUBLIC_API_URL="http://127.0.0.1:${API_PORT}/api/v1"
  export PHONE_VERIFY_ADAPTER=local
  export GEO_PROVIDER=local
  export PHONE_VERIFY_REQUIRED=false
  pnpm migration:run
  pnpm seed:admin
  exec node dist/main
) >"$EVID_DIR/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 90); do
  curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/health" | tee -a "$EVID_DIR/log.txt"
echo | tee -a "$EVID_DIR/log.txt"

# Seed: um candidato PENDING (prova e-mail na fila) + uma entrega DELIVERED.
export PORT="$API_PORT" ADMIN_EMAIL_VALUE ADMIN_PASSWORD_VALUE RUN_ID
export SEED_OUT="$EVID_DIR/seed.txt"
python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error
def req(method, path, body=None, token=None):
    url = f"http://127.0.0.1:{os.environ['PORT']}/api/v1{path}"
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print("HTTPERR", e.code, e.read().decode()[:300], file=sys.stderr)
        raise
admin = req("POST", "/auth/login", {"email": os.environ["ADMIN_EMAIL_VALUE"], "password": os.environ["ADMIN_PASSWORD_VALUE"]})
run = os.environ["RUN_ID"]
courier = req("POST", "/auth/register/courier", {
    "name": "Candidato QA", "email": f"candidato.qa.{run}@aquilog.test",
    "password": "TesteSeguro123!", "document": str(int(run) % 10**11).zfill(11),
    "vehicleType": "MOTORCYCLE", "vehiclePlate": "QAQ1Q11"})
cid = courier['id']
print("COURIER_EMAIL=" + f"candidato.qa.{run}@aquilog.test", file=open(os.environ["SEED_OUT"], "a"))
cust = req("POST", "/auth/register/customer", {
    "name": "Cliente QA", "email": f"cliente.qa.{run}@aquilog.test",
    "password": "TesteSeguro123!", "document": str((int(run)+1) % 10**11).zfill(11), "phone": "65991112233"})
cust_id = cust['user'].get('customerId') or cust['user']['id']
req("POST", f"/finance/accounts/customer/{cust_id}/adjust", {"amountCents": 1000000, "reason": "QA-02"}, token=admin["accessToken"])
presign = req("POST", "/storage/presign", {"purpose": "product", "contentType": "image/jpeg"}, token=cust["accessToken"])
up = urllib.request.Request(presign["uploadUrl"], data=b"fake", method="PUT")
up.add_header("Content-Type", "image/jpeg"); up.add_header("Authorization", f"Bearer {cust['accessToken']}")
urllib.request.urlopen(up).read()
delivery = req("POST", "/deliveries", {
    "pickupAddress": "Av. Historiador Rubens de Mendonca 1000 Cuiaba", "pickupLatitude": -15.58, "pickupLongitude": -56.08,
    "deliveryAddress": "Rua das Flores 200 Cuiaba", "deliveryLatitude": -15.60, "deliveryLongitude": -56.10,
    "recipientName": "Dest QA", "recipientPhone": "65988887777", "fulfillmentMode": "IMMEDIATE",
    "productType": "OTHER", "packageSize": "SMALL", "weightKg": 1.0, "deliveryScope": "SAME_CITY",
    "productPhotoUrls": [presign["fileUrl"]]}, token=cust["accessToken"])
print("DELIVERED_ID=" + delivery["id"], file=open(os.environ["SEED_OUT"], "a"))
req("PATCH", f"/couriers/{cid}/approve", None, token=admin["accessToken"])
sess = req("POST", "/auth/login", {"email": f"candidato.qa.{run}@aquilog.test", "password": "TesteSeguro123!"})
tok = sess["accessToken"]
req("PATCH", "/couriers/me/availability", {"available": True}, token=tok)
req("PATCH", "/couriers/me/location", {"latitude": -15.601, "longitude": -56.097}, token=tok)
offers = req("GET", "/deliveries/offers/mine", None, token=tok)
if not offers:
    req("POST", f"/deliveries/{delivery['id']}/dispatch", None, token=admin["accessToken"])
    offers = req("GET", "/deliveries/offers/mine", None, token=tok)
oid = offers[0]["id"]
req("PATCH", f"/deliveries/offers/{oid}/accept", None, token=tok)
detail = req("GET", f"/deliveries/{delivery['id']}", None, token=cust["accessToken"])
code = str(detail["pickupCode"])
req("PATCH", f"/deliveries/{delivery['id']}/status", {"status": "AT_PICKUP"}, token=tok)
proof = req("POST", "/storage/presign", {"purpose": "proof", "contentType": "image/jpeg"}, token=tok)
up2 = urllib.request.Request(proof["uploadUrl"], data=b"fake", method="PUT")
up2.add_header("Content-Type", "image/jpeg"); up2.add_header("Authorization", f"Bearer {tok}")
urllib.request.urlopen(up2).read()
req("PATCH", f"/deliveries/{delivery['id']}/status", {"status": "PICKED_UP", "pickupCode": code, "proofUrl": proof["fileUrl"]}, token=tok)
req("PATCH", f"/deliveries/{delivery['id']}/status", {"status": "IN_TRANSIT"}, token=tok)
req("PATCH", f"/deliveries/{delivery['id']}/status", {"status": "DELIVERED", "proofUrl": proof["fileUrl"]}, token=tok)
print("seed ok")
PY

# Sobe o dashboard (vite dev) apontando para a API local.
(
  cd "$ROOT_DIR/apps/dashboard"
  export VITE_API_URL="http://127.0.0.1:${API_PORT}/api/v1"
  exec pnpm dev --host 127.0.0.1 --port "$DASH_PORT"
) >"$EVID_DIR/dash.log" 2>&1 &
DASH_PID=$!

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${DASH_PORT}/" >/dev/null 2>&1 && break
  sleep 1
done

SEED_COURIER_EMAIL="candidato.qa.${RUN_ID}@aquilog.test"
SEED_DELIVERED_ID="$(grep '^DELIVERED_ID=' "$SEED_OUT" | cut -d= -f2 || true)"

set +e
cd "$ROOT_DIR/apps/dashboard"
QA_DASHBOARD_URL="http://127.0.0.1:${DASH_PORT}" \
QA_ADMIN_EMAIL="$ADMIN_EMAIL_VALUE" \
QA_ADMIN_PASSWORD="$ADMIN_PASSWORD_VALUE" \
QA_SEED_COURIER_EMAIL="$SEED_COURIER_EMAIL" \
QA_SEED_DELIVERED_ID="$SEED_DELIVERED_ID" \
pnpm exec playwright test
PW=$?
set -e
echo "playwright_exit=$PW" | tee -a "$EVID_DIR/log.txt"
exit "$PW"
