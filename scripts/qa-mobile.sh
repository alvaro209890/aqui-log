#!/usr/bin/env bash
# QA-01 — dirige um dos apps Flutter no AVD dedicado `aqui_log_qa`, sem humano.
# Uso: bash scripts/qa-mobile.sh customer_app|courier_app
set -euo pipefail

APP="${1:?uso: bash scripts/qa-mobile.sh customer_app|courier_app}"
case "$APP" in customer_app|courier_app) ;; *)
  echo "app inválido: $APP" >&2; exit 2 ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$JAVA_HOME/bin:$HOME/develop/flutter/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
# O sandbox do agente redireciona GRADLE_USER_HOME para /tmp/cursor-sandbox-cache
# e o assembleDebug passa dos 12 min do test (QA-03, 2026-08-22). Forçar o
# Gradle do usuário. Não toca no AVD Medium_Phone_API_36.0 (AquiResolve).
if [[ "${GRADLE_USER_HOME:-}" == *cursor-sandbox-cache* ]] || [[ -z "${GRADLE_USER_HOME:-}" ]]; then
  export GRADLE_USER_HOME="$HOME/.gradle"
fi

AVD_NAME="aqui_log_qa"
RUN_ID="$(date +%s)"
DB_NAME="aqui_log_qa_${RUN_ID}"
API_PID=""
EMU_PID=""
EVID_DIR="$ROOT_DIR/docs/04-status/entregas/qa-01-${RUN_ID}"
mkdir -p "$EVID_DIR"

env_value() {
  for f in "$HOME/.config/aqui-log/env" "$ROOT_DIR/.env"; do
    v="$(sed -n "s/^$1=//p" "$f" 2>/dev/null | tail -1)"
    [ -n "$v" ] && { echo "$v"; return; }
  done
}
ADMIN_EMAIL_VALUE="${ADMIN_EMAIL:-$(env_value ADMIN_EMAIL)}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
echo "DBG admin_email=[$ADMIN_EMAIL_VALUE] has_pw=[${ADMIN_PASSWORD_VALUE:+yes}]" >&2
DB_USER="${DATABASE_USER:-$(env_value DATABASE_USER)}"
DB_USER="${DB_USER:-aqui_log}"

find_free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}

cleanup() {
  local code=$?
  set +e
  if [[ -n "${API_PID}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if adb devices | awk '/emulator-/{print $1}' | head -1 | grep -q .; then
    local serial
    serial="$(adb devices | awk '/emulator-/{print $1; exit}')"
    if adb -s "$serial" emu avd name 2>/dev/null | grep -q "$AVD_NAME"; then
      adb -s "$serial" emu kill || true
    fi
  fi
  [[ -n "${EMU_PID}" ]] && kill "$EMU_PID" 2>/dev/null || true
  docker exec aqui-log-postgres dropdb -U "$DB_USER" --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  echo "cleanup exit=$code db=$DB_NAME" | tee -a "$EVID_DIR/log.txt"
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "== QA-01 $APP run=$RUN_ID ==" | tee "$EVID_DIR/log.txt"

if [[ ! -d "$HOME/.android/avd/${AVD_NAME}.avd" ]]; then
  echo no | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/avdmanager" create avd \
    -n "$AVD_NAME" \
    -k "system-images;android-36;google_apis_playstore;x86_64" \
    -d pixel_6
fi

if adb devices | grep -q emulator-; then
  echo "já existe emulador no adb — recusando para não misturar com AquiResolve" >&2
  exit 1
fi

"$ANDROID_SDK_ROOT/emulator/emulator" -avd "$AVD_NAME" -partition-size 8192 \
  -no-window -no-audio -no-snapshot -gpu swiftshader_indirect \
  >"$EVID_DIR/emulator.log" 2>&1 &
EMU_PID=$!

adb wait-for-device
echo "esperando boot_completed..." | tee -a "$EVID_DIR/log.txt"
for _ in $(seq 1 120); do
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] && break
  sleep 1
done
[[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] \
  || { echo "emulador não bootou em 120s" >&2; exit 1; }

PORT="$(find_free_port)"
echo "porta API=$PORT" | tee -a "$EVID_DIR/log.txt"

docker exec aqui-log-postgres psql -U "$DB_USER" -d postgres \
  -c "CREATE DATABASE ${DB_NAME};" >/dev/null

(
  cd "$ROOT_DIR/apps/backend"
  export PORT="$PORT"
  export DATABASE_NAME="$DB_NAME"
  # presign visto do emulador; o seed no host reescreve 10.0.2.2 → 127.0.0.1
  export PUBLIC_API_URL="http://10.0.2.2:${PORT}/api/v1"
  export PHONE_VERIFY_ADAPTER=local
  export GEO_PROVIDER=local
  export PHONE_VERIFY_REQUIRED=false
  pnpm migration:run
  pnpm seed:admin
  exec node dist/main
) >"$EVID_DIR/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 180); do
  curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" | tee -a "$EVID_DIR/log.txt"
echo | tee -a "$EVID_DIR/log.txt"

python3 - <<'PY'
from PIL import Image
Image.new("RGB", (64, 64), (249, 115, 22)).save("scripts/qa-produto.jpg", "JPEG", quality=85)
PY
adb push "$ROOT_DIR/scripts/qa-produto.jpg" /data/local/tmp/qa-produto.jpg >/dev/null

SEED_CUSTOMER_EMAIL=""
SEED_CUSTOMER_PASSWORD=""
SEED_DELIVERY_ID=""

if [[ "$APP" == "courier_app" ]]; then
  SEED_CUSTOMER_EMAIL="cliente.seed.${RUN_ID}@aquilog.test"
  SEED_CUSTOMER_PASSWORD="TesteSeguro123!"
  export PORT ADMIN_EMAIL_VALUE ADMIN_PASSWORD_VALUE
  export SEED_CUSTOMER_EMAIL SEED_CUSTOMER_PASSWORD RUN_ID
  export SEED_OUT="$EVID_DIR/seed-delivery-id.txt"
  python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

def req(method, path, body=None, token=None):
    print("REQ", method, path, "tok=yes" if token else "tok=no", file=sys.stderr)
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

admin = req("POST", "/auth/login", {
    "email": os.environ["ADMIN_EMAIL_VALUE"],
    "password": os.environ["ADMIN_PASSWORD_VALUE"],
})
cust = req("POST", "/auth/register/customer", {
    "name": "Cliente semente QA",
    "email": os.environ["SEED_CUSTOMER_EMAIL"],
    "password": os.environ["SEED_CUSTOMER_PASSWORD"],
    "document": str(int(os.environ["RUN_ID"]) % 10**11).zfill(11),
    "phone": "65991112222",
})
cid = cust['user'].get('customerId') or cust['user']['id']
req("POST", f"/finance/accounts/customer/{cid}/adjust",
    {"amountCents": 1000000, "reason": "Credito QA-01 semente"},
    token=admin["accessToken"])
presign = req("POST", "/storage/presign",
              {"purpose": "product", "contentType": "image/jpeg"},
              token=cust["accessToken"])
upload_url = presign["uploadUrl"].replace("10.0.2.2", "127.0.0.1")
upload = urllib.request.Request(upload_url, data=b"fake-jpeg-qa01", method="PUT")
upload.add_header("Content-Type", "image/jpeg")
upload.add_header("Authorization", f"Bearer {cust['accessToken']}")
urllib.request.urlopen(upload).read()
delivery = req("POST", "/deliveries", {
    "pickupAddress": "Av. Historiador Rubens de Mendonca 1000 Cuiaba",
    "pickupLatitude": -15.58,
    "pickupLongitude": -56.08,
    "deliveryAddress": "Rua das Flores 200 Cuiaba",
    "deliveryLatitude": -15.60,
    "deliveryLongitude": -56.10,
    "recipientName": "Destinatario QA",
    "recipientPhone": "65988887777",
    "fulfillmentMode": "IMMEDIATE",
    "productType": "OTHER",
    "packageSize": "SMALL",
    "weightKg": 1.0,
    "deliveryScope": "SAME_CITY",
    "productPhotoUrls": [presign["fileUrl"]],
}, token=cust["accessToken"])
open(os.environ["SEED_OUT"], "w").write(delivery["id"])
print("seed delivery", delivery["id"])
PY
  SEED_DELIVERY_ID="$(cat "$EVID_DIR/seed-delivery-id.txt")"
fi

DEFINES=(
  --dart-define="AQUI_LOG_API=http://10.0.2.2:${PORT}/api/v1"
  --dart-define="QA_RUN_ID=${RUN_ID}"
  --dart-define="QA_ADMIN_EMAIL=${ADMIN_EMAIL_VALUE}"
  --dart-define="QA_ADMIN_PASSWORD=${ADMIN_PASSWORD_VALUE}"
  --dart-define="QA_FIXTURE_PHOTO=/data/local/tmp/qa-produto.jpg"
)
if [[ "$APP" == "courier_app" ]]; then
  DEFINES+=(
    --dart-define="QA_SEED_CUSTOMER_EMAIL=${SEED_CUSTOMER_EMAIL}"
    --dart-define="QA_SEED_CUSTOMER_PASSWORD=${SEED_CUSTOMER_PASSWORD}"
    --dart-define="QA_SEED_DELIVERY_ID=${SEED_DELIVERY_ID}"
  )
fi

set +e
(
  cd "$ROOT_DIR/apps/$APP"
  flutter test integration_test/app_test.dart --timeout 25m "${DEFINES[@]}"
)
FLUTTER_CODE=$?
set -e
adb exec-out screencap -p > "$EVID_DIR/tela-final-${APP}.png" || true
echo "flutter_exit=$FLUTTER_CODE" | tee -a "$EVID_DIR/log.txt"
exit "$FLUTTER_CODE"
