import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim() ?? env.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    const supabase = createClient(url, key);

    const { data: menu, error } = await supabase
      .from('menu_entries')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Select Error:', error);
    } else {
      console.log('Columns in menu_entries:');
      console.log(Object.keys(menu || {}));
      console.log('Sample Row:', menu);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
