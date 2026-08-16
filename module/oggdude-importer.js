import { normalizeSkillName } from "./utils/skill-normalization.js";

/**
 * Oggdude XML Dataset parser for Star Wars FFG
 */

/**
 * Parses an Oggdude talent XML definition
 * @param {string} xmlString - The talent XML file contents
 * @returns {Array<Object>} Array of parsed talent structures ready for Foundry item creation
 */
export function parseOggdudeTalents(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const talents = xmlDoc.getElementsByTagName("Talent");
  const items = [];

  for (let i = 0; i < talents.length; i++) {
    const talentNode = talents[i];
    const key = talentNode.getElementsByTagName("Key")[0]?.textContent || "";
    const name = talentNode.getElementsByTagName("Name")[0]?.textContent || "Unnamed Talent";
    const description = talentNode.getElementsByTagName("Description")[0]?.textContent || "";
    
    // Check if ranked
    const rankedNode = talentNode.getElementsByTagName("Ranked")[0];
    const isRanked = rankedNode ? (rankedNode.textContent.toLowerCase() === "true") : false;

    // Check activation
    const activationNode = talentNode.getElementsByTagName("ActivationValue")[0];
    const activation = activationNode ? activationNode.textContent : "Passive";

    items.push({
      name: name,
      type: "talent",
      system: {
        description: description,
        activation: activation,
        tier: 1,
        ranked: isRanked,
        key: key
      }
    });
  }

  return items;
}

/**
 * Parses Oggdude Weapon XML definitions
 */
export function parseOggdudeWeapons(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const weapons = xmlDoc.getElementsByTagName("Weapon");
  const items = [];

  for (let i = 0; i < weapons.length; i++) {
    const weaponNode = weapons[i];
    const key = weaponNode.getElementsByTagName("Key")[0]?.textContent || "";
    const name = weaponNode.getElementsByTagName("Name")[0]?.textContent || "Unnamed Weapon";
    const damage = parseInt(weaponNode.getElementsByTagName("Damage")[0]?.textContent || "0");
    const crit = parseInt(weaponNode.getElementsByTagName("Crit")[0]?.textContent || "0");
    const range = weaponNode.getElementsByTagName("Range")[0]?.textContent || "Engaged";
    const encumbrance = parseInt(weaponNode.getElementsByTagName("Encumbrance")[0]?.textContent || "1");
    const qualities = weaponNode.getElementsByTagName("Qualities")[0]?.textContent || "";
    const skillRaw = weaponNode.getElementsByTagName("SkillKey")[0]?.textContent || weaponNode.getElementsByTagName("Skill")[0]?.textContent || "Ranged - Light";
    const skill = normalizeSkillName(skillRaw);
    const price = parseInt(weaponNode.getElementsByTagName("Price")[0]?.textContent || "0");
    const rarity = parseInt(weaponNode.getElementsByTagName("Rarity")[0]?.textContent || "0");
    const restricted = weaponNode.getElementsByTagName("Restricted")[0]?.textContent?.toLowerCase() === "true";

    items.push({
      name: name,
      type: "weapon",
      system: {
        damage: damage,
        critical: crit,
        range: range,
        encumbrance: encumbrance,
        qualities: qualities,
        skill: skill,
        price: price,
        rarity: rarity,
        restricted: restricted,
        key: key
      }
    });
  }

  return items;
}

export function parseOggdudeSpecies(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const speciesNode = xmlDoc.getElementsByTagName("Species")[0];
  if (!speciesNode) return [];

  const key = speciesNode.getElementsByTagName("Key")[0]?.textContent || "";
  const name = speciesNode.getElementsByTagName("Name")[0]?.textContent || "Unnamed Species";
  
  // Extract description
  let description = speciesNode.getElementsByTagName("Description")[0]?.textContent || "";
  description = description.replace(/\[H4\]/g, "<h4>").replace(/\[h4\]/g, "</h4>");

  // Starting Characteristics
  const brawn = parseInt(speciesNode.getElementsByTagName("Brawn")[0]?.textContent || "2");
  const agility = parseInt(speciesNode.getElementsByTagName("Agility")[0]?.textContent || "2");
  const intellect = parseInt(speciesNode.getElementsByTagName("Intellect")[0]?.textContent || "2");
  const cunning = parseInt(speciesNode.getElementsByTagName("Cunning")[0]?.textContent || "2");
  const willpower = parseInt(speciesNode.getElementsByTagName("Willpower")[0]?.textContent || "2");
  const presence = parseInt(speciesNode.getElementsByTagName("Presence")[0]?.textContent || "2");

  // Attrs
  const woundThreshold = parseInt(speciesNode.getElementsByTagName("WoundThreshold")[0]?.textContent || "10");
  const strainThreshold = parseInt(speciesNode.getElementsByTagName("StrainThreshold")[0]?.textContent || "10");
  const experience = parseInt(speciesNode.getElementsByTagName("Experience")[0]?.textContent || "100");

  // Parse skill modifiers and option choices
  const skillModList = [];
  
  // Fixed SkillModifiers
  const fixedMods = speciesNode.getElementsByTagName("SkillModifiers")[0]?.getElementsByTagName("SkillModifier") || [];
  for (let i = 0; i < fixedMods.length; i++) {
    const modKey = fixedMods[i].getElementsByTagName("Key")[0]?.textContent || "";
    const startRank = parseInt(fixedMods[i].getElementsByTagName("RankStart")[0]?.textContent || "1");
    
    // Map Oggdude skill keys to standard display names
    const skillMap = {
      "ASTRO": "Astrogation", "ATHL": "Athletics", "CHARM": "Charm", "COERC": "Coercion",
      "COMP": "Computers", "COOL": "Cool", "COORD": "Coordination", "DEC": "Deception",
      "DECEP": "Deception", "DISC": "Discipline", "LEAD": "Leadership", "MECH": "Mechanics",
      "MED": "Medicine", "NEG": "Negotiation", "NEGOT": "Negotiation", "PERC": "Perception",
      "PILOTPL": "Piloting - Planetary", "PILOTSP": "Piloting - Space", "RESIL": "Resilience",
      "SKUL": "Skulduggery", "SKULD": "Skulduggery", "STEAL": "Stealth", "SW": "Streetwise",
      "STREET": "Streetwise", "SURV": "Survival", "VIGIL": "Vigilance", "BRAWL": "Brawl",
      "GUNN": "Gunnery", "MELEE": "Melee", "RANGLT": "Ranged - Light", "RANGELT": "Ranged - Light",
      "RANGHVY": "Ranged - Heavy", "RANGEHV": "Ranged - Heavy", "CORE": "Core Worlds",
      "EDU": "Education", "LORE": "Lore", "OUT": "Outer Rim", "UND": "Underworld",
      "WARF": "Warfare", "XEN": "Xenology", "LTSABER": "Lightsaber", "LIGHTSABER": "Lightsaber"
    };
    const mappedName = skillMap[modKey.toUpperCase()] || modKey;
    skillModList.push(`${mappedName}:${startRank}`);
  }

  // Option Choices (e.g. choice between Charm & Deception for Twi'leks)
  const choices = speciesNode.getElementsByTagName("OptionChoices")[0]?.getElementsByTagName("OptionChoice") || [];
  const choiceSkills = [];
  for (let i = 0; i < choices.length; i++) {
    const choiceName = choices[i].getElementsByTagName("Name")[0]?.textContent || "";
    const options = choices[i].getElementsByTagName("Option");
    for (let j = 0; j < options.length; j++) {
      if (choiceName.toLowerCase() === "skills" && j > 0) {
        continue;
      }
      const optMods = options[j].getElementsByTagName("SkillModifier");
      for (let k = 0; k < optMods.length; k++) {
        const modKey = optMods[k].getElementsByTagName("Key")[0]?.textContent || "";
        const startRank = parseInt(optMods[k].getElementsByTagName("RankStart")[0]?.textContent || "1");
        
        const skillMap = {
          "ASTRO": "Astrogation", "ATHL": "Athletics", "CHARM": "Charm", "COERC": "Coercion",
          "COMP": "Computers", "COOL": "Cool", "COORD": "Coordination", "DEC": "Deception",
          "DECEP": "Deception", "DISC": "Discipline", "LEAD": "Leadership", "MECH": "Mechanics",
          "MED": "Medicine", "NEG": "Negotiation", "NEGOT": "Negotiation", "PERC": "Perception",
          "PILOTPL": "Piloting - Planetary", "PILOTSP": "Piloting - Space", "RESIL": "Resilience",
          "SKUL": "Skulduggery", "SKULD": "Skulduggery", "STEAL": "Stealth", "SW": "Streetwise",
          "STREET": "Streetwise", "SURV": "Survival", "VIGIL": "Vigilance", "BRAWL": "Brawl",
          "GUNN": "Gunnery", "MELEE": "Melee", "RANGLT": "Ranged - Light", "RANGELT": "Ranged - Light",
          "RANGHVY": "Ranged - Heavy", "RANGEHV": "Ranged - Heavy", "CORE": "Core Worlds",
          "EDU": "Education", "LORE": "Lore", "OUT": "Outer Rim", "UND": "Underworld",
          "WARF": "Warfare", "XEN": "Xenology", "LTSABER": "Lightsaber", "LIGHTSABER": "Lightsaber"
        };
        const mappedName = skillMap[modKey.toUpperCase()] || modKey;
        choiceSkills.push(`${mappedName}:${startRank}`);
      }
    }
  }

  // If there are choice-based skills (like Twi'lek Charm or Deception), default to the first one but list them all
  if (choiceSkills.length > 0) {
    for (const cSkill of choiceSkills) {
      if (!skillModList.includes(cSkill)) {
        skillModList.push(cSkill);
      }
    }
  }

  // Special Abilities extraction from OptionChoices (like Environmental, Rage, etc.)
  const specialAbilitiesList = [];
  for (let i = 0; i < choices.length; i++) {
    const choiceName = choices[i].getElementsByTagName("Name")[0]?.textContent || "";
    if (choiceName.toLowerCase() !== "skills") {
      const options = choices[i].getElementsByTagName("Option");
      for (let j = 0; j < options.length; j++) {
        const optName = options[j].getElementsByTagName("Name")[0]?.textContent || "";
        const optDesc = options[j].getElementsByTagName("Description")[0]?.textContent || "";
        specialAbilitiesList.push(`<strong>${optName}</strong>: ${optDesc.trim()}`);
      }
    }
  }

  const specialAbilitiesHtml = specialAbilitiesList.join("<br><br>");

  return [{
    name: name,
    type: "species",
    system: {
      description: description,
      characteristics: {
        brawn: { value: brawn },
        agility: { value: agility },
        intellect: { value: intellect },
        cunning: { value: cunning },
        willpower: { value: willpower },
        presence: { value: presence }
      },
      wounds: { base: woundThreshold },
      strain: { base: strainThreshold },
      xp: experience,
      key: key,
      modifiers: {
        wounds: 0,
        strain: 0,
        soak: 0,
        encumbrance: 0,
        characteristics: "",
        skills: skillModList.join(",")
      },
      specialAbilities: specialAbilitiesHtml
    }
  }];
}

/**
 * Exposing a general dispatcher
 */
export function oggdudeParser(xmlString, type) {
  if (type === "talent") {
    return parseOggdudeTalents(xmlString);
  } else if (type === "weapon") {
    return parseOggdudeWeapons(xmlString);
  } else if (type === "species") {
    return parseOggdudeSpecies(xmlString);
  }
  return [];
}
