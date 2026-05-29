/**
 * Node.js Compiler script to parse Stoogoff SW-Adversaries JSON files
 * and output a Foundry VTT compatible flat database compendium file.
 * 
 * Usage:
 * 1. Download/copy JSON files from 'src/media/data/adversaries' of sw-adversaries repo.
 * 2. Save them in 'tools/data-stoogoff/' folder.
 * 3. Run: node tools/compile-stoogoff.js
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'data-stoogoff');
const destDir = path.join(__dirname, '..', 'packs');
const destFile = path.join(destDir, 'adversaries.db');

// Ensure directories exist
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
  console.log(`Created input data directory at: ${srcDir}`);
  console.log("Please copy the adversary JSON files into this directory and run the script again.");
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Generate unique ID helper
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
const outputLines = [];

console.log(`Found ${files.length} JSON files to parse...`);

for (const file of files) {
  const filePath = path.join(srcDir, file);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  let adversaries = [];

  try {
    const parsed = JSON.parse(rawData);
    adversaries = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`Error parsing JSON file ${file}:`, err.message);
    continue;
  }

  for (const adv of adversaries) {
    if (!adv.name) continue;

    // Detect Actor Type (Minion, Rival, Nemesis)
    // FFG classifies Rivals and Nemeses both as NPCs, Minions as Minions.
    let type = "npc";
    const sourceString = (adv.type || adv.derived_type || "").toLowerCase();
    if (sourceString.includes("minion")) {
      type = "minion";
    }

    // Build the Foundry Actor document representation
    const actorDoc = {
      _id: generateId(),
      name: adv.name,
      type: type,
      img: "icons/svg/mystery-man.svg",
      system: {
        characteristics: {
          brawn: { value: adv.characteristics?.brawn || 2 },
          agility: { value: adv.characteristics?.agility || 2 },
          intellect: { value: adv.characteristics?.intellect || 2 },
          cunning: { value: adv.characteristics?.cunning || 2 },
          willpower: { value: adv.characteristics?.willpower || 2 },
          presence: { value: adv.characteristics?.presence || 2 }
        },
        stats: {
          wounds: { value: 0, max: adv.wound_threshold || 10 },
          strain: { value: 0, max: adv.strain_threshold || 10 },
          soak: { value: adv.soak || 0 },
          defence: {
            melee: adv.defense?.melee || 0,
            ranged: adv.defense?.ranged || 0
          }
        },
        biography: {
          description: adv.description || adv.background || ""
        }
      },
      items: [], // Expandable dynamically to hold weapon items or custom talents
      effects: [],
      flags: {},
      ownership: {
        default: 0
      }
    };

    // Parse weapons if any
    if (Array.isArray(adv.weapons)) {
      for (const w of adv.weapons) {
        actorDoc.items.push({
          _id: generateId(),
          name: w.name || "Weapon",
          type: "weapon",
          system: {
            damage: w.damage || 0,
            critical: w.critical || 0,
            range: w.range || "Engaged",
            skill: w.skill || "Ranged-Light",
            qualities: Array.isArray(w.qualities) ? w.qualities.join(', ') : (w.qualities || "")
          }
        });
      }
    }

    // Parse talents if any
    if (Array.isArray(adv.talents)) {
      for (const t of adv.talents) {
        actorDoc.items.push({
          _id: generateId(),
          name: t.name || "Talent",
          type: "talent",
          system: {
            description: t.description || "",
            activation: t.activation || "Passive",
            tier: 1,
            ranked: false
          }
        });
      }
    }

    // Convert document to single-line JSON representation for Foundry NeDB DB format
    outputLines.push(JSON.stringify(actorDoc));
  }
}

if (outputLines.length > 0) {
  fs.writeFileSync(destFile, outputLines.join('\n') + '\n', 'utf-8');
  console.log(`Successfully compiled ${outputLines.length} adversaries into: ${destFile}`);
} else {
  console.log("No adversaries compiled. Please ensure you copied files with correct properties inside 'tools/data-stoogoff/'");
}
