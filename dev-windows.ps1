param(
  [int]$Port = 5000,
  [string]$ListenHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies (first run)..."
  & npm.cmd install
}

if (-not (Test-Path ".env")) {
  Write-Host "Creating .env from .env.example..."
  Copy-Item -Force ".env.example" ".env"
}

$env:PORT = "$Port"
$env:HOST = $ListenHost

Write-Host "Starting dev server on http://$ListenHost`:$Port ..."
& npm.cmd run dev
