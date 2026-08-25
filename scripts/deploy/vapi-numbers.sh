#!/usr/bin/env bash
# Runs inside LXC 129: list Vapi phone numbers.
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $KEY" https://api.vapi.ai/phone-number | python3 -c '
import json, sys
for p in json.load(sys.stdin):
    print(
        p.get("number", "?"), "::", p.get("name", "?"),
        ":: provider =", p.get("provider", "?"),
        ":: assistantId =", p.get("assistantId"),
        ":: id =", p["id"],
    )
'
