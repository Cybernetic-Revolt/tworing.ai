#!/usr/bin/env bash
set -euo pipefail
RAW=$(cat /root/.tworing-key-joes-lawn-snow)
echo "key head: ${RAW:0:8}  len: ${#RAW}"
COMPUTED=$(printf %s "$RAW" | sha256sum | cut -d' ' -f1)
echo "computed hash: $COMPUTED"
su - postgres <<'PSQL'
psql -Atq -d bilco_platform -c "SELECT k.\"keyHash\", o.slug FROM \"IngestKey\" k JOIN \"Org\" o ON o.id=k.\"orgId\" WHERE o.slug='joes-lawn-snow';"
PSQL
