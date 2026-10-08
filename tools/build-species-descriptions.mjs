/**
 * Builds a uniform description for every species:
 *   heading · facts (homeworld, language, common professions — where saved SRD facts exist)
 *   · source reference(s) · Wookieepedia link · descriptive text from the OggDude data (if any).
 *
 * Everything is generated from source data, so the tool can be re-run at any time:
 *   tools/data-oggdude/Species/*.xml     sources + description (BBCode, via formatOggdudeDescription)
 *   tools/data-srd/species-facts.json    homeworld / language / professions / Wookieepedia link
 *   tools/data-srd/species-links.json    Wookieepedia links for all other species
 *
 * Output:  packs/species.db (in place). Afterwards repack with Foundry stopped:
 *          node tools/repack-from-ndjson.mjs species
 *
 * Usage:   node tools/build-species-descriptions.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatOggdudeDescription } from '../module/oggdude-importer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'packs', 'species.db');
const xmlDir = path.join(__dirname, 'data-oggdude', 'Species');
const facts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-srd', 'species-facts.json'), 'utf8'));
const { links } = JSON.parse(fs.readFileSync(path.join(__dirname, 'data-srd', 'species-links.json'), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plainText = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** name -> { sources: [{book, page}], text: html } from the OggDude species XML */
const oggdude = {};
for (const file of fs.readdirSync(xmlDir).filter(f => f.endsWith('.xml'))) {
  const xml = fs.readFileSync(path.join(xmlDir, file), 'utf8').replace(/^﻿/, '');
  const name = decodeXml(xml.match(/<Name>([^<]+)<\/Name>/)?.[1] ?? '').trim();
  const sources = [...xml.matchAll(/<Source(?: Page="(\d+)")?>([^<]+)<\/Source>/g)]
    .map(([, page, book]) => ({ book: decodeXml(book).trim(), page }));
  let text = formatOggdudeDescription(decodeXml(xml.match(/<Description>([\s\S]*?)<\/Description>/)?.[1] ?? ''));
  text = text.replace(/^<h[34]>[\s\S]*?<\/h[34]>/, '');
  // A bare "Please see page X of ... for details." adds nothing next to the source line
  if (/^(please\s+)?see\s+page\s+\d+[\s\S]*for details\.?$/i.test(plainText(text))) text = '';
  oggdude[name] = { sources, text };
}

function buildDescription(name) {
  const f = facts[name];
  const link = f?.wookieepedia || links[name];
  const sources = oggdude[name]?.sources ?? [];
  const factLines = [
    ['Heimatwelt', f?.homeworld], ['Sprache', f?.language], ['Typische Berufe', f?.professions]
  ].filter(([, value]) => value).map(([label, value]) => `<strong>${label}:</strong> ${escapeHtml(value)}`);
  const sourceText = sources.map(s => `${escapeHtml(s.book)}${s.page ? `, S. ${s.page}` : ''}`).join('; ');
  const text = oggdude[name]?.text;

  return [
    `<div class="swffg-species-facts">`,
    `<h4>${escapeHtml(name)}</h4>`,
    factLines.length ? `<p>${factLines.join('<br>')}</p>` : '',
    sourceText ? `<p><strong>Quelle:</strong> ${sourceText}</p>` : '',
    link ? `<p><a href="${escapeHtml(link)}">Wookieepedia: ${escapeHtml(name)}</a></p>` : '',
    `</div>`,
    text ? `<div class="swffg-species-text">${text}</div>` : ''
  ].filter(Boolean).join('');
}

const docs = fs.readFileSync(dbPath, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const stats = { total: docs.length, withFacts: 0, withText: 0, withoutSource: [], withoutLink: [], withoutOggdude: [] };
for (const doc of docs) {
  if (!oggdude[doc.name]) stats.withoutOggdude.push(doc.name);
  doc.system.description = buildDescription(doc.name);
  if (facts[doc.name]) stats.withFacts++;
  if (oggdude[doc.name]?.text) stats.withText++;
  if (!oggdude[doc.name]?.sources.length) stats.withoutSource.push(doc.name);
  if (!(facts[doc.name]?.wookieepedia || links[doc.name])) stats.withoutLink.push(doc.name);
}

if (!dryRun) fs.writeFileSync(dbPath, docs.map(d => JSON.stringify(d)).join('\n') + '\n');
console.log(`SWFFG | [SpeciesDescriptions] ${dryRun ? '(dry run) ' : ''}${stats.total} descriptions built: ` +
  `${stats.withFacts} with SRD facts, ${stats.withText} with descriptive text`);
for (const key of ['withoutOggdude', 'withoutSource', 'withoutLink']) {
  if (stats[key].length) console.warn(`SWFFG | [SpeciesDescriptions] ${key}: ${stats[key].join(', ')}`);
}
