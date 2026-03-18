#!/bin/bash
# QRMenu/MenuBank - Proje Taşıma ve Yedekleme Tamir Scripti

OLD_PATH="/Users/musamecit/Desktop/QRMenu"
NEW_PATH="$HOME/src/QRMenu" # Desktop dışı güvenli bir klasör

echo "=========================================="
echo "  Yedekleme Sistemini Tamir Etme"
echo "=========================================="

# 1. Yeni klasörü oluştur
mkdir -p "$HOME/src"

# 2. Projeyi taşı (eğer hala eski yerindeyse)
if [ -d "$OLD_PATH" ]; then
    echo "1. Proje taşınıyor: $OLD_PATH -> $NEW_PATH"
    mv "$OLD_PATH" "$NEW_PATH"
else
    echo "1. Proje zaten taşınmış veya eski yerinde bulunamadı."
fi

# 3. Yeni klasöre geç
cd "$NEW_PATH" || exit 1

# 4. Plist dosyasındaki yolları güncelle
PLIST_FILE="scripts/com.menubank.backup.plist"
if [ -f "$PLIST_FILE" ]; then
    echo "2. Konfigürasyon dosyasındaki yallar güncelleniyor..."
    sed -i '' "s|/Users/musamecit/Desktop/QRMenu|$NEW_PATH|g" "$PLIST_FILE"
fi

# 5. LaunchAgent'ı yükle/yenile
echo "3. macOS Arka Plan Servisi güncelleniyor..."
launchctl unload ~/Library/LaunchAgents/com.menubank.backup.plist 2>/dev/null
cp "$PLIST_FILE" ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.menubank.backup.plist

echo ""
echo "=========================================="
echo "✓ TAMAMLANDI!"
echo "------------------------------------------"
echo "Yeni Proje Klasörü: $NEW_PATH"
echo "Yedekleme Kuralı: Aktif (Her gece 00:01)"
echo "=========================================="
echo "Artık kodlarınız Masaüstü kısıtlamalarına takılmadan yedeklenecek."
