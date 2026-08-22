#!/usr/bin/env bash
# QA-03 — migration ida e volta num banco descartável, com linha legada.
# Uso: bash scripts/migration-roundtrip.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

DB_USER="${DATABASE_USER:-$(env_value DATABASE_USER)}"
DB_USER="${DB_USER:-aqui_log}"
DB_PASS="${DATABASE_PASSWORD:-$(env_value DATABASE_PASSWORD)}"
DB_PASS="${DB_PASS:-aqui_log_dev}"
DB_HOST="${DATABASE_HOST:-$(env_value DATABASE_HOST)}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-$(env_value DATABASE_PORT)}"
DB_PORT="${DB_PORT:-5433}"
RUN_ID="$(date +%s)"
DB_NAME="aqui_log_roundtrip_${RUN_ID}"
USER_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1"
CUST_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee2"

psql_db() {
  local db="$1"; shift
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  local code=$?
  set +e
  PGPASSWORD="$DB_PASS" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$DB_NAME" >/dev/null 2>&1 || true
  echo "roundtrip cleanup exit=$code db=$DB_NAME"
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "== migration-roundtrip db=$DB_NAME =="

if ! PGPASSWORD="$DB_PASS" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
  echo "postgres nao responde em ${DB_HOST}:${DB_PORT}" >&2
  exit 1
fi

psql_db postgres -c "CREATE DATABASE ${DB_NAME};" >/dev/null

export DATABASE_NAME="$DB_NAME"
export DATABASE_HOST="$DB_HOST"
export DATABASE_PORT="$DB_PORT"
export DATABASE_USER="$DB_USER"
export DATABASE_PASSWORD="$DB_PASS"

pnpm --filter backend migration:run

psql_db "$DB_NAME" <<SQL
INSERT INTO users (id, name, email, password_hash, role, status)
VALUES ('${USER_ID}', 'Cliente legado roundtrip', 'legado.roundtrip.${RUN_ID}@aquilog.test', 'hash-legado', 'CUSTOMER', 'ACTIVE');
INSERT INTO customers (id, user_id, document, phone, status)
VALUES ('${CUST_ID}', '${USER_ID}', '${RUN_ID}', '+5565987654321', 'ACTIVE');
UPDATE users SET customer_id = '${CUST_ID}' WHERE id = '${USER_ID}';
SQL

email="$(psql_db "$DB_NAME" -Atc "SELECT email FROM users WHERE id = '${USER_ID}';")"
[[ "$email" == *roundtrip* ]] || { echo "insert legado falhou: $email" >&2; exit 1; }

echo "revertendo ultima migration (CustomerPhoneVerification)..."
pnpm --filter backend migration:revert

# A linha tem que sobreviver sem as colunas de telefone.
survived="$(psql_db "$DB_NAME" -Atc "SELECT email FROM users WHERE id = '${USER_ID}';")"
if [[ "$survived" != "$email" ]]; then
  echo "linha legada sumiu no revert: $survived" >&2
  exit 1
fi
# Colunas da ultima migration nao podem existir depois do down.
if psql_db "$DB_NAME" -Atc "SELECT phone_verified_at FROM customers WHERE id = '${CUST_ID}';" >/dev/null 2>&1; then
  echo "phone_verified_at ainda existe apos revert" >&2
  exit 1
fi

echo "reaplicando migrations..."
pnpm --filter backend migration:run

survived2="$(psql_db "$DB_NAME" -Atc "SELECT email FROM users WHERE id = '${USER_ID}';")"
if [[ "$survived2" != "$email" ]]; then
  echo "linha legada sumiu no reapply: $survived2" >&2
  exit 1
fi
verified_null="$(psql_db "$DB_NAME" -Atc "SELECT phone_verified_at FROM customers WHERE id = '${CUST_ID}';")"
if [[ -n "$verified_null" ]]; then
  echo "legado deveria ter phone_verified_at nulo, veio '$verified_null'" >&2
  exit 1
fi

echo "migration-roundtrip PASS (legado $email sobreviveu revert+reapply)"
