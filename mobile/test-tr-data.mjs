import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
  envText.split('\n')
         .filter(line => line && !line.startsWith('#'))
         .map(line => line.split('=').map(p => p.trim()))
);

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function extractTR() {
  const { data: dbCountries } = await supabase.from('countries').select('*');
  console.log("Countries in DB:", dbCountries);
}
extractTR();
