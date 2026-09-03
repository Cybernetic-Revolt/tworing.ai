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
cd /opt/tworing/app
sudo -u tworing git pull

# `prisma generate` runs as an npm postinstall, and Prisma 7 refuses to load its config
# without DATABASE_URL — even though generate never connects. The real credential lives in
# /etc/tworing/env, which is 0600 root:tworing and NOT readable by the tworing user, so a
# placeholder is what resolves the config here. The same applies to `npm run build`.
sudo -u tworing DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder \
  npm ci --no-audit --no-fund

# Only this step really talks to the database, so it is the only one that needs the real
# URL. Sourced in-process as root; never put it on a command line, where `ps` and the SSM
# command history would both capture it.
set -a; . /etc/tworing/env; set +a; npx prisma migrate deploy      # only when migrations changed

sudo -u tworing DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder \
  npm run build

sudo systemctl restart tworing
```

**Run these as separate commands and check each exit code.** Chaining them with `&&` into
one `sudo` and piping the lot through `tail` once hid a failed migration: the build never
ran, the restart went ahead into a missing `.next`, and the service crash-looped for about
fifteen minutes. `npm run build` succeeding is the precondition for the restart, so it has
to be observed, not assumed.

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
