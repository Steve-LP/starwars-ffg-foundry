/**
 * Repacks Foundry VTT NDJSON .db files into LevelDB (ClassicLevel) directories.
 * Used to fix pack data after Foundry V13 migration (from NeDB to ClassicLevel).
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
    for (const doc of documents) {
      const key = `!${doc.type === 'Actor' ? 'actors' : 'items'}!${doc._id}`;
      // For specializations, talents, etc. use '!items!' prefix
      // For adversaries (Actors), use '!actors!' prefix
      const actualKey = determineKey(doc);
      batch.put(actualKey, doc);
    }
    await batch.write();
    console.log(`  ✅ Written ${documents.length} documents to LevelDB`);
  } finally {
    await db.close();
  }
}

/**
 * Determines the correct LevelDB key for a Foundry document.
 * Foundry V13 uses keys like:
 *   - Items: `!items!<id>`
 *   - Actors: `!actors!<id>`
 */
function determineKey(doc) {
  if (doc.type === 'character' || doc.type === 'npc' || doc.type === 'minion') {
    return `!actors!${doc._id}`;
  }
  return `!items!${doc._id}`;
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
