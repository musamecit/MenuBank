import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
  // Sign up a dummy user
  const email = `test-${Date.now()}@example.com`;
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }
  
  const token = authData.session.access_token;
  console.log("Got token!");
  
  // Call the edge function
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-restaurant-claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ restaurant_id: 'dummy-id' })
  });
  
  const text = await res.text();
  console.log("Edge Function Response Status:", res.status);
  console.log("Edge Function Response Body:", text);
}

test();
