import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim() ?? env.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    if (!url || !key) {
      console.error('Missing URL or Key in .env');
      return;
    }

    const supabase = createClient(url, key);

    const { data: rests, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name, created_at, status')
      .order('created_at', { ascending: false })
      .limit(3);

    if (restErr) console.error('Rest Error:', restErr);
    console.log('Recent Restaurants:');
    console.log(JSON.stringify(rests, null, 2));

    if (rests && rests.length > 0) {
      const ids = rests.map(r => r.id);
      const { data: menus, error: menuErr } = await supabase
        .from('menu_entries')
        .select('id, restaurant_id, url, verification_status, updated_at')
        .in('restaurant_id', ids)
        .order('updated_at', { ascending: false });

      if (menuErr) console.error('Menu Error:', menuErr);
      console.log('\nMenu Entries for these restaurants:');
      console.log(JSON.stringify(menus, null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
