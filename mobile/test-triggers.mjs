import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const url = env.match(/SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
    const key = env.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim() ?? env.match(/SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

    const supabase = createClient(url, key);

    const { data: triggers, error } = await supabase.rpc('get_triggers_metadata', {});
    
    if (error) {
      // fallback to SQL query via rpc if we don't have that function
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: `
          SELECT 
            tgname as trigger_name,
            relname as table_name
          FROM pg_trigger t
          JOIN pg_class c ON t.tgrelid = c.oid
          WHERE relname = 'menu_entries' OR relname = 'restaurants'
        `
      });
      if (sqlError) {
        console.error('SQL Error:', sqlError);
      } else {
        console.log('Triggers:', sqlData);
      }
    } else {
      console.log('Triggers:', triggers);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
