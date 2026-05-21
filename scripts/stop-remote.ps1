$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendPidPath = Join-Path $projectRoot 'backend-remote.pid'
$tunnelPidPath = Join-Path $projectRoot 'backend-tunnel.pid'
$frontendWebPidPath = Join-Path $projectRoot 'frontend-web.pid'
$frontendTunnelPidPath = Join-Path $projectRoot 'frontend-tunnel.pid'

if (Test-Path $tunnelPidPath) {
  $tunnelPid = Get-Content $tunnelPidPath | Select-Object -First 1
  if ($tunnelPid) {
    Stop-Process -Id ([int]$tunnelPid) -Force
  }
}

Get-CimInstance Win32_Process -Filter "name = 'ssh.exe'" |
  Where-Object { $_.CommandLine -match 'localhost\.run' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

if (Test-Path $backendPidPath) {
  $backendPid = Get-Content $backendPidPath | Select-Object -First 1
  if ($backendPid) {
    Stop-Process -Id ([int]$backendPid) -Force
  }
}

if (Test-Path $frontendWebPidPath) {
  $frontendWebPid = Get-Content $frontendWebPidPath | Select-Object -First 1
  if ($frontendWebPid) {
    Stop-Process -Id ([int]$frontendWebPid) -Force
  }
}

Remove-Item `
  (Join-Path $projectRoot 'backend-remote.pid'), `
  (Join-Path $projectRoot 'backend-tunnel.pid'), `
  (Join-Path $projectRoot 'backend-tunnel.url'), `
  (Join-Path $projectRoot 'frontend-web.pid'), `
  (Join-Path $projectRoot 'frontend-tunnel.pid'), `
  (Join-Path $projectRoot 'frontend-tunnel.url') `
  -Force

Write-Host 'Stopped remote backend/frontend tunnel processes that were started by this project.'
