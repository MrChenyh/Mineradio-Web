$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (!(Test-Path $edge)) {
  $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
if (!(Test-Path $edge)) {
  throw 'Microsoft Edge was not found.'
}

$extension = Join-Path $root 'extension'
$profile = Join-Path $root '.edge-test-profile'
$url = 'http://127.0.0.1:4173/'

Write-Host "Opening Edge with Mineradio Connector..."
Write-Host "Extension: $extension"
Write-Host "Profile:   $profile"

Start-Process -FilePath $edge -ArgumentList @(
  "--user-data-dir=$profile",
  "--disable-extensions-except=$extension",
  "--load-extension=$extension",
  $url
)
