/**
 * Canonical List of Standard Skills in Star Wars FFG
 */
export const CANONICAL_SKILLS = [
  // General Skills
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

  // Knowledge Skills
  { name: "Knowledge: Core Worlds", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Education", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Lore", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Outer Rim", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Underworld", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Warfare", characteristic: "intellect", category: "Knowledge" },
  { name: "Knowledge: Xenology", characteristic: "intellect", category: "Knowledge" },

  // Combat Skills
  { name: "Brawl", characteristic: "brawn", category: "Combat" },
  { name: "Gunnery", characteristic: "agility", category: "Combat" },
  { name: "Lightsaber", characteristic: "brawn", category: "Combat" },
  { name: "Melee", characteristic: "brawn", category: "Combat" },
  { name: "Ranged - Light", characteristic: "agility", category: "Combat" },
  { name: "Ranged - Heavy", characteristic: "agility", category: "Combat" }
];

/**
 * Mapping table of all known variations, legacy spellings, abbreviations,
 * and OggDude / SWA import keys to canonical skill names.
 */
const SKILL_NAME_MAP = new Map([
  // Astrogation
  ["astro", "Astrogation"],
  ["astrogation", "Astrogation"],

  // Athletics
  ["athl", "Athletics"],
  ["athletics", "Athletics"],

  // Charm
  ["charm", "Charm"],

  // Coercion
  ["coerc", "Coercion"],
  ["coercion", "Coercion"],

  // Computers
  ["comp", "Computers"],
  ["computers", "Computers"],

  // Cool
  ["cool", "Cool"],

  // Coordination
  ["coord", "Coordination"],
  ["coordination", "Coordination"],

  // Deception
  ["dec", "Deception"],
  ["decep", "Deception"],
  ["deception", "Deception"],

  // Discipline
  ["disc", "Discipline"],
  ["discipline", "Discipline"],

  // Leadership
  ["lead", "Leadership"],
  ["leadership", "Leadership"],

  // Mechanics
  ["mech", "Mechanics"],
  ["mechanics", "Mechanics"],

  // Medicine
  ["med", "Medicine"],
  ["medicine", "Medicine"],

  // Negotiation
  ["neg", "Negotiation"],
  ["negot", "Negotiation"],
  ["negotiation", "Negotiation"],

  // Perception
  ["perc", "Perception"],
  ["perception", "Perception"],

  // Piloting - Planetary
  ["pilotpl", "Piloting - Planetary"],
  ["pilotingplanetary", "Piloting - Planetary"],
  ["piloting: planetary", "Piloting - Planetary"],
  ["piloting : planetary", "Piloting - Planetary"],
  ["piloting-planetary", "Piloting - Planetary"],
  ["piloting - planetary", "Piloting - Planetary"],
  ["piloting (planetary)", "Piloting - Planetary"],

  // Piloting - Space
  ["pilotsp", "Piloting - Space"],
  ["pilotingspace", "Piloting - Space"],
  ["piloting: space", "Piloting - Space"],
  ["piloting : space", "Piloting - Space"],
  ["piloting-space", "Piloting - Space"],
  ["piloting - space", "Piloting - Space"],
  ["piloting (space)", "Piloting - Space"],

  // Resilience
  ["resil", "Resilience"],
  ["resilience", "Resilience"],

  // Skulduggery
  ["skul", "Skulduggery"],
  ["skuld", "Skulduggery"],
  ["skulduggery", "Skulduggery"],

  // Stealth
  ["steal", "Stealth"],
  ["stealth", "Stealth"],

  // Streetwise
  ["sw", "Streetwise"],
  ["street", "Streetwise"],
  ["streetwise", "Streetwise"],

  // Survival
  ["surv", "Survival"],
  ["survival", "Survival"],

  // Vigilance
  ["vigil", "Vigilance"],
  ["vigilance", "Vigilance"],

  // Knowledge: Core Worlds
  ["core", "Knowledge: Core Worlds"],
  ["core worlds", "Knowledge: Core Worlds"],
  ["knowledge: core worlds", "Knowledge: Core Worlds"],
  ["knowledge: core", "Knowledge: Core Worlds"],
  ["knowledge : core worlds", "Knowledge: Core Worlds"],
  ["knowledge (core worlds)", "Knowledge: Core Worlds"],
  ["knowledge-core worlds", "Knowledge: Core Worlds"],
  ["knowledge - core worlds", "Knowledge: Core Worlds"],
  ["lore: core worlds", "Knowledge: Core Worlds"],
  ["lore - core worlds", "Knowledge: Core Worlds"],
  ["lore: core", "Knowledge: Core Worlds"],

  // Knowledge: Education
  ["edu", "Knowledge: Education"],
  ["education", "Knowledge: Education"],
  ["knowledge: education", "Knowledge: Education"],
  ["knowledge : education", "Knowledge: Education"],
  ["knowledge (education)", "Knowledge: Education"],
  ["knowledge-education", "Knowledge: Education"],
  ["knowledge - education", "Knowledge: Education"],
  ["lore: education", "Knowledge: Education"],
  ["lore - education", "Knowledge: Education"],

  // Knowledge: Lore
  ["lore", "Knowledge: Lore"],
  ["knowledge: lore", "Knowledge: Lore"],
  ["knowledge : lore", "Knowledge: Lore"],
  ["knowledge (lore)", "Knowledge: Lore"],
  ["knowledge-lore", "Knowledge: Lore"],
  ["knowledge - lore", "Knowledge: Lore"],
  ["lore: lore", "Knowledge: Lore"],

  // Knowledge: Outer Rim
  ["out", "Knowledge: Outer Rim"],
  ["outer rim", "Knowledge: Outer Rim"],
  ["knowledge: outer rim", "Knowledge: Outer Rim"],
  ["knowledge: outer", "Knowledge: Outer Rim"],
  ["knowledge : outer rim", "Knowledge: Outer Rim"],
  ["knowledge (outer rim)", "Knowledge: Outer Rim"],
  ["knowledge-outer rim", "Knowledge: Outer Rim"],
  ["knowledge - outer rim", "Knowledge: Outer Rim"],
  ["lore: outer rim", "Knowledge: Outer Rim"],
  ["lore - outer rim", "Knowledge: Outer Rim"],

  // Knowledge: Underworld
  ["und", "Knowledge: Underworld"],
  ["underworld", "Knowledge: Underworld"],
  ["knowledge: underworld", "Knowledge: Underworld"],
  ["knowledge : underworld", "Knowledge: Underworld"],
  ["knowledge (underworld)", "Knowledge: Underworld"],
  ["knowledge-underworld", "Knowledge: Underworld"],
  ["knowledge - underworld", "Knowledge: Underworld"],
  ["lore: underworld", "Knowledge: Underworld"],
  ["lore - underworld", "Knowledge: Underworld"],

  // Knowledge: Warfare
  ["warf", "Knowledge: Warfare"],
  ["warfare", "Knowledge: Warfare"],
  ["knowledge: warfare", "Knowledge: Warfare"],
  ["knowledge : warfare", "Knowledge: Warfare"],
  ["knowledge (warfare)", "Knowledge: Warfare"],
  ["knowledge-warfare", "Knowledge: Warfare"],
  ["knowledge - warfare", "Knowledge: Warfare"],
  ["lore: warfare", "Knowledge: Warfare"],
  ["lore - warfare", "Knowledge: Warfare"],

  // Knowledge: Xenology
  ["xen", "Knowledge: Xenology"],
  ["xenology", "Knowledge: Xenology"],
  ["knowledge: xenology", "Knowledge: Xenology"],
  ["knowledge : xenology", "Knowledge: Xenology"],
  ["knowledge (xenology)", "Knowledge: Xenology"],
  ["knowledge-xenology", "Knowledge: Xenology"],
  ["knowledge - xenology", "Knowledge: Xenology"],
  ["lore: xenology", "Knowledge: Xenology"],
  ["lore - xenology", "Knowledge: Xenology"],

  // Brawl
  ["brawl", "Brawl"],

  // Gunnery
  ["gunn", "Gunnery"],
  ["gunnery", "Gunnery"],

  // Lightsaber
  ["ltsaber", "Lightsaber"],
  ["lightsaber", "Lightsaber"],

  // Melee
  ["melee", "Melee"],

  // Ranged - Light
  ["ranglt", "Ranged - Light"],
  ["rangelt", "Ranged - Light"],
  ["rangedlight", "Ranged - Light"],
  ["ranged: light", "Ranged - Light"],
  ["ranged : light", "Ranged - Light"],
  ["ranged-light", "Ranged - Light"],
  ["ranged - light", "Ranged - Light"],
  ["ranged (light)", "Ranged - Light"],

  // Ranged - Heavy
  ["ranghvy", "Ranged - Heavy"],
  ["rangehv", "Ranged - Heavy"],
  ["rangedheavy", "Ranged - Heavy"],
  ["ranged: heavy", "Ranged - Heavy"],
  ["ranged : heavy", "Ranged - Heavy"],
  ["ranged-heavy", "Ranged - Heavy"],
  ["ranged - heavy", "Ranged - Heavy"],
  ["ranged (heavy)", "Ranged - Heavy"]
]);

/**
 * Normalizes any skill name variation, abbreviation, or legacy format
 * into its canonical Star Wars FFG name.
 *
 * Idempotent: passing an already canonical name returns it unchanged.
 *
 * @param {string} name - Raw skill name or key (e.g. "Ranged: Heavy", "Ranged-Light", "ranGLT")
 * @returns {string} Canonical skill name (e.g. "Ranged - Heavy") or trimmed original if unknown
 */
export function normalizeSkillName(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  // 1. Direct lookup with lowercased key
  const lower = trimmed.toLowerCase();
  if (SKILL_NAME_MAP.has(lower)) {
    return SKILL_NAME_MAP.get(lower);
  }

  // 2. Normalize punctuation variations: e.g. "Ranged: Heavy", "Ranged (Heavy)" -> "ranged heavy"
  const cleanKey = lower.replace(/[:()\-]/g, " ").replace(/\s+/g, " ").trim();
  if (SKILL_NAME_MAP.has(cleanKey)) {
    return SKILL_NAME_MAP.get(cleanKey);
  }

  // 3. Check if cleanKey matches with hyphens or colons
  for (const [mapKey, canonicalName] of SKILL_NAME_MAP.entries()) {
    const mapClean = mapKey.replace(/[:()\-]/g, " ").replace(/\s+/g, " ").trim();
    if (mapClean === cleanKey) {
      return canonicalName;
    }
  }

  // Fallback: return original trimmed string
  return trimmed;
}

/**
 * Retrieves default characteristic associated with a skill.
 *
 * @param {string} skillName - Canonical or raw skill name
 * @returns {string} Characteristic key (e.g. "agility", "brawn", "intellect")
 */
export function getSkillCharacteristic(skillName) {
  const canonical = normalizeSkillName(skillName);
  const found = CANONICAL_SKILLS.find(s => s.name === canonical);
  return found?.characteristic || "agility";
}
