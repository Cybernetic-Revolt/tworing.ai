#!/usr/bin/env bash
# Runs inside LXC 129: add Google-sync env vars. Generates the token
# encryption key once; client id/secret stay empty until the founder
# creates the Google OAuth app.
set -euo pipefail
ENV=/etc/bilco-platform.env
grep -q '^TOKEN_ENCRYPTION_KEY=' $ENV || echo "TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> $ENV
grep -q '^GOOGLE_CLIENT_ID=' $ENV || echo "GOOGLE_CLIENT_ID=" >> $ENV
grep -q '^GOOGLE_CLIENT_SECRET=' $ENV || echo "GOOGLE_CLIENT_SECRET=" >> $ENV
grep -c '=' $ENV
systemctl restart bilco-platform
sleep 2
systemctl is-active bilco-platform
