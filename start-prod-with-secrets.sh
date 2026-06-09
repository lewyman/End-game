#!/usr/bin/env bash
set -euo pipefail
cd /home/workspace/bio-sync-academy

if [ -f /root/.zo_secrets ]; then
  set -a
  source /root/.zo_secrets
  set +a
fi

if [ -f .runtime-secrets.json ]; then
  export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-$(python3 -c "import json; print(json.load(open('.runtime-secrets.json')).get('GOOGLE_CLIENT_ID',''))")}" 
  export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-$(python3 -c "import json; print(json.load(open('.runtime-secrets.json')).get('GOOGLE_CLIENT_SECRET',''))")}" 
  export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-$(python3 -c "import json; print(json.load(open('.runtime-secrets.json')).get('STRIPE_SECRET_KEY',''))")}" 
  export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-$(python3 -c "import json; print(json.load(open('.runtime-secrets.json')).get('STRIPE_WEBHOOK_SECRET',''))")}" 
  export ZO_CLIENT_IDENTITY_TOKEN="${ZO_CLIENT_IDENTITY_TOKEN:-$(python3 -c "import json; print(json.load(open('.runtime-secrets.json')).get('ZO_CLIENT_IDENTITY_TOKEN',''))")}" 
fi

export NODE_ENV=production
export MAIA_PRO_MODEL="${MAIA_PRO_MODEL:-google/gemini-3.1-pro-preview}"

python3 - <<'PY'
import os
required=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','ZO_CLIENT_IDENTITY_TOKEN']
missing=[k for k in required if not os.environ.get(k)]
if missing:
    raise SystemExit('Missing runtime secrets: '+','.join(missing))
print('Runtime secrets loaded:', ','.join(required))
PY

exec bun run prod
