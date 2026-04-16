#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null || { echo "jq is required"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }
command -v node >/dev/null || { echo "node is required"; exit 1; }

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
cd "$PROJECT_ROOT"

SUPABASE_BASE_URL="${SUPABASE_PROJECT_URL:-${SUPABASE_URL:-}}"
SUPABASE_BASE_URL="${SUPABASE_BASE_URL%/}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
BACKEND_URL="${BACKEND_URL:-}"

[[ -n "$SUPABASE_BASE_URL" ]] || { echo "Missing SUPABASE_PROJECT_URL (or SUPABASE_URL) in .env"; exit 1; }
[[ -n "$SUPABASE_ANON_KEY" ]] || { echo "Missing SUPABASE_ANON_KEY in .env"; exit 1; }
[[ -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Missing SUPABASE_SERVICE_ROLE_KEY in .env"; exit 1; }

LAT_INPUT="${1:-${CACHE_TEST_LAT:-}}"
LNG_INPUT="${2:-${CACHE_TEST_LNG:-}}"
[[ -n "$LAT_INPUT" ]] || {
  echo "Usage: tests/smoke/smoke-location-cache.sh <lat> <lng>"
  echo "Or set CACHE_TEST_LAT and CACHE_TEST_LNG in the environment."
  exit 1
}
[[ -n "$LNG_INPUT" ]] || {
  echo "Usage: tests/smoke/smoke-location-cache.sh <lat> <lng>"
  echo "Or set CACHE_TEST_LAT and CACHE_TEST_LNG in the environment."
  exit 1
}

LAT="$LAT_INPUT"
LNG="$LNG_INPUT"
COORDINATE_TOLERANCE="${COORDINATE_TOLERANCE:-0.0001}"
MAX_WAIT_SECONDS="${CACHE_MAX_WAIT_SECONDS:-300}"
POLL_INTERVAL_SECONDS="${CACHE_POLL_INTERVAL_SECONDS:-2}"
ALLOW_WARM_CACHE="${CACHE_ALLOW_WARM:-0}"
PROJECT_NAME_PREFIX="${CACHE_TEST_PROJECT_PREFIX:-cache-smoke}"

TMP_DIR="$(mktemp -d)"
RESP_FILE=""
RESP_STATUS=""
CREATED_USER_ID=""
CREATED_USER_EMAIL=""
CURL_COMMON_ARGS=(--noproxy '*')
CURL_TIMEOUT_ARGS=(--connect-timeout 10 --max-time 60)
HEALTH_TIMEOUT_ARGS=(--connect-timeout 3 --max-time 5)

cleanup() {
  if [[ -n "$CREATED_USER_ID" ]]; then
    curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X DELETE \
      "$SUPABASE_BASE_URL/auth/v1/admin/users/$CREATED_USER_ID" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" >/dev/null || true
  fi
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

resolve_backend_url() {
  if [[ -n "$BACKEND_URL" ]]; then
    if probe_backend_health "$BACKEND_URL"; then
      return
    fi
    echo "Configured BACKEND_URL is not reachable: $BACKEND_URL"
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

create_test_user() {
  local email="cache_smoke_$(date +%s)_$RANDOM@example.com"
  local password='P@ssw0rd!123456'

  local create_resp
  create_resp="$(curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X POST "$SUPABASE_BASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg email "$email" --arg password "$password" \
      '{email:$email,password:$password,email_confirm:true}')")"

  CREATED_USER_ID="$(jq -r '.id // empty' <<<"$create_resp")"
  if [[ -z "$CREATED_USER_ID" ]]; then
    echo "[FAIL] create cache smoke user"
    echo "$create_resp"
    exit 1
  fi
  CREATED_USER_EMAIL="$email"

  local sign_in_resp
  sign_in_resp="$(curl "${CURL_COMMON_ARGS[@]}" "${CURL_TIMEOUT_ARGS[@]}" -sS -X POST "$SUPABASE_BASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg email "$email" --arg password "$password" \
      '{email:$email,password:$password}')")"

  local token
  token="$(jq -r '.access_token // empty' <<<"$sign_in_resp")"
  if [[ -z "$token" ]]; then
    echo "[FAIL] sign in cache smoke user"
    echo "$sign_in_resp"
    exit 1
  fi

  echo "$token|$CREATED_USER_ID|$CREATED_USER_EMAIL"
}

create_project() {
  local token="$1"
  local name="$2"
  local location_id="$3"

  request_backend POST "$BACKEND_URL/api/projects" "$token" \
    "$(jq -n --arg name "$name" --arg locationId "$location_id" '{name:$name,locationId:$locationId}')"
  expect_status 201 "$RESP_STATUS" "Create project \"$name\""
}

location_window_stats() {
  CACHE_LAT="$1" CACHE_LNG="$2" CACHE_TOL="$COORDINATE_TOLERANCE" node --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const lat = Number(process.env.CACHE_LAT)
const lng = Number(process.env.CACHE_LNG)
const tol = Number(process.env.CACHE_TOL)

const locations = await prisma.location.findMany({
  where: {
    lat: { gte: lat - tol, lte: lat + tol },
    lng: { gte: lng - tol, lte: lng + tol }
  },
  orderBy: { createdAt: 'asc' },
  select: { id: true, status: true, createdAt: true }
})

console.log(JSON.stringify({ count: locations.length, locations }, null, 2))
await prisma.$disconnect()
NODE
}

location_record_snapshot() {
  CACHE_LOCATION_ID="$1" node --input-type=module <<'NODE'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const locationId = process.env.CACHE_LOCATION_ID

const location = await prisma.location.findUnique({
  where: { id: locationId },
  select: {
    id: true,
    status: true,
    buildingInsightsJson: true,
    rgbImageUrl: true,
    monthlyFluxPath: true,
    maskPath: true,
    annualFluxPath: true,
    dsmPath: true,
    createdAt: true
  }
})

console.log(JSON.stringify(location, null, 2))
await prisma.$disconnect()
NODE
}

poll_until_ready() {
  local token="$1"
  local location_id="$2"
  local started_at
  started_at="$(date +%s)"

  while true; do
    request_backend GET "$BACKEND_URL/api/locations/$location_id/status" "$token"
    expect_status 200 "$RESP_STATUS" "Poll location status"

    local status
    status="$(jq -r '.status // empty' "$RESP_FILE")"
    if [[ "$status" == "ready" ]]; then
      echo "[PASS] Location $location_id reached ready state"
      return
    fi
    if [[ "$status" == "failed" ]]; then
      echo "[FAIL] Location $location_id entered failed state"
      cat "$RESP_FILE"
      echo
      exit 1
    fi

    local now elapsed
    now="$(date +%s)"
    elapsed="$((now - started_at))"
    if (( elapsed >= MAX_WAIT_SECONDS )); then
      echo "[FAIL] Timed out waiting for location $location_id to become ready"
      exit 1
    fi

    echo "[INFO] Location $location_id still processing after ${elapsed}s"
    sleep "$POLL_INTERVAL_SECONDS"
  done
}

resolve_backend_url
echo "Backend URL: $BACKEND_URL"
echo "Cache test coordinate: lat=$LAT lng=$LNG tolerance=$COORDINATE_TOLERANCE"

PRE_STATS_JSON="$(location_window_stats "$LAT" "$LNG")"
PRE_COUNT="$(jq -r '.count' <<<"$PRE_STATS_JSON")"

echo "Pre-run cache window count: $PRE_COUNT"
if [[ "$ALLOW_WARM_CACHE" != "1" && "$PRE_COUNT" != "0" ]]; then
  echo "[FAIL] The coordinate window is already cached."
  echo "Pick a fresh location or rerun with CACHE_ALLOW_WARM=1 to test warm-cache reuse only."
  echo "$PRE_STATS_JSON"
  exit 1
fi

IFS='|' read -r TOKEN CREATED_USER_ID CREATED_USER_EMAIL <<<"$(create_test_user)"
echo "Created temp user: $CREATED_USER_EMAIL"

FIRST_BODY="$(jq -n --argjson lat "$LAT" --argjson lng "$LNG" '{lat:$lat,lng:$lng}')"
echo "First resolve + project creation..."
request_backend POST "$BACKEND_URL/api/locations/resolve" "$TOKEN" "$FIRST_BODY"
expect_status 200 "$RESP_STATUS" "First resolve call"
FIRST_LOCATION_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
FIRST_STATUS="$(jq -r '.status // empty' "$RESP_FILE")"
[[ -n "$FIRST_LOCATION_ID" ]] || { echo "[FAIL] missing first locationId"; exit 1; }
echo "[INFO] First resolve returned locationId=$FIRST_LOCATION_ID status=$FIRST_STATUS"

if [[ "$FIRST_STATUS" == "processing" ]]; then
  poll_until_ready "$TOKEN" "$FIRST_LOCATION_ID"
elif [[ "$FIRST_STATUS" != "ready" ]]; then
  echo "[FAIL] Unexpected first resolve status: $FIRST_STATUS"
  cat "$RESP_FILE"
  echo
  exit 1
fi

MID_STATS_JSON="$(location_window_stats "$LAT" "$LNG")"
MID_COUNT="$(jq -r '.count' <<<"$MID_STATS_JSON")"
echo "Post-first-run cache window count: $MID_COUNT"

FIRST_LOCATION_JSON="$(location_record_snapshot "$FIRST_LOCATION_ID")"
FIRST_LOCATION_STATUS="$(jq -r '.status // empty' <<<"$FIRST_LOCATION_JSON")"
FIRST_HAS_BUILDING_INSIGHTS="$(jq -r '(.buildingInsightsJson != null)' <<<"$FIRST_LOCATION_JSON")"
FIRST_HAS_RGB_PNG="$(jq -r '(.rgbImageUrl != null)' <<<"$FIRST_LOCATION_JSON")"
FIRST_HAS_MONTHLY_FLUX="$(jq -r '(.monthlyFluxPath != null)' <<<"$FIRST_LOCATION_JSON")"
FIRST_HAS_MASK="$(jq -r '(.maskPath != null)' <<<"$FIRST_LOCATION_JSON")"
FIRST_CREATED_AT="$(jq -r '.createdAt // empty' <<<"$FIRST_LOCATION_JSON")"

if [[ "$FIRST_LOCATION_STATUS" != "ready" ]]; then
  echo "[FAIL] Persisted location row is not ready after first resolve"
  echo "$FIRST_LOCATION_JSON"
  exit 1
fi
if [[ "$FIRST_HAS_BUILDING_INSIGHTS" != "true" || "$FIRST_HAS_RGB_PNG" != "true" || "$FIRST_HAS_MONTHLY_FLUX" != "true" || "$FIRST_HAS_MASK" != "true" ]]; then
  echo "[FAIL] Persisted location row is missing required cached artifacts"
  echo "$FIRST_LOCATION_JSON"
  exit 1
fi
echo "[PASS] First resolve persisted buildingInsightsJson, rgbImageUrl, monthlyFluxPath and maskPath"

FIRST_PROJECT_NAME="${PROJECT_NAME_PREFIX}-first"
create_project "$TOKEN" "$FIRST_PROJECT_NAME" "$FIRST_LOCATION_ID"
FIRST_PROJECT_ID="$(jq -r '.id // empty' "$RESP_FILE")"
FIRST_PROJECT_LOCATION_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
if [[ "$FIRST_PROJECT_LOCATION_ID" != "$FIRST_LOCATION_ID" ]]; then
  echo "[FAIL] First project did not link to the resolved location"
  cat "$RESP_FILE"
  echo
  exit 1
fi
echo "[PASS] First project linked to cached location $FIRST_PROJECT_LOCATION_ID"

SECOND_BODY="$(jq -n --argjson lat "$LAT" --argjson lng "$LNG" '{lat:$lat,lng:$lng}')"
echo "Second resolve + project creation..."
request_backend POST "$BACKEND_URL/api/locations/resolve" "$TOKEN" "$SECOND_BODY"
expect_status 200 "$RESP_STATUS" "Second resolve call"
SECOND_LOCATION_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
SECOND_STATUS="$(jq -r '.status // empty' "$RESP_FILE")"
[[ -n "$SECOND_LOCATION_ID" ]] || { echo "[FAIL] missing second locationId"; exit 1; }
echo "[INFO] Second resolve returned locationId=$SECOND_LOCATION_ID status=$SECOND_STATUS"

POST_STATS_JSON="$(location_window_stats "$LAT" "$LNG")"
POST_COUNT="$(jq -r '.count' <<<"$POST_STATS_JSON")"
echo "Post-second-run cache window count: $POST_COUNT"

SECOND_PROJECT_NAME="${PROJECT_NAME_PREFIX}-second"
create_project "$TOKEN" "$SECOND_PROJECT_NAME" "$SECOND_LOCATION_ID"
SECOND_PROJECT_ID="$(jq -r '.id // empty' "$RESP_FILE")"
SECOND_PROJECT_LOCATION_ID="$(jq -r '.locationId // empty' "$RESP_FILE")"
if [[ "$SECOND_PROJECT_LOCATION_ID" != "$SECOND_LOCATION_ID" ]]; then
  echo "[FAIL] Second project did not link to the resolved location"
  cat "$RESP_FILE"
  echo
  exit 1
fi
echo "[PASS] Second project linked to cached location $SECOND_PROJECT_LOCATION_ID"

SECOND_LOCATION_JSON="$(location_record_snapshot "$SECOND_LOCATION_ID")"
SECOND_CREATED_AT="$(jq -r '.createdAt // empty' <<<"$SECOND_LOCATION_JSON")"
if [[ "$SECOND_CREATED_AT" != "$FIRST_CREATED_AT" ]]; then
  echo "[FAIL] Cached location metadata changed unexpectedly between the first and second flow"
  echo "First createdAt:  $FIRST_CREATED_AT"
  echo "Second createdAt: $SECOND_CREATED_AT"
  exit 1
fi
echo "[PASS] Cached location record identity remained stable across both flows"

if [[ "$SECOND_LOCATION_ID" != "$FIRST_LOCATION_ID" ]]; then
  echo "[FAIL] Cache reuse failed: second resolve returned a different locationId"
  echo "First:  $FIRST_LOCATION_ID"
  echo "Second: $SECOND_LOCATION_ID"
  exit 1
fi
echo "[PASS] Second resolve reused the same locationId"

if [[ "$POST_COUNT" != "$MID_COUNT" ]]; then
  echo "[FAIL] Cache reuse failed: location count changed on second resolve"
  echo "After first resolve:  $MID_COUNT"
  echo "After second resolve: $POST_COUNT"
  echo "$POST_STATS_JSON"
  exit 1
fi
echo "[PASS] Second resolve did not create an additional Location row"

if [[ "$SECOND_STATUS" != "ready" ]]; then
  echo "[FAIL] Expected warm-cache second resolve to return ready, got: $SECOND_STATUS"
  exit 1
fi
echo "[PASS] Second resolve returned ready immediately"

if [[ -z "$FIRST_PROJECT_ID" || -z "$SECOND_PROJECT_ID" ]]; then
  echo "[FAIL] Missing project ids from create-project responses"
  exit 1
fi
if [[ "$FIRST_PROJECT_ID" == "$SECOND_PROJECT_ID" ]]; then
  echo "[FAIL] Expected two distinct projects, but both responses returned the same id"
  exit 1
fi
if [[ -z "$FIRST_CREATED_AT" ]]; then
  echo "[FAIL] Missing createdAt for cached location snapshot"
  exit 1
fi
echo "[PASS] Repeated project creation reused one cached location across two distinct projects"

echo
echo "Location caching smoke test passed."
echo "If backend logging is enabled, you should see the fetch pipeline start only on the first resolve."
