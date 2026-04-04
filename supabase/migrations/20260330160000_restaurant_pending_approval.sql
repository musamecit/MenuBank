-- Yeni işletme kullanıcı eklemesi: status = 'pending_approval' (keşif / arama / detay: yalnızca active)
-- Mevcut değerler: active, disabled
COMMENT ON COLUMN public.restaurants.status IS 'active | disabled | pending_approval — pending_approval onaylanana kadar halka açık listelerde kullanılmaz';
