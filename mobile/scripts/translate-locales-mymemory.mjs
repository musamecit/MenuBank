/**
 * Fills locale JSON from en.json via MyMemory Translate API (free tier).
 * Run: node scripts/translate-locales-mymemory.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/locales');

const TARGET_LANGPAIRS = [
  ['es', 'en|es'],
  ['fr', 'en|fr'],
  ['de', 'en|de'],
  ['ru', 'en|ru'],
  ['ja', 'en|ja'],
  ['zh', 'en|zh-CN'],
  ['hi', 'en|hi'],
  ['ar', 'en|ar'],
];

const SKIP = new Set(['MenuBank']);

function flattenStrings(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([p, v]);
    else if (v && typeof v === 'object' && !Array.isArray(v)) flattenStrings(v, p, out);
  }
  return out;
}

function setDeep(root, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function protect(s) {
  const ph = [];
  const out = s.replace(/\{\{[^}]+\}\}/g, (m) => {
    const i = ph.length;
    ph.push(m);
    return ` @@P${i}@@ `;
  });
  return { out, ph };
}

function restore(s, ph) {
  return s.replace(/\s*@@P(\d+)@@\s*/g, (_, i) => ph[Number(i)] ?? '');
}

async function translateText(text, langpair) {
  const t = text.trim();
  if (!t) return text;
  if (SKIP.has(text) || SKIP.has(t)) return text;
  if (/^https?:\/\//i.test(t)) return text;
  if (t.startsWith('ca-app-pub-')) return text;

  const { out, ph } = protect(text);
  const maxChunk = 450;
  const chunks = [];
  let rest = out;
  while (rest.length > maxChunk) {
    let cut = rest.lastIndexOf(' ', maxChunk);
    if (cut < maxChunk / 2) cut = maxChunk;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length) chunks.push(rest);

  const translatedChunks = [];
  for (const ch of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(ch)}&langpair=${langpair}`;
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await sleep(350 + attempt * 200);
        const res = await fetch(url);
        const data = await res.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          translatedChunks.push(data.responseData.translatedText);
          lastErr = null;
          break;
        }
        lastErr = new Error(data.responseDetails || 'translate failed');
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
  }
  const merged = translatedChunks.join(' ');
  return restore(merged, ph);
}

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

for (const [code, langpair] of TARGET_LANGPAIRS) {
  console.error('===', code, langpair, '===');
  const pairs = flattenStrings(en);
  const out = JSON.parse(JSON.stringify(en));
  let i = 0;
  for (const [dotPath, str] of pairs) {
    i += 1;
    process.stderr.write(`\r${code} ${i}/${pairs.length}`);
    try {
      const tr = await translateText(str, langpair);
      setDeep(out, dotPath, tr);
    } catch (e) {
      console.error(`\nfail ${dotPath}:`, e.message);
      setDeep(out, dotPath, str);
    }
  }
  console.error('');
  fs.writeFileSync(path.join(localesDir, `${code}.json`), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}
