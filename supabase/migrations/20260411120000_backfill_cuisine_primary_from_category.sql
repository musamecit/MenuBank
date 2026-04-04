-- Kategori listeleri cuisine_primary üzerinden süzülüyor; çoğu satırda NULL kaldı.
-- category_id -> restaurant_categories.slug eşlemesi + uygulama slug'larıyla hizalama.

-- 1) Eski kategori slug metinlerini venueCategories (mobil) ile aynı anahtarlara çevir
UPDATE public.restaurants
SET cuisine_primary = CASE BTRIM(cuisine_primary)
  WHEN 'sokak-lezzetleri' THEN 'street_food'
  WHEN 'tatli' THEN 'dessert'
  WHEN 'diger' THEN 'other'
  ELSE BTRIM(cuisine_primary)
END
WHERE deleted_at IS NULL
  AND cuisine_primary IS NOT NULL
  AND BTRIM(cuisine_primary) IN ('sokak-lezzetleri', 'tatli', 'diger');

-- 2) cuisine_primary boşken category_id üzerinden doldur
UPDATE public.restaurants r
SET cuisine_primary = CASE rc.slug
  WHEN 'sokak-lezzetleri' THEN 'street_food'
  WHEN 'tatli' THEN 'dessert'
  WHEN 'diger' THEN 'other'
  ELSE rc.slug
END
FROM public.restaurant_categories rc
WHERE r.category_id = rc.id
  AND r.deleted_at IS NULL
  AND (r.cuisine_primary IS NULL OR NULLIF(BTRIM(r.cuisine_primary::text), '') IS NULL);

-- 3) Hâlâ boş olanlar: genel liste (Restoran)
UPDATE public.restaurants
SET cuisine_primary = 'restaurant'
WHERE deleted_at IS NULL
  AND (cuisine_primary IS NULL OR NULLIF(BTRIM(cuisine_primary::text), '') IS NULL);
