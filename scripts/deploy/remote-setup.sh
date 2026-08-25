#!/usr/bin/env bash
# Runs inside LXC 129 as root. Idempotent: safe for first deploy and redeploys.
set -euo pipefail

APP_DIR=/opt/bilco-platform
ENV_FILE=/etc/bilco-platform.env
TARBALL=${1:-/tmp/platform.tar}

id -u bilco &>/dev/null || useradd --system --create-home \
  --home-dir /var/lib/bilco --shell /usr/sbin/nologin bilco

# stale-file hygiene: source trees are replaced wholesale, build output kept
rm -rf "$APP_DIR/src" "$APP_DIR/prisma" "$APP_DIR/scripts" "$APP_DIR/public"
mkdir -p "$APP_DIR"
tar -xf "$TARBALL" -C "$APP_DIR"
ln -sf "$ENV_FILE" "$APP_DIR/.env"

if ! grep -q PLATFORM_URL "$ENV_FILE"; then
  cat >> "$ENV_FILE" <<EOF
PLATFORM_URL=https://platform.bilco.ca
VAPI_API_KEY=
VOIPMS_API_USERNAME=
VOIPMS_API_PASSWORD=
EOF
fi
grep -q SESSION_SECRET "$ENV_FILE" || \
  echo "SESSION_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
chown bilco:bilco "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown -R bilco:bilco "$APP_DIR"

run_as_bilco() { su -s /bin/bash bilco -c "cd $APP_DIR && $1"; }
run_as_bilco "npm ci"
run_as_bilco "npx prisma migrate deploy"
run_as_bilco "npm run build"

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
