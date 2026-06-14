const fs = require('fs');
const path = require('path');

const specsFile = path.join(__dirname, '..', 'packs', 'specializations.db');
const talentsFile = path.join(__dirname, '..', 'packs', 'talents.db');

function loadJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error(`Error parsing line ${idx + 1} in ${filePath}:`, e.message);
        return null;
      }
    })
    .filter(Boolean);
}

function verify() {
  console.log('--- SWFFG Talent Database Verification ---');
  
  const specs = loadJsonlFile(specsFile);
  const talents = loadJsonlFile(talentsFile);

  console.log(`Loaded ${specs.length} specializations.`);
  console.log(`Loaded ${talents.length} talents.`);

  // Map talents by key
  const talentMap = new Map();
  for (const talent of talents) {
    const key = talent.system?.key?.toLowerCase();
    if (key) {
      talentMap.set(key, talent);
    }
  }

  let totalSpecsChecked = 0;
  let totalMissingTalents = 0;
  const missingBySpec = {};

  for (const spec of specs) {
    totalSpecsChecked++;
    const specName = spec.name;
    const rows = spec.system?.talentRows || [];
    const missingInThisSpec = new Set();

    for (const row of rows) {
      const rowTalents = row.talents || [];
      for (const talentKey of rowTalents) {
        if (!talentKey) continue;
        const normalizedKey = talentKey.toLowerCase();
        if (!talentMap.has(normalizedKey)) {
          missingInThisSpec.add(talentKey);
          totalMissingTalents++;
        }
      }
    }

    if (missingInThisSpec.size > 0) {
      missingBySpec[specName] = Array.from(missingInThisSpec);
    }
  }

  console.log('\n--- Verification Results ---');
  console.log(`Checked ${totalSpecsChecked} specializations.`);
  
  if (totalMissingTalents === 0) {
    console.log('✅ Success: All referenced talents exist in the talents database!');
  } else {
    console.log(`❌ Found ${totalMissingTalents} missing talent references across the trees:\n`);
    for (const [specName, missing] of Object.entries(missingBySpec)) {
      console.log(`Specialization: "${specName}"`);
      console.log(`  Missing keys: ${missing.join(', ')}`);
    }
  }
}

verify();
