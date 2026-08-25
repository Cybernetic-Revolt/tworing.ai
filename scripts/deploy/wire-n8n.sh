#!/usr/bin/env bash
# Runs on the Proxmox host: moves the ingest key 129 -> 127, applies the n8n
# workflow update, fixes the org display name.
set -euo pipefail

pct pull 129 /root/.bilco-ingest-key /tmp/.bk
pct push 127 /tmp/.bk /tmp/.bk
pct push 127 /tmp/n8n-forward.py /tmp/n8n-forward.py
rm -f /tmp/.bk
pct exec 127 -- python3 /tmp/n8n-forward.py
pct exec 127 -- rm -f /tmp/.bk /tmp/n8n-forward.py

cat > /tmp/fixname.sh <<'SH'
su - postgres <<'PSQL'
psql -d bilco_platform -c 'UPDATE "Org" SET name = $$Bilco Works$$ WHERE slug = $$bilco$$;'
PSQL
SH
pct push 129 /tmp/fixname.sh /tmp/fixname.sh
pct exec 129 -- bash /tmp/fixname.sh
rm -f /tmp/fixname.sh /tmp/n8n-forward.py
