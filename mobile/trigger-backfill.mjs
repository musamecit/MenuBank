import fs from 'fs';

async function trigger() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/EXPO_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const anonKey = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    if (!url) {
      console.error('Missing URL in .env');
      return;
    }

    const endpoint = `${url}/functions/v1/backfill-phones`;
    console.log(`Triggering: ${endpoint}`);

    let totalUpdated = 0;
    let run = true;
    let iterations = 0;

    while (run && iterations < 10) { // Safety limit of 10 runs for now
      iterations++;
      console.log(`\n--- Iteration ${iterations} ---`);
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey ?? '',
          'Authorization': `Bearer ${anonKey ?? ''}` // Anon allows hitting it if unprotected
        }
      });

      if (!res.ok) {
        console.error('Fetch Failed:', res.status, await res.text());
        break;
      }

      const data = await res.json();
      console.log('Response:', JSON.stringify(data, null, 2));

      if (data.message === 'No restaurants found missing phone numbers.') {
        console.log('All caught up!');
        run = false;
      } else if (data.results) {
        const count = data.results.filter(r => r.phone && r.success).length;
        totalUpdated += count;
        console.log(`Updated ${count} restaurants in this Batch.`);
        if (data.results.length === 0) run = false;
      } else {
        run = false;
      }
    }

    console.log(`\nFinished! Total updated: ${totalUpdated}`);

  } catch (e) {
    console.error('Error triggering backfill:', e);
  }
}

trigger();
