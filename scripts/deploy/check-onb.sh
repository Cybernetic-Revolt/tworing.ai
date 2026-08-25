#!/usr/bin/env bash
# Robust content checks on the captured onboarding page (no set -e abort).
for s in "Onboarding" "complete" "Business hours set" "Owner login created" "First test call received" "Stripe checkout"; do
  if grep -qF "$s" /tmp/onb.html; then echo "PASS: $s"; else echo "FAIL: $s"; fi
done
# Done-count (strip React comment markers first).
sed 's/<!--[^>]*-->//g' /tmp/onb.html | grep -oE "[0-9]/8 complete" | head -1
