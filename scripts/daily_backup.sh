#!/usr/bin/env bash
# Yerel / cron: prod → yedek kopya. TÜM gizliler ortam değişkeninden okunur (repoda yok).
#
# Örnek (shell’de export edin veya launchd plist içinde EnvironmentVariables):
#   export PROD_SUPABASE_URL="https://xxxx.supabase.co"
#   export PROD_SUPABASE_ANON_KEY="<Dashboard → API → anon public>"
#   export BACKUP_SUPABASE_URL="https://yyyy.supabase.co"
#   export BACKUP_SERVICE_ROLE_KEY="<Dashboard → API → service_role yedek proje; asla commit yok>"
#   export PROD_PGHOST="db.xxxx.supabase.co"   # veya Session pooler host
#   export PROD_PGPASSWORD="..."
#
set -euo pipefail

: "${PROD_SUPABASE_URL:?PROD_SUPABASE_URL tanımlayın}"
: "${PROD_SUPABASE_ANON_KEY:?PROD_SUPABASE_ANON_KEY tanımlayın}"
: "${BACKUP_SUPABASE_URL:?BACKUP_SUPABASE_URL tanımlayın}"
: "${BACKUP_SERVICE_ROLE_KEY:?BACKUP_SERVICE_ROLE_KEY tanımlayın}"
: "${PROD_PGHOST:?PROD_PGHOST tanımlayın (pg_dump)}"
: "${PROD_PGPASSWORD:?PROD_PGPASSWORD tanımlayın}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/Desktop/QRMenu/backups}"
DATE=$(date +%Y-%m-%d)
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

log "=== Günlük yedekleme başladı ==="

DUMP_FILE="$BACKUP_DIR/menubank_${DATE}.dump"
log "pg_dump (custom)..."
PGPASSWORD="$PROD_PGPASSWORD" pg_dump \
  -h "$PROD_PGHOST" -p "${PROD_PGPORT:-5432}" -U postgres -d postgres \
  --format=custom --no-owner --no-privileges --schema=public \
  --file="$DUMP_FILE" 2>>"$LOG" && \
  log "✅ Local dump: $DUMP_FILE" || log "❌ Local dump başarısız"

SQL_FILE="$BACKUP_DIR/menubank_${DATE}.sql"
log "pg_dump (SQL)..."
PGPASSWORD="$PROD_PGPASSWORD" pg_dump \
  -h "$PROD_PGHOST" -p "${PROD_PGPORT:-5432}" -U postgres -d postgres \
  --format=plain --no-owner --no-privileges --schema=public \
  --exclude-table='app_events_p*' --exclude-table='spatial_ref_sys' \
  --file="$SQL_FILE" 2>>"$LOG" && \
  log "✅ SQL dump: $SQL_FILE" || log "❌ SQL dump başarısız"

TABLES=(
  restaurants menu_entries user_profiles user_favorites user_follows user_lists
  user_list_items user_blocks user_notifications user_push_tokens restaurant_claims
  restaurant_price_votes restaurant_categories curated_lists curated_list_restaurants
  menu_reports admin_audit_log countries cities areas
)

log "REST API ile backup projesine kopyalama..."
COPIED=0
FAILED=0
for TABLE in "${TABLES[@]}"; do
  DATA=$(curl -s "${PROD_SUPABASE_URL}/rest/v1/${TABLE}?select=*" \
    -H "apikey: ${PROD_SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${PROD_SUPABASE_ANON_KEY}" \
    -H "Accept: application/json" 2>/dev/null || true)

  if [ -z "$DATA" ] || [ "$DATA" = "[]" ]; then
    log "  ⏭ $TABLE: boş veya erişilemez"
    continue
  fi

  RESP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BACKUP_SUPABASE_URL}/rest/v1/${TABLE}" \
    -H "apikey: ${BACKUP_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${BACKUP_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$DATA" 2>/dev/null || echo "000")

  if [ "$RESP" = "201" ] || [ "$RESP" = "200" ]; then
    COPIED=$((COPIED+1))
    log "  ✅ $TABLE"
  else
    FAILED=$((FAILED+1))
    log "  ⚠️ $TABLE: HTTP $RESP"
  fi
done

log "REST: ${COPIED} ok, ${FAILED} hata"
find "$BACKUP_DIR" -name "menubank_*.dump" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "menubank_*.sql" -mtime +7 -delete 2>/dev/null || true
log "=== Tamamlandı ==="
