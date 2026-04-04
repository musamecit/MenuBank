#!/usr/bin/env bash
# Prod → yedek Supabase: public şema. Kaynak yalnız pg_dump (okuma); psql yalnız hedef.
#
# GitHub Actions: Supabase "direct" host db.*.supabase.co = IPv6; runner IPv6 yok.
# Bu yüzden secret'larda Session pooler URI kullanın (*.pooler.supabase.com:5432).
# Dashboard → Connect → Session mode.
#
# Gerekli: SOURCE_DATABASE_URL, TARGET_DATABASE_URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pg-url-normalize.sh
source "$SCRIPT_DIR/pg-url-normalize.sh"

SOURCE_URL=$(finalize_pg_url "${SOURCE_DATABASE_URL:-}")
TARGET_URL=$(finalize_pg_url "${TARGET_DATABASE_URL:-}")

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "Hata: SOURCE_DATABASE_URL ve TARGET_DATABASE_URL tanımlı olmalı." >&2
  exit 1
fi
if [[ "$SOURCE_URL" == "$TARGET_URL" ]]; then
  echo "Hata: Kaynak ve hedef URL aynı olamaz." >&2
  exit 1
fi

export PGSSLMODE="${PGSSLMODE:-require}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-30}"

command -v pg_dump >/dev/null || { echo "pg_dump bulunamadı." >&2; exit 1; }
command -v psql >/dev/null || { echo "psql bulunamadı." >&2; exit 1; }

dump_from_source() {
  if [[ "${REPLICA_SOURCE_READ_ONLY_GUARD:-1}" == "1" ]]; then
    PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$SOURCE_URL" "$@"
  else
    pg_dump "$SOURCE_URL" "$@"
  fi
}

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

SCHEMA_DUMP_ARGS=(
  --schema=public
  --schema-only
  --no-owner
  --no-privileges
)
if [[ "${REPLICA_SCHEMA_CLEAN:-1}" == "1" ]]; then
  SCHEMA_DUMP_ARGS+=(--clean --if-exists)
fi

echo "→ Şema dökümü (public, kaynak=salt okunur)..."
dump_from_source "${SCHEMA_DUMP_ARGS[@]}" --file="$TMPDIR/schema_raw.sql"

# Filtre: Supabase 'public' semasi dahil bazi temel nesneleri kilitler/korur. Dosyadan bunlari cikartiyoruz.
grep -E -v '^(DROP SCHEMA|CREATE SCHEMA|COMMENT ON SCHEMA) (public|auth|graphql|realtime|storage)' "$TMPDIR/schema_raw.sql" > "$TMPDIR/schema.sql"

echo "→ Hedefe şema uygulanıyor (yalnız yedek DB)..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$TMPDIR/schema.sql"

echo "→ Veri dökümü (FK kapalı; hedef=yedek DB)..."
{
  echo "BEGIN;"
  echo "SET session_replication_role = replica;"
  dump_from_source \
    --schema=public \
    --data-only \
    --no-owner \
    --no-privileges
  echo "COMMIT;"
} | psql "$TARGET_URL" -v ON_ERROR_STOP=1

echo "→ Tamamlandı: yedek proje güncellendi."
