param(
    [int]$Port = 8000
)

$scriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

$buildScript = Join-Path $projectRoot "bin" "build.py"
Write-Host "Running build.py from $projectRoot..."
$buildProc = Start-Process -FilePath py -ArgumentList $buildScript -WorkingDirectory $projectRoot -NoNewWindow -Wait -PassThru
if ($buildProc.ExitCode -ne 0) {
    Write-Error "build.py failed with exit code $($buildProc.ExitCode)"
    exit $buildProc.ExitCode
}

$serveDir = Join-Path $projectRoot "songbook\html"
Write-Host "Starting Python HTTP server in $serveDir on port $Port..."
Start-Process -FilePath py -ArgumentList @("-m", "http.server", "$Port") -WorkingDirectory $serveDir -NoNewWindow -Wait
