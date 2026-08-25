# Runs inside LXC 127: replay real Vapi end-of-call payloads from
# vapi-data.db through the platform ingest endpoint (idempotent upserts).
import json
import sqlite3
import urllib.request

KEY = open("/tmp/.bk").read().strip()
# LAN-direct: Cloudflare's WAF 403s the large transcript payloads
URL = "http://10.10.1.129:3000/api/ingest/vapi"

con = sqlite3.connect("file:/var/lib/n8n/vapi-data.db?mode=ro", uri=True)
rows = con.execute(
    "SELECT call_id, raw_json FROM calls "
    "WHERE call_id GLOB '019e*' AND raw_json IS NOT NULL "
    "ORDER BY started_at"
).fetchall()
con.close()

ok = fail = 0
for cid, raw in rows:
    try:
        msg = json.loads(raw)
        req = urllib.request.Request(
            URL,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-bilco-ingest-key": KEY,
            },
            data=json.dumps({"message": msg}).encode(),
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            json.loads(resp.read())
        ok += 1
    except Exception as e:  # noqa: BLE001 - report and continue
        fail += 1
        print(f"{cid}: {e}")

print(f"replayed {ok} calls, {fail} failures")
