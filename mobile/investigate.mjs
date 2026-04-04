import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  try {
    const email = `test_agent_${Date.now()}@example.com`;
    const password = 'Password123!';

    console.log(`--- ATTEMPTING SIGNUP/LOGIN WITH: ${email} ---`);
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authErr) {
      console.log('Signup failed or needs confirmation:', authErr.message);
      console.log('Falling back to pure Anon read for everything...');
    } else {
      console.log('Signup/Login Success! User ID:', authData.user?.id);
    }

    // Now try to read Curated Lists with whatever session we have
    console.log('\n--- CURATED LISTS ---');
    const { data: lists, error: listsErr } = await supabase
      .from('curated_lists')
      .select('id, slug, title_tr, title_en');
    if (listsErr) console.error('Lists Error:', listsErr);
    else console.log(JSON.stringify(lists, null, 2));

    console.log('\n--- RESTAURANT CATEGORIES ---');
    const { data: cats } = await supabase.from('restaurant_categories').select('*');
    console.log(JSON.stringify(cats, null, 2));

    console.log('\n--- FETCHING TARGET RESTAURANTS ---');
    const { data: rests } = await supabase
      .from('restaurants')
      .select('id, name, category_id')
      .or('name.ilike.%Leymona%,name.ilike.%Blanca%,name.ilike.%Keyf-i%');
    console.log(JSON.stringify(rests, null, 2));

    if (rests && rests.length > 0) {
      const ids = rests.map(r => r.id);
      console.log('\n--- CURATED LIST MAPPINGS ---');
      const { data: mappings, error: mapErr } = await supabase
        .from('curated_list_restaurants')
        .select('*')
        .in('restaurant_id', ids);
      if (mapErr) console.error('Mappings Error:', mapErr);
      else console.log(JSON.stringify(mappings, null, 2));
    }

  } catch (e) {
    console.error('Unexpected error:', e);
  }
}

investigate();
