const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'packs', 'species.db');

const slugs = [
  'aqualish',   'arcona',      'besalisk',
  'bothan',     'chevin',      'chiss',
  'clawdite',   'devaronian',  'droid',
  'dug',        'duros',       'falleen',
  'gand',       'gotal',       'gran',
  'human',      'kalleran',    'klatooinian',
  'mirialan',   'mustafarian', 'quarren',
  'rodian',     'togruta',     'toydarian',
  'trandoshan', 'twilek',      'weequay',
  'wookiee'
];

const slugToNameMap = {
  'aqualish': 'Aqualish',
  'arcona': 'Arcona',
  'besalisk': 'Besalisk',
  'bothan': 'Bothan',
  'chevin': 'Chevin',
  'chiss': 'Chiss',
  'clawdite': 'Clawdite',
  'devaronian': 'Devaronian',
  'droid': 'Droid',
  'dug': 'Dug',
  'duros': 'Duros',
  'falleen': 'Falleen',
  'gand': 'Gand',
  'gotal': 'Gotal',
  'gran': 'Gran',
  'human': 'Human',
  'kalleran': 'Kalleran',
  'klatooinian': 'Klatooinian',
  'mirialan': 'Mirialan',
  'mustafarian': 'Mustafarian',
  'quarren': 'Quarren',
  'rodian': 'Rodian',
  'togruta': 'Togruta',
  'toydarian': 'Toydarians',
  'trandoshan': 'Trandoshan',
  'twilek': "Twi'lek",
  'weequay': 'Weequay',
  'wookiee': 'Wookiee'
};

function runVerification() {
  console.log("Loading species.db for verification...");
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database file not found at: ${dbPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(dbPath, 'utf8');
  const lines = content.trim().split('\n');
  const docs = lines.map(line => JSON.parse(line));
  console.log(`Loaded ${docs.length} species records.`);

  // Let's verify Twi'lek specifically
  const twilek = docs.find(d => d.name === "Twi'lek");
  if (!twilek) {
    console.error("ERROR: Twi'lek entry not found in database!");
    process.exit(1);
  }

  console.log("\n=== Twi'lek Verification ===");
  console.log(`Name: ${twilek.name}`);
  console.log(`Type: ${twilek.type}`);
  
  // Attributes
  const chars = twilek.system.characteristics;
  const charStr = `Brawn ${chars.brawn.value}, Agility ${chars.agility.value}, Intellect ${chars.intellect.value}, Cunning ${chars.cunning.value}, Willpower ${chars.willpower.value}, Presence ${chars.presence.value}`;
  console.log(`Characteristics: ${charStr}`);
  
  // Thresholds & XP
  console.log(`Wounds Base: ${twilek.system.wounds?.base} (Expect: 10)`);
  console.log(`Strain Base: ${twilek.system.strain?.base} (Expect: 11)`);
  console.log(`Starting XP: ${twilek.system.xp} (Expect: 100)`);
  
  // Special Abilities
  console.log(`Special Abilities: ${twilek.system.specialAbilities}`);
  
  // Description
  console.log(`Description:\n${twilek.system.description}`);

  // Assertions
  let passed = true;
  if (chars.brawn.value !== 1 || chars.presence.value !== 3) {
    console.error("FAIL: Characteristics do not match (Expect Brawn 1, Presence 3)!");
    passed = false;
  }
  if (twilek.system.wounds?.base !== 10 || twilek.system.strain?.base !== 11) {
    console.error("FAIL: Thresholds do not match (Expect Wounds 10, Strain 11)!");
    passed = false;
  }
  if (twilek.system.xp !== 100) {
    console.error("FAIL: Starting XP does not match 100!");
    passed = false;
  }
  if (!twilek.system.description.includes("Wookiepedia Link")) {
    console.error("FAIL: Description does not contain Wookieepedia link!");
    passed = false;
  }
  if (!twilek.system.specialAbilities.includes("Charm or Deception")) {
    console.error("FAIL: Special abilities do not contain Charm or Deception choices!");
    passed = false;
  }

  // Check another random placeholder species to ensure it was updated
  const wookiee = docs.find(d => d.name === "Wookiee");
  console.log("\n=== Wookiee Verification ===");
  console.log(`Description:\n${wookiee.system.description}`);
  console.log(`Wounds Base: ${wookiee.system.wounds?.base} (Expect: 14)`);
  console.log(`Strain Base: ${wookiee.system.strain?.base} (Expect: 8)`);
  console.log(`Starting XP: ${wookiee.system.xp} (Expect: 90)`);
  if (wookiee.system.description.includes("Please see page")) {
    console.error("FAIL: Wookiee description is still a placeholder!");
    passed = false;
  }

  // Check Sullustan (not in SRD) to ensure description was preserved and untouched
  const sullustan = docs.find(d => d.name === "Sullustan");
  console.log("\n=== Sullustan Verification ===");
  console.log(`Description Length: ${sullustan.system.description.length} chars`);
  console.log(`Has original lore: ${sullustan.system.description.includes("Sullustans are a species of Near-Humans")}`);
  console.log(`Untouched (no Wookiepedia Link): ${!sullustan.system.description.includes("Wookiepedia Link")}`);
  if (!sullustan.system.description.includes("Sullustans are a species of Near-Humans") || sullustan.system.description.includes("Wookiepedia Link")) {
    console.error("FAIL: Sullustan description was modified!");
    passed = false;
  }

  // Verify all 28 SRD species descriptions were updated from their placeholders
  for (const slug of slugs) {
    const name = slugToNameMap[slug];
    const doc = docs.find(d => d.name === name);
    if (!doc) {
      console.error(`FAIL: Species ${name} not found in database!`);
      passed = false;
      continue;
    }
    if (doc.system.description.includes("Please see page")) {
      console.error(`FAIL: Species ${name} is still a placeholder!`);
      passed = false;
    }
  }

  if (passed) {
    console.log("\n>>> ALL VERIFICATIONS PASSED SUCCESSFULLY! <<<");
  } else {
    console.log("\n>>> VERIFICATION FAILED! <<<");
    process.exit(1);
  }
}

runVerification();
