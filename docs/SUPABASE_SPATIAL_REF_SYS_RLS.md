# `spatial_ref_sys` ve linter uyarısı (0013_rls_disabled_in_public)

## Neden `42501: must be owner of table spatial_ref_sys`?

`spatial_ref_sys` PostGIS’in **sistem tablosudur**; sahibi genelde **postgres** veya extension rolüdür. Ne migration rolü ne de Dashboard SQL Editor bu tabloda `ALTER TABLE` / `CREATE POLICY` çalıştıramaz — bu yüzden hem `db push` hem SQL Editor’de aynı hata çıkar. **Bu sizin hatanız değil; platform kısıtı.**

## Projeyi bozar mı?

**Hayır.** Uyarıyı düzeltemeseniz bile uygulama mantığı bozulmaz. Tabloda sadece **EPSG koordinat sistemi kodları** (kamuya açık referans verisi) vardır; kullanıcı verisi yok.

## Ne yapabilirsiniz?

### 1) Uyarıyı kabul edip geçmek (çoğu ekip için yeterli)

Dashboard → **Advisors** / **Security** → ilgili uyarıda **Dismiss** / **Ignore** varsa kullanın. Açıklama: *PostGIS-owned table, RLS cannot be enabled without superuser.*

### 2) Supabase Support

[Support](https://supabase.com/dashboard/support/new) veya support@supabase.io — örnek metin:

> Project ref: …  
> Please enable RLS on `public.spatial_ref_sys` (PostGIS) or adjust the linter to exclude extension-owned reference tables. We get ERROR 42501 must be owner when running ALTER TABLE.

Bazen bunu sadece platform tarafı yapabiliyor.

### 3) SQL Editor’de denenen script (çoğu projede çalışmaz)

Aşağıdaki script **sadece tablo sahibi yetkisi varsa** işe yarar; hosted Supabase’te sıkça **42501** verir — tekrar denemek zorunda değilsiniz.

```sql
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- + policy …
```

## Özet

| Soru | Cevap |
|------|--------|
| Uygulama kırılır mı? | Hayır. |
| Kendi SQL’inizle düzelir mi? | Genelde hayır (owner değilsiniz). |
| Ne yapmalı? | Advisor’ı dismiss veya Support’a yazın. |

---

## Migration stub’ları (`db push`)

Uzak migration geçmişi için repoda `*_sync_remote_placeholder.sql` dosyaları var; detaylar için bu dosyanın alt bölümü yerine repo içi migration README’ye bakın.
