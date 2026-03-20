-- Migration: Create atomic restaurant and menu creation function
-- Date: 2026-03-19

CREATE OR REPLACE FUNCTION create_restaurant_with_menu(
  p_place_id TEXT,
  p_name TEXT,
  p_city_name TEXT,
  p_area_name TEXT,
  p_country_code TEXT,
  p_formatted_address TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_cuisine_primary TEXT,
  p_created_by UUID,
  p_menu_url TEXT,
  p_menu_submitted_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_restaurant_id UUID;
  v_menu_id UUID;
  v_status TEXT;
BEGIN
  -- 1. Insert Restaurant
  INSERT INTO public.restaurants (
    place_id,
    name,
    city_name,
    area_name,
    country_code,
    formatted_address,
    lat,
    lng,
    cuisine_primary,
    status,
    created_by
  )
  VALUES (
    p_place_id,
    p_name,
    p_city_name,
    p_area_name,
    p_country_code,
    p_formatted_address,
    p_lat,
    p_lng,
    p_cuisine_primary,
    'active',
    p_created_by
  )
  RETURNING id INTO v_restaurant_id;

  -- 2. Insert Menu Entry
  INSERT INTO public.menu_entries (
    restaurant_id,
    url,
    submitted_by,
    verification_status
  )
  VALUES (
    v_restaurant_id,
    p_menu_url,
    p_menu_submitted_by,
    'pending'
  )
  RETURNING id, verification_status INTO v_menu_id, v_status;

  -- 3. Mark creator as admin of this restaurant
  -- This ensures the person who created the restaurant can update its menu even if verified.
  INSERT INTO public.restaurant_admins (restaurant_id, user_id)
  VALUES (v_restaurant_id, p_created_by)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'restaurant_id', v_restaurant_id,
    'menu_id', v_menu_id,
    'status', v_status
  );
EXCEPTION WHEN OTHERS THEN
  -- Transaction will roll back automatically in Postgres on error
  RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
