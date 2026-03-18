# MenuBank iOS Build Rehberi

## Xcode ile Açılacak Dosya

**Şu dosyayı açın:**

```
/Users/musamecit/Desktop/QRMenu/mobile/ios/MenuBank.xcworkspace
```

⚠️ **Önemli:** `.xcodeproj` değil, `.xcworkspace` dosyasını açın. CocoaPods kullanıldığı için workspace gerekli.

## Versiyon Bilgisi (Güncellendi)

- **Expo SDK 55** + **React Native 0.83.2** — `createFromUtf16` hatası giderildi
- **lucide-react-native** React 19 uyumlu versiyona güncellendi

---

## Xcode'da Yapılacaklar

1. **Signing & Capabilities**
   - Sol panelden **MenuBank** projesini seçin
   - **Signing & Capabilities** sekmesine gidin
   - **Team** kısmından Apple Developer hesabınızı seçin
   - **Bundle Identifier:** `com.musamecit.qrmenu` (değiştirmeyin)

2. **Cihaz Seçimi**
   - Üst bardan hedef cihaz olarak iPhone'unuzu seçin (bağlıysa) veya simülatör

3. **Build & Run**
   - `Cmd + R` veya ▶️ (Play) butonuna basın

4. **Fiziksel cihaza yükleme (Metro olmadan)**
   - Varsayılan **Debug** modunda JS bundle gömülmez; uygulama Metro packager bekler.
   - Fiziksel telefonda Metro olmadan çalıştırmak için **Release** moduna geçin:
   - **Product → Scheme → Edit Scheme** (veya `Cmd + <`)
   - Soldan **Run** seçin
   - **Build Configuration:** `Release` yapın
   - Kapatıp tekrar **Build & Run** yapın
   - JS bundle uygulamaya gömülür, Metro gerekmez.

---

## "No script URL provided" Hatası

**Hata:** Uygulama açılınca kırmızı ekranda "No script URL provided. Make sure the packager is running..." görünüyor.

**Sebep:** Debug modunda build edildi; JS bundle gömülmedi, Metro packager bekleniyor. Fiziksel cihaz Metro'ya erişemiyor.

**Çözüm:** Yukarıdaki adım 4'ü uygulayın — Scheme'i **Release** yapıp yeniden build edin.

---

## Sandbox Build Hatası

**Hata:** `Sandbox: bash deny(1) file-write-create .../Pods/resources-to-copy-MenuBank.txt` veya `Unexpected failure`

**Çözüm:** Projede `ENABLE_USER_SCRIPT_SANDBOXING = NO` ayarlandı. Bu, CocoaPods script'lerinin `Pods` klasörüne yazmasına izin verir. Xcode 15+ ile bu sandbox varsayılan olarak açıktır.

---

## Sarı Uyarılar (Yellow Warnings)

Build başarılı olduğunda Xcode’da çok sayıda sarı uyarı görebilirsiniz. **Bunlar normaldir ve uygulamanın çalışmasını engellemez.**

### Neden bu kadar çok uyarı var?

- **%95+ üçüncü parti kütüphanelerden** (Expo, React Native, react-native-maps, vb.)
- Bu dosyalar `node_modules` ve `Pods` içinde; sizin kodunuz değil
- Nullability, deprecation, legacy architecture gibi uyarılar

### Ne yapmalısınız?

1. **Genelde hiçbir şey** – Uygulama çalışıyorsa bu uyarıları görmezden gelebilirsiniz.
2. **“Update to recommended settings”** – Xcode proje seviyesinde sarı uyarı gösteriyorsa, üzerine tıklayıp önerilen ayarları uygulayabilirsiniz (isteğe bağlı).
3. **Güncellemeler** – Expo ve paket güncellemeleriyle zamanla bu uyarılar azalabilir.

### Özet

- Uyarılar hata değildir; build başarılıysa uygulama çalışır.
- Üçüncü parti kodunu değiştirmek önerilmez.
- App Store gönderimi için bu uyarılar engel oluşturmaz.

---

## İlk Kez Build

İlk build 5–10 dakika sürebilir. Telefona yüklemek için:
- iPhone USB ile bağlı olmalı
- Telefonda "Bu bilgisayara güven" onayı verilmiş olmalı
- Apple Developer hesabı (ücretsiz de olur) Xcode’da eklenmiş olmalı
