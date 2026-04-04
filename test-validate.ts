import { validateMenuUrl } from './supabase/functions/_shared/validateMenuUrl.ts';

async function test() {
  const tests = [
    'https://qrmenu.com/some/cafe', // Positive words like "qr" and "menu"
    'http://localhost:3000/menu',   // SSRF reject
    'javascript:alert(1)',          // Bad scheme reject
    'https://instagram.com/p/123',  // Social domain but maybe fine? (Score penalised)
    'https://www.example.com/bad-casino-link', // Reject keyword
  ];

  for (const url of tests) {
    const res = await validateMenuUrl(url);
    console.log(`[${res.action.toUpperCase()}] ${url} -> ${res.reason}`);
  }
}

test();
