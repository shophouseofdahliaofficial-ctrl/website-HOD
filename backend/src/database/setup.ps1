# Database Setup Script for Milko.in (PowerShell)
# This script sets up the PostgreSQL database

Write-Host "========================================" -ForegroundColor Green
Write-Host "Milko.in Database Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "Warning: DATABASE_URL not set." -ForegroundColor Yellow
    Write-Host "Please set DATABASE_URL environment variable."
    Write-Host "Example: `$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/milko'"
    exit 1
}

Write-Host "Step 1: Creating database schema..." -ForegroundColor Green
psql $env:DATABASE_URL -f src/database/schema.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Schema created successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "✗ Schema creation failed" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Seed data (optional)" -ForegroundColor Yellow
$seed = Read-Host "Do you want to seed initial data (admin user + sample products)? (y/n)"
if ($seed -eq "y" -or $seed -eq "Y") {
    Write-Host "Note: You need to generate a password hash first." -ForegroundColor Yellow
    Write-Host "Run: node src/database/generate_admin_hash.js YourPassword"
    Write-Host "Then update src/database/seed.sql with the hash."
    $updated = Read-Host "Have you updated seed.sql? (y/n)"
    if ($updated -eq "y" -or $updated -eq "Y") {
        psql $env:DATABASE_URL -f src/database/seed.sql
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Seed data inserted successfully" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "✗ Seed data insertion failed" -ForegroundColor Red
        }
    }
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

