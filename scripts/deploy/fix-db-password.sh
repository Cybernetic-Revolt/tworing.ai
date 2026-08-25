#!/usr/bin/env bash
# One-time repair: align the bilco role password with /etc/bilco-platform.env,
# then finish the aborted first deploy (migrate, build, unit, start).
set -euo pipefail

PW=$(sed -n "s|.*bilco:\([^@]*\)@.*|\1|p" /etc/bilco-platform.env)
[ -n "$PW" ] || { echo "no password found in env file"; exit 1; }
su - postgres -c "psql -c \"ALTER ROLE bilco PASSWORD '$PW';\""

cd /opt/bilco-platform
su -s /bin/bash bilco -c "cd /opt/bilco-platform && npx prisma migrate deploy && npm run build"

cat > /etc/systemd/system/bilco-platform.service <<'UNIT'
[Unit]
Description=Bilco Platform (Next.js)
After=network.target postgresql.service

[Service]
User=bilco
WorkingDirectory=/opt/bilco-platform
EnvironmentFile=/etc/bilco-platform.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable bilco-platform >/dev/null 2>&1
systemctl restart bilco-platform
sleep 3
systemctl is-active bilco-platform
curl -fsS -o /dev/null -w "local http %{http_code}\n" http://localhost:3000/
