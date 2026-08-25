#!/usr/bin/env bash
# Runs inside LXC 129: confirm Kelly's tools resolve to joes-lawn-snow.
set -euo pipefail
KEY=$(cat /root/.tworing-key-joes-lawn-snow)
curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"kelly-test-1"},"toolCallList":[{"id":"t1","function":{"name":"check_availability","arguments":{}}}]}}' \
  | head -c 300
echo
