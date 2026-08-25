#!/usr/bin/env bash
# Runs inside LXC 129: show Sarah's persona (first words of system prompt).
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $KEY" https://api.vapi.ai/assistant | python3 -c '
import json, sys
for a in json.load(sys.stdin):
    if a.get("name") == "Sarah":
        msgs = (a.get("model") or {}).get("messages") or []
        prompt = next((m["content"] for m in msgs if m.get("role") == "system"), "")
        print("id:", a["id"])
        print("firstMessage:", a.get("firstMessage", ""))
        print("prompt-start:", prompt[:400].replace("\n", " "))
'
