#!/usr/bin/env sh
set -eu

# Migrations are idempotent. Running them on startup keeps a fresh external
# deployment consistent after every approved schema change.
pnpm db:migrate
exec node dist/index.js
