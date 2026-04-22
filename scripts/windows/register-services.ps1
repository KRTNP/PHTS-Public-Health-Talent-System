param(
  [string]$BaseDir = "D:\apps\phts",
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$NssmPath = "",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[services] $Message"
}

function Resolve-NssmPath {
  param(
    [string]$RequestedPath,
    [string]$BaseDir
  )

  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    $candidates += $RequestedPath
  }
  $candidates += (Join-Path $BaseDir "tools\nssm\win64\nssm.exe")
  $candidates += (Join-Path $BaseDir "tools\nssm\win32\nssm.exe")

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
      return (Resolve-Path $candidate).Path
    }
  }

  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  throw "Unable to resolve nssm executable. Provide -NssmPath, keep nssm in PATH, or place it under $BaseDir\\tools\\nssm."
}

function Ensure-Service {
  param(
    [string]$NssmExe,
    [string]$Name,
    [string]$AppPath,
    [string]$AppArgs,
    [string]$AppDir,
    [string]$StdOut,
    [string]$StdErr
  )

  sc.exe query $Name | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Step "Installing service: $Name"
    & $NssmExe install $Name $AppPath $AppArgs | Out-Null
  } else {
    Write-Step "Updating service: $Name"
  }

  & $NssmExe set $Name AppDirectory $AppDir | Out-Null
  & $NssmExe set $Name AppExit Default Restart | Out-Null
  & $NssmExe set $Name Start SERVICE_AUTO_START | Out-Null
  & $NssmExe set $Name AppStdout $StdOut | Out-Null
  & $NssmExe set $Name AppStderr $StdErr | Out-Null
  & $NssmExe set $Name AppRotateFiles 1 | Out-Null
  & $NssmExe set $Name AppRotateOnline 1 | Out-Null
  & $NssmExe set $Name AppRotateBytes 10485760 | Out-Null
}

$resolvedNssmPath = Resolve-NssmPath -RequestedPath $NssmPath -BaseDir $BaseDir
Write-Step "Using nssm: $resolvedNssmPath"

$currentBackendDir = Join-Path $BaseDir "current\backend"
$currentFrontendDir = Join-Path $BaseDir "current\frontend"
$backendLogDir = Join-Path $BaseDir "logs\backend"
$frontendLogDir = Join-Path $BaseDir "logs\frontend"

New-Item -ItemType Directory -Force -Path $backendLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $frontendLogDir | Out-Null

Ensure-Service `
  -NssmExe $resolvedNssmPath `
  -Name $BackendService `
  -AppPath $NodePath `
  -AppArgs "dist/index.js" `
  -AppDir $currentBackendDir `
  -StdOut (Join-Path $backendLogDir "stdout.log") `
  -StdErr (Join-Path $backendLogDir "stderr.log")

Ensure-Service `
  -NssmExe $resolvedNssmPath `
  -Name $FrontendService `
  -AppPath $NodePath `
  -AppArgs "node_modules\next\dist\bin\next start -p $FrontendPort" `
  -AppDir $currentFrontendDir `
  -StdOut (Join-Path $frontendLogDir "stdout.log") `
  -StdErr (Join-Path $frontendLogDir "stderr.log")

Write-Step "Starting services"
& $resolvedNssmPath start $BackendService | Out-Null
& $resolvedNssmPath start $FrontendService | Out-Null

Write-Step "Services configured. Backend expected on 127.0.0.1:$BackendPort, Frontend on 127.0.0.1:$FrontendPort"
