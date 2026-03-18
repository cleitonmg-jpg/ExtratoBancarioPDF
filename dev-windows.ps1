$ErrorActionPreference = "Stop"

param(
  [int]$Port = 5000,
  [string]$Host = "127.0.0.1"
)

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
$env:HOST = $Host

Write-Host "Starting dev server on http://$Host`:$Port ..."
& npm.cmd run dev
