#!/usr/bin/env bash
# Runs inside LXC 129: exercise the Vapi tools endpoint LAN-direct and via
# the public URL (Cloudflare WAF check).
set -euo pipefail
KEY=$(cat /root/.bilco-ingest-key)

echo "== check_availability (LAN) =="
curl -s -X POST http://localhost:3000/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-tools-001"},"toolCallList":[{"id":"tc1","function":{"name":"check_availability","arguments":{}}}]}}'
echo; echo
echo "== check_availability (public, via Cloudflare) =="
curl -s -o /tmp/tools-public.json -w "HTTP %{http_code}\n" -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-tools-001"},"toolCallList":[{"id":"tc1","function":{"name":"check_availability","arguments":{}}}]}}'
head -c 400 /tmp/tools-public.json
echo
