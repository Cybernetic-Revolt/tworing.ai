# Deploy committed HEAD to the platform LXC via the Proxmox host.
param(
  [string]$Vmid = "129",
  [string]$ProxmoxHost = "root@10.10.1.230"
)
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Set-Location $root
git archive -o "$env:TEMP\platform.tar" HEAD
scp -q "$env:TEMP\platform.tar" "$($ProxmoxHost):/tmp/platform.tar"
scp -q "$root\scripts\deploy\remote-setup.sh" "$($ProxmoxHost):/tmp/remote-setup.sh"
ssh $ProxmoxHost "sed -i 's/\r$//' /tmp/remote-setup.sh && pct push $Vmid /tmp/platform.tar /tmp/platform.tar && pct push $Vmid /tmp/remote-setup.sh /tmp/remote-setup.sh && pct exec $Vmid -- bash /tmp/remote-setup.sh"
