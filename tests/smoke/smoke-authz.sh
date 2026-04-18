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

SUPABASE_BASE_URL="${SUPABASE_URL:-}"
SUPABASE_BASE_URL="${SUPABASE_BASE_URL%/}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
BACKEND_URL="${BACKEND_URL:-}"

[[ -n "$SUPABASE_BASE_URL" ]] || { echo "Missing SUPABASE_URL in .env"; exit 1; }
[[ -n "$SUPABASE_ANON_KEY" ]] || { echo "Missing SUPABASE_ANON_KEY in .env"; exit 1; }
[[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Missing SUPABASE_SERVICE_ROLE_KEY in .env"; exit 1; }

TMP_DIR="$(mktemp -d)"
RESP_FILE=""
RESP_STATUS=""
declare -a CREATED_USER_IDS=()
# Force local direct calls (bypass any system/http proxy that can break localhost checks)
CURL_COMMON_ARGS=(--noproxy '*')
CURL_TIMEOUT_ARGS=(--connect-timeout 10 --max-time 60)
HEALTH_TIMEOUT_ARGS=(--connect-timeout 3 --max-time 5)

cleanup() {
  for uid in "${CREATED_USER_IDS[@]:-}"; do
    curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X DELETE \
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
  local -a args=("${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -o "$RESP_FILE" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(--data "$body")
  RESP_STATUS="$(curl "${args[@]}")"
}

probe_backend_health() {
  local candidate="$1"
  local status
  status="$(curl "${CURL_COMMON_ARGS[@]}" "${HEALTH_TIMEOUT_ARGS[@]}" -sS -o /dev/null -w "%{http_code}" "$candidate/api/health" 2>/dev/null || true)"
  [[ "$status" == "200" ]]
}

diagnose_backend_listener() {
  command -v ss >/dev/null || return

  local listener_line
  listener_line="$(ss -ltnp 2>/dev/null | awk -v port="$BACKEND_PORT" '$4 ~ ":" port "$" { print; exit }')"
  [[ -n "$listener_line" ]] || return

  echo
  echo "Detected listener on port $BACKEND_PORT, but health checks did not return 200."
  echo "$listener_line"

  local pid
  pid="$(sed -n 's/.*pid=\([0-9]\+\).*/\1/p' <<<"$listener_line" | head -n 1)"
  if [[ -n "$pid" ]] && command -v ps >/dev/null; then
    local stat
    stat="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
    if [[ "$stat" == T* ]]; then
      echo "Backend process $pid is STOPPED (job-control state '$stat')."
      echo "This usually means it was suspended (e.g. Ctrl+Z)."
      echo "Run 'fg' in the backend terminal or restart backend cleanly."
    fi
  fi
}

resolve_backend_url() {
  if [[ -n "$BACKEND_URL" ]]; then
    if probe_backend_health "$BACKEND_URL"; then
      return
    fi
    echo "Configured BACKEND_URL is not reachable: $BACKEND_URL"
    echo "Check backend server status and port, then retry."
    exit 1
  fi

  local -a candidates=(
    "http://localhost:${BACKEND_PORT}"
    "http://127.0.0.1:${BACKEND_PORT}"
  )

  if command -v ip >/dev/null; then
    local gateway_ip
    gateway_ip="$(ip route 2>/dev/null | awk '/^default / {print $3; exit}' || true)"
    if [[ -n "$gateway_ip" ]]; then
      candidates+=("http://${gateway_ip}:${BACKEND_PORT}")
    fi
  fi

  if [[ -f /etc/resolv.conf ]]; then
    local win_host_ip
    win_host_ip="$(awk '/^nameserver / {print $2; exit}' /etc/resolv.conf || true)"
    if [[ -n "$win_host_ip" ]]; then
      candidates+=("http://${win_host_ip}:${BACKEND_PORT}")
    fi
  fi

  for candidate in "${candidates[@]}"; do
    if probe_backend_health "$candidate"; then
      BACKEND_URL="$candidate"
      return
    fi
  done

  echo "Backend is not reachable from this shell."
  echo "Tried:"
  for candidate in "${candidates[@]}"; do
    echo "  - $candidate"
  done
  diagnose_backend_listener
  echo "Start backend first and retry."
  exit 1
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
  create_resp="$(curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X POST "$SUPABASE_BASE_URL/auth/v1/admin/users" \
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
  sign_in_resp="$(curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X POST "$SUPABASE_BASE_URL/auth/v1/token?grant_type=password" \
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

resolve_backend_url
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

echo "Smoke 3: Shared cache cross-link via POST /api/projects"
request_backend POST "$BACKEND_URL/api/projects" "$TOKEN_A" \
  "$(jq -n --arg name "smoke-a-shared" --arg locationId "$LOCATION_B_ID" '{name:$name,locationId:$locationId}')"
expect_status 201 "$RESP_STATUS" "A can create project linked to existing B location"

request_backend GET "$BACKEND_URL/api/locations/$LOCATION_B_ID/status" "$TOKEN_A"
expect_status 200 "$RESP_STATUS" "A can read shared location status after linking"

echo "Smoke 4: A can still access own location"
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
