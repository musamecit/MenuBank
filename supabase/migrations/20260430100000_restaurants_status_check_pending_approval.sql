-- Yeni işletme + menü akışı status = 'pending_approval' yazar; CHECK yalnızca active|disabled ise insert reddedilir.
-- (20260330160000 yalnızca COMMENT eklemişti.)

UPDATE public.restaurants
SET status = 'active'
WHERE status IS NULL OR BTRIM(COALESCE(status::text, '')) = '';

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;

ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check CHECK (
  BTRIM(status::text) IN ('active', 'disabled', 'pending_approval')
);
