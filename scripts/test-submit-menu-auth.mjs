#!/usr/bin/env node
/**
 * Auth test for submit-menu edge function.
 * Expects 401 for both: no-auth and anon-key only.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const files = [
    join(root, 'web', '.env.local'),
    join(root, 'web', '.env'),
    join(root, 'web', '.env.example'),
    join(root, '.env.local'),
    join(root, '.env'),
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
      break;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL or ANON_KEY. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local');
  process.exit(1);
}

const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/submit-menu`;
const body = JSON.stringify({ restaurant_id: 'test', url: 'https://example.com/menu.pdf' });

async function run() {
  let passed = 0;
  let failed = 0;

  // Test 1: no auth
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.status === 401) {
      console.log('PASS: no-auth -> 401');
      passed++;
    } else {
      console.log(`FAIL: no-auth -> ${res.status} (expected 401)`);
      failed++;
    }
  } catch (e) {
    console.log('FAIL: no-auth request threw:', e.message);
    failed++;
  }

  // Test 2: anon key only
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body,
    });
    if (res.status === 401) {
      console.log('PASS: anon-key -> 401');
      passed++;
    } else {
      console.log(`FAIL: anon-key -> ${res.status} (expected 401)`);
      failed++;
    }
  } catch (e) {
    console.log('FAIL: anon-key request threw:', e.message);
    failed++;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
