CREATE OR REPLACE FUNCTION update_restaurant_price_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant_id uuid;
  v_mode_vote text;
  v_mapped_price_level text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_restaurant_id := OLD.restaurant_id;
  ELSE
    v_restaurant_id := NEW.restaurant_id;
  END IF;

  SELECT vote INTO v_mode_vote
  FROM restaurant_price_votes
  WHERE restaurant_id = v_restaurant_id
  GROUP BY vote
  ORDER BY count(*) DESC, MAX(created_at) DESC
  LIMIT 1;

  IF v_mode_vote = 'average' THEN
    v_mapped_price_level := 'medium';
  ELSE
    v_mapped_price_level := v_mode_vote;
  END IF;

  IF v_mapped_price_level IS NOT NULL THEN
    UPDATE restaurants
    SET price_level = v_mapped_price_level
    WHERE id = v_restaurant_id;
  ELSE
    UPDATE restaurants
    SET price_level = NULL
    WHERE id = v_restaurant_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_restaurant_price_level ON restaurant_price_votes;
CREATE TRIGGER tr_update_restaurant_price_level
AFTER INSERT OR UPDATE OR DELETE ON restaurant_price_votes
FOR EACH ROW
EXECUTE FUNCTION update_restaurant_price_level();

DO $$
DECLARE
  r RECORD;
  v_mode_vote text;
  v_mapped_price_level text;
BEGIN
  FOR r IN SELECT DISTINCT restaurant_id FROM restaurant_price_votes LOOP
    SELECT vote INTO v_mode_vote
    FROM restaurant_price_votes
    WHERE restaurant_id = r.restaurant_id
    GROUP BY vote
    ORDER BY count(*) DESC
    LIMIT 1;

    IF v_mode_vote = 'average' THEN
      v_mapped_price_level := 'medium';
    ELSE
      v_mapped_price_level := v_mode_vote;
    END IF;

    UPDATE restaurants
    SET price_level = v_mapped_price_level
    WHERE id = r.restaurant_id AND (price_level IS DISTINCT FROM v_mapped_price_level);
  END LOOP;
END;
$$;
