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

# A kaydı (IPv4); GitHub runner'da getent çoğu zaman önce IPv6 verir, hostaddr hiç eklenmez.
resolved_ipv4_for_host() {
  local host=$1
  local ipv4=""
  if command -v dig >/dev/null 2>&1; then
    local ns
    for ns in 8.8.8.8 1.1.1.1; do
      ipv4=$(dig +short A "$host" @"$ns" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
      [[ -n "$ipv4" ]] && break
    done
    [[ -z "$ipv4" ]] && ipv4=$(dig +short A "$host" 2>/dev/null | grep -E '^[0-9.]+$' | head -1)
  fi
  if [[ -z "$ipv4" ]]; then
    ipv4=$(getent ahosts "$host" 2>/dev/null | awk '/STREAM/ {print $1}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
  fi
  printf '%s' "$ipv4"
}

# GitHub Actions → Supabase: runner'da IPv6 genelde "Network is unreachable"; IPv4 hostaddr zorunlu.
maybe_prefer_ipv4_pg_url() {
  local u=$1
  [[ "${REPLICA_PREFER_IPV4:-0}" != "1" ]] && { printf '%s' "$u"; return; }
  local host ipv4
  host=$(printf '%s' "$u" | sed -E -n 's|postgresql://[^@]+@([^:/]+).*|\1|p')
  [[ -z "$host" ]] && { printf '%s' "$u"; return; }
  ipv4=$(resolved_ipv4_for_host "$host")
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
