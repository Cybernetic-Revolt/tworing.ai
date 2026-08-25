#!/usr/bin/env bash
# Runs inside LXC 129: dump persona (firstMessage + prompt start) for the
# assistant ids passed as args.
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)
for aid in "$@"; do
  curl -s -H "Authorization: Bearer $KEY" -H "User-Agent: curl/8.5.0" \
    "https://api.vapi.ai/assistant/$aid" | python3 -c '
import json, sys
a = json.load(sys.stdin)
msgs = (a.get("model") or {}).get("messages") or []
prompt = next((m["content"] for m in msgs if m.get("role") == "system"), "")
tools = [t.get("type") + ("/" + (t.get("function") or {}).get("name","") if t.get("type")=="function" else "") for t in (a.get("model") or {}).get("tools", [])]
print("=== " + (a.get("name") or "?") + " ===")
print("firstMessage:", (a.get("firstMessage") or "")[:160])
print("tools:", tools)
print("prompt-start:", prompt[:500].replace("\n", " "))
print()
'
done
