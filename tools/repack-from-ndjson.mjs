/**
 * Repacks Foundry VTT NDJSON .db files into LevelDB (ClassicLevel) directories.
 * Used to fix pack data after Foundry V13 migration (from NeDB to ClassicLevel).
 * Embedded documents (actor items, table results, effects) are written as separate keys.
 * 
 * Usage:
 *   node tools/repack-from-ndjson.mjs [packName]
 * 
 * Examples:
 *   node tools/repack-from-ndjson.mjs               # Repacks all packs
 *   node tools/repack-from-ndjson.mjs specializations  # Repacks only specializations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClassicLevel } from 'classic-level';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(__dirname, '..', 'packs');

// Map of NDJSON .db files to their LevelDB directory names
const PACK_MAP = [
  { db: 'specializations.db', dir: 'specializations' },
  { db: 'talents.db', dir: 'talents' },
  { db: 'careers.db', dir: 'careers' },
  { db: 'species.db', dir: 'species' },
  { db: 'skills.db', dir: 'skills' },
  { db: 'adversaries.db', dir: 'adversaries' },
  { db: 'critical-injuries.db', dir: 'critical-injuries' },
  { db: 'critical-injuries-vehicles.db', dir: 'critical-injuries-vehicles' },
  { db: 'armor.db', dir: 'armor' },
  { db: 'gear.db', dir: 'gear' },
  { db: 'attachments.db', dir: 'attachments' },
  { db: 'weapons.db', dir: 'weapons' },
];

async function repackSingle(packName, dbFileName) {
  const dbFilePath = path.join(packsDir, dbFileName);
  const leveldbDir = path.join(packsDir, packName);

  if (!fs.existsSync(dbFilePath)) {
    console.warn(`⚠ Skipping ${packName}: Source file not found at ${dbFilePath}`);
    return;
  }

  console.log(`\n📦 Repacking "${packName}" from ${dbFileName}...`);
  const documentName = PACK_TYPES[packName];
  if (!COLLECTIONS[documentName]) throw new Error(`Unsupported pack type "${documentName}" for ${packName}`);

  // Read NDJSON source
  const lines = fs.readFileSync(dbFilePath, 'utf-8')
    .split('\n')
    .filter(l => l.trim());

  const documents = [];
  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (doc._id) {
        documents.push(doc);
      }
    } catch (e) {
      console.warn(`  ⚠ Failed to parse line: ${line.substring(0, 80)}`);
    }
  }

  console.log(`  📄 Found ${documents.length} documents to write`);

  // Remove existing LevelDB directory
  if (fs.existsSync(leveldbDir)) {
    fs.rmSync(leveldbDir, { recursive: true, force: true });
    console.log(`  🗑  Cleared existing LevelDB at ${leveldbDir}`);
  }
  fs.mkdirSync(leveldbDir, { recursive: true });

  // Write to ClassicLevel DB

  const db = new ClassicLevel(leveldbDir, { keyEncoding: 'utf8', valueEncoding: 'json' });
  await db.open();

  try {
    const batch = db.batch();
    const embeddedCounts = {};
    for (const doc of documents) {
      for (const [key, value] of toLevelEntries(documentName, doc, embeddedCounts)) batch.put(key, value);
    }
    await batch.write();
    const embedded = Object.entries(embeddedCounts).map(([k, n]) => `${n} ${k}`).join(', ');
    console.log(`  ✅ Written ${documents.length} ${documentName} documents${embedded ? ` + ${embedded}` : ''} to LevelDB`);
  } finally {
    await db.close();
  }
}

/** Primary collection and embedded collections per document type (Foundry V14 LevelDB layout). */
const COLLECTIONS = {
  Actor: { collection: 'actors', embedded: ['items', 'effects'] },
  Item: { collection: 'items', embedded: ['effects'] },
  RollTable: { collection: 'tables', embedded: ['results'] },
};

/** Pack name -> document type, as declared in system.json. */
const PACK_TYPES = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'system.json'), 'utf-8')).packs.map(p => [p.name, p.type])
);

/**
 * Splits a document into its LevelDB entries.
 * Foundry V14 stores embedded documents as separate keys; the parent only keeps their IDs:
 *   - `!actors!<actorId>`                     -> { ..., items: [itemId, ...] }
 *   - `!actors.items!<actorId>.<itemId>`      -> embedded item
 *   - `!tables.results!<tableId>.<resultId>`  -> table result
 */
function toLevelEntries(documentName, doc, embeddedCounts) {
  const { collection, embedded } = COLLECTIONS[documentName];
  const parent = { ...doc };
  const entries = [];

  for (const field of embedded) {
    const children = Array.isArray(doc[field]) ? doc[field] : [];
    parent[field] = children.map(child => child._id);
    for (const child of children) {
      const data = documentName === 'RollTable' ? migrateLegacyTableResult(child) : child;
      entries.push([`!${collection}.${field}!${doc._id}.${child._id}`, data]);
    }
    if (children.length) embeddedCounts[field] = (embeddedCounts[field] || 0) + children.length;
  }

  entries.unshift([`!${collection}!${doc._id}`, parent]);
  return entries;
}

/**
 * Converts a pre-V10 table result (`type: 0`, `text`) to the V13+ schema (`type: "text"`, `description`).
 */
function migrateLegacyTableResult(result) {
  const data = { ...result };
  if (data.type === 0) data.type = 'text';
  else if (typeof data.type === 'number') console.warn(`  ⚠ Table result ${data._id} has unsupported legacy type ${data.type}`);
  if ('text' in data) {
    if (data.type === 'text') data.description ??= data.text;
    else data.name ??= data.text;
    delete data.text;
  }
  data.name ??= '';
  return data;
}

async function main() {
  const targetPack = process.argv[2]; // Optional: specific pack name

  const packs = targetPack
    ? PACK_MAP.filter(p => p.dir === targetPack)
    : PACK_MAP;

  if (targetPack && packs.length === 0) {
    console.error(`❌ Pack "${targetPack}" not found in PACK_MAP.`);
    console.log('Available packs:', PACK_MAP.map(p => p.dir).join(', '));
    process.exit(1);
  }

  console.log(`🚀 Repacking ${packs.length} pack(s) from NDJSON to LevelDB...`);

  for (const pack of packs) {
    try {
      await repackSingle(pack.dir, pack.db);
    } catch (err) {
      console.error(`  ❌ Error repacking ${pack.dir}:`, err.message);
    }
  }

  console.log('\n✅ Repacking complete! Restart Foundry VTT to load the updated data.');
}

main();
