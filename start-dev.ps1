param(
  [switch]$Install
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "templates"
$Python = Join-Path $RootDir ".venv\Scripts\python.exe"

function Write-Step($Message) {
  Write-Host ">>> $Message" -ForegroundColor Cyan
}

if (!(Test-Path $Python)) {
  throw "Python virtual environment was not found: $Python. Create .venv in the project root first."
}

if (!(Test-Path $BackendDir)) {
  throw "Backend directory was not found: $BackendDir"
}

if (!(Test-Path $FrontendDir)) {
  throw "Frontend directory was not found: $FrontendDir"
}

if ($Install) {
  Write-Step "Installing backend dependencies"
  Push-Location $BackendDir
  & $Python -m pip install -r requirements.txt
  Pop-Location

  Write-Step "Installing frontend dependencies"
  Push-Location $FrontendDir
  & npm.cmd install
  Pop-Location
}

if (!(Test-Path (Join-Path $FrontendDir "node_modules"))) {
  Write-Host "Hint: templates\node_modules was not found. Run .\start-dev.ps1 -Install to install dependencies." -ForegroundColor Yellow
}

Write-Step "Starting backend FastAPI at http://localhost:8000"
$BackendJob = Start-Job -Name "AstroCore-Backend" -ScriptBlock {
  param($BackendDir, $Python)
  Set-Location $BackendDir
  & $Python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $BackendDir, $Python

Write-Step "Starting frontend Vite at http://localhost:3000"
$FrontendJob = Start-Job -Name "AstroCore-Frontend" -ScriptBlock {
  param($FrontendDir)
  Set-Location $FrontendDir
  & npm.cmd run dev
} -ArgumentList $FrontendDir

Write-Host ""
Write-Host "AstroCore dev servers are starting." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host ""

try {
  while ($true) {
    foreach ($job in @($BackendJob, $FrontendJob)) {
      Receive-Job -Job $job | ForEach-Object {
        Write-Host "[$($job.Name)] $_"
      }

      if ($job.State -in @("Failed", "Stopped", "Completed")) {
        Receive-Job -Job $job -ErrorAction SilentlyContinue | ForEach-Object {
          Write-Host "[$($job.Name)] $_"
        }
        throw "$($job.Name) exited with state: $($job.State)"
      }
    }

    Start-Sleep -Milliseconds 500
  }
}
finally {
  Write-Host ""
  Write-Step "Stopping dev servers"
  Stop-Job -Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
  Remove-Job -Job $BackendJob, $FrontendJob -Force -ErrorAction SilentlyContinue
}
