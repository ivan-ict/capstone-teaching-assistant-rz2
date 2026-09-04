$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RootDir = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RootDir "capstone-teaching-assistant-rz2-be"
$FrontendDir = Join-Path $RootDir "capstone-teaching-assistant-rz2-app"
$ComposeFile = Join-Path $BackendDir "docker-compose.yml"

$AppUrl = "http://localhost:3000"
$ApiUrl = "http://localhost:8000"
$OllamaUrl = "http://localhost:11434"
$StartupTimeoutSeconds = 120

$BackendProcess = $null
$FrontendProcess = $null
$OllamaProcess = $null
$OllamaStdoutLog = $null
$OllamaStderrLog = $null
$StartedDockerServices = @()
$ExitCode = 0
$DockerExe = $null

function Write-Step {
    param([string]$Message)
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor Cyan
}

function Require-Command {
    param(
        [string]$Name,
        [string]$InstallationUrl
    )
    $Command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $Command) {
        throw "Required command '$Name' was not found. Install it from $InstallationUrl"
    }
    return $Command.Path
}

function Assert-LastCommand {
    param([string]$Description)
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Test-Url {
    param([string]$Url)
    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Wait-ForUrl {
    param(
        [string]$ServiceName,
        [string]$Url,
        [System.Diagnostics.Process]$Process = $null
    )
    for ($Waited = 0; $Waited -lt $StartupTimeoutSeconds; $Waited++) {
        if (Test-Url $Url) {
            Write-Step "$ServiceName is ready"
            return
        }
        if ($null -ne $Process -and $Process.HasExited) {
            throw "$ServiceName exited before becoming ready."
        }
        Start-Sleep -Seconds 1
    }
    throw "$ServiceName did not become ready within $StartupTimeoutSeconds seconds."
}

function Stop-ProcessTree {
    param(
        [AllowNull()]
        [System.Diagnostics.Process]$Process,
        [string]$ProcessName
    )
    if ($null -eq $Process -or $Process.HasExited) {
        return
    }
    Write-Step "Stopping $ProcessName"
    & taskkill.exe /PID $Process.Id /T /F *> $null
}

try {
    Write-Step "Checking prerequisites"
    $DockerExe = Require-Command "docker" "https://docs.docker.com/get-docker/"
    $UvExe = Require-Command "uv" "https://docs.astral.sh/uv/getting-started/installation/"
    Require-Command "node" "https://nodejs.org/" | Out-Null
    $NpmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($null -eq $NpmCommand) {
        $NpmCommand = Get-Command "npm" -ErrorAction SilentlyContinue
    }
    if ($null -eq $NpmCommand) {
        throw "Required command 'npm' was not found. Install it from https://nodejs.org/"
    }
    $NpmExe = $NpmCommand.Source
    $OllamaExe = Require-Command "ollama" "https://ollama.com/download"

    & $DockerExe compose version *> $null
    Assert-LastCommand "Docker Compose check"
    & $DockerExe info *> $null
    Assert-LastCommand "Docker daemon check"

    $BackendEnv = Join-Path $BackendDir ".env"
    if (-not (Test-Path $BackendEnv)) {
        Write-Step "Creating backend .env from .env.example"
        Copy-Item (Join-Path $BackendDir ".env.example") $BackendEnv
    }
    $FrontendEnv = Join-Path $FrontendDir ".env.local"
    if (-not (Test-Path $FrontendEnv)) {
        Write-Step "Creating frontend .env.local from .env.example"
        Copy-Item (Join-Path $FrontendDir ".env.example") $FrontendEnv
    }

    Write-Step "Synchronizing backend dependencies"
    Push-Location $BackendDir
    try {
        & $UvExe sync
        Assert-LastCommand "Backend dependency synchronization"
    }
    finally {
        Pop-Location
    }

    Write-Step "Synchronizing frontend dependencies"
    Push-Location $FrontendDir
    try {
        & $NpmExe install
        Assert-LastCommand "Frontend dependency synchronization"
    }
    finally {
        Pop-Location
    }

    $RunningDockerServices = @(& $DockerExe compose -f $ComposeFile ps --services --status running)
    Assert-LastCommand "Docker service inspection"
    foreach ($ServiceName in @("postgres", "rustfs")) {
        if ($RunningDockerServices -notcontains $ServiceName) {
            $StartedDockerServices += $ServiceName
        }
    }

    Write-Step "Starting PostgreSQL and RustFS"
    & $DockerExe compose -f $ComposeFile up -d --wait --wait-timeout $StartupTimeoutSeconds postgres rustfs
    Assert-LastCommand "Docker service startup"

    Write-Step "Initializing the RustFS bucket"
    & $DockerExe compose -f $ComposeFile run --rm --no-deps rustfs-init
    Assert-LastCommand "RustFS bucket initialization"

    Write-Step "Applying database migrations"
    Push-Location $BackendDir
    try {
        & $UvExe run alembic upgrade head
        Assert-LastCommand "Database migration"

        Write-Step "Seeding the local administrator"
        & $UvExe run python tools/seed_local_admin.py
        Assert-LastCommand "Local administrator seed"
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Url "$OllamaUrl/api/tags")) {
        Write-Step "Starting Ollama"
        $OllamaStdoutLog = [System.IO.Path]::GetTempFileName()
        $OllamaStderrLog = [System.IO.Path]::GetTempFileName()
        $OllamaProcess = Start-Process -FilePath $OllamaExe -ArgumentList "serve" -PassThru -WindowStyle Hidden -RedirectStandardOutput $OllamaStdoutLog -RedirectStandardError $OllamaStderrLog
        Wait-ForUrl "Ollama" "$OllamaUrl/api/tags" $OllamaProcess
    }
    else {
        Write-Step "Using the existing Ollama server"
    }

    foreach ($ModelName in @("qwen3.5:4b", "qwen3-vl:2b", "qwen3-embedding:0.6b")) {
        & $OllamaExe show $ModelName *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Ollama model is already available: $ModelName"
        }
        else {
            Write-Step "Downloading Ollama model: $ModelName"
            & $OllamaExe pull $ModelName
            Assert-LastCommand "Ollama model download for $ModelName"
        }
    }

    Write-Step "Starting FastAPI on $ApiUrl"
    $BackendProcess = Start-Process -FilePath $UvExe -ArgumentList @("run", "fastapi", "dev", "app/main.py") -WorkingDirectory $BackendDir -PassThru -NoNewWindow

    Write-Step "Starting Vite on $AppUrl"
    $FrontendProcess = Start-Process -FilePath $NpmExe -ArgumentList @("run", "dev") -WorkingDirectory $FrontendDir -PassThru -NoNewWindow

    Wait-ForUrl "FastAPI" "$ApiUrl/openapi.json" $BackendProcess
    Wait-ForUrl "Vite" $AppUrl $FrontendProcess

    Write-Host "`nCapstone Teaching Assistant is ready." -ForegroundColor Green
    Write-Host "  Web app:       $AppUrl"
    Write-Host "  API:           $ApiUrl"
    Write-Host "  Swagger:       $ApiUrl/docs"
    Write-Host "  RustFS:        http://localhost:9000"
    Write-Host "  Default admin: admin / AdminPassword123! (when using the example environment)"
    Write-Host "  Stop:          Ctrl+C`n"

    Start-Process $AppUrl

    while (-not $BackendProcess.HasExited -and -not $FrontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
    if ($BackendProcess.HasExited) {
        throw "FastAPI exited unexpectedly with code $($BackendProcess.ExitCode)."
    }
    throw "Vite exited unexpectedly with code $($FrontendProcess.ExitCode)."
}
catch {
    $ExitCode = 1
    Write-Error $_ -ErrorAction Continue
}
finally {
    Stop-ProcessTree $FrontendProcess "frontend"
    Stop-ProcessTree $BackendProcess "backend"
    Stop-ProcessTree $OllamaProcess "Ollama"

    if ($null -ne $DockerExe -and $StartedDockerServices.Count -gt 0) {
        Write-Step "Stopping Docker services started by this run: $($StartedDockerServices -join ', ')"
        $DockerArguments = @("compose", "-f", $ComposeFile, "stop") + $StartedDockerServices
        & $DockerExe @DockerArguments
    }

    foreach ($LogFile in @($OllamaStdoutLog, $OllamaStderrLog)) {
        if ($null -ne $LogFile -and (Test-Path $LogFile)) {
            Remove-Item $LogFile -Force
        }
    }
}

exit $ExitCode
