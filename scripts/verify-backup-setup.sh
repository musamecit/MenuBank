#!/bin/bash
# Yedekleme kurulumunun doğrulanması

echo "=========================================="
echo "  MenuBank Yedekleme Kurulum Kontrolü"
echo "=========================================="
echo ""

# 1. Script
if [ -x "/Users/musamecit/Desktop/QRMenu/scripts/daily-backup.sh" ]; then
  echo "✓ daily-backup.sh mevcut ve çalıştırılabilir"
else
  echo "✗ daily-backup.sh eksik veya çalıştırılamıyor"
fi

# 2. Plist
if [ -f "$HOME/Library/LaunchAgents/com.menubank.backup.plist" ]; then
  echo "✓ LaunchAgent plist dosyası yüklü"
else
  echo "✗ Plist ~/Library/LaunchAgents/ içinde yok"
fi

# 3. Git remote
cd /Users/musamecit/Desktop/QRMenu 2>/dev/null && git remote get-url backup &>/dev/null && echo "✓ backup remote tanımlı" || echo "✗ backup remote tanımlı değil"

# 4. LaunchAgent durumu (macOS'ta per-user job'lar farklı listede olabilir)
if launchctl print gui/$(id -u) 2>/dev/null | grep -q "com.menubank.dailybackup"; then
  echo "✓ LaunchAgent aktif (her gün 00:01'de çalışacak)"
else
  echo "? LaunchAgent durumu belirsiz - yine de çalışıyor olabilir"
  echo "  Tekrar yüklemek için: launchctl load ~/Library/LaunchAgents/com.menubank.backup.plist"
fi

echo ""
echo "Manuel test: ./scripts/daily-backup.sh"
echo "  (Not: Sadece 00:00-00:10 arası push yapar; diğer saatlerde sessizce çıkış yapar)"
echo ""
