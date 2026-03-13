param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseId,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,

  [string]$BaseDir = "D:\apps\phts",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [string]$HealthUrl = "http://127.0.0.1:4000/health",
  [int]$RetainReleases = 5
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[deploy] $Message"
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function New-Junction {
  param(
    [string]$LinkPath,
    [string]$TargetPath
  )

  if (Test-Path $LinkPath) {
    cmd /c rmdir "$LinkPath" | Out-Null
  }
  cmd /c mklink /J "$LinkPath" "$TargetPath" | Out-Null
}

function Restart-ServiceSafe {
  param([string]$Name)
  Write-Step "Restarting service: $Name"
  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $service) {
    throw "Service not found: $Name"
  }
  Restart-Service -Name $Name -Force -ErrorAction Stop
}

function Invoke-Smoke {
  param(
    [string]$Url,
    [int]$MaxAttempts = 12,
    [int]$SleepSeconds = 5
  )
  Write-Step "Running smoke check: $Url"

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
      if ($res.StatusCode -eq 200) {
        Write-Step "Smoke check passed on attempt $attempt/$MaxAttempts"
        return
      }
      Write-Step "Smoke check returned status=$($res.StatusCode) (attempt $attempt/$MaxAttempts)"
    } catch {
      Write-Step "Smoke check not ready yet (attempt $attempt/$MaxAttempts): $($_.Exception.Message)"
    }

    if ($attempt -lt $MaxAttempts) {
      Start-Sleep -Seconds $SleepSeconds
    }
  }

  throw "Smoke check failed for $Url after $MaxAttempts attempts"
}

function Write-ServiceDiagnostics {
  param(
    [string]$BaseDir,
    [string[]]$ServiceNames
  )
  Write-Step "Collecting service diagnostics"
  foreach ($name in $ServiceNames) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($svc) {
      Write-Host "[deploy] Service '$name' status: $($svc.Status)"
    } else {
      Write-Host "[deploy] Service '$name' not found"
    }
  }

  $backendErr = Join-Path $BaseDir "logs\backend\stderr.log"
  $backendOut = Join-Path $BaseDir "logs\backend\stdout.log"
  $frontendErr = Join-Path $BaseDir "logs\frontend\stderr.log"

  if (Test-Path $backendErr) {
    Write-Host "[deploy] backend stderr tail:"
    Get-Content $backendErr -Tail 60
  }
  if (Test-Path $backendOut) {
    Write-Host "[deploy] backend stdout tail:"
    Get-Content $backendOut -Tail 60
  }
  if (Test-Path $frontendErr) {
    Write-Host "[deploy] frontend stderr tail:"
    Get-Content $frontendErr -Tail 40
  }
}

Assert-Command "node"
Assert-Command "npm"

$releasesDir = Join-Path $BaseDir "releases"
$sharedDir = Join-Path $BaseDir "shared"
$currentDir = Join-Path $BaseDir "current"
$releaseDir = Join-Path $releasesDir $ReleaseId
$backendDir = Join-Path $releaseDir "backend"
$frontendDir = Join-Path $releaseDir "frontend"
$sharedBackendEnv = Join-Path $sharedDir "backend\.env"
$sharedFrontendEnv = Join-Path $sharedDir "frontend\.env.local"

Write-Step "Preparing directories"
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sharedDir "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sharedDir "frontend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BaseDir "logs\backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BaseDir "logs\frontend") | Out-Null

if (-not (Test-Path $ArtifactPath)) {
  throw "Artifact not found: $ArtifactPath"
}

if (Test-Path $releaseDir) {
  throw "Release already exists: $releaseDir"
}

Write-Step "Extracting artifact into $releaseDir"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Expand-Archive -Path $ArtifactPath -DestinationPath $releaseDir -Force

if (-not (Test-Path $backendDir)) {
  throw "backend folder missing in artifact: $backendDir"
}
if (-not (Test-Path $frontendDir)) {
  throw "frontend folder missing in artifact: $frontendDir"
}

if (Test-Path $sharedBackendEnv) {
  Copy-Item $sharedBackendEnv (Join-Path $backendDir ".env") -Force
}
if (Test-Path $sharedFrontendEnv) {
  Copy-Item $sharedFrontendEnv (Join-Path $frontendDir ".env.local") -Force
}

Write-Step "Installing production dependencies"
Push-Location $backendDir
npm ci --omit=dev
Pop-Location

Push-Location $frontendDir
npm ci --omit=dev
Pop-Location

Write-Step "Switching current release to $ReleaseId"
New-Junction -LinkPath $currentDir -TargetPath $releaseDir

Restart-ServiceSafe -Name $BackendService
Restart-ServiceSafe -Name $FrontendService

try {
  Start-Sleep -Seconds 3
  Invoke-Smoke -Url $HealthUrl -MaxAttempts 12 -SleepSeconds 5
} catch {
  Write-ServiceDiagnostics -BaseDir $BaseDir -ServiceNames @($BackendService, $FrontendService)
  throw
}

Write-Step "Pruning old releases (retain=$RetainReleases)"
$allReleases = Get-ChildItem -Path $releasesDir -Directory | Sort-Object LastWriteTime -Descending
if ($allReleases.Count -gt $RetainReleases) {
  $toDelete = $allReleases | Select-Object -Skip $RetainReleases
  foreach ($item in $toDelete) {
    if ($item.FullName -ne $releaseDir) {
      Remove-Item -Path $item.FullName -Recurse -Force
    }
  }
}

Write-Step "Deployment completed successfully for release $ReleaseId"
