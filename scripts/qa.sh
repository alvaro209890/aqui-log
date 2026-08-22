#!/usr/bin/env bash
# QA-03 — portão completo: roundtrip + painel + (opcional) apps.
# Uso: pnpm qa
# QA_SKIP_MOBILE=1 pula o emulador (CI sem AVD, ou AVD ocupado pelo AquiResolve).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== pnpm qa: migration-roundtrip =="
bash "$ROOT_DIR/scripts/migration-roundtrip.sh"

echo "== pnpm qa: dashboard Playwright =="
bash "$ROOT_DIR/scripts/qa-dashboard.sh"

if [[ "${QA_SKIP_MOBILE:-}" == "1" ]]; then
  echo "== pnpm qa: mobile PULADO (QA_SKIP_MOBILE=1) =="
  echo "Emulador em runner GitHub e no AVD compartilhado do AquiResolve nao e o caminho principal."
  exit 0
fi

echo "== pnpm qa: mobile customer_app =="
bash "$ROOT_DIR/scripts/qa-mobile.sh" customer_app
echo "== pnpm qa: mobile courier_app =="
bash "$ROOT_DIR/scripts/qa-mobile.sh" courier_app
echo "== pnpm qa PASS =="
