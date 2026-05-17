$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$frontendEnvPath = Join-Path $projectRoot 'frontend\.env'
$outLog = Join-Path $projectRoot 'backend-localhostrun.out.log'
$errLog = Join-Path $projectRoot 'backend-localhostrun.err.log'

Get-CimInstance Win32_Process -Filter "name = 'ssh.exe'" |
  Where-Object { $_.CommandLine -match 'localhost\.run' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue

$process = Start-Process -FilePath 'ssh.exe' `
  -ArgumentList @(
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=NUL',
    '-R', '80:127.0.0.1:3000',
    'nokey@localhost.run'
  ) `
  -WorkingDirectory $projectRoot `
  -NoNewWindow `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

$url = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  $combinedLog = @()
  if (Test-Path $outLog) {
    $combinedLog += Get-Content $outLog
  }
  if (Test-Path $errLog) {
    $combinedLog += Get-Content $errLog
  }

  $match = $combinedLog | Select-String -Pattern 'https://[a-z0-9]+\.lhr\.life' | Select-Object -First 1
  if ($match) {
    $url = $match.Matches[0].Value
    break
  }

  if ($process.HasExited) {
    throw "Backend tunnel exited before a URL was created. Check $outLog and $errLog."
  }
}

if (-not $url) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw 'Timed out waiting for localhost.run to create a backend tunnel URL.'
}

$envLines = if (Test-Path $frontendEnvPath) { Get-Content $frontendEnvPath } else { @() }
$apiLine = "EXPO_PUBLIC_API_URL=$url/api"
$hasApiLine = $false
$nextLines = foreach ($line in $envLines) {
  if ($line -match '^EXPO_PUBLIC_API_URL=') {
    $hasApiLine = $true
    $apiLine
  } else {
    $line
  }
}

if (-not $hasApiLine) {
  $nextLines += $apiLine
}

Set-Content -Path $frontendEnvPath -Value $nextLines

Write-Host "Backend tunnel is ready: $url"
Write-Host "Updated frontend/.env to EXPO_PUBLIC_API_URL=$url/api"
Write-Host 'Keep this terminal open while testing. Press Ctrl+C to stop the tunnel.'

Wait-Process -Id $process.Id
