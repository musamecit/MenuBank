/**
 * Fills locale JSON from en.json via Lingva. Optional arg: language code only (e.g. ru).
 * Run: node scripts/translate-lingva.mjs
 *      node scripts/translate-lingva.mjs ru
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/locales');

const ALL_TARGETS = [
  ['de', 'de'],
  ['ru', 'ru'],
  ['ja', 'ja'],
  ['zh', 'zh'],
  ['hi', 'hi'],
  ['ar', 'ar'],
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
    return `__PH${i}__`;
  });
  return { out, ph };
}

function restore(s, ph) {
  return s.replace(/__PH(\d+)__/g, (_, i) => ph[Number(i)] ?? '');
}

const cache = new Map();

async function lingva(text, target) {
  const t = text.trim();
  if (!t) return text;
  if (SKIP.has(text) || SKIP.has(t)) return text;
  if (/^https?:\/\//i.test(t)) return text;
  if (t.startsWith('ca-app-pub-')) return text;

  const { out, ph } = protect(text);
  const key = `${target}::${out}`;
  if (cache.has(key)) return restore(cache.get(key), ph);

  const max = 160;
  const parts = [];
  let rest = out;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max / 3) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length) parts.push(rest);

  const trParts = [];
  for (const seg of parts) {
    const url = `https://lingva.ml/api/v1/en/${target}/${encodeURIComponent(seg)}`;
    let translated = null;
    for (let a = 0; a < 12; a++) {
      try {
        await sleep(550 + a * 200);
        const res = await fetch(url);
        if (res.status === 429 || res.status === 503) {
          await sleep(12000 + a * 3000);
          continue;
        }
        if (!res.ok) {
          if (res.status === 404) break;
          await sleep(3000);
          continue;
        }
        const data = await res.json();
        if (typeof data.translation !== 'string') {
          await sleep(2000);
          continue;
        }
        translated = data.translation;
        break;
      } catch {
        await sleep(4000);
      }
    }
    if (translated == null) throw new Error('translate failed');
    trParts.push(translated);
  }
  const merged = trParts.join(' ');
  cache.set(key, merged);
  return restore(merged, ph);
}

const only = process.argv[2]?.toLowerCase();
const TARGETS = only ? ALL_TARGETS.filter(([c]) => c === only) : ALL_TARGETS;
if (TARGETS.length === 0) {
  console.error('Unknown language:', only);
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

for (const [code, lingvaTarget] of TARGETS) {
  console.error('===', code, '===');
  const pairs = flattenStrings(en);
  const valueToPaths = new Map();
  for (const [dotPath, str] of pairs) {
    if (!valueToPaths.has(str)) valueToPaths.set(str, []);
    valueToPaths.get(str).push(dotPath);
  }
  const unique = [...valueToPaths.keys()];
  let i = 0;
  const translatedByValue = new Map();
  for (const str of unique) {
    i += 1;
    process.stderr.write(`\r${code} ${i}/${unique.length}`);
    try {
      const tr = await lingva(str, lingvaTarget);
      translatedByValue.set(str, tr);
    } catch (e) {
      console.error(`\nfail "${String(str).slice(0, 50)}...":`, e.message);
      translatedByValue.set(str, str);
    }
  }
  console.error('');
  const out = JSON.parse(JSON.stringify(en));
  for (const [str, paths] of valueToPaths) {
    const tr = translatedByValue.get(str) ?? str;
    for (const dotPath of paths) setDeep(out, dotPath, tr);
  }
  fs.writeFileSync(path.join(localesDir, `${code}.json`), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}
