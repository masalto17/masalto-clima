#!/usr/bin/env bash
# Aplica supabase/migrations/*.sql al proyecto vinculado, en orden.
# No usa `supabase db push`: el proyecto Supabase se comparte con Handy y su
# historial (supabase_migrations) no se toca. Registro propio: clima.schema_migrations.
set -euo pipefail

cd "$(dirname "$0")/.."

applied=$(supabase db query --linked -o csv \
  "select version from clima.schema_migrations" 2>/dev/null || true)

for file in supabase/migrations/*.sql; do
  version=$(basename "$file" .sql)
  if grep -qx "$version" <<<"$applied"; then
    echo "ya aplicada: $version"
    continue
  fi
  echo "aplicando:   $version"
  supabase db query --linked -f "$file" >/dev/null
  supabase db query --linked \
    "insert into clima.schema_migrations (version) values ('$version')" >/dev/null
done
