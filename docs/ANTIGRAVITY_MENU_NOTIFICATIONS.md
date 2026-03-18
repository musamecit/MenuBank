# Antigravity Prompt: Takip Edilen Restorana Yeni Menü Eklendiğinde Bildirim

## Amaç
Kullanıcı takip ettiği bir restorana yeni menü (link) eklendiğinde push bildirimi alabilsin. Ayarlar > Bildirimler toggle'ı bu özelliği kontrol eder.

## Mevcut Yapı
- `user_follows`: user_id, restaurant_id (kullanıcının takip ettiği restoranlar)
- `user_push_tokens`: user_id, token, platform (Expo push token'ları)
- `menu_entries`: restaurant_id, url, verification_status ('pending' | 'approved' | 'rejected')
- `mobile/src/lib/notifications.ts`: registerPushToken() - token'ı push-tokenable Edge function'a gönderiyor
- Ayarlar ekranında "Bildirimler" toggle var; `settingsStorage.notifications_enabled` (AsyncStorage) kullanılıyor

## Yapılması Gerekenler

### 1. Bildirim tercihini Supabase'e taşı
- `user_profiles` tablosuna `notifications_menu_enabled` (boolean, default true) kolonu ekle
- Settings ekranında toggle değiştiğinde bu değeri Supabase'e yaz (sadece AsyncStorage değil)
- Böylece Edge function bildirim göndermeden önce bu tercihi okuyabilsin

### 2. Menü onaylandığında bildirim tetikle
İki noktada yeni menü "aktif" oluyor:
- **Admin onayı**: `admin-actions` Edge function'da `approve_menu` action'ı menu_entries'i güncelliyor (verification_status = 'approved')
- **İlk ekleme**: Bazı menüler otomatik onaylı olabilir (şu an hepsi pending)

**Önerilen yaklaşım**: `admin-actions` içinde `approve_menu` başarılı olduktan sonra, yeni bir Edge function çağır veya inline olarak:
1. Onaylanan menu_entry'den restaurant_id al
2. `user_follows` tablosundan bu restaurant_id'yi takip eden user_id'leri al
3. Bu user'ların `user_profiles.notifications_menu_enabled = true` olanlarını filtrele
4. `user_push_tokens` tablosundan bu user'ların token'larını al
5. Expo Push API ile her token'a bildirim gönder

### 3. Expo Push API kullanımı
```typescript
// Örnek: Expo Push API
const messages = tokens.map(token => ({
  to: token,
  sound: 'default',
  title: 'Yeni menü eklendi',
  body: `${restaurantName} restoranına yeni menü eklendi.`,
  data: { restaurantId, screen: 'RestaurantDetail' },
}));
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(messages),
});
```

### 4. Database trigger alternatifi
Supabase'de `menu_entries` tablosunda `UPDATE` trigger'ı: `verification_status` 'pending'den 'approved'a geçtiğinde bir pg_net veya Edge function'ı tetikleyebilir. Bu, admin-actions dışındaki onay yollarını da kapsar.

## Özet
- user_profiles: notifications_menu_enabled kolonu
- Mobile: Settings > Bildirimler toggle'ı bu kolonu güncellemeli
- admin-actions approve_menu sonrası: takipçilere push gönder
- Edge function veya Supabase trigger ile bu mantığı implement et
