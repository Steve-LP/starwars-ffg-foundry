const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. Read actor.js
const actorJsPath = path.join(__dirname, '..', 'module', 'actor.js');
let code = fs.readFileSync(actorJsPath, 'utf8');

// 2. Remove imports and exports (since we are in Node.js CommonJS environment)
code = code.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '');
code = code.replace(/\bexport\s+(class|const|function|let|var)\b/g, '$1');
code = code.replace(/\bexport\s+\{/g, '/* export */ {');
code += '\n;globalThis.SWFFGActor = SWFFGActor;';

// 3. Define the mock environment
const DEFAULT_SKILLS = [
  { name: "Astrogation", characteristic: "intellect", category: "General" },
  { name: "Athletics", characteristic: "brawn", category: "General" },
  { name: "Charm", characteristic: "presence", category: "General" },
  { name: "Coercion", characteristic: "willpower", category: "General" },
  { name: "Computers", characteristic: "intellect", category: "General" },
  { name: "Cool", characteristic: "presence", category: "General" },
  { name: "Coordination", characteristic: "agility", category: "General" },
  { name: "Deception", characteristic: "cunning", category: "General" },
  { name: "Discipline", characteristic: "willpower", category: "General" },
  { name: "Leadership", characteristic: "presence", category: "General" },
  { name: "Mechanics", characteristic: "intellect", category: "General" },
  { name: "Medicine", characteristic: "intellect", category: "General" },
  { name: "Negotiation", characteristic: "presence", category: "General" },
  { name: "Perception", characteristic: "cunning", category: "General" },
  { name: "Piloting - Planetary", characteristic: "agility", category: "General" },
  { name: "Piloting - Space", characteristic: "agility", category: "General" },
  { name: "Resilience", characteristic: "brawn", category: "General" },
  { name: "Skulduggery", characteristic: "cunning", category: "General" },
  { name: "Stealth", characteristic: "agility", category: "General" },
  { name: "Streetwise", characteristic: "cunning", category: "General" },
  { name: "Survival", characteristic: "cunning", category: "General" },
  { name: "Vigilance", characteristic: "willpower", category: "General" },
  { name: "Brawl", characteristic: "brawn", category: "Combat" },
  { name: "Gunnery", characteristic: "agility", category: "Combat" },
  { name: "Melee", characteristic: "brawn", category: "Combat" },
  { name: "Ranged - Light", characteristic: "agility", category: "Combat" },
  { name: "Ranged - Heavy", characteristic: "agility", category: "Combat" },
  { name: "Core Worlds", characteristic: "intellect", category: "Knowledge" },
  { name: "Education", characteristic: "intellect", category: "Knowledge" },
  { name: "Lore", characteristic: "intellect", category: "Knowledge" },
  { name: "Outer Rim", characteristic: "intellect", category: "Knowledge" },
  { name: "Underworld", characteristic: "intellect", category: "Knowledge" },
  { name: "Warfare", characteristic: "intellect", category: "Knowledge" },
  { name: "Xenology", characteristic: "intellect", category: "Knowledge" },
  { name: "Lightsaber", characteristic: "brawn", category: "Combat" }
];

const CHOICE_SPECIES = {
  "twilek": ["Charm", "Deception"],
  "devaronian": ["Survival", "Deception"],
  "weequay": ["Resilience", "Athletics"],
  "klatooinian": ["Brawl", "Ranged - Heavy", "Ranged - Light"]
};

function normalizeSpeciesName(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/['\s-]/g, "");
}

// Mock base classes and systems
class Actor {
  prepareDerivedData() {}
}

const sandbox = {
  Actor,
  DEFAULT_SKILLS,
  CHOICE_SPECIES,
  normalizeSpeciesName,
  rollFFGPool: () => {},
  sendRollToChat: () => {},
  console
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// 4. Test function
function runTests() {
  console.log("Starting Species Choice automated verification tests...");

  let passed = true;
  const assert = (condition, msg) => {
    if (condition) {
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
      passed = false;
    }
  };

  // Instantiate SWFFGActor
  const actor = new sandbox.SWFFGActor();
  
  // Set up mock actor properties
  actor.type = "character";
  actor.items = [];
  actor.dutyXp = 0;
  actor.maxAttributeXpAllowed = 100;
  actor.calculateSpentTalentXp = () => 0;
  actor.calculateSpentSpecializationXp = () => 0;
  actor.calculateSpentSkillXp = () => 0;

  // Test Case A: Drop Twi'lek with no choice made yet
  actor.system = {
    biography: {
      species: "Twi'lek"
    },
    stats: {
      wounds: { base: 10, max: 10 },
      strain: { base: 10, max: 10 },
      force: { value: 0, max: 0 },
      soak: { value: 0 },
      defence: { melee: 0, ranged: 0 },
      encumbrance: { value: 0, max: 0 }
    },
    characteristics: {
      brawn: { value: 1 },
      agility: { value: 2 },
      intellect: { value: 2 },
      cunning: { value: 2 },
      willpower: { value: 2 },
      presence: { value: 3 }
    },
    xp: { total: 100, available: 100, earned: 0 },
    creation: {
      isCreationMode: true,
      startingXp: 100,
      speciesSnapshot: {
        name: "Twi'lek",
        characteristics: { brawn: 1, agility: 2, intellect: 2, cunning: 2, willpower: 2, presence: 3 },
        wounds: 10,
        strain: 11,
        xp: 100,
        modifiers: {
          skills: "Charm:1" // The database starting skill modifier (Charm by default)
        }
      },
      ledger: {
        speciesSkillChoice: "" // No choice made
      }
    }
  };

  actor.prepareDerivedData();
  
  // Verify that neither Charm nor Deception starting ranks are granted because choice is empty
  let charmSkill = actor.derivedSkills["charm"];
  let deceptionSkill = actor.derivedSkills["deception"];
  assert(charmSkill.freeRanks === 0, "No choice: Charm free ranks should be 0");
  assert(deceptionSkill.freeRanks === 0, "No choice: Deception free ranks should be 0");

  // Test Case B: Select Deception as starting choice
  actor.system.creation.ledger.speciesSkillChoice = "Deception";
  actor.prepareDerivedData();

  charmSkill = actor.derivedSkills["charm"];
  deceptionSkill = actor.derivedSkills["deception"];
  assert(charmSkill.freeRanks === 0, "Choice=Deception: Charm free ranks should be 0");
  assert(deceptionSkill.freeRanks === 1, "Choice=Deception: Deception free ranks should be 1");

  // Test Case C: Select Charm as starting choice
  actor.system.creation.ledger.speciesSkillChoice = "Charm";
  actor.prepareDerivedData();

  charmSkill = actor.derivedSkills["charm"];
  deceptionSkill = actor.derivedSkills["deception"];
  assert(charmSkill.freeRanks === 1, "Choice=Charm: Charm free ranks should be 1");
  assert(deceptionSkill.freeRanks === 0, "Choice=Charm: Deception free ranks should be 0");

  // Test Case D: Verify Devaronian choices (Survival vs Deception)
  actor.system.biography.species = "Devaronian";
  actor.system.creation.speciesSnapshot = {
    name: "Devaronian",
    characteristics: { brawn: 2, agility: 2, intellect: 2, cunning: 3, willpower: 2, presence: 1 },
    wounds: 11,
    strain: 10,
    xp: 95,
    modifiers: {
      skills: "Deception:1" // Default modifier in DB
    }
  };
  
  // Devaronian Choice = Survival
  actor.system.creation.ledger.speciesSkillChoice = "Survival";
  actor.prepareDerivedData();

  let survivalSkill = actor.derivedSkills["survival"];
  deceptionSkill = actor.derivedSkills["deception"];
  assert(survivalSkill.freeRanks === 1, "Devaronian Choice=Survival: Survival free ranks should be 1");
  assert(deceptionSkill.freeRanks === 0, "Devaronian Choice=Survival: Deception free ranks should be 0");

  // Devaronian Choice = Deception
  actor.system.creation.ledger.speciesSkillChoice = "Deception";
  actor.prepareDerivedData();

  survivalSkill = actor.derivedSkills["survival"];
  deceptionSkill = actor.derivedSkills["deception"];
  assert(survivalSkill.freeRanks === 0, "Devaronian Choice=Deception: Survival free ranks should be 0");
  assert(deceptionSkill.freeRanks === 1, "Devaronian Choice=Deception: Deception free ranks should be 1");

  if (passed) {
    console.log("\nAll automated verification tests PASSED successfully!");
    process.exit(0);
  } else {
    console.error("\nSome automated verification tests FAILED!");
    process.exit(1);
  }
}

runTests();
