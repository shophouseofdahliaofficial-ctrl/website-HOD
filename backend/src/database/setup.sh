#!/bin/bash

# Database Setup Script for Milko.in
# This script sets up the PostgreSQL database

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Milko.in Database Setup${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Warning: DATABASE_URL not set.${NC}"
    echo "Please set DATABASE_URL environment variable or update this script."
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/milko"
    exit 1
fi

echo -e "${GREEN}Step 1: Creating database schema...${NC}"
psql "$DATABASE_URL" -f src/database/schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Schema created successfully${NC}\n"
else
    echo -e "${RED}✗ Schema creation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 2: Seed data (optional)${NC}"
read -p "Do you want to seed initial data (admin user + sample products)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Note: You need to generate a password hash first.${NC}"
    echo "Run: node src/database/generate_admin_hash.js YourPassword"
    echo "Then update src/database/seed.sql with the hash."
    read -p "Have you updated seed.sql? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        psql "$DATABASE_URL" -f src/database/seed.sql
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Seed data inserted successfully${NC}\n"
        else
            echo -e "${RED}✗ Seed data insertion failed${NC}"
        fi
    fi
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"

