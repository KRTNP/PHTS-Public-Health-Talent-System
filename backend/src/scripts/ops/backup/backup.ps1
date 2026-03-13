$ErrorActionPreference = "Stop"

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { ".\\backups" }
$BackupRetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 30 }

$DbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "127.0.0.1" }
$DbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$DbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "phts_system" }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$backupFile = Join-Path $BackupDir "${DbName}_${timestamp}.sql.gz"
$tempSqlFile = Join-Path $BackupDir "${DbName}_${timestamp}.sql"
$env:MYSQL_PWD = $DbPassword

$process = Start-Process -FilePath "mysqldump" `
  -ArgumentList "-h", $DbHost, "-P", $DbPort, "-u", $DbUser, $DbName `
  -RedirectStandardOutput $tempSqlFile `
  -NoNewWindow `
  -PassThru `
  -Wait

$env:MYSQL_PWD = $null

if ($process.ExitCode -ne 0) {
  throw "mysqldump failed with exit code $($process.ExitCode)"
}

$inputStream = [System.IO.File]::OpenRead($tempSqlFile)
$outputStream = [System.IO.File]::Create($backupFile)
$gzipStream = New-Object System.IO.Compression.GzipStream($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)

try {
  $inputStream.CopyTo($gzipStream)
} finally {
  $gzipStream.Dispose()
  $outputStream.Dispose()
  $inputStream.Dispose()
  Remove-Item -Force -Path $tempSqlFile -ErrorAction SilentlyContinue
}

Get-ChildItem -Path $BackupDir -File -Filter "${DbName}_*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$BackupRetentionDays) } |
  Remove-Item -Force

Write-Output "Backup written to $backupFile"
