#!/usr/bin/env bash
# Runs inside LXC 129: add the workstation's public key to root authorized_keys
# so MobaXterm logs in passwordless. Idempotent. Expects /tmp/ws.pub present.
set -euo pipefail
mkdir -p /root/.ssh && chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
if grep -qxF "$(cat /tmp/ws.pub)" /root/.ssh/authorized_keys; then
  echo "key already present"
else
  cat /tmp/ws.pub >> /root/.ssh/authorized_keys
  echo "key added"
fi
echo "authorized_keys now has $(wc -l < /root/.ssh/authorized_keys) key(s)"
systemctl is-active ssh sshd 2>/dev/null | head -1 || true
