param(
  [int]$BackendPort = 3000,
  [int]$BackendWaitSeconds = 25
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$backendOutLog = Join-Path $projectRoot 'backend-remote.out.log'
$backendErrLog = Join-Path $projectRoot 'backend-remote.err.log'
$backendPidPath = Join-Path $projectRoot 'backend-remote.pid'
$tunnelPidPath = Join-Path $projectRoot 'backend-tunnel.pid'
$startedBackend = $false
$backendProcess = $null

function Test-BackendReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-BackendReady)) {
  Remove-Item $backendOutLog, $backendErrLog -Force -ErrorAction SilentlyContinue

  $backendProcess = Start-Process -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'start') `
    -WorkingDirectory $backendRoot `
    -RedirectStandardOutput $backendOutLog `
    -RedirectStandardError $backendErrLog `
    -WindowStyle Hidden `
    -PassThru

  Write-Host "Started backend on port $BackendPort. Process id: $($backendProcess.Id)"
  Set-Content -Path $backendPidPath -Value $backendProcess.Id
  $startedBackend = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt $BackendWaitSeconds; $attempt++) {
    Start-Sleep -Seconds 1

    if (Test-BackendReady) {
      $ready = $true
      break
    }

    if ($backendProcess.HasExited) {
      throw "Backend exited before it became ready. Check $backendOutLog and $backendErrLog."
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for backend on http://127.0.0.1:$BackendPort. Check $backendOutLog and $backendErrLog."
  }
} else {
  Write-Host "Backend is already running on http://127.0.0.1:$BackendPort."
}

Push-Location $backendRoot
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-tunnel.ps1 -NoWait
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Starting Expo tunnel. Scan the QR code from this terminal.'
Write-Host 'Keep this terminal open while remote users are testing.'

Push-Location $frontendRoot
try {
  & npm.cmd run start:tunnel
} finally {
  Pop-Location

  if (Test-Path $tunnelPidPath) {
    $tunnelPid = Get-Content $tunnelPidPath -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($tunnelPid) {
      Stop-Process -Id ([int]$tunnelPid) -Force -ErrorAction SilentlyContinue
    }
  }

  if ($startedBackend -and $backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
