const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function testJWT() {
  // We use the ANON_KEY as the token but we maliciously alter the signature part!
  const parts = ANON_KEY.split('.');
  const fakeSignature = parts[2].substring(0, parts[2].length - 3) + 'abc';
  const badToken = `${parts[0]}.${parts[1]}.${fakeSignature}`;

  console.log("\n--- Testing Edge Function with bad signature token ---");
  const res1 = await fetch(`${SUPABASE_URL}/functions/v1/submit-menu`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${badToken}`,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({ restaurant_id: '123', url: 'https://test.com' })
  });
  console.log("Bad Signature Response:", res1.status, await res1.text());
}

testJWT();
