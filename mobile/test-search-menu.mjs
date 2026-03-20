import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim() ?? env.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    const supabase = createClient(url, key);

    // Search for all menu entries that contain 'muteber' in the URL
    const { data: menus, error } = await supabase
      .from('menu_entries')
      .select('id, restaurant_id, url, verification_status, updated_at')
      .ilike('url', '%muteber%')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Search Error:', error);
    } else {
      console.log('Menu Entries matching "muteber":');
      console.log(JSON.stringify(menus, null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
