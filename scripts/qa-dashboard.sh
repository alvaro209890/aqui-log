#!/usr/bin/env bash
# QA-02 — varre o painel admin logado com Playwright, sem humano.
# Uso: bash scripts/qa-dashboard.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
CHROME=""
for candidate in \
  "${PLAYWRIGHT_CHROMIUM:-}" \
  "${PLAYWRIGHT_BROWSERS_PATH:-}/chromium-1234/chrome-linux64/chrome" \
  "$HOME/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" \
  /home/acer/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome
do
  [[ -n "$candidate" && -x "$candidate" ]] && { CHROME="$candidate"; break; }
done
if [[ -z "$CHROME" ]]; then
  echo "Chromium do cache ausente — nao baixar de novo sem pedido." >&2
  exit 1
fi
export PLAYWRIGHT_CHROMIUM="$CHROME"
export PLAYWRIGHT_BROWSERS_PATH="$(cd "$(dirname "$CHROME")/../.." && pwd)"

RUN_ID="$(date +%s)"
DB_NAME="aqui_log_qa_dash_${RUN_ID}"
EVID_DIR="$ROOT_DIR/docs/04-status/entregas/qa-02-${RUN_ID}"
mkdir -p "$EVID_DIR"

env_value() {
  for f in \
    "$HOME/.config/aqui-log/env" \
    /home/acer/.config/aqui-log/env \
    "$ROOT_DIR/.env"
  do
    [[ -f "$f" ]] || continue
    v="$(sed -n "s/^$1=//p" "$f" 2>/dev/null | tail -1 | tr -d '\r')"
    [[ -n "$v" ]] && { echo "$v"; return; }
  done
}
ADMIN_EMAIL_VALUE="${QA_ADMIN_EMAIL:-$(env_value ADMIN_EMAIL)}"
ADMIN_EMAIL_VALUE="${ADMIN_EMAIL_VALUE:-admin@aquilog.com.br}"
ADMIN_PASSWORD_VALUE="${QA_ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
DB_USER="${DATABASE_USER:-$(env_value DATABASE_USER)}"
DB_USER="${DB_USER:-aqui_log}"
DB_PASS="${DATABASE_PASSWORD:-$(env_value DATABASE_PASSWORD)}"
DB_PASS="${DB_PASS:-aqui_log_dev}"
DB_HOST="${DATABASE_HOST:-$(env_value DATABASE_HOST)}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-$(env_value DATABASE_PORT)}"
DB_PORT="${DB_PORT:-5433}"

psql_admin() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

if [[ -z "$ADMIN_PASSWORD_VALUE" ]]; then
  echo "ADMIN_PASSWORD ausente (.env ou ~/.config/aqui-log/env). Nao ha senha no repo." >&2
  exit 1
fi

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
  PGPASSWORD="$DB_PASS" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  echo "cleanup exit=$code db=$DB_NAME" | tee -a "$EVID_DIR/log.txt"
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "== QA-02 dashboard run=$RUN_ID ==" | tee "$EVID_DIR/log.txt"

if ! PGPASSWORD="$DB_PASS" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
  echo "postgres nao responde em ${DB_HOST}:${DB_PORT}" >&2
  exit 1
fi
if ! python3 - <<'PY'
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(("127.0.0.1", 6379))
except OSError:
    sys.exit(1)
finally:
    s.close()
PY
then
  echo "redis nao responde em 127.0.0.1:6379" >&2
  exit 1
fi

API_PORT="$(find_free_port)"
DASH_PORT="$(find_free_port)"
echo "api=$API_PORT dash=$DASH_PORT chrome=$CHROME" | tee -a "$EVID_DIR/log.txt"

pnpm --filter backend build >/dev/null
psql_admin -c "CREATE DATABASE ${DB_NAME};" >/dev/null

(
  cd "$ROOT_DIR/apps/backend"
  export PORT="$API_PORT"
  export DATABASE_NAME="$DB_NAME"
  export DATABASE_HOST="$DB_HOST"
  export DATABASE_PORT="$DB_PORT"
  export DATABASE_USER="$DB_USER"
  export DATABASE_PASSWORD="$DB_PASS"
  export PUBLIC_API_URL="http://127.0.0.1:${API_PORT}/api/v1"
  export PHONE_VERIFY_ADAPTER=local
  export PHONE_VERIFY_REQUIRED=false
  export GEO_PROVIDER=local
  export STORAGE_DRIVER=local
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

export PORT="$API_PORT"
export ADMIN_EMAIL_VALUE ADMIN_PASSWORD_VALUE RUN_ID
export SEED_OUT="$EVID_DIR/seed.txt"
: >"$SEED_OUT"
python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error, time

PORT = os.environ["PORT"]
RUN = os.environ["RUN_ID"]
SEED = os.environ["SEED_OUT"]

def req(method, path, body=None, token=None):
    url = f"http://127.0.0.1:{PORT}/api/v1{path}"
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print("HTTPERR", method, path, e.code, e.read().decode()[:400], file=sys.stderr)
        raise

def append(line):
    with open(SEED, "a") as f:
        f.write(line + "\n")

admin = req("POST", "/auth/login", {
    "email": os.environ["ADMIN_EMAIL_VALUE"],
    "password": os.environ["ADMIN_PASSWORD_VALUE"],
})
admin_tok = admin["accessToken"]

pending_email = f"candidato.qa.{RUN}@aquilog.test"
pending = req("POST", "/auth/register/courier", {
    "name": "Candidato QA",
    "email": pending_email,
    "password": "TesteSeguro123!",
    "document": str((int(RUN) % 10**10)).zfill(11),
    "vehicleType": "MOTORCYCLE",
    "vehiclePlate": "QAQ1A11",
})
assert pending.get("courierId"), pending
append("COURIER_EMAIL=" + pending_email)
append("COURIER_NAME=Candidato QA")

worker = req("POST", "/auth/register/courier", {
    "name": "Motoboy QA Ativo",
    "email": f"motoboy.qa.{RUN}@aquilog.test",
    "password": "TesteSeguro123!",
    "document": str(((int(RUN) + 7) % 10**10)).zfill(11),
    "vehicleType": "MOTORCYCLE",
    "vehiclePlate": "QAQ2B22",
})
req("PATCH", f"/couriers/{worker['courierId']}/approve", None, token=admin_tok)

cust = req("POST", "/auth/register/customer", {
    "name": "Cliente QA",
    "email": f"cliente.qa.{RUN}@aquilog.test",
    "password": "TesteSeguro123!",
    "document": str(((int(RUN) + 13) % 10**10)).zfill(11),
    "phone": "65991112233",
})
cust_id = cust["user"]["customerId"]
cust_tok = cust["accessToken"]
req(
    "POST",
    f"/finance/accounts/customer/{cust_id}/adjust",
    {"amountCents": 1000000, "reason": "credito QA-02"},
    token=admin_tok,
)

def new_delivery():
    presign = req("POST", "/storage/presign", {
        "purpose": "product", "contentType": "image/jpeg",
    }, token=cust_tok)
    up = urllib.request.Request(presign["uploadUrl"], data=b"fakejpg", method="PUT")
    up.add_header("Content-Type", "image/jpeg")
    up.add_header("Authorization", f"Bearer {cust_tok}")
    urllib.request.urlopen(up).read()
    return req("POST", "/deliveries", {
        "pickupAddress": "Av. Historiador Rubens de Mendonca 1000 Cuiaba",
        "pickupLatitude": -15.58, "pickupLongitude": -56.08,
        "deliveryAddress": "Rua das Flores 200 Cuiaba",
        "deliveryLatitude": -15.60, "deliveryLongitude": -56.10,
        "recipientName": "Dest QA", "recipientPhone": "65988887777",
        "fulfillmentMode": "IMMEDIATE",
        "productType": "OTHER", "packageSize": "SMALL", "weightKg": 1.0,
        "deliveryScope": "SAME_CITY",
        "productPhotoUrls": [presign["fileUrl"]],
    }, token=cust_tok)

delivered = new_delivery()
canceled = new_delivery()
req("PATCH", f"/deliveries/{canceled['id']}/status", {
    "status": "CANCELED", "note": "cancelado no seed QA-02",
}, token=cust_tok)
append("CANCELED_ID=" + canceled["id"])

sess = req("POST", "/auth/login", {
    "email": f"motoboy.qa.{RUN}@aquilog.test",
    "password": "TesteSeguro123!",
})
tok = sess["accessToken"]
req("PATCH", "/couriers/me/availability", {"available": True}, token=tok)
req("PATCH", "/couriers/me/location", {
    "latitude": -15.601, "longitude": -56.097,
}, token=tok)

offers = req("GET", "/deliveries/offers/mine", None, token=tok)
if not offers:
    req("POST", f"/deliveries/{delivered['id']}/dispatch", None, token=admin_tok)
    for _ in range(15):
        offers = req("GET", "/deliveries/offers/mine", None, token=tok)
        if offers:
            break
        time.sleep(1)
if not offers:
    raise SystemExit("sem oferta para completar DELIVERED")
oid = offers[0]["id"]
req("PATCH", f"/deliveries/offers/{oid}/accept", None, token=tok)
detail = req("GET", f"/deliveries/{delivered['id']}", None, token=cust_tok)
code = str(detail["pickupCode"])
req("PATCH", f"/deliveries/{delivered['id']}/status", {"status": "AT_PICKUP"}, token=tok)
proof = req("POST", "/storage/presign", {
    "purpose": "proof", "contentType": "image/jpeg",
}, token=tok)
up2 = urllib.request.Request(proof["uploadUrl"], data=b"fakepng", method="PUT")
up2.add_header("Content-Type", "image/jpeg")
up2.add_header("Authorization", f"Bearer {tok}")
urllib.request.urlopen(up2).read()
req("PATCH", f"/deliveries/{delivered['id']}/status", {
    "status": "PICKED_UP", "pickupCode": code, "proofUrl": proof["fileUrl"],
}, token=tok)
req("PATCH", f"/deliveries/{delivered['id']}/status", {"status": "IN_TRANSIT"}, token=tok)
req("PATCH", f"/deliveries/{delivered['id']}/status", {
    "status": "DELIVERED", "proofUrl": proof["fileUrl"],
}, token=tok)
append("DELIVERED_ID=" + delivered["id"])
print("seed ok")
PY

(
  cd "$ROOT_DIR/apps/dashboard"
  export VITE_API_URL="http://127.0.0.1:${API_PORT}/api/v1"
  export VITE_WS_URL="http://127.0.0.1:${API_PORT}"
  exec pnpm dev --host 127.0.0.1 --port "$DASH_PORT"
) >"$EVID_DIR/dash.log" 2>&1 &
DASH_PID=$!

for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${DASH_PORT}/" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS -o /dev/null -w "dash_http=%{http_code}\n" "http://127.0.0.1:${DASH_PORT}/" | tee -a "$EVID_DIR/log.txt"

SEED_COURIER_EMAIL="$(grep '^COURIER_EMAIL=' "$SEED_OUT" | cut -d= -f2 || true)"
SEED_COURIER_NAME="$(grep '^COURIER_NAME=' "$SEED_OUT" | cut -d= -f2 || true)"

run_pw() {
  cd "$ROOT_DIR/apps/dashboard"
  QA_DASHBOARD_URL="http://127.0.0.1:${DASH_PORT}" \
  QA_ADMIN_EMAIL="$ADMIN_EMAIL_VALUE" \
  QA_ADMIN_PASSWORD="$ADMIN_PASSWORD_VALUE" \
  QA_SEED_COURIER_EMAIL="$SEED_COURIER_EMAIL" \
  QA_SEED_COURIER_NAME="$SEED_COURIER_NAME" \
  QA_EVID_DIR="$EVID_DIR" \
  PLAYWRIGHT_CHROMIUM="$CHROME" \
  PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  pnpm exec playwright test "$@"
}

echo "== Playwright API viva ==" | tee -a "$EVID_DIR/log.txt"
set +e
run_pw
LIVE=$?
set -e
echo "playwright_live_exit=$LIVE" | tee -a "$EVID_DIR/log.txt"
if [[ "$LIVE" -ne 0 ]]; then
  exit "$LIVE"
fi

echo "== Playwright API morta (tem que falhar) ==" | tee -a "$EVID_DIR/log.txt"
kill "$API_PID" 2>/dev/null || true
wait "$API_PID" 2>/dev/null || true
API_PID=""
sleep 1
set +e
run_pw e2e/dashboard.spec.ts --grep "varredura claro"
DEAD=$?
set -e
echo "playwright_dead_exit=$DEAD" | tee -a "$EVID_DIR/log.txt"
if [[ "$DEAD" -eq 0 ]]; then
  echo "portao falso: qa:e2e passou com a API morta" >&2
  exit 1
fi
echo "API morta reprovou como esperado" | tee -a "$EVID_DIR/log.txt"

STABLE="$ROOT_DIR/docs/04-status/entregas"
for src in \
  "$EVID_DIR/qa-02-login-claro.png" \
  "$EVID_DIR/qa-02-overview-claro.png" \
  "$EVID_DIR/qa-02-fila-aprovacao-claro.png" \
  "$EVID_DIR/qa-02-entregas-claro.png" \
  "$EVID_DIR/qa-02-settings-claro.png" \
  "$EVID_DIR/qa-02-overview-escuro.png"
do
  [[ -f "$src" ]] && cp -f "$src" "$STABLE/$(basename "$src")"
done

echo "QA-02 PASS run=$RUN_ID" | tee -a "$EVID_DIR/log.txt"
exit 0
