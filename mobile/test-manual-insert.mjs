import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim() ?? env.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    const supabase = createClient(url, key);

    // Create a dummy restaurant first
    console.log('Inserting dummy restaurant...');
    const { data: rest, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        place_id: `test-${Date.now()}`,
        name: 'Test Menu Insertion',
        status: 'active'
      })
      .select('id')
      .single();

    if (restErr) {
      console.error('Rest Insert Error:', restErr);
      return;
    }

    const restaurantId = rest.id;
    console.log('Created Restaurant ID:', restaurantId);

    // Now insert menu entry exactly as in the Edge function
    console.log('Inserting menu entry...');
    const { data: newMenu, error: menuErr } = await supabase
      .from('menu_entries')
      .insert({
        restaurant_id: restaurantId,
        url: 'https://example.com/menu',
        submitted_by: '83f5e557-ca18-40da-b7eb-ba045bc9a2f7', // use some user ID or yours if you know it, wait, let's omit submitted_by or find any valid user ID
        verification_status: 'approved'
      })
      .select('id, verification_status')
      .single();

    if (menuErr) {
      console.error('Menu Insert Error:', menuErr);
      // rollback simulates Edge function
      await supabase.from('restaurants').delete().eq('id', restaurantId);
    } else {
      console.log('Menu Insert SUCCESS!');
      console.log('Response Data:', newMenu);
    }

    // Clean up if success
    if (!menuErr) {
      console.log('Cleaning up...');
      await supabase.from('menu_entries').delete().eq('id', newMenu.id);
      await supabase.from('restaurants').delete().eq('id', restaurantId);
    }

  } catch (e) {
    console.error('Error:', e);
  }
}

check();
