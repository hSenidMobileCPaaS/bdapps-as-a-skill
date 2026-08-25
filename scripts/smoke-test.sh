#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# bdapps smoke tests
#
# Verifies credentials, IP whitelisting, and every endpoint you have configured.
#
# Only the services with a URL set in your environment are tested — an unset
# endpoint means that API is not enabled on your application, so there is
# nothing to test. Configure them in .env; see templates/.env.example.
#
# Usage:
#   cp templates/.env.example .env && $EDITOR .env
#   ./scripts/smoke-test.sh                 # safe tests only
#   ./scripts/smoke-test.sh --with-sms      # also sends a real SMS
#   ./scripts/smoke-test.sh --with-charge   # also charges REAL MONEY
#   ./scripts/smoke-test.sh --with-otp      # also sends a real OTP SMS
#
# RUN THIS FROM THE SERVER THAT WILL CALL BDAPPS. Running it from a laptop
# tests the laptop's IP, which is not what you whitelisted, and E1303 will tell
# you nothing useful.
#
# Credentials come from the environment. Never paste them into this file.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

[ -f .env ] && set -a && . ./.env && set +a

: "${BDAPPS_APP_ID:?Set BDAPPS_APP_ID (see templates/.env.example)}"
: "${BDAPPS_PASSWORD:?Set BDAPPS_PASSWORD (see templates/.env.example)}"

# A number in your app's Whitelisted Numbers list.
TEST_MSISDN="${TEST_MSISDN:-8801812345678}"

WITH_SMS=false; WITH_CHARGE=false; WITH_OTP=false
for arg in "$@"; do
  case "$arg" in
    --with-sms) WITH_SMS=true ;;
    --with-charge) WITH_CHARGE=true ;;
    --with-otp) WITH_OTP=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; DIM=$'\033[2m'; NC=$'\033[0m'
PASS=0; FAIL=0; SKIP=0

skip() { printf '%-28s%s\n' "$1" "${DIM}$2${NC}"; SKIP=$((SKIP+1)); }

# call <name> <url> <json-body>
call() {
  local name="$1" url="$2" body="$3"
  printf '%-28s' "$name"
  local response
  response=$(curl -sS --max-time 20 -X POST "$url" \
    -H 'Content-Type: application/json' --data "$body" 2>&1)

  if [ -z "$response" ]; then
    echo "${RED}NO RESPONSE${NC}  (network, firewall, or TLS chain problem)"
    FAIL=$((FAIL+1)); return
  fi

  local code
  code=$(printf '%s' "$response" | grep -o '"statusCode"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([SE][0-9]*\)"/\1/')

  case "$code" in
    S1000) echo "${GREEN}S1000 OK${NC}"; PASS=$((PASS+1)) ;;
    E1303) echo "${RED}E1303${NC}  This IP is not whitelisted. Run: curl -4 https://api.ipify.org"; FAIL=$((FAIL+1)) ;;
    E1313) echo "${RED}E1313${NC}  Auth failure — check BDAPPS_APP_ID / BDAPPS_PASSWORD"; FAIL=$((FAIL+1)) ;;
    E1309) echo "${YELLOW}E1309${NC}  Service not provisioned — remove this URL from your .env"; FAIL=$((FAIL+1)) ;;
    E1343) echo "${YELLOW}E1343${NC}  $TEST_MSISDN is not in Whitelisted Numbers"; FAIL=$((FAIL+1)) ;;
    E1351) echo "${GREEN}E1351${NC}  Already registered (benign)"; PASS=$((PASS+1)) ;;
    E1356) echo "${GREEN}E1356${NC}  Not registered (benign for unregister)"; PASS=$((PASS+1)) ;;
    "")    echo "${RED}NO statusCode${NC}"; echo "${DIM}  $response${NC}"; FAIL=$((FAIL+1)) ;;
    *)     echo "${RED}${code}${NC}"; echo "${DIM}  $response${NC}"; FAIL=$((FAIL+1)) ;;
  esac
}

creds="\"applicationId\":\"$BDAPPS_APP_ID\",\"password\":\"$BDAPPS_PASSWORD\""

echo
echo "bdapps smoke test"
echo "  app id     $BDAPPS_APP_ID"
echo "  password   ***redacted***"
echo "  egress IP  $(curl -4 -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo '(could not determine)')"
echo "             ^ this must be in your app's Allowed Host Addresses"
echo

# ── Subscription ────────────────────────────────────────────────────────────
echo "── Subscription ────────────────────────────────"
if [ -n "${BDAPPS_SUBSCRIPTION_QUERY_BASE_URL:-}" ]; then
  call "Query Base (base size)" "$BDAPPS_SUBSCRIPTION_QUERY_BASE_URL" "{$creds}"
else
  skip "Query Base (base size)" "BDAPPS_SUBSCRIPTION_QUERY_BASE_URL not set"
fi

if [ -n "${BDAPPS_SUBSCRIPTION_STATUS_URL:-}" ]; then
  call "Get Status" "$BDAPPS_SUBSCRIPTION_STATUS_URL" \
    "{$creds,\"subscriberId\":\"tel:$TEST_MSISDN\"}"
else
  skip "Get Status" "BDAPPS_SUBSCRIPTION_STATUS_URL not set"
fi

if [ -n "${BDAPPS_SUBSCRIPTION_SEND_URL:-}" ]; then
  call "Register (opt-in)" "$BDAPPS_SUBSCRIPTION_SEND_URL" \
    "{$creds,\"version\":\"1.0\",\"action\":\"1\",\"subscriberId\":\"tel:$TEST_MSISDN\"}"
  call "Unregister (opt-out)" "$BDAPPS_SUBSCRIPTION_SEND_URL" \
    "{$creds,\"version\":\"1.0\",\"action\":\"0\",\"subscriberId\":\"tel:$TEST_MSISDN\"}"
else
  skip "Register / Unregister" "BDAPPS_SUBSCRIPTION_SEND_URL not set"
fi

# ── CaaS ────────────────────────────────────────────────────────────────────
echo
echo "── CaaS ────────────────────────────────────────"
if [ -n "${BDAPPS_CAAS_GET_BALANCE_URL:-}" ]; then
  call "Query Balance" "$BDAPPS_CAAS_GET_BALANCE_URL" \
    "{$creds,\"subscriberId\":\"tel:$TEST_MSISDN\",\"currency\":\"BDT\"}"
else
  skip "Query Balance" "BDAPPS_CAAS_GET_BALANCE_URL not set"
fi

if [ -z "${BDAPPS_CAAS_DEBIT_URL:-}" ]; then
  skip "Direct Debit" "BDAPPS_CAAS_DEBIT_URL not set"
elif [ "$WITH_CHARGE" != true ]; then
  skip "Direct Debit" "skipped (--with-charge to run — charges real money)"
else
  echo "${YELLOW}  ⚠  This charges REAL MONEY from $TEST_MSISDN${NC}"
  TRX_ID=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
  echo "${DIM}  externalTrxId: $TRX_ID  (persist this before charging, in real code)${NC}"
  call "Direct Debit (BDT 1)" "$BDAPPS_CAAS_DEBIT_URL" \
    "{$creds,\"externalTrxId\":\"$TRX_ID\",\"subscriberId\":\"tel:$TEST_MSISDN\",\"amount\":\"1\",\"currency\":\"BDT\"}"
fi

# ── SMS ─────────────────────────────────────────────────────────────────────
echo
echo "── SMS ─────────────────────────────────────────"
if [ -z "${BDAPPS_SMS_SEND_URL:-}" ]; then
  skip "SMS Send" "BDAPPS_SMS_SEND_URL not set"
elif [ "$WITH_SMS" != true ]; then
  skip "SMS Send" "skipped (--with-sms to run — sends a real SMS)"
else
  call "SMS Send" "$BDAPPS_SMS_SEND_URL" \
    "{$creds,\"destinationAddresses\":[\"tel:$TEST_MSISDN\"],\"message\":\"bdapps smoke test\"}"
fi

# ── OTP ─────────────────────────────────────────────────────────────────────
echo
echo "── OTP ─────────────────────────────────────────"
if [ -z "${BDAPPS_OTP_REQUEST_URL:-}" ]; then
  skip "OTP Request" "BDAPPS_OTP_REQUEST_URL not set"
elif [ "$WITH_OTP" != true ]; then
  skip "OTP Request" "skipped (--with-otp to run — sends a real SMS to the test number)"
else
  call "OTP Request" "$BDAPPS_OTP_REQUEST_URL" \
    "{$creds,\"subscriberId\":\"tel:$TEST_MSISDN\"}"
  echo "${DIM}  Then verify: POST \$BDAPPS_OTP_VERIFY_URL with {referenceNo, otp}${NC}"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo
echo "───────────────────────────────────────────────"
echo "  ${GREEN}passed ${PASS}${NC}   ${RED}failed ${FAIL}${NC}   ${DIM}skipped ${SKIP}${NC}"
if [ "$PASS" -eq 0 ] && [ "$FAIL" -eq 0 ]; then
  echo "  ${YELLOW}Nothing ran — no service endpoints are configured in .env.${NC}"
fi
echo
[ "$FAIL" -eq 0 ] || exit 1
