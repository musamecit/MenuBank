import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://byjcxrgcrcxeklhfmqxr.supabase.co';
const ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

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
