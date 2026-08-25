#!/usr/bin/env bash
# Runs inside LXC 129: figure out why an inbound SMS reply didn't register.
# 1) Ask VoIP.ms whether it even received the reply (getSMS).
# 2) Hit our callback locally (route works?) and publicly (WAF blocks?).
SECRET=$(grep ^SMS_INBOUND_SECRET= /etc/bilco-platform.env | cut -d= -f2-)
DID=5878852387
FROM=5875006941

echo "== VoIP.ms getSMS (received) for the last 2 days =="
python3 - <<PY
import json, urllib.parse, urllib.request
env=dict(l.strip().split("=",1) for l in open("/etc/bilco-platform.env") if "=" in l and not l.startswith("#"))
q={"api_username":env["VOIPMS_API_USERNAME"],"api_password":env["VOIPMS_API_PASSWORD"],
   "method":"getSMS","from":"2026-06-16","to":"2026-06-18","did":"$DID","limit":"20","type":"1"}
req=urllib.request.Request("https://voip.ms/api/v1/rest.php?"+urllib.parse.urlencode(q),headers={"User-Agent":"curl/8.5.0"})
d=json.loads(urllib.request.urlopen(req).read())
print("status:",d.get("status"))
for s in d.get("sms",[]):
    print(f"  {s.get('date')} type={s.get('type')} from={s.get('contact')} to_did={s.get('did')} msg={s.get('message')!r}")
PY

echo "== local callback (bypasses Cloudflare) — route logic =="
curl -s -o /dev/null -w "  localhost http %{http_code}\n" \
  "http://localhost:3000/api/sms/inbound?secret=${SECRET}&from=${FROM}&to=${DID}&message=DIAGLOCAL&id=diag-local"

echo "== public callback (what VoIP.ms actually hits) =="
curl -s -o /dev/null -w "  public http %{http_code}\n" \
  "https://tworing.ai/api/sms/inbound?secret=${SECRET}&from=${FROM}&to=${DID}&message=DIAGPUBLIC&id=diag-public"

echo "== did either get recorded? =="
su - postgres -c "psql -d bilco_platform -c \"SELECT direction, body, \\\"createdAt\\\"::timestamp(0) FROM \\\"Message\\\" WHERE body IN ('DIAGLOCAL','DIAGPUBLIC') ORDER BY \\\"createdAt\\\";\""
echo "== cleanup diag rows =="
su - postgres -c "psql -d bilco_platform -c \"DELETE FROM \\\"Message\\\" WHERE body IN ('DIAGLOCAL','DIAGPUBLIC');\"" >/dev/null
echo done
