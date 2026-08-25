#!/usr/bin/env bash
# Point this clone's git hooks at the versioned .githooks/ directory.
#
# Git does not clone hooks, so every machine and every fresh Claude Code session
# has to run this once:
#
#     scripts/install-hooks.sh

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "hooks enabled: core.hooksPath -> .githooks"

if command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks:      $(command -v gitleaks) ($(gitleaks version 2>/dev/null || echo 'version unknown'))"
else
  cat >&2 <<'EOF'
gitleaks:      NOT FOUND

The pre-commit hook needs it and will fail commits until it is installed:

  # Linux/macOS, via release binary
  #   https://github.com/gitleaks/gitleaks/releases
  # or build from source (needs Go):
  #   git clone --branch v8.30.1 https://github.com/gitleaks/gitleaks
  #   cd gitleaks && go build -o ~/.local/bin/gitleaks ./

EOF
  exit 1
fi

echo
echo "verifying against the current working tree..."
gitleaks dir --redact --no-banner --config .gitleaks.toml . \
  && echo "clean." \
  || { echo "findings above (redacted) — review before committing." >&2; exit 1; }
