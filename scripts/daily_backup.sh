#!/bin/bash
# ============================================================
# MenuBank → Backup Supabase Projesi Veri Kopyalama
# Supabase REST API (service_role) ile tablo verilerini kopyalar
# ============================================================
set -euo pipefail

PROD_URL="https://byjcxrgcrcxeklhfmqxr.supabase.co"
PROD_KEY="[REDACTED_SUPABASE_ANON_KEY]"

BACKUP_URL="https://ymftgtxcrkdrdgpzlumx.supabase.co"
BACKUP_KEY="[REDACTED_SUPABASE_SERVICE_ROLE]"

PROD_DB_HOST="[REDACTED_PROD_DB_HOST]"
PROD_DB_PASS="[REDACTED_PROD_DB_PASS]"

BACKUP_DIR="$HOME/Desktop/QRMenu/backups"
DATE=$(date +%Y-%m-%d)
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

log "=== Günlük yedekleme başladı ==="

# 1) LOCAL DUMP (pg_dump)
DUMP_FILE="$BACKUP_DIR/menubank_${DATE}.dump"
log "pg_dump (custom format)..."
PGPASSWORD="$PROD_DB_PASS" pg_dump \
  -h "$PROD_DB_HOST" -p 5432 -U postgres -d postgres \
  --format=custom --no-owner --no-privileges --schema=public \
  --file="$DUMP_FILE" 2>>"$LOG" && \
  log "✅ Local dump: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))" || \
  log "❌ Local dump başarısız"

# 2) SUPABASE REST API İLE BACKUP PROJESİNE KOPYALA
TABLES=(
  restaurants
  menu_entries
  user_profiles
  user_favorites
  user_follows
  user_lists
  user_list_items
  user_blocks
  user_notifications
  user_push_tokens
  restaurant_claims
  restaurant_price_votes
  restaurant_categories
  curated_lists
  curated_list_restaurants
  menu_reports
  admin_audit_log
  countries
  cities
  areas
)

# İlk çalışmada backup projesinde tablolar olmayacak.
# SQL dump'ı da saklıyoruz, ihtiyaç olursa psql ile restore edilebilir.
SQL_FILE="$BACKUP_DIR/menubank_${DATE}.sql"
log "pg_dump (SQL format, schema+data)..."
PGPASSWORD="$PROD_DB_PASS" pg_dump \
  -h "$PROD_DB_HOST" -p 5432 -U postgres -d postgres \
  --format=plain --no-owner --no-privileges --schema=public \
  --exclude-table='app_events_p*' --exclude-table='spatial_ref_sys' \
  --file="$SQL_FILE" 2>>"$LOG" && \
  log "✅ SQL dump: $SQL_FILE ($(du -h "$SQL_FILE" | cut -f1))" || \
  log "❌ SQL dump başarısız"

log "REST API ile kritik tabloları backup projesine kopyalıyor..."
COPIED=0
FAILED=0
for TABLE in "${TABLES[@]}"; do
  DATA=$(curl -s "${PROD_URL}/rest/v1/${TABLE}?select=*" \
    -H "apikey: ${PROD_KEY}" \
    -H "Authorization: Bearer ${PROD_KEY}" \
    -H "Accept: application/json" 2>/dev/null)

  if [ -z "$DATA" ] || [ "$DATA" = "[]" ]; then
    log "  ⏭ $TABLE: boş veya erişilemez, atlıyor"
    continue
  fi

  RESP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BACKUP_URL}/rest/v1/${TABLE}" \
    -H "apikey: ${BACKUP_KEY}" \
    -H "Authorization: Bearer ${BACKUP_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$DATA" 2>/dev/null)

  if [ "$RESP" = "201" ] || [ "$RESP" = "200" ]; then
    COPIED=$((COPIED+1))
    log "  ✅ $TABLE kopyalandı"
  else
    FAILED=$((FAILED+1))
    log "  ⚠️ $TABLE: HTTP $RESP (tablo backup'ta olmayabilir)"
  fi
done

log "REST API sonuç: ${COPIED} başarılı, ${FAILED} başarısız"

# 3) ESKİ YEDEKLERİ TEMİZLE (7 günden eski)
find "$BACKUP_DIR" -name "menubank_*.dump" -mtime +7 -delete 2>/dev/null
find "$BACKUP_DIR" -name "menubank_*.sql" -mtime +7 -delete 2>/dev/null
log "✅ 7 günden eski yedekler temizlendi"

log "=== Günlük yedekleme tamamlandı ==="
