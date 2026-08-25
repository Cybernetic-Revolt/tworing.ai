#!/usr/bin/env bash
# Runs on the nginx VM (10.10.1.10): wire tworing.ai through the
# Cloudflare tunnel to the platform LXC. Idempotent.
set -euo pipefail

TUNNEL_ID="1c8de40d-340c-4038-9b82-942795670df4"

# 1. nginx vhost — TLS terminates at the Cloudflare edge; the tunnel
#    delivers to localhost:80, so no ssl listener here.
cat > /etc/nginx/sites-available/tworing.ai <<'EOF'
server {
    listen 80;
    listen [::]:80;

    server_name tworing.ai www.tworing.ai;

    client_max_body_size 20m;

    location / {
        proxy_pass http://10.10.1.129:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_redirect off;
    }
}
EOF
ln -sf /etc/nginx/sites-available/tworing.ai /etc/nginx/sites-enabled/tworing.ai
nginx -t
systemctl reload nginx
echo "nginx: tworing.ai vhost enabled"

# 2. cloudflared ingress entries ahead of the default-404 rule
python3 - <<'PY'
p = "/etc/cloudflared/config.yml"
s = open(p).read()
if "tworing.ai" in s:
    print("cloudflared: ingress already has tworing.ai")
else:
    block = (
        '  - hostname: "tworing.ai"\n    service: http://127.0.0.1:80\n'
        '  - hostname: "www.tworing.ai"\n    service: http://127.0.0.1:80\n\n'
    )
    marker = "  # Default 404\n"
    assert marker in s, "default-404 marker not found in config.yml"
    open(p, "w").write(s.replace(marker, block + marker, 1))
    print("cloudflared: ingress updated")
PY
cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate
systemctl restart cloudflared
sleep 3
systemctl is-active cloudflared

# 3. DNS: CNAME both hostnames to the tunnel (requires the tworing.ai
#    zone to exist in the same Cloudflare account)
cloudflared tunnel route dns "$TUNNEL_ID" tworing.ai || echo "ROUTE-DNS-FAILED tworing.ai"
cloudflared tunnel route dns "$TUNNEL_ID" www.tworing.ai || echo "ROUTE-DNS-FAILED www.tworing.ai"
