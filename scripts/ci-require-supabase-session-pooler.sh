#!/usr/bin/env bash
# GitHub Actions IPv6 kullanmaz. Supabase db.*.supabase.co doğrudan bağlantı = IPv6.
# Session pooler (*.pooler.supabase.com) IPv4 üzerinden çalışır.
# Kaynak: https://supabase.com/docs/guides/database/connecting-to-postgres

set -euo pipefail

check_one() {
  local name=$1
  local url=$2
  [[ -z "$url" ]] && return
  if printf '%s' "$url" | grep -qE '@db\.[^@:/]+\.supabase\.co:5432'; then
    echo "::error title=Supabase IPv4 / GitHub Actions::$name doğrudan db.*.supabase.co kullanıyor (IPv6). GitHub runner IPv6'ya bağlanamaz."
    echo "::error::Adımlar: repodaki scripts/GITHUB_SUPABASE_POOLER_SETUP.txt dosyasını açın."
    echo "::error::Supabase → Connect → Session pooler URI (host ...pooler.supabase.com:5432). GitHub Secret SOURCE/TARGET'a yapıştırın."
    exit 1
  fi
}

check_one "SOURCE_DATABASE_URL" "${SOURCE_DATABASE_URL:-}"
check_one "TARGET_DATABASE_URL" "${TARGET_DATABASE_URL:-}"
echo "→ Supabase host: doğrudan db.*. değil (pooler veya IPv4 uyumlu bağlantı)."
