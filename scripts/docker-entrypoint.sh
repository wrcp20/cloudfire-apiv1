#!/bin/sh
set -e

echo "==> Aplicando migraciones D1 locales..."
npx wrangler d1 migrations apply cloudfire-db --local || echo "WARN: migraciones ya aplicadas o error ignorable"

echo "==> Iniciando servidor de desarrollo..."
exec "$@"
