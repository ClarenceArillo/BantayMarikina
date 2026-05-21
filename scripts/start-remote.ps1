param(
  [int]$BackendPort = 3000,
  [int]$BackendWaitSeconds = 25,
  [int]$FrontendWebPort = 8082,
  [int]$FrontendWaitSeconds = 45
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$backendOutLog = Join-Path $projectRoot 'backend-remote.out.log'
$backendErrLog = Join-Path $projectRoot 'backend-remote.err.log'
$backendPidPath = Join-Path $projectRoot 'backend-remote.pid'
$tunnelPidPath = Join-Path $projectRoot 'backend-tunnel.pid'
$frontendWebOutLog = Join-Path $projectRoot 'frontend-web.out.log'
$frontendWebErrLog = Join-Path $projectRoot 'frontend-web.err.log'
$frontendWebPidPath = Join-Path $projectRoot 'frontend-web.pid'
$frontendTunnelOutLog = Join-Path $projectRoot 'frontend-localhostrun.out.log'
$frontendTunnelErrLog = Join-Path $projectRoot 'frontend-localhostrun.err.log'
$frontendTunnelPidPath = Join-Path $projectRoot 'frontend-tunnel.pid'
$frontendTunnelUrlPath = Join-Path $projectRoot 'frontend-tunnel.url'
$startedBackend = $false
$backendProcess = $null
$frontendWebProcess = $null
$frontendTunnelProcess = $null

function Test-BackendReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-FrontendWebReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendWebPort/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-LocalhostRunTunnel {
  param(
    [int]$Port,
    [string]$OutLog,
    [string]$ErrLog,
    [string]$PidPath,
    [string]$UrlPath,
    [string]$Label
  )

  Remove-Item $OutLog, $ErrLog -Force -ErrorAction SilentlyContinue

  $process = Start-Process -FilePath 'ssh.exe' `
    -ArgumentList @(
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=NUL',
      '-R', "80:127.0.0.1:$Port",
      'nokey@localhost.run'
    ) `
    -WorkingDirectory $projectRoot `
    -NoNewWindow `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru

  $url = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    $combinedLog = @()
    if (Test-Path $OutLog) {
      $combinedLog += Get-Content $OutLog
    }
    if (Test-Path $ErrLog) {
      $combinedLog += Get-Content $ErrLog
    }

    $match = $combinedLog | Select-String -Pattern 'https://[a-z0-9]+\.lhr\.life' | Select-Object -First 1
    if ($match) {
      $url = $match.Matches[0].Value
      break
    }

    if ($process.HasExited) {
      throw "$Label tunnel exited before a URL was created. Check $OutLog and $ErrLog."
    }
  }

  if (-not $url) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Timed out waiting for localhost.run to create a $Label tunnel URL."
  }

  Set-Content -Path $PidPath -Value $process.Id
  Set-Content -Path $UrlPath -Value $url

  return @{
    Process = $process
    Url = $url
  }
}

function Start-FrontendWebFallback {
  Remove-Item $frontendWebOutLog, $frontendWebErrLog -Force -ErrorAction SilentlyContinue

  $previousExpoNoDoctor = $env:EXPO_NO_DOCTOR
  $previousExpoOffline = $env:EXPO_OFFLINE
  $env:EXPO_NO_DOCTOR = '1'
  $env:EXPO_OFFLINE = '1'

  try {
    $script:frontendWebProcess = Start-Process -FilePath 'npx.cmd' `
      -ArgumentList @('expo', 'start', '--web', '--host', 'localhost', '--port', "$FrontendWebPort", '--clear') `
      -WorkingDirectory $frontendRoot `
      -RedirectStandardOutput $frontendWebOutLog `
      -RedirectStandardError $frontendWebErrLog `
      -WindowStyle Hidden `
      -PassThru
  } finally {
    $env:EXPO_NO_DOCTOR = $previousExpoNoDoctor
    $env:EXPO_OFFLINE = $previousExpoOffline
  }

  Set-Content -Path $frontendWebPidPath -Value $script:frontendWebProcess.Id
  Write-Host "Started Expo web on http://127.0.0.1:$FrontendWebPort. Process id: $($script:frontendWebProcess.Id)"

  $ready = $false
  for ($attempt = 0; $attempt -lt $FrontendWaitSeconds; $attempt++) {
    Start-Sleep -Seconds 1

    if (Test-FrontendWebReady) {
      $ready = $true
      break
    }

    if ($script:frontendWebProcess.HasExited) {
      throw "Expo web exited before it became ready. Check $frontendWebOutLog and $frontendWebErrLog."
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for Expo web on http://127.0.0.1:$FrontendWebPort. Check $frontendWebOutLog and $frontendWebErrLog."
  }

  $tunnel = Start-LocalhostRunTunnel `
    -Port $FrontendWebPort `
    -OutLog $frontendTunnelOutLog `
    -ErrLog $frontendTunnelErrLog `
    -PidPath $frontendTunnelPidPath `
    -UrlPath $frontendTunnelUrlPath `
    -Label 'Frontend web'

  $script:frontendTunnelProcess = $tunnel.Process

  Write-Host ''
  Write-Host "Frontend web tunnel is ready: $($tunnel.Url)"
  Write-Host 'Share this URL with remote testers if Expo tunnel cannot connect.'
  Write-Host 'Keep this terminal open while remote users are testing. Press Ctrl+C to stop.'
  Wait-Process -Id $script:frontendWebProcess.Id
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
Write-Host 'Starting Expo tunnel. Scan the QR code from this terminal if it appears.'
Write-Host 'Keep this terminal open while remote users are testing.'

Push-Location $frontendRoot
try {
  & npm.cmd run start:tunnel
  $expoExitCode = $LASTEXITCODE

  if ($expoExitCode -eq 130) {
    return
  }

  if ($expoExitCode -ne 0) {
    Write-Host ''
    Write-Host "Expo tunnel exited with code $expoExitCode. Retrying once without clearing Metro cache..."
    & npm.cmd run start:tunnel:warm
    $expoExitCode = $LASTEXITCODE
  }

  if ($expoExitCode -eq 130) {
    return
  }

  if ($expoExitCode -ne 0) {
    Write-Host ''
    Write-Host 'Expo/ngrok tunnel still did not connect. Starting public Expo Web fallback...'
    Start-FrontendWebFallback
  }
} finally {
  Pop-Location

  if (Test-Path $frontendTunnelPidPath) {
    $frontendTunnelPid = Get-Content $frontendTunnelPidPath -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($frontendTunnelPid) {
      Stop-Process -Id ([int]$frontendTunnelPid) -Force -ErrorAction SilentlyContinue
    }
  }

  if ($frontendWebProcess -and -not $frontendWebProcess.HasExited) {
    Stop-Process -Id $frontendWebProcess.Id -Force -ErrorAction SilentlyContinue
  }

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
