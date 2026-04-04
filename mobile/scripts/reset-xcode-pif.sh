#!/usr/bin/env bash
# Xcode "unable to initiate PIF transfer session (operation in progress?)" için ortam sıfırlama.
# Kullanım: Xcode'u TAMAMEN kapat, sonra: bash scripts/reset-xcode-pif.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"

echo "==> Xcode derleme servislerini sonlandırıyorum (çalışmıyorsa hata normaldir)"
for svc in XCBBuildService SWBBuildService XcodeBuildService; do
  killall "$svc" 2>/dev/null || true
done
# macOS bazen farklı işlem adı kullanır
pkill -9 -f XCBBuildService 2>/dev/null || true
pkill -9 -f SWBBuildService 2>/dev/null || true

echo "==> Bu projenin iOS build ara dizinini siliyorum"
rm -rf "$IOS/build"

echo "==> Xcode DerivedData (tümü — PIF/cache bozulmasını giderir)"
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData"/*
mkdir -p "${HOME}/Library/Developer/Xcode/DerivedData"

echo "==> SwiftPM önbelleği (PIF ile çakışma bildirimleri için)"
rm -rf "${HOME}/Library/Caches/org.swift.swiftpm"

echo "==> CocoaPods"
cd "$IOS"
pod install

echo ""
echo "Bitti. Xcode'u aç, mobile/ios/MenuBank.xcworkspace ile aç, Product > Clean Build Folder, sonra Build."
