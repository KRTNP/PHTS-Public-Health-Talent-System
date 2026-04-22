param(
  [string]$BaseDir = "D:\apps\phts",
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$NssmPath = "",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 3000,
  [string]$BackendEnvTemplate = "backend\.env.example",
  [string]$FrontendEnvTemplate = "frontend\.env.production.example",
  [switch]$SkipServiceRegistration
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[bootstrap] $Message"
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Assert-Nssm {
  param(
    [string]$RequestedPath,
    [string]$BaseDir
  )

  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    if (-not (Test-Path $RequestedPath)) {
      throw "nssm.exe not found at: $RequestedPath"
    }
    return
  }

  $baseCandidates = @(
    (Join-Path $BaseDir "tools\nssm\win64\nssm.exe"),
    (Join-Path $BaseDir "tools\nssm\win32\nssm.exe")
  )
  foreach ($candidate in $baseCandidates) {
    if (Test-Path $candidate) {
      return
    }
  }

  if (-not (Get-Command "nssm" -ErrorAction SilentlyContinue)) {
    throw "Required command not found: nssm (or provide -NssmPath)"
  }
}

function Assert-Node20 {
  if (-not (Test-Path $NodePath)) {
    throw "node.exe not found at: $NodePath"
  }

  $versionOutput = & $NodePath -v
  if (-not $?) {
    throw "Unable to read Node.js version from: $NodePath"
  }

  if ($versionOutput -notmatch "^v(\d+)\.") {
    throw "Unexpected Node.js version output: $versionOutput"
  }

  $major = [int]$Matches[1]
  if ($major -lt 20) {
    throw "Node.js 20+ is required. Current: $versionOutput"
  }

  Write-Step "Node.js version OK: $versionOutput"
}

function Ensure-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
  Write-Step "Directory ready: $Path"
}

function Ensure-FileFromTemplate {
  param(
    [string]$TemplatePath,
    [string]$TargetPath
  )

  if (Test-Path $TargetPath) {
    Write-Step "Env file exists, skip: $TargetPath"
    return
  }

  if (-not (Test-Path $TemplatePath)) {
    New-Item -ItemType File -Path $TargetPath | Out-Null
    Write-Step "Created empty env file: $TargetPath"
    return
  }

  Copy-Item $TemplatePath $TargetPath
  Write-Step "Created env file from template: $TargetPath"
}

Write-Step "Checking required commands"
Assert-Command "npm"
Assert-Command "mysqldump"
Assert-Node20
if (-not $SkipServiceRegistration) {
  Assert-Nssm -RequestedPath $NssmPath -BaseDir $BaseDir
}

$releasesDir = Join-Path $BaseDir "releases"
$sharedBackendDir = Join-Path $BaseDir "shared\backend"
$sharedFrontendDir = Join-Path $BaseDir "shared\frontend"
$backendLogsDir = Join-Path $BaseDir "logs\backend"
$frontendLogsDir = Join-Path $BaseDir "logs\frontend"

Write-Step "Preparing production directory layout under $BaseDir"
Ensure-Directory -Path $releasesDir
Ensure-Directory -Path $sharedBackendDir
Ensure-Directory -Path $sharedFrontendDir
Ensure-Directory -Path $backendLogsDir
Ensure-Directory -Path $frontendLogsDir

$sharedBackendEnv = Join-Path $sharedBackendDir ".env"
$sharedFrontendEnv = Join-Path $sharedFrontendDir ".env.local"
Ensure-FileFromTemplate -TemplatePath $BackendEnvTemplate -TargetPath $sharedBackendEnv
Ensure-FileFromTemplate -TemplatePath $FrontendEnvTemplate -TargetPath $sharedFrontendEnv

if (-not $SkipServiceRegistration) {
  Write-Step "Registering/updating NSSM services"
  & "$PSScriptRoot\register-services.ps1" `
    -BaseDir $BaseDir `
    -NodePath $NodePath `
    -NssmPath $NssmPath `
    -BackendService $BackendService `
    -FrontendService $FrontendService `
    -BackendPort $BackendPort `
    -FrontendPort $FrontendPort
} else {
  Write-Step "Skip service registration by request"
}

Write-Step "Bootstrap complete"
Write-Step "Next steps:"
Write-Step "1) Edit $sharedBackendEnv and $sharedFrontendEnv with real production values."
Write-Step "2) Ensure GitHub runner service is online on this host."
Write-Step "3) Run workflow 'Deploy Windows Production' from GitHub Actions."
