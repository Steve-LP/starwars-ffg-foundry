import { normalizeSkillName, getSkillCharacteristic, CANONICAL_SKILLS } from "../module/utils/skill-normalization.js";

console.log("==================================================");
console.log("SWFFG TEST | Skill Normalization Unit Tests");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assertEqual(testName, actual, expected) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}: "${actual}" === "${expected}"`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
    failed++;
  }
}

// 1. Idempotency test (all canonical skills remain unchanged)
for (const skill of CANONICAL_SKILLS) {
  assertEqual(`Canonical "${skill.name}" is idempotent`, normalizeSkillName(skill.name), skill.name);
}

// 2. Colon variants
assertEqual("Ranged: Heavy", normalizeSkillName("Ranged: Heavy"), "Ranged - Heavy");
assertEqual("Ranged: Light", normalizeSkillName("Ranged: Light"), "Ranged - Light");
assertEqual("Piloting: Planetary", normalizeSkillName("Piloting: Planetary"), "Piloting - Planetary");
assertEqual("Piloting: Space", normalizeSkillName("Piloting: Space"), "Piloting - Space");
assertEqual("Knowledge: Core Worlds", normalizeSkillName("Knowledge: Core Worlds"), "Core Worlds");
assertEqual("Knowledge: Xenology", normalizeSkillName("Knowledge: Xenology"), "Xenology");

// 3. Hyphen variants
assertEqual("Ranged-Heavy", normalizeSkillName("Ranged-Heavy"), "Ranged - Heavy");
assertEqual("Ranged-Light", normalizeSkillName("Ranged-Light"), "Ranged - Light");
assertEqual("Piloting-Space", normalizeSkillName("Piloting-Space"), "Piloting - Space");

// 4. Short codes / abbreviations from Oggdude
assertEqual("RANGLT", normalizeSkillName("RANGLT"), "Ranged - Light");
assertEqual("RANGHVY", normalizeSkillName("RANGHVY"), "Ranged - Heavy");
assertEqual("PILOTSP", normalizeSkillName("PILOTSP"), "Piloting - Space");
assertEqual("PILOTPL", normalizeSkillName("PILOTPL"), "Piloting - Planetary");
assertEqual("LTSABER", normalizeSkillName("LTSABER"), "Lightsaber");
assertEqual("CORE", normalizeSkillName("CORE"), "Core Worlds");
assertEqual("MED", normalizeSkillName("MED"), "Medicine");

// 5. Associated Characteristics
assertEqual("Ranged - Heavy char", getSkillCharacteristic("Ranged - Heavy"), "agility");
assertEqual("Ranged: Heavy char (with normalization)", getSkillCharacteristic("Ranged: Heavy"), "agility");
assertEqual("Brawl char", getSkillCharacteristic("Brawl"), "brawn");
assertEqual("Core Worlds char", getSkillCharacteristic("Knowledge: Core Worlds"), "intellect");
assertEqual("Charm char", getSkillCharacteristic("Charm"), "presence");
assertEqual("Discipline char", getSkillCharacteristic("Discipline"), "willpower");

console.log("==================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("==================================================");

if (failed > 0) process.exit(1);
