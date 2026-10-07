param(
    [int]$Port = 8000,
    # Extra arguments for build.py, e.g. -BuildArgs --no-scrape,--no-pdf
    [string[]]$BuildArgs = @()
)

$scriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

# Run build.py
$buildScript = Join-Path (Join-Path $projectRoot "bin") "build.py"
Write-Host "Running build.py from $projectRoot..."
$buildProc = Start-Process -FilePath py -ArgumentList (@($buildScript) + $BuildArgs) -WorkingDirectory $projectRoot -NoNewWindow -Wait -PassThru
if ($buildProc.ExitCode -ne 0) {
    Write-Error "build.py failed with exit code $($buildProc.ExitCode)"
    exit $buildProc.ExitCode
}

# Serve
$serveDir = Join-Path $projectRoot "dist"
Write-Host "Serving $serveDir at http://localhost:$Port ..."
Start-Process -FilePath py -ArgumentList @("-m", "http.server", "$Port") -WorkingDirectory $serveDir -NoNewWindow -Wait
