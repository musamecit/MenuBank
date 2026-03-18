#!/bin/bash
# MenuBank / QRMenu - Günlük yedekleme scripti
# Her gün 00:01'de çalışır. Bilgisayar o saatte kapalıysa, geç açıldığında atlar (bir sonraki 00:01'i bekler).

set -e
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

# Sadece 00:00–00:10 arası çalıştır (LaunchAgent geç tetiklenirse atla)
CURRENT_HOUR=$(date +%H)
CURRENT_MIN=$(date +%M)
if [ "$CURRENT_HOUR" != "00" ] || [ "$CURRENT_MIN" -gt 10 ]; then
  exit 0
fi

# Renkli çıktı
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "[$(date '+%Y-%m-%d %H:%M')] Yedekleme başlıyor..."

# Backup remote tanımlı mı kontrol et
if ! git remote get-url backup &>/dev/null; then
  echo -e "${RED}HATA: 'backup' remote tanımlı değil. Önce scripts/README_BACKUP.md dosyasındaki adımları tamamlayın.${NC}"
  exit 1
fi

# Commit edilmemiş değişiklik var mı?
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${YELLOW}UYARI: Commit edilmemiş değişiklikler var. Bunlar yedeklenmeyecek.${NC}"
  echo "Yedeklemek için: git add -A && git commit -m 'mesaj'"
fi

# Önce origin'e push (public repo)
if git push origin main 2>/dev/null; then
  echo -e "${GREEN}✓ origin (public) push edildi${NC}"
else
  echo -e "${YELLOW}! origin push atlandı (zaten güncel veya hata)${NC}"
fi

# Sonra backup'a push (private repo)
if git push backup main 2>/dev/null; then
  echo -e "${GREEN}✓ backup (private) push edildi${NC}"
else
  echo -e "${RED}HATA: backup push başarısız. Bağlantıyı ve remote URL'i kontrol edin.${NC}"
  exit 1
fi

echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M')] Yedekleme tamamlandı.${NC}"
