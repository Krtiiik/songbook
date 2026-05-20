# PowerShell script to build the songbook into a single PDF document
# Assumes chordpro is installed and available in PATH

# Get all .cho files in the songs folder
$choFiles = Get-ChildItem -Path "songs" -Filter "*.cho" -File | Select-Object -ExpandProperty FullName

# Check if there are any .cho files
if ($choFiles.Count -eq 0) {
    Write-Host "No .cho files found in songs folder."
    exit 1
}

# Run chordpro to generate a single PDF and HTML from all songs
mkdir -Force songbook | Out-Null
chordpro $choFiles -o songbook\songbook.pdf --config chordpro.json
chordpro $choFiles -o songbook\songbook.html --config chordpro.json
