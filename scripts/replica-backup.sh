#!/usr/bin/env bash
# Prod → yedek Supabase projesine public şema kopyası.
#
# ANA VERİTABANI: Bu script kaynak URL'ye yalnızca pg_dump ile bağlanır (okuma).
#                psql / DDL / DML yalnızca TARGET_DATABASE_URL üzerinde çalışır.
#
# Gerekli ortam değişkenleri:
#   SOURCE_DATABASE_URL  — production postgres URL
#   TARGET_DATABASE_URL  — yedek proje postgres URL
#
# Opsiyonel:
#   REPLICA_SOURCE_READ_ONLY_GUARD=0 — varsayılan 1: pg_dump öncesi default_transaction_read_only=on
#   REPLICA_SCHEMA_CLEAN=0          — hedefe --clean atla
#
# Otomatik gece çalıştırma: .github/workflows/db-replica-nightly.yml + GitHub Secrets

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

command -v pg_dump >/dev/null || { echo "pg_dump bulunamadı (postgresql-client kurun)." >&2; exit 1; }
command -v psql >/dev/null || { echo "psql bulunamadı." >&2; exit 1; }

# Kaynak: sadece pg_dump (PostgreSQL tarafında yazma yok). Ek güvence: read-only session.
dump_from_source() {
  if [[ "${REPLICA_SOURCE_READ_ONLY_GUARD:-1}" == "1" ]]; then
    PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$SOURCE_URL" "$@"
  else
    pg_dump "$SOURCE_URL" "$@"
  fi
}

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# REPLICA_SCHEMA_CLEAN=0 ile --clean atlanır (ilk kurulumda hedef şema boşsa deneyin).
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
dump_from_source "${SCHEMA_DUMP_ARGS[@]}" --file="$TMPDIR/schema.sql"

echo "→ Hedefe şema uygulanıyor (yalnız yedek DB)..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$TMPDIR/schema.sql"

echo "→ Veri dökümü (kaynak=salt okunur; FK kapalı transaction yalnız yedek DB)..."
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
