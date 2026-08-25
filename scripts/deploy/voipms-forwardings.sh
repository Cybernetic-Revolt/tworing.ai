#!/usr/bin/env bash
# Runs inside LXC 129: list all VoIP.ms forwarding entries.
set -euo pipefail
U=$(grep ^VOIPMS_API_USERNAME= /etc/bilco-platform.env | cut -d= -f2)
P=$(grep ^VOIPMS_API_PASSWORD= /etc/bilco-platform.env | cut -d= -f2)
curl -s "https://voip.ms/api/v1/rest.php?api_username=$U&api_password=$P&method=getForwardings" | python3 -m json.tool
