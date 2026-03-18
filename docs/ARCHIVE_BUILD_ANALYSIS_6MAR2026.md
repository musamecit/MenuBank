# MenuBank 6.03.2026, 15.59 Build Analizi

**Tarih:** 7 Mart 2026  
**Kaynak:** `MenuBank 6.03.2026, 15.59.xcarchive`  
**Not:** main.jsbundle Hermes bytecode (v96) formatında olduğu için kaynak kod çıkarılamadı. Karşılaştırma app.config, Info.plist ve mevcut kod tabanı üzerinden yapıldı.

---

## 1. Yapılandırma Karşılaştırması

### app.config (Archive vs Mevcut)

| Özellik | Archive (6.03.2026) | Mevcut Kod |
|---------|---------------------|-------------|
| **newArchEnabled** | `true` | `false` |
| **buildNumber** | `7` | `4` |
| **icon** | `./assets/menubank-icon-v2.png` | `./assets/QRMenu_AppIcon_1024x1024.png` |
| **splash image** | `./assets/menubank-splash-v2.png` | `./assets/QRMenu_SplashScreen_iPhone.png` |
| **GADApplicationIdentifier** (AdMob) | ❌ Yok | ✅ Var |
| **SKAdNetworkItems** | ❌ Yok | ✅ Var (9 adet) |
| **NSLocationWhenInUseUsageDescription** | ✅ Var ("Show nearby restaurants on the map") | ✅ Var (aynı) |
| **NSUserTrackingUsageDescription** | ✅ Var | ✅ Var (aynı) |

### Info.plist (Archive)

- CFBundleVersion: **7**
- CFBundleShortVersionString: **1.0.0**
- CFBundleDisplayName: **MenuBank**
- ITSAppUsesNonExemptEncryption: **false**
- Konum izinleri: Mevcut ile aynı metinler
- **AdMob / SKAdNetwork yok** – Archive build reklamsız

---

## 2. Archive'da Olup Mevcut Kodda Farklı/Eksik Olabilecekler

### 2.1 React Native New Architecture
- **Archive:** `newArchEnabled: true`
- **Mevcut:** `newArchEnabled: false`
- **Öneri:** New Architecture performans ve gelecek uyumluluk açısından avantajlı olabilir. Test edilerek açılabilir.

### 2.2 Reklam (AdMob)
- **Archive:** Reklam yok (GADApplicationIdentifier yok)
- **Mevcut:** SafeBannerAd bileşeni birçok ekranda kullanılıyor
- **Not:** Archive Apple’a gönderilen “temiz” bir build olabilir (reklam olmadan review için)

### 2.3 Build Numarası ve Versiyon
- **Archive:** buildNumber 7
- **Mevcut:** buildNumber 4
- **Öneri:** Yeni App Store gönderiminde buildNumber artırılmalı (örn. 8 veya üzeri)

### 2.4 Uygulama İkonu ve Splash
- **Archive:** menubank-icon-v2, menubank-splash-v2
- **Mevcut:** QRMenu_AppIcon, QRMenu_SplashScreen
- **Öneri:** Hangi asset setinin kullanılacağına karar verilmeli

---

## 3. Mevcut Kodda Olup Archive’da Olmayabilecekler (Son Eklenenler)

Konuşma geçmişi ve kod incelemesine göre:

### 3.1 Menü Ekleme Akışı
- **Mevcut:** Restoran sadece menü linki girildikten sonra oluşturuluyor (menüsüz restoran eklenmiyor)
- **Archive:** Muhtemelen eski akış (restoran seçilince hemen oluşturuluyordu)

### 3.2 Restoran Sahipliği (Claim)
- **Mevcut:** "Bu restoranın sahibi misin?" butonu + 9,99$ ödeme modalı
- **Archive:** Önceki konuşmalarda "Claim akışı Apple review için geçici olarak gizlendi" denmişti – archive’da claim UI gizli olabilir

### 3.3 Menü Güncelleme Akışı
- **Mevcut:** "Menüyü Güncelle" → Direkt link alanı (uyarı/ödeme yok)
- **Archive:** Eski akışta uyarı + ödeme modalı vardı

### 3.4 Referral Sistemi
- **Mevcut:** Devre dışı (ProfileScreen’de invite/davet kodu UI yok)
- **Archive:** Açık veya kapalı olabilir – Hermes bytecode’dan çıkarılamadı

### 3.5 is_menu_blocked Uyarısı
- **Mevcut:** SettingsScreen’de `is_menu_blocked` kontrolü ve uyarı
- **Archive:** Muhtemelen yoktu

### 3.6 NotificationScreen
- **Mevcut:** Takip edilen restoranlara menü eklendiğinde bildirim
- **Archive:** Var mı bilinmiyor

### 3.7 Klavye / Input Düzenlemeleri
- **Mevcut:** RestaurantDetailScreen’de KeyboardAvoidingView + scrollTo ile menü linki alanı klavye altında kalmıyor
- **Archive:** Bu düzeltme olmayabilir

---

## 4. Özet Tablo: Yapılacaklar Değerlendirmesi

| # | Özellik / Kural | Archive | Mevcut | Öneri |
|---|-----------------|---------|--------|-------|
| 1 | newArchEnabled | true | false | Test edip açmayı değerlendir |
| 2 | AdMob / Reklamlar | Yok | Var | Apple review için reklamsız build gerekebilir |
| 3 | buildNumber | 7 | 4 | Yeni gönderimde 8+ kullan |
| 4 | İkon / Splash | menubank-v2 | QRMenu | Hangi set kullanılacak netleştir |
| 5 | Menüsüz restoran ekleme | Muhtemelen vardı | Engellendi | Mevcut davranış korunmalı |
| 6 | Claim UI | Gizli olabilir | Açık | Apple onayı sonrası açık tutulabilir |
| 7 | Menü güncelleme (uyarı/ödeme) | Vardı | Kaldırıldı | Mevcut davranış korunmalı |
| 8 | Referral sistemi | Bilinmiyor | Kapalı | İhtiyaca göre açılabilir |
| 9 | is_menu_blocked uyarısı | Muhtemelen yok | Var | Mevcut davranış korunmalı |
| 10 | Harita düzeltmeleri | Bilinmiyor | Son düzeltmeler | Mevcut davranış korunmalı |

---

## 5. Sonuç ve Öneriler

1. **Hermes bytecode** nedeniyle archive’daki tam özellik listesi çıkarılamadı.
2. **app.config** karşılaştırması: Archive reklamsız, New Architecture açık, farklı asset’ler kullanıyor.
3. **Mevcut kod** son konuşmalarda güncellendi: menüsüz restoran engeli, claim ayrımı, menü güncelleme sadeleştirmesi, klavye düzeltmesi.
4. **Apple’a gönderim:** Reklamsız veya sadeleştirilmiş bir build (archive benzeri) review için tercih edilebilir.
5. **buildNumber:** Yeni gönderimde 8 veya üzeri kullanılmalı.

---

*Bu doküman otomatik analiz ve mevcut kod incelemesiyle oluşturulmuştur.*
