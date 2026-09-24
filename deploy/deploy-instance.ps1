# Powershell script to deploy a isolated single-tenant college instance
param (
    [Parameter(Mandatory=$true)]
    [string]$CollegeName,

    [int]$Port = 8000
)

$DeployDir = Get-Location
$InstanceEnv = "$DeployDir\.env.$CollegeName"
$InstanceYaml = "$DeployDir\college.$CollegeName.yaml"

if (-not (Test-Path $InstanceEnv)) {
    Write-Host "Creating default .env for $CollegeName..." -ForegroundColor Yellow
    Copy-Item "$DeployDir\.env.example" $InstanceEnv
}

Write-Host "Deploying $CollegeName on port $Port..." -ForegroundColor Green
$env:PORT = $Port
docker compose -p $CollegeName --env-file $InstanceEnv up -d --build

Write-Host "Instance $CollegeName deployed successfully! Accessible at http://localhost:$Port" -ForegroundColor Green
