#!/usr/bin/env node
/**
 * Splits Foundry VTT NDJSON .db files into individual JSON files per document.
 * This is the source format required by the Foundry VTT CLI for packing into LevelDB.
 * 
 * Usage:
 *   node tools/split-ndjson.cjs [packName]
 * 
 * Examples:
 *   node tools/split-ndjson.cjs                   # Splits all packs
 *   node tools/split-ndjson.cjs specializations   # Splits only specializations
 * 
 * Output:
 *   tools/src/<packName>/<document-name>.json
 */

const fs = require('fs');
const path = require('path');

const toolsDir = __dirname;
const packsDir = path.resolve(toolsDir, '..', 'packs');
const srcDir = path.resolve(toolsDir, 'src');

// Map of NDJSON .db files to their pack names
const PACK_MAP = [
  { db: 'specializations.db', name: 'specializations' },
  { db: 'talents.db',         name: 'talents' },
  { db: 'careers.db',         name: 'careers' },
  { db: 'species.db',         name: 'species' },
  { db: 'skills.db',          name: 'skills' },
  { db: 'adversaries.db',     name: 'adversaries' },
  { db: 'critical-injuries.db',          name: 'critical-injuries' },
  { db: 'critical-injuries-vehicles.db', name: 'critical-injuries-vehicles' },
];

function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
}

function splitPack(packName, dbFileName) {
  const dbFilePath = path.join(packsDir, dbFileName);

  if (!fs.existsSync(dbFilePath)) {
    console.warn(`⚠ Skipping ${packName}: Source file not found at ${dbFilePath}`);
    return 0;
  }

  const destDir = path.join(srcDir, packName);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const lines = fs.readFileSync(dbFilePath, 'utf-8')
    .split('\n')
    .filter(l => l.trim());

  let count = 0;
  const seen = new Map();

  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (!doc._id) continue;

      let fileName = sanitizeName(doc.name || doc._id);
      // Ensure unique filenames
      if (seen.has(fileName)) {
        seen.set(fileName, seen.get(fileName) + 1);
        fileName = `${fileName}_${seen.get(fileName)}`;
      } else {
        seen.set(fileName, 1);
      }

      fs.writeFileSync(
        path.join(destDir, `${fileName}.json`),
        JSON.stringify(doc, null, 2),
        'utf-8'
      );
      count++;
    } catch (e) {
      console.warn(`  ⚠ Failed to parse: ${line.substring(0, 60)}`);
    }
  }

  return count;
}

const targetPack = process.argv[2];
const packs = targetPack
  ? PACK_MAP.filter(p => p.name === targetPack)
  : PACK_MAP;

if (targetPack && packs.length === 0) {
  console.error(`❌ Pack "${targetPack}" not found.`);
  console.log('Available:', PACK_MAP.map(p => p.name).join(', '));
  process.exit(1);
}

console.log(`📂 Splitting ${packs.length} pack(s) into JSON source files...\n`);
for (const pack of packs) {
  const count = splitPack(pack.name, pack.db);
  console.log(`  ✅ ${pack.name}: ${count} documents → tools/src/${pack.name}/`);
}
console.log('\nDone! Now run: fvtt package pack for each pack directory.');
