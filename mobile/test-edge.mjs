import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const files = [
    join(root, 'web', '.env.local'),
    join(root, 'mobile', '.env'),
  ];
  for (const f of files) {
    if (existsSync(f)) {
      const content = readFileSync(f, 'utf8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://byjcxrgcrcxeklhfmqxr.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing URL or ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

async function run() {
  console.log('Testing Edge Functions...');
  let failed = false;

  // 1) Test `search`
  console.log('\n--- 1. Testing Search Function ---');
  try {
    const { data: searchData, error: searchErr } = await supabase.functions.invoke('search', {
      body: { q: 'Antalya' } // Wait, search uses URL params? No, it uses req.url. Wait, search index.ts says: url.searchParams.get('q') 
    });
    // Let's use fetch directly since supabase-js does POST by default, and search takes GET with `q=`
    const searchRes = await fetch(`${SUPABASE_URL}/functions/v1/search?q=Antalya`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ANON_KEY}` }
    });
    const searchJson = await searchRes.json();
    if (searchJson.items) {
      console.log('PASS: Search returned items:', searchJson.items.length);
    } else {
      console.log('FAIL: Search failed:', searchJson);
      failed = true;
    }
  } catch (e) {
    console.log('FAIL: Search threw error:', e);
    failed = true;
  }

  // 2) Test `explore`
  console.log('\n--- 2. Testing Explore Function ---');
  try {
    // action=nearby, lat/lng required
    const exploreRes = await fetch(`${SUPABASE_URL}/functions/v1/explore?action=nearby&lat=36.8969&lng=30.7133&radius=50000`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ANON_KEY}` }
    });
    const exploreJson = await exploreRes.json();
    if (exploreJson.items) {
      console.log('PASS: Explore returned items:', exploreJson.items.length);
    } else {
      console.log('FAIL: Explore failed:', exploreJson);
      failed = true;
    }
  } catch (e) {
    console.log('FAIL: Explore threw error:', e);
    failed = true;
  }

  // 3) Test `submit-report`
  console.log('\n--- 3. Testing Submit-Report Function ---');
  if (!supabaseAdmin) {
    console.log('Skipping submit-report because SUPABASE_SERVICE_ROLE_KEY is missing');
    process.exit(failed ? 1 : 0);
  }

  const email = `testuser_${Date.now()}@example.com`;
  const password = 'Testpassword123!';
  
  const { data: adminUser, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (adminErr) {
    console.log('FAIL: Admin user creation failed:', adminErr.message);
    failed = true;
  } else {
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    const userSession = loginData?.session;
    
    if (!userSession) {
      console.log('FAIL: Could not login with created user:', loginErr?.message);
      failed = true;
    } else {
      const { data: rests } = await supabase.from('restaurants').select('id').limit(1);
      const restId = rests?.[0]?.id || '123e4567-e89b-12d3-a456-426614174000';
      
      const reportBody = { restaurant_id: restId, reason: 'wrong_menu', details: 'test testing' };
      
      const repRes1 = await fetch(`${SUPABASE_URL}/functions/v1/submit-report`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${userSession.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportBody)
      });
      const repData1 = await repRes1.json();
      
      if (repRes1.status === 200 && repData1.status === 'received') {
        console.log('PASS: submit-report first call -> 200 received');
        
        const repRes2 = await fetch(`${SUPABASE_URL}/functions/v1/submit-report`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${userSession.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reportBody)
        });
        const repData2 = await repRes2.json();
        
        if (repRes2.status === 429 || repData2.error === 'already_reported' || repData2.status === 'already_reported') {
           console.log('PASS: submit-report second call ->', repRes2.status, repData2);
        } else {
           console.log('FAIL: submit-report second call unexpected ->', repRes2.status, repData2);
           failed = true;
        }
      } else {
        console.log('FAIL: submit-report first call failed ->', repRes1.status, repData1);
        failed = true;
      }
    }
    
    // Cleanup
    if (adminUser?.user) {
      await supabaseAdmin.auth.admin.deleteUser(adminUser.user.id);
    }
  }

  process.exit(failed ? 1 : 0);
}

run();
