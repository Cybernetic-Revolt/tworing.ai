#!/usr/bin/env bash
# Runs inside LXC 129: book an appt, then prove find_appointments locates it via
# the caller's inbound number (no phone arg), and reschedule works the same way.
set -euo pipefail
KEY=$(cat /root/.tworing-key-joes-lawn-snow)
CID="+15555550191"   # number the "caller" is dialing from
T="find-test"
post(){ curl -s -X POST https://tworing.ai/api/vapi/tools -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" -d "$1"; }

slots=$(post '{"message":{"call":{"id":"'$T'","customer":{"number":"'$CID'"}},"toolCallList":[{"id":"a","function":{"name":"check_availability","arguments":{}}}]}}' | grep -oP '(?<=slotStart: )[0-9TZ:.-]+')
S1=$(echo "$slots" | sed -n 1p); S2=$(echo "$slots" | sed -n 2p)
echo "slot1=$S1 slot2=$S2"

echo "== book slot1 (phone = caller id) =="
post '{"message":{"call":{"id":"'$T'","customer":{"number":"'$CID'"}},"toolCallList":[{"id":"b","function":{"name":"book_appointment","arguments":{"name":"Find Test","phone":"'$CID'","slotStart":"'$S1'","jobType":"Mowing"}}}]}}' | head -c 140; echo

echo "== find_appointments with NO phone arg (should use caller id) =="
post '{"message":{"call":{"id":"'$T'","customer":{"number":"'$CID'"}},"toolCallList":[{"id":"f","function":{"name":"find_appointments","arguments":{}}}]}}' | head -c 260; echo

echo "== reschedule with NO phone arg (should find + move) =="
post '{"message":{"call":{"id":"'$T'","customer":{"number":"'$CID'"}},"toolCallList":[{"id":"r","function":{"name":"reschedule_appointment","arguments":{"slotStart":"'$S2'"}}}]}}' | head -c 220; echo

echo "== db (expect 1 CANCELLED + 1 CONFIRMED) =="
su - postgres <<PSQL
psql -d bilco_platform -c "SELECT status, \"startsAt\" FROM \"Appointment\" WHERE \"customerPhone\"='$CID' ORDER BY \"createdAt\";"
psql -d bilco_platform -c "DELETE FROM \"Appointment\" WHERE \"customerPhone\"='$CID';"
PSQL
echo cleaned
