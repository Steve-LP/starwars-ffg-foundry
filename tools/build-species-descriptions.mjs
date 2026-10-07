/**
 * Replaces species descriptions that only point to a rulebook page ("Please see page 51 of ...")
 * with a short facts block: homeworld, language, common professions (from saved SRD pages),
 * the original source reference and a Wookieepedia link. No rulebook prose is copied.
 *
 * Inputs:  packs/species.db, tools/data-srd/species-facts.json, tools/data-srd/species-links.json
 * Output:  packs/species.db (in place). Afterwards repack with Foundry stopped:
 *          node tools/repack-from-ndjson.mjs species
 *
 * Usage:   node tools/build-species-descriptions.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'packs', 'species.db');
const facts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-srd', 'species-facts.json'), 'utf8'));
const { links } = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-srd', 'species-links.json'), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

const MARKER = 'swffg-species-facts';
const REFERENCE = /(?:please\s+)?see\s+(page\s+\d+[\s\S]*?)\s*,?\s*for details\.?/i;

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Source reference of a reference-only or previously generated description, or null. */
function extractSource(description) {
  const generated = description.match(new RegExp(`data-source="([^"]*)"`));
  if (description.includes(MARKER) && generated) return generated[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const plain = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.match(REFERENCE)?.[1].trim() ?? null;
}

function buildDescription(name, source) {
  const f = facts[name];
  const link = f?.wookieepedia || links[name];
  const lines = [];
  if (f) {
    if (f.homeworld) lines.push(`<strong>Heimatwelt:</strong> ${escapeHtml(f.homeworld)}`);
    if (f.language) lines.push(`<strong>Sprache:</strong> ${escapeHtml(f.language)}`);
    if (f.professions) lines.push(`<strong>Typische Berufe:</strong> ${escapeHtml(f.professions)}`);
  }
  return [
    `<div class="${MARKER}" data-source="${escapeHtml(source)}">`,
    `<h4>${escapeHtml(name)}</h4>`,
    lines.length ? `<p>${lines.join('<br>')}</p>` : '',
    `<p><strong>Quelle:</strong> ${escapeHtml(source.charAt(0).toUpperCase() + source.slice(1))}</p>`,
    link ? `<p><a href="${escapeHtml(link)}">Wookieepedia: ${escapeHtml(name)}</a></p>` : '',
    `</div>`
  ].filter(Boolean).join('');
}

const docs = fs.readFileSync(dbPath, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
let changed = 0, withFacts = 0;
const withoutLink = [];
for (const doc of docs) {
  const description = doc.system?.description || '';
  const source = extractSource(description);
  if (!source) continue;
  doc.system.description = buildDescription(doc.name, source);
  changed++;
  if (facts[doc.name]) withFacts++;
  if (!facts[doc.name]?.wookieepedia && !links[doc.name]) withoutLink.push(doc.name);
}

if (!dryRun) fs.writeFileSync(dbPath, docs.map(d => JSON.stringify(d)).join('\n') + '\n');
console.log(`SWFFG | [SpeciesDescriptions] ${dryRun ? '(dry run) ' : ''}${changed} descriptions rebuilt, ${withFacts} with SRD facts`);
if (withoutLink.length) console.warn(`SWFFG | [SpeciesDescriptions] no Wookieepedia link: ${withoutLink.join(', ')}`);
