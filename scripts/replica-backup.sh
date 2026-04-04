#!/usr/bin/env bash
# Prod → yedek Supabase projesine public şema kopyası.
#
# ANA VERİTABANI: yalnızca pg_dump (okuma). psql/pg_restore yalnız TARGET üzerinde.
#
# REPLICA_PREFER_IPV4=1 (GitHub Actions): URI yerine PGHOST+PGHOSTADDR kullanılır — runner IPv6'ya gidemez.
#
# Gerekli: SOURCE_DATABASE_URL, TARGET_DATABASE_URL
# Opsiyonel: REPLICA_SOURCE_READ_ONLY_GUARD, REPLICA_SCHEMA_CLEAN, REPLICA_PREFER_IPV4

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pg-url-normalize.sh
source "$SCRIPT_DIR/pg-url-normalize.sh"

trim() { printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'; }

S_RAW=$(trim "${SOURCE_DATABASE_URL:-}")
T_RAW=$(trim "${TARGET_DATABASE_URL:-}")
if [[ -z "$S_RAW" || -z "$T_RAW" ]]; then
  echo "Hata: SOURCE_DATABASE_URL ve TARGET_DATABASE_URL tanımlı olmalı." >&2
  exit 1
fi
if [[ "$S_RAW" == "$T_RAW" ]]; then
  echo "Hata: Kaynak ve hedef URL aynı olamaz." >&2
  exit 1
fi

use_ipv4_libpq=0
if [[ "${REPLICA_PREFER_IPV4:-0}" == "1" ]] && command -v python3 >/dev/null 2>&1; then
  use_ipv4_libpq=1
fi

if [[ "$use_ipv4_libpq" == "0" ]]; then
  SOURCE_URL=$(finalize_pg_url "$S_RAW")
  TARGET_URL=$(finalize_pg_url "$T_RAW")
else
  SOURCE_URL=""
  TARGET_URL=""
fi

export PGSSLMODE="${PGSSLMODE:-require}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-30}"

command -v pg_dump >/dev/null || { echo "pg_dump bulunamadı." >&2; exit 1; }
command -v psql >/dev/null || { echo "psql bulunamadı." >&2; exit 1; }

if [[ "$use_ipv4_libpq" == "1" ]]; then
  command -v dig >/dev/null || { echo "dig bulunamadı (dnsutils)." >&2; exit 1; }
fi

# Kaynak: pg_dump
dump_from_source() {
  if [[ "$use_ipv4_libpq" == "1" ]]; then
    (
      eval "$(python3 "$SCRIPT_DIR/pg_ci_libpq_env.py" SOURCE_DATABASE_URL)"
      if [[ "${REPLICA_SOURCE_READ_ONLY_GUARD:-1}" == "1" ]]; then
        PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$@"
      else
        pg_dump "$@"
      fi
    )
  else
    if [[ "${REPLICA_SOURCE_READ_ONLY_GUARD:-1}" == "1" ]]; then
      PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$SOURCE_URL" "$@"
    else
      pg_dump "$SOURCE_URL" "$@"
    fi
  fi
}

psql_to_target() {
  if [[ "$use_ipv4_libpq" == "1" ]]; then
    (
      eval "$(python3 "$SCRIPT_DIR/pg_ci_libpq_env.py" TARGET_DATABASE_URL)"
      psql "$@"
    )
  else
    psql "$TARGET_URL" "$@"
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
dump_from_source "${SCHEMA_DUMP_ARGS[@]}" --file="$TMPDIR/schema.sql"

echo "→ Hedefe şema uygulanıyor (yalnız yedek DB)..."
psql_to_target -v ON_ERROR_STOP=1 -f "$TMPDIR/schema.sql"

echo "→ Veri dökümü (FK kapalı; hedef=yedek DB)..."
if [[ "$use_ipv4_libpq" == "1" ]]; then
  {
    echo "BEGIN;"
    echo "SET session_replication_role = replica;"
    (
      eval "$(python3 "$SCRIPT_DIR/pg_ci_libpq_env.py" SOURCE_DATABASE_URL)"
      if [[ "${REPLICA_SOURCE_READ_ONLY_GUARD:-1}" == "1" ]]; then
        PGOPTIONS='-c default_transaction_read_only=on' pg_dump \
          --schema=public --data-only --no-owner --no-privileges
      else
        pg_dump --schema=public --data-only --no-owner --no-privileges
      fi
    )
    echo "COMMIT;"
  } | (
    eval "$(python3 "$SCRIPT_DIR/pg_ci_libpq_env.py" TARGET_DATABASE_URL)"
    psql -v ON_ERROR_STOP=1
  )
else
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
fi

echo "→ Tamamlandı: yedek proje güncellendi."
