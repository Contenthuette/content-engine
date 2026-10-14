#!/bin/bash
# deploy the DM worker via Cloudflare API. needs /root/.secrets/{cf_token,ig_verify_token} and optional ig_app_secret, ig_user_id
set -e
cd "$(dirname "$0")"
T=$(cat /root/.secrets/cf_token); A=4fe53d495f5b154ab87274ff3e35db4b; KV=adbfac159eae423c85a0a976c8c5b2f8
H="Authorization: Bearer $T"; B=https://api.cloudflare.com/client/v4/accounts/$A/workers/scripts/ig-dm
VT=$(cat /root/.secrets/ig_verify_token)
AS=$(cat /root/.secrets/ig_app_secret 2>/dev/null || true); UID_=$(cat /root/.secrets/ig_user_id 2>/dev/null || true)
python3 - "$KV" "$VT" "$AS" "$UID_" > /tmp/meta.json <<'PY'
import json,sys
kv,vt,as_,uid=sys.argv[1:5]
b=[{"type":"kv_namespace","name":"DM","namespace_id":kv},{"type":"plain_text","name":"IG_HANDLE","text":"ultra_automations"},{"type":"secret_text","name":"VERIFY_TOKEN","text":vt}]
if as_: b.append({"type":"secret_text","name":"APP_SECRET","text":as_})
if uid: b.append({"type":"plain_text","name":"IG_USER_ID","text":uid})
print(json.dumps({"main_module":"worker.js","compatibility_date":"2025-09-01","bindings":b}))
PY
curl -s -X PUT "$B" -H "$H" -F "metadata=@/tmp/meta.json;type=application/json" -F "worker.js=@worker.js;type=application/javascript+module" | python3 -c "import json,sys;d=json.load(sys.stdin);print('deploy',d['success'],d.get('errors'))"
rm -f /tmp/meta.json
curl -s -X POST "$B/subdomain" -H "$H" -H "Content-Type: application/json" -d '{"enabled":true,"previews_enabled":false}' | python3 -c "import json,sys;d=json.load(sys.stdin);print('subdomain',d['success'],d.get('errors'))"
curl -s -X PUT "$B/schedules" -H "$H" -H "Content-Type: application/json" -d '[{"cron":"17 4 * * *"}]' | python3 -c "import json,sys;d=json.load(sys.stdin);print('cron',d['success'],d.get('errors'))"
