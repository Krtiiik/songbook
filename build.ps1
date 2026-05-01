# PowerShell script to build the songbook into a single PDF document
# Assumes chordpro is installed and available in PATH

# Get all .cho files in the songs folder
$choFiles = Get-ChildItem -Path "songs" -Filter "*.cho" -File | Select-Object -ExpandProperty FullName

# Check if there are any .cho files
if ($choFiles.Count -eq 0) {
    Write-Host "No .cho files found in songs folder."
    exit 1
}

# Run chordpro to generate a single PDF from all songs
chordpro $choFiles -o songbook.pdf --config chordpro.json

# Check if the command succeeded
if ($LASTEXITCODE -eq 0) {
    Write-Host "Songbook built successfully: songbook.pdf"
} else {
    Write-Host "Error building songbook. Exit code: $LASTEXITCODE"
}
