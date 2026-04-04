-- Enable RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (both anon and authenticated)
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'countries' AND policyname = 'Allow public read-only access on countries'
  ) THEN
      CREATE POLICY "Allow public read-only access on countries" ON countries FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'cities' AND policyname = 'Allow public read-only access on cities'
  ) THEN
      CREATE POLICY "Allow public read-only access on cities" ON cities FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'areas' AND policyname = 'Allow public read-only access on areas'
  ) THEN
      CREATE POLICY "Allow public read-only access on areas" ON areas FOR SELECT TO public USING (true);
  END IF;
END
$$;
