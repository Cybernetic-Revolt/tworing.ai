#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
env = {}
for l in open('/etc/bilco-platform.env'):
    l = l.strip()
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1)
        env[k] = v
k = env['VAPI_API_KEY']
print('len', len(k), 'head', repr(k[:6]), 'tail', repr(k[-3:]))
PY
grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2 | wc -c
