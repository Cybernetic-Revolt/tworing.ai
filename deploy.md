# Deploying tworing.ai

Runs on a single **EC2 instance in `ca-west-1`**, behind the Cloudflare that already fronts
the domain. Cloudflare terminates public TLS; the instance is reached over a **Cloudflare
Tunnel**, so its security group needs **no inbound rules at all**.

Amplify Hosting and App Runner are *not available in `ca-west-1`* — that is why this is a
plain instance rather than a managed deploy. See `tworing/aws-migration.md` in the context
repo for the region table.

## Deploy

Same shape as bilcoworks-site — pull, build, restart:

```bash
sudo -u tworing -i
cd /opt/tworing
git pull
npm ci                         # runs `prisma generate` via postinstall — no separate step
npx prisma migrate deploy      # only when migrations changed
npm run build
exit
sudo systemctl restart tworing
```

`systemctl status tworing` and `journalctl -u tworing -f` to watch it come up.

## The unit

`/etc/systemd/system/tworing.service`:

```ini
[Unit]
Description=tworing.ai platform
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tworing
WorkingDirectory=/opt/tworing
EnvironmentFile=/etc/tworing/env      # 0600, root:tworing — NOT in the repo
ExecStart=/usr/bin/npm run start        # next start
Restart=always
RestartSec=5

# The app needs none of these.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/tworing/.next

[Install]
WantedBy=multi-user.target
```

## Environment

Variables live in `/etc/tworing/env`, mode 0600, owned `root:tworing`. **Never in the repo** —
see `.env.example` for the names. `DATABASE_URL` points at RDS; the instance reaches S3 through
an **IAM instance role**, not an access key, so no AWS credentials belong in that file.

## Cutover and rollback

Pointing the domain at AWS is a **Cloudflare origin change** — one record. Rolling back is
moving it back. CT 129 keeps running untouched for a week after cutover so that stays possible.
