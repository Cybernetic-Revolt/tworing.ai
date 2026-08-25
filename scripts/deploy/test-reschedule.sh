#!/usr/bin/env bash
# Runs inside LXC 129: book, then reschedule, and confirm the original is
# cancelled (no duplicate active appointment). Cleans up.
set -euo pipefail
KEY=$(cat /root/.tworing-key-joes-lawn-snow)
PHONE="+15555550190"
T="resched-test"

slots=$(curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"'$T'"},"toolCallList":[{"id":"t1","function":{"name":"check_availability","arguments":{}}}]}}' \
  | grep -oP '(?<=slotStart: )[0-9TZ:.-]+')
S1=$(echo "$slots" | sed -n 1p)
S2=$(echo "$slots" | sed -n 2p)
echo "slot1=$S1  slot2=$S2"

echo "== book slot1 =="
curl -s -X POST https://tworing.ai/api/vapi/tools -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"'$T'"},"toolCallList":[{"id":"b1","function":{"name":"book_appointment","arguments":{"name":"Rebook Test","phone":"'$PHONE'","slotStart":"'$S1'","jobType":"Mowing"}}}]}}' | head -c 160; echo

echo "== reschedule to slot2 =="
curl -s -X POST https://tworing.ai/api/vapi/tools -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"'$T'"},"toolCallList":[{"id":"r1","function":{"name":"reschedule_appointment","arguments":{"phone":"'$PHONE'","slotStart":"'$S2'"}}}]}}' | head -c 220; echo

echo "== appointments for that caller (expect 1 CONFIRMED + 1 CANCELLED) =="
su - postgres <<PSQL
psql -d bilco_platform -c "SELECT status, \"startsAt\" FROM \"Appointment\" WHERE \"customerPhone\"='$PHONE' ORDER BY \"createdAt\";"
psql -d bilco_platform -c "DELETE FROM \"Appointment\" WHERE \"customerPhone\"='$PHONE';"
PSQL
echo cleaned
