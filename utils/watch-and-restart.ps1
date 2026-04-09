# --- CONFIGURATION ---
$PROJECT_PATH = "C:\Users\User\Documents\Projects\obsidian-tasks-utils"
$CHECK_INTERVAL_SECONDS = 60
$PORT = 13371
# ---------------------

$serverProcess = $null

function Start-Server {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting server..." -ForegroundColor Cyan
    $script:serverProcess = Start-Process -FilePath "python" -ArgumentList "-m", "waitress", "--host=0.0.0.0", "--port=$PORT", "main:app" -WorkingDirectory $PROJECT_PATH -PassThru -NoNewWindow
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Server started (PID $($script:serverProcess.Id))" -ForegroundColor Green
}

function Stop-Server {
    if ($script:serverProcess -and -not $script:serverProcess.HasExited) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Stopping server (PID $($script:serverProcess.Id))..." -ForegroundColor Yellow
        $script:serverProcess | Stop-Process -Force
        $script:serverProcess = $null
        Start-Sleep -Seconds 2
    }
}

Write-Host "=== MonoVault Server Watcher ===" -ForegroundColor Magenta
Write-Host "Project: $PROJECT_PATH"
Write-Host "Checking for updates every $CHECK_INTERVAL_SECONDS seconds"
Write-Host ""

Set-Location $PROJECT_PATH
Start-Server

while ($true) {
    Start-Sleep -Seconds $CHECK_INTERVAL_SECONDS

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Checking for updates..." -ForegroundColor Yellow
    $pullOutput = & git -C $PROJECT_PATH pull origin main 2>&1
    Write-Host $pullOutput

    if ($pullOutput -notmatch "Already up to date") {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Changes detected. Restarting server..." -ForegroundColor Cyan
        Stop-Server
        Start-Server
    }
}
