/**
 * Extracts plain facts (homeworld, language, common professions, Wookieepedia link) from saved
 * EotE SRD species pages into tools/data-srd/species-facts.json. No descriptive prose is copied.
 * The SRD site (sw-eote-srd.vercel.app) is offline since 2026-10; the pages were saved in June 2026.
 *
 * Usage: node tools/extract-srd-species-facts.mjs <dir-with-saved-pages>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = process.argv[2];
if (!pagesDir || !fs.existsSync(pagesDir)) {
  console.error('Usage: node tools/extract-srd-species-facts.mjs <dir-with-saved-pages>');
  process.exit(1);
}

const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
const text = (html) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([,)])/g, '$1').trim();

const facts = {};
for (const file of fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).sort()) {
  const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const title = text(html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ?? '');
  const field = (label) => {
    const m = html.match(new RegExp(`<p[^>]*>${label}:\\s*([\\s\\S]*?)</p>`, 'i'));
    return m ? text(m[1]) : '';
  };
  facts[title] = {
    homeworld: field('Homeworld'),
    language: field('Language'),
    professions: field('Common\\s+Professions'),
    wookieepedia: decode(html.match(/Wookiepedia Link:<\/strong>\s*<a[^>]*href="([^"]+)"/i)?.[1] ?? '')
  };
}

const out = path.join(__dirname, 'data-srd', 'species-facts.json');
fs.writeFileSync(out, JSON.stringify(facts, null, 2) + '\n');
console.log(`SWFFG | [SpeciesFacts] ${Object.keys(facts).length} species written to ${out}`);
