#!/bin/sh

# This script runs database migrations and starts the production server
set -e

cd /app/project

echo "Running database migrations..."
pnpm db:push

echo "Starting production server..."
exec node dist/index.js