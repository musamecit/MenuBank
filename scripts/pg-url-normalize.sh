# shellcheck shell=bash
# Kaynak: replica-backup.sh ve GitHub Actions bağlantı testleri.
# Kullanım: source "$(dirname "$0")/pg-url-normalize.sh" veya replica-backup içinden source.

normalize_pg_url() {
  local u=$1
  u=$(printf '%s' "$u" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ -z "$u" ]] && { printf '%s' "$u"; return; }
  if [[ "$u" != *sslmode=* ]]; then
    if [[ "$u" == *\?* ]]; then
      u="${u}&sslmode=require"
    else
      u="${u}?sslmode=require"
    fi
  fi
  printf '%s' "$u"
}

# GitHub Actions → Supabase: bazen IPv6 yolu sorun çıkarır; IPv4 hostaddr ekle
maybe_prefer_ipv4_pg_url() {
  local u=$1
  [[ "${REPLICA_PREFER_IPV4:-0}" != "1" ]] && { printf '%s' "$u"; return; }
  local host ipv4
  host=$(printf '%s' "$u" | sed -E -n 's|postgresql://[^@]+@([^:/]+).*|\1|p')
  [[ -z "$host" ]] && { printf '%s' "$u"; return; }
  ipv4=$(getent ahosts "$host" 2>/dev/null | awk '/STREAM/ {print $1}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
  [[ -z "$ipv4" ]] && { printf '%s' "$u"; return; }
  if [[ "$u" == *hostaddr=* ]]; then
    printf '%s' "$u"
    return
  fi
  if [[ "$u" == *\?* ]]; then
    u="${u}&hostaddr=${ipv4}"
  else
    u="${u}?hostaddr=${ipv4}"
  fi
  printf '%s' "$u"
}

finalize_pg_url() {
  local u
  u=$(normalize_pg_url "$1")
  u=$(maybe_prefer_ipv4_pg_url "$u")
  printf '%s' "$u"
}
