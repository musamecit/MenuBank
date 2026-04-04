-- 1. Update Keyf-i Dem category to 'meyhane' (id: 6)
UPDATE public.restaurants
SET category_id = 6
WHERE id = '9c1aa77b-7ce9-4d97-ab34-08f98d5a0891'
  AND (category_id IS NULL OR category_id != 6);

-- 2. Update Curated List Mappings for Leymona and Blanca (Beach)
DO $$
DECLARE
  v_beach_list_id uuid;
  v_meyhane_list_id uuid;
BEGIN
  -- Find Beach list ID
  SELECT id INTO v_beach_list_id FROM public.curated_lists WHERE slug = 'beach' OR title_tr ILIKE '%Beach%' OR title_tr ILIKE '%Plaj%' LIMIT 1;
  -- Find Meyhane list ID
  SELECT id INTO v_meyhane_list_id FROM public.curated_lists WHERE slug = 'meyhane' OR title_tr ILIKE '%Meyhane%' LIMIT 1;

  -- Leymona Beach (19664154-6353-4d5e-b7ef-71c83fa986b1)
  IF v_beach_list_id IS NOT NULL THEN
    DELETE FROM public.curated_list_restaurants 
    WHERE restaurant_id = '19664154-6353-4d5e-b7ef-71c83fa986b1';
    
    INSERT INTO public.curated_list_restaurants (curated_list_id, restaurant_id, sort_order)
    VALUES (v_beach_list_id, '19664154-6353-4d5e-b7ef-71c83fa986b1', 1)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Blanca Beach Hotel (b8f1f289-946f-4132-bd5e-aefecbf7451e)
  IF v_beach_list_id IS NOT NULL THEN
    DELETE FROM public.curated_list_restaurants 
    WHERE restaurant_id = 'b8f1f289-946f-4132-bd5e-aefecbf7451e';
    
    INSERT INTO public.curated_list_restaurants (curated_list_id, restaurant_id, sort_order)
    VALUES (v_beach_list_id, 'b8f1f289-946f-4132-bd5e-aefecbf7451e', 2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Keyf-i Dem (9c1aa77b-7ce9-4d97-ab34-08f98d5a0891)
  IF v_meyhane_list_id IS NOT NULL THEN
    DELETE FROM public.curated_list_restaurants 
    WHERE restaurant_id = '9c1aa77b-7ce9-4d97-ab34-08f98d5a0891';
    
    INSERT INTO public.curated_list_restaurants (curated_list_id, restaurant_id, sort_order)
    VALUES (v_meyhane_list_id, '9c1aa77b-7ce9-4d97-ab34-08f98d5a0891', 1)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
