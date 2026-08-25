#!/usr/bin/env bash
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)
for aid in 534db2e3-da19-4bb5-b5ea-4cb4c09896c8 cbeca395-1970-45f6-9b32-c2471eda4b43; do
  curl -s -H "Authorization: Bearer $KEY" -H "User-Agent: curl/8.5.0" \
    "https://api.vapi.ai/assistant/$aid" | python3 -c '
import json, sys
a = json.load(sys.stdin)
name = a.get("name", "?")
for t in a["model"].get("tools", []):
    if t.get("type") == "transferCall":
        dests = [d.get("number") for d in t.get("destinations", [])]
        print(f"{name}: transferCall -> {dests}")
'
done
