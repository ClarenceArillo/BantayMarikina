$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adb)) {
  Write-Error "ADB was not found at $adb. Install Android platform tools or add adb.exe to PATH."
  exit 1
}

& $adb devices
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $adb reverse tcp:8081 tcp:8081
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $adb reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host 'Android USB reverse is ready for Metro on 8081 and backend API on 3000.'
