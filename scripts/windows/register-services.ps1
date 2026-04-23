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
  param([string]$RequestedPath)

  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    if (-not (Test-Path $RequestedPath)) {
      throw "nssm.exe not found at: $RequestedPath"
    }
    return (Resolve-Path $RequestedPath).Path
  }

  $nssmCmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($nssmCmd) {
    return $nssmCmd.Source
  }

  throw "Unable to resolve nssm executable. Provide -NssmPath or add nssm to PATH."
}

function Invoke-Nssm {
  param(
    [string]$Executable,
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  if (-not $Arguments -or $Arguments.Count -eq 0) {
    throw "NSSM invocation requires at least one argument."
  }

  $quoted = @($Arguments | ForEach-Object {
    $value = [string]$_
    if ($value.Contains('"')) {
      $value = $value.Replace('"', '\"')
    }
    if ($value -match '\s') {
      '"' + $value + '"'
    } else {
      $value
    }
  })
  $argLine = ($quoted -join ' ')

  $proc = Start-Process -FilePath $Executable -ArgumentList $argLine -NoNewWindow -Wait -PassThru
  if (-not $AllowFailure -and $proc.ExitCode -ne 0) {
    throw "NSSM command failed (exit=$($proc.ExitCode)): $Executable $argLine"
  }
  return $proc.ExitCode
}

$resolvedNssmPath = Resolve-NssmPath -RequestedPath $NssmPath
Write-Step "Using NSSM: $resolvedNssmPath"

function Ensure-Service {
  param(
    [string]$NssmExecutable,
    [string]$Name,
    [string]$AppPath,
    [string]$AppArgs,
    [string]$AppDir,
    [string]$StdOut,
    [string]$StdErr
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $service) {
    Write-Step "Installing service: $Name"
    Invoke-Nssm -Executable $NssmExecutable -Arguments @("install", $Name, $AppPath, $AppArgs) | Out-Null
  } else {
    Write-Step "Updating service: $Name"
  }

  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppDirectory", $AppDir) | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppExit", "Default", "Restart") | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "Start", "SERVICE_AUTO_START") | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppStdout", $StdOut) | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppStderr", $StdErr) | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppRotateFiles", "1") | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppRotateOnline", "1") | Out-Null
  Invoke-Nssm -Executable $NssmExecutable -Arguments @("set", $Name, "AppRotateBytes", "10485760") | Out-Null
}

$currentBackendDir = Join-Path $BaseDir "current\backend"
$currentFrontendDir = Join-Path $BaseDir "current\frontend"
$backendLogDir = Join-Path $BaseDir "logs\backend"
$frontendLogDir = Join-Path $BaseDir "logs\frontend"

New-Item -ItemType Directory -Force -Path $backendLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $frontendLogDir | Out-Null

Ensure-Service `
  -NssmExecutable $resolvedNssmPath `
  -Name $BackendService `
  -AppPath $NodePath `
  -AppArgs "dist/index.js" `
  -AppDir $currentBackendDir `
  -StdOut (Join-Path $backendLogDir "stdout.log") `
  -StdErr (Join-Path $backendLogDir "stderr.log")

Ensure-Service `
  -NssmExecutable $resolvedNssmPath `
  -Name $FrontendService `
  -AppPath $NodePath `
  -AppArgs "node_modules\next\dist\bin\next start -p $FrontendPort" `
  -AppDir $currentFrontendDir `
  -StdOut (Join-Path $frontendLogDir "stdout.log") `
  -StdErr (Join-Path $frontendLogDir "stderr.log")

Write-Step "Starting services"
Invoke-Nssm -Executable $resolvedNssmPath -Arguments @("start", $BackendService) | Out-Null
Invoke-Nssm -Executable $resolvedNssmPath -Arguments @("start", $FrontendService) | Out-Null

Write-Step "Services configured. Backend expected on 127.0.0.1:$BackendPort, Frontend on 127.0.0.1:$FrontendPort"
