/**
 * Generates locale JSON files from en.json using Google Translate (unofficial API).
 * Run from mobile/: node scripts/translate-locales.mjs
 */
import { translate } from '@vitalets/google-translate-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/locales');

const TARGETS = [
  ['es', 'es'],
  ['fr', 'fr'],
  ['de', 'de'],
  ['ru', 'ru'],
  ['ja', 'ja'],
  ['zh', 'zh-CN'],
  ['hi', 'hi'],
  ['ar', 'ar'],
];

const SKIP_EXACT = new Set(['MenuBank']);

function protectInterpolations(s) {
  const ph = [];
  const out = s.replace(/\{\{[^}]+\}\}/g, (m) => {
    const i = ph.length;
    ph.push(m);
    return `@@PH${i}@@`;
  });
  return { out, ph };
}

function restoreInterpolations(s, ph) {
  return s.replace(/@@PH(\d+)@@/g, (_, i) => ph[Number(i)] ?? '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateString(str, to) {
  if (!str || typeof str !== 'string') return str;
  const t = str.trim();
  if (SKIP_EXACT.has(str) || SKIP_EXACT.has(t)) return str;
  if (/^https?:\/\//i.test(t)) return str;
  if (t.startsWith('ca-app-pub-')) return str;
  const { out, ph } = protectInterpolations(str);
  await sleep(100);
  const { text } = await translate(out, { to });
  return restoreInterpolations(text, ph);
}

async function walk(obj, to) {
  if (typeof obj === 'string') {
    return translateString(obj, to);
  }
  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
      arr.push(await walk(item, to));
    }
    return arr;
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = await walk(obj[k], to);
    }
    return out;
  }
  return obj;
}

const enPath = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

for (const [file, googleTo] of TARGETS) {
  console.error('Translating', file, '→', googleTo);
  const copy = JSON.parse(JSON.stringify(en));
  const translated = await walk(copy, googleTo);
  fs.writeFileSync(path.join(localesDir, `${file}.json`), `${JSON.stringify(translated, null, 2)}\n`, 'utf8');
  console.error('Wrote', `${file}.json`);
}
