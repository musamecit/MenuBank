const SUPABASE_URL = 'https://byjcxrgcrcxeklhfmqxr.supabase.co';
const ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

async function test() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/restaurant_claims?limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const text = await res.text();
  console.log("Claims table response:", text);
}

test();
