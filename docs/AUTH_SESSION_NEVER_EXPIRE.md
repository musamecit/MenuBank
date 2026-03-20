# Oturum Süresiz Kalması (Instagram/Twitter Tarzı)

Uygulama, kullanıcı kendisi çıkış yapmadığı sürece oturumun açık kalması için yapılandırıldı.

## Uygulama Tarafı (Yapıldı)

- **autoRefreshToken: true** – Access token süresi dolunca otomatik yenilenir
- **persistSession: true** – Oturum SecureStore’da saklanır
- **AppState** – Uygulama ön plana geldiğinde oturum proaktif yenilenir

## Supabase Dashboard (Kontrol Edin)

1. [Supabase Dashboard](https://supabase.com/dashboard) → Projeniz → **Authentication** → **Settings** (veya **Sessions**)
2. **Pro plan** kullanıyorsanız:
   - **Inactivity timeout** → Kapalı veya 0
   - **Time-box user sessions** → Kapalı veya 0
   - **Single session per user** → Kapalı (kullanıcı birden fazla cihazda giriş yapabilsin)

3. **JWT expiry** (Settings → API / JWT):
   - Varsayılan 3600 saniye (1 saat) – Sorun yok; refresh token ile otomatik yenilenir
   - İsterseniz 604800 (7 gün) gibi daha uzun süre verebilirsiniz (güvenlik açısından genelde önerilmez)

**Not:** Free planda oturum sınırları yok; varsayılan olarak süresiz kalır. Pro planda bu ayarlar etkinse kapatın.
