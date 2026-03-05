#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null || { echo "jq is required"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
fi

ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source <(sed -e 's/\r$//' "$ENV_FILE")
set +a

SUPABASE_BASE_URL="${SUPABASE_PROJECT_URL:-${SUPABASE_URL:-}}"
SUPABASE_BASE_URL="${SUPABASE_BASE_URL%/}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
BACKEND_URL="${BACKEND_URL:-http://localhost:${BACKEND_PORT:-3001}}"

[[ -n "$SUPABASE_BASE_URL" ]] || { echo "Missing SUPABASE_PROJECT_URL (or SUPABASE_URL) in .env"; exit 1; }
[[ -n "$SUPABASE_ANON_KEY" ]] || { echo "Missing SUPABASE_ANON_KEY in .env"; exit 1; }
[[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Missing SUPABASE_SERVICE_ROLE_KEY in .env"; exit 1; }

TMP_DIR="$(mktemp -d)"
RESP_FILE=""
RESP_STATUS=""
declare -a CREATED_USER_IDS=()

cleanup() {
  for uid in "${CREATED_USER_IDS[@]:-}"; do
    curl -sS -X DELETE \
      "$SUPABASE_BASE_URL/auth/v1/admin/users/$uid" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" >/dev/null || true
  done
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

request_backend() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local body="${4:-}"

  RESP_FILE="$(mktemp "$TMP_DIR/resp.XXXX.json")"
  local -a args=(-sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(--data "$body")
  RESP_STATUS="$(curl "${args[@]}")"
}

expect_status() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "[FAIL] $label (expected $expected got $actual)"
    cat "$RESP_FILE"
    echo
    exit 1
  fi
  echo "[PASS] $label"
}

expect_not_404() {
  local actual="$1"
  local label="$2"
  if [[ "$actual" == "404" ]]; then
    echo "[FAIL] $label (got 404)"
    cat "$RESP_FILE"
    echo
    exit 1
  fi
  echo "[PASS] $label (status=$actual)"
}

create_test_user() {
  local label="$1"
  local email="${label}_$(date +%s)_$RANDOM@example.com"
  local password='P@ssw0rd!123456'

  local create_resp
  create_resp="$(curl -sS -X POST "$SUPABASE_BASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg email "$email" --arg password "$password" \
      '{email:$email,password:$password,email_confirm:true}')")"

  local user_id
  user_id="$(jq -r '.id // empty' <<<"$create_resp")"
  if [[ -z "$user_id" ]]; then
    echo "[FAIL] create $label user"
    echo "$create_resp"
    exit 1
  fi
  CREATED_USER_IDS+=("$user_id")

  local sign_in_resp
  sign_in_resp="$(curl -sS -X POST "$SUPABASE_BASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg email "$email" --arg password "$password" \
      '{email:$email,password:$password}')")"

  local token
  token="$(jq -r '.access_token // empty' <<<"$sign_in_resp")"
  if [[ -z "$token" ]]; then
    echo "[FAIL] sign in $label user"
    echo "$sign_in_resp"
    exit 1
  fi

  echo "$token|$user_id|$email"
}

echo "Backend URL: $BACKEND_URL"
echo "Creating test users..."
IFS='|' read -r TOKEN_A USER_A_ID EMAIL_A <<<"$(create_test_user user_a)"
IFS='|' read -r TOKEN_B USER_B_ID EMAIL_B <<<"$(create_test_user user_b)"

LAT_A=3.1390
LNG_A=101.6869
LAT_B=3.1579
LNG_B=101.7117

echo "Resolving base locations..."
request_backend POST "$BACKEND_URL/api/locations/resolve" "$TOKEN_A" "$(jq -n --argjson lat "$LAT_A" --argjson lng "$LNG_A" '{lat:$lat,lng:$lng}')"
expect_status 200 "$RESP_STATUS" "A resolve base location"
LOCATION_A_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
[[ -n "$LOCATION_A_ID" ]] || { echo "[FAIL] missing locationId for A"; exit 1; }

request_backend POST "$BACKEND_URL/api/locations/resolve" "$TOKEN_B" "$(jq -n --argjson lat "$LAT_B" --argjson lng "$LNG_B" '{lat:$lat,lng:$lng}')"
expect_status 200 "$RESP_STATUS" "B resolve base location"
LOCATION_B_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
[[ -n "$LOCATION_B_ID" ]] || { echo "[FAIL] missing locationId for B"; exit 1; }

echo "Creating projects..."
request_backend POST "$BACKEND_URL/api/projects" "$TOKEN_A" "$(jq -n --arg name "smoke-a" --arg locationId "$LOCATION_A_ID" '{name:$name,locationId:$locationId}')"
expect_status 201 "$RESP_STATUS" "A create project"
PROJECT_A_ID="$(jq -r '.id // empty' "$RESP_FILE")"
[[ -n "$PROJECT_A_ID" ]] || { echo "[FAIL] missing projectId for A"; exit 1; }

request_backend POST "$BACKEND_URL/api/projects" "$TOKEN_B" "$(jq -n --arg name "smoke-b" --arg locationId "$LOCATION_B_ID" '{name:$name,locationId:$locationId}')"
expect_status 201 "$RESP_STATUS" "B create project"
PROJECT_B_ID="$(jq -r '.id // empty' "$RESP_FILE")"
[[ -n "$PROJECT_B_ID" ]] || { echo "[FAIL] missing projectId for B"; exit 1; }

echo "Smoke 1: A resolving with B projectId -> 404"
request_backend POST "$BACKEND_URL/api/locations/resolve" "$TOKEN_A" \
  "$(jq -n --argjson lat "$LAT_A" --argjson lng "$LNG_A" --arg projectId "$PROJECT_B_ID" '{lat:$lat,lng:$lng,projectId:$projectId}')"
expect_status 404 "$RESP_STATUS" "A cannot link B projectId"

echo "Smoke 2: A cannot read/recompute B location -> 404"
request_backend GET "$BACKEND_URL/api/locations/$LOCATION_B_ID/status" "$TOKEN_A"
expect_status 404 "$RESP_STATUS" "A cannot read B status"

request_backend GET "$BACKEND_URL/api/locations/$LOCATION_B_ID/data" "$TOKEN_A"
expect_status 404 "$RESP_STATUS" "A cannot read B data"

request_backend POST "$BACKEND_URL/api/locations/$LOCATION_B_ID/panels/recompute" "$TOKEN_A" \
  "$(jq -n --argjson lat "$LAT_B" --argjson lng "$LNG_B" '{panelId:"smoke_panel",center:{lat:$lat,lng:$lng},rotation:0}')"
expect_status 404 "$RESP_STATUS" "A cannot recompute B location"

echo "Smoke 3: A can still access own location"
request_backend GET "$BACKEND_URL/api/locations/$LOCATION_A_ID/status" "$TOKEN_A"
expect_status 200 "$RESP_STATUS" "A can read own status"

request_backend GET "$BACKEND_URL/api/locations/$LOCATION_A_ID/data" "$TOKEN_A"
expect_not_404 "$RESP_STATUS" "A can access own data endpoint"

request_backend POST "$BACKEND_URL/api/locations/$LOCATION_A_ID/panels/recompute" "$TOKEN_A" \
  "$(jq -n --argjson lat "$LAT_A" --argjson lng "$LNG_A" '{panelId:"smoke_panel",center:{lat:$lat,lng:$lng},rotation:0}')"
if [[ "$RESP_STATUS" == "200" ]]; then
  echo "[PASS] A own recompute succeeded"
else
  echo "[INFO] A own recompute returned $RESP_STATUS (common while location is still processing)"
fi

echo
echo "All ownership smoke checks completed."
echo "Test users auto-clean on exit: $EMAIL_A, $EMAIL_B"
