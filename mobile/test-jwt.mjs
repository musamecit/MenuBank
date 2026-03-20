const SUPABASE_URL = 'https://byjcxrgcrcxeklhfmqxr.supabase.co';
const ANON_KEY = '[REDACTED_SUPABASE_ANON_KEY]';

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
