#!/usr/bin/env bash
# Runs inside LXC 129: show each assistant's server webhook destination.
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $KEY" https://api.vapi.ai/assistant | python3 -c '
import json, sys
for a in json.load(sys.stdin):
    server = a.get("server") or {}
    url = server.get("url") or a.get("serverUrl") or "(none)"
    print(a["id"], "::", a.get("name", "?"), "::", url)
'
