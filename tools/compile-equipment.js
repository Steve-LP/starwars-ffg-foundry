import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeSkillName } from "../module/utils/skill-normalization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data-oggdude");
const destDir = path.join(__dirname, "..", "packs");

export const QUALITY_MAP = {
  "ACCURATE": "Accurate",
  "AUTOFIRE": "Auto-Fire",
  "BLAST": "Blast",
  "BREACH": "Breach",
  "BURN": "Burn",
  "CONCUSSIVE": "Concussive",
  "CUMBERSOME": "Cumbersome",
  "DEFENSIVE": "Defensive",
  "DEFLECTION": "Deflection",
  "DISORIENT": "Disorient",
  "ENSNARE": "Ensnare",
  "GUIDED": "Guided",
  "INACCURATE": "Inaccurate",
  "INFERIOR": "Inferior",
  "ION": "Ion",
  "KNOCKDOWN": "Knockdown",
  "LIMITEDAMMO": "Limited Ammo",
  "LINKED": "Linked",
  "OVERHEATING": "Overheating",
  "PIERCE": "Pierce",
  "PREPARE": "Prepare",
  "SLOWFIRING": "Slow-Firing",
  "STUN": "Stun",
  "STUNDMG": "Stun Damage",
  "STUNSETTING": "Stun Setting",
  "SUNDER": "Sunder",
  "SUPERIOR": "Superior",
  "TRACTOR": "Tractor",
  "UNWIELDY": "Unwieldy",
  "VICIOUS": "Vicious",
  "REINFORCED": "Reinforced"
};

export const RANGE_MAP = {
  "wrengaged": "Engaged",
  "wrshort": "Short",
  "wrmedium": "Medium",
  "wrlong": "Long",
  "wrextreme": "Extreme"
};

export function formatQuality(key, count) {
  const upper = (key || "").toUpperCase().trim();
  const name = QUALITY_MAP[upper] || key;
  return count ? `${name} ${count}` : name;
}

function generateId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function formatDescription(desc) {
  if (!desc) return "";
  let formatted = desc;
  
  formatted = formatted.replace(/\[h3\]/gi, "</h3>").replace(/\[H3\]/gi, "<h3>");
  formatted = formatted.replace(/\[h4\]/gi, "</h4>").replace(/\[H4\]/gi, "<h4>");
  formatted = formatted.replace(/\[b\]/gi, "</strong>").replace(/\[B\]/gi, "<strong>");
  formatted = formatted.replace(/\[i\]/gi, "</em>").replace(/\[I\]/gi, "<em>");
  formatted = formatted.replace(/\[p\]/gi, "</p>").replace(/\[P\]/gi, "<p>");
  formatted = formatted.replace(/\[bullet\]/gi, "</li>").replace(/\[Bullet\]/gi, "<li>");
  
  formatted = formatted.replace(/\[SETBACK\]/gi, "<strong>[Setback]</strong>");
  formatted = formatted.replace(/\[BOOST\]/gi, "<strong>[Boost]</strong>");
  formatted = formatted.replace(/\[DIFFICULTY\]/gi, "<strong>[Difficulty]</strong>");
  formatted = formatted.replace(/\[DI\]/gi, "<strong>[Difficulty]</strong>");
  formatted = formatted.replace(/\[CHALLENGE\]/gi, "<strong>[Challenge]</strong>");
  formatted = formatted.replace(/\[ABILITY\]/gi, "<strong>[Ability]</strong>");
  formatted = formatted.replace(/\[PROFICIENCY\]/gi, "<strong>[Proficiency]</strong>");
  formatted = formatted.replace(/\[FORCE\]/gi, "<strong>[Force]</strong>");
  formatted = formatted.replace(/\[SUCCESS\]/gi, "<strong>[Success]</strong>");
  formatted = formatted.replace(/\[ADVANTAGE\]/gi, "<strong>[Advantage]</strong>");
  formatted = formatted.replace(/\[TRIUMPH\]/gi, "<strong>[Triumph]</strong>");
  formatted = formatted.replace(/\[FAILURE\]/gi, "<strong>[Failure]</strong>");
  formatted = formatted.replace(/\[THREAT\]/gi, "<strong>[Threat]</strong>");
  formatted = formatted.replace(/\[DESPAIR\]/gi, "<strong>[Despair]</strong>");
  
  formatted = formatted.replace(/\r?\n\r?\n/g, "<br><br>");
  formatted = formatted.replace(/\r?\n/g, " ");
  formatted = formatted.replace(/\s+/g, " ");
  
  return formatted.trim();
}

function getSources(xml) {
  const sources = [];
  const srcRegex = /<Source(?: Page="([^"]*)")?>([\s\S]*?)<\/Source>/gi;
  let match;
  while ((match = srcRegex.exec(xml)) !== null) {
    const page = match[1] ? ` p. ${match[1]}` : "";
    const book = match[2].trim();
    sources.push(`${book}${page}`);
  }
  return sources;
}

// 1. Compile Armor
export function compileArmor() {
  const file = path.join(dataDir, "Armor.xml");
  if (!fs.existsSync(file)) {
    console.error(`Armor file not found: ${file}`);
    return { count: 0, sources: {} };
  }

  const rawXml = fs.readFileSync(file, "utf-8");
  const armorRegex = /<Armor>([\s\S]*?)<\/Armor>/gi;
  const lines = [];
  const sourceCounts = {};
  let count = 0;
  let match;

  while ((match = armorRegex.exec(rawXml)) !== null) {
    try {
      const xml = match[1];
      const key = getTag(xml, "Key");
      const name = getTag(xml, "Name") || "Unnamed Armor";
      const desc = formatDescription(getTag(xml, "Description"));
      const sources = getSources(xml);
      
      for (const s of sources) {
        const book = s.split(" p.")[0].trim();
        sourceCounts[book] = (sourceCounts[book] || 0) + 1;
      }

      const soak = parseInt(getTag(xml, "Soak") || "0");
      const defence = parseInt(getTag(xml, "Defense") || getTag(xml, "Def") || "0");
      const encumbrance = parseInt(getTag(xml, "Encumbrance") || "0");
      const hardpoints = parseInt(getTag(xml, "HP") || "0");
      const price = parseInt(getTag(xml, "Price") || "0");
      const rarity = parseInt(getTag(xml, "Rarity") || "0");
      const restricted = getTag(xml, "Restricted").toLowerCase() === "true";

      const qualityList = [];
      const qualMatch = xml.match(/<Qualities>([\s\S]*?)<\/Qualities>/i);
      if (qualMatch) {
        const qRegex = /<Quality>([\s\S]*?)<\/Quality>/gi;
        let qm;
        while ((qm = qRegex.exec(qualMatch[1])) !== null) {
          const qKey = getTag(qm[1], "Key");
          const qCount = getTag(qm[1], "Count");
          qualityList.push(formatQuality(qKey, qCount));
        }
      }

      const doc = {
        _id: generateId(),
        name: name,
        type: "armor",
        img: "icons/svg/shield.svg",
        system: {
          description: desc,
          soak: soak,
          defence: defence,
          encumbrance: encumbrance,
          hardpoints: hardpoints,
          qualities: qualityList.join(", "),
          price: price,
          rarity: rarity,
          restricted: restricted,
          equipped: false,
          key: key.toLowerCase(),
          modifiers: {
            wounds: 0,
            strain: 0,
            soak: 0,
            encumbrance: 0,
            characteristics: "",
            skills: ""
          },
          attachments: []
        },
        effects: [],
        flags: {
          starwarsffg: {
            sources: sources
          }
        }
      };

      lines.push(JSON.stringify(doc));
      count++;
    } catch (err) {
      console.warn("Skipping malformed armor entry:", err);
    }
  }

  const destFile = path.join(destDir, "armor.db");
  fs.writeFileSync(destFile, lines.join("\n") + "\n", "utf-8");
  return { count, sourceCounts, destFile };
}

// 2. Compile Gear
export function compileGear() {
  const file = path.join(dataDir, "Gear.xml");
  if (!fs.existsSync(file)) {
    console.error(`Gear file not found: ${file}`);
    return { count: 0, sources: {} };
  }

  const rawXml = fs.readFileSync(file, "utf-8");
  const gearRegex = /<Gear>([\s\S]*?)<\/Gear>/gi;
  const lines = [];
  const sourceCounts = {};
  let count = 0;
  let match;

  while ((match = gearRegex.exec(rawXml)) !== null) {
    try {
      const xml = match[1];
      const key = getTag(xml, "Key");
      const name = getTag(xml, "Name") || "Unnamed Gear";
      const desc = formatDescription(getTag(xml, "Description"));
      const sources = getSources(xml);
      
      for (const s of sources) {
        const book = s.split(" p.")[0].trim();
        sourceCounts[book] = (sourceCounts[book] || 0) + 1;
      }

      const encumbrance = parseInt(getTag(xml, "Encumbrance") || "0");
      const price = parseInt(getTag(xml, "Price") || "0");
      const rarity = parseInt(getTag(xml, "Rarity") || "0");
      const restricted = getTag(xml, "Restricted").toLowerCase() === "true";

      const doc = {
        _id: generateId(),
        name: name,
        type: "gear",
        img: "icons/svg/backpack.svg",
        system: {
          description: desc,
          quantity: 1,
          encumbrance: encumbrance,
          price: price,
          rarity: rarity,
          restricted: restricted,
          equipped: false,
          key: key.toLowerCase(),
          modifiers: {
            wounds: 0,
            strain: 0,
            soak: 0,
            encumbrance: 0,
            characteristics: "",
            skills: ""
          }
        },
        effects: [],
        flags: {
          starwarsffg: {
            sources: sources
          }
        }
      };

      lines.push(JSON.stringify(doc));
      count++;
    } catch (err) {
      console.warn("Skipping malformed gear entry:", err);
    }
  }

  const destFile = path.join(destDir, "gear.db");
  fs.writeFileSync(destFile, lines.join("\n") + "\n", "utf-8");
  return { count, sourceCounts, destFile };
}

// 3. Compile Attachments
export function compileAttachments() {
  const file = path.join(dataDir, "ItemAttachments.xml");
  if (!fs.existsSync(file)) {
    console.error(`ItemAttachments file not found: ${file}`);
    return { count: 0, sources: {} };
  }

  const rawXml = fs.readFileSync(file, "utf-8");
  const attRegex = /<ItemAttachment>([\s\S]*?)<\/ItemAttachment>/gi;
  const lines = [];
  const sourceCounts = {};
  let count = 0;
  let match;

  while ((match = attRegex.exec(rawXml)) !== null) {
    try {
      const xml = match[1];
      const key = getTag(xml, "Key");
      const name = getTag(xml, "Name") || "Unnamed Attachment";
      const desc = formatDescription(getTag(xml, "Description"));
      const sources = getSources(xml);
      
      for (const s of sources) {
        const book = s.split(" p.")[0].trim();
        sourceCounts[book] = (sourceCounts[book] || 0) + 1;
      }

      const typeRaw = getTag(xml, "Type");
      let slotType = "all";
      if (typeRaw.toLowerCase().includes("weapon")) slotType = "weapon";
      else if (typeRaw.toLowerCase().includes("armor")) slotType = "armor";

      const hardpoints = parseInt(getTag(xml, "HP") || "0");
      const price = parseInt(getTag(xml, "Price") || "0");
      const rarity = parseInt(getTag(xml, "Rarity") || "0");
      const restricted = getTag(xml, "Restricted").toLowerCase() === "true";

      const mods = [];
      const addedMatch = xml.match(/<AddedMods>([\s\S]*?)<\/AddedMods>/i);
      if (addedMatch) {
        const modRegex = /<Mod>([\s\S]*?)<\/Mod>/gi;
        let mm;
        while ((mm = modRegex.exec(addedMatch[1])) !== null) {
          const mKey = getTag(mm[1], "Key");
          const mCount = parseInt(getTag(mm[1], "Count") || "1");
          const mMisc = getTag(mm[1], "MiscDesc");

          let modTarget = mKey.toLowerCase();
          let modType = "quality";
          let modValue = mCount;

          if (mKey.includes("DAMADD")) {
            modType = "stat";
            modTarget = "damage";
          } else if (mKey.includes("CRITSUB")) {
            modType = "stat";
            modTarget = "critical";
            modValue = -mCount;
          } else if (mKey.includes("SOAKADD")) {
            modType = "stat";
            modTarget = "soak";
          } else if (mKey.includes("DEFADD") || mKey.includes("MELEEDEFADD") || mKey.includes("RANGEDEFADD")) {
            modType = "stat";
            modTarget = "defence";
          }

          const modName = mMisc || (mCount > 1 ? `${formatQuality(mKey)} +${mCount}` : formatQuality(mKey));
          mods.push({
            name: modName,
            type: modType,
            target: modTarget,
            value: modValue,
            active: false
          });
        }
      }

      const doc = {
        _id: generateId(),
        name: name,
        type: "attachment",
        img: "icons/svg/upgrade.svg",
        system: {
          description: desc,
          hardpoints: hardpoints,
          slotType: slotType,
          price: price,
          rarity: rarity,
          restricted: restricted,
          baseModifiers: {
            wounds: 0,
            strain: 0,
            soak: 0,
            encumbrance: 0,
            characteristics: "",
            skills: "",
            qualities: "",
            damage: 0,
            critical: 0
          },
          mods: mods,
          key: key.toLowerCase()
        },
        effects: [],
        flags: {
          starwarsffg: {
            sources: sources
          }
        }
      };

      lines.push(JSON.stringify(doc));
      count++;
    } catch (err) {
      console.warn("Skipping malformed attachment entry:", err);
    }
  }

  const destFile = path.join(destDir, "attachments.db");
  fs.writeFileSync(destFile, lines.join("\n") + "\n", "utf-8");
  return { count, sourceCounts, destFile };
}

// 4. Compile Weapons
export function compileWeapons() {
  const file = path.join(dataDir, "Weapons.xml");
  if (!fs.existsSync(file)) {
    console.error(`Weapons file not found: ${file}`);
    return { count: 0, sources: {} };
  }

  const rawXml = fs.readFileSync(file, "utf-8");
  const weaponRegex = /<Weapon>([\s\S]*?)<\/Weapon>/gi;
  const lines = [];
  const sourceCounts = {};
  let count = 0;
  let match;

  while ((match = weaponRegex.exec(rawXml)) !== null) {
    try {
      const xml = match[1];
      const key = getTag(xml, "Key");
      const name = getTag(xml, "Name") || "Unnamed Weapon";
      const desc = formatDescription(getTag(xml, "Description"));
      const sources = getSources(xml);
      
      for (const s of sources) {
        const book = s.split(" p.")[0].trim();
        sourceCounts[book] = (sourceCounts[book] || 0) + 1;
      }

      const skillRaw = getTag(xml, "SkillKey") || getTag(xml, "Skill") || "RANGLT";
      const skill = normalizeSkillName(skillRaw);
      const damage = parseInt(getTag(xml, "Damage") || "0");
      const crit = parseInt(getTag(xml, "Crit") || "0");
      const rangeVal = getTag(xml, "RangeValue").toLowerCase();
      const range = RANGE_MAP[rangeVal] || "Engaged";
      const encumbrance = parseInt(getTag(xml, "Encumbrance") || "0");
      const hardpoints = parseInt(getTag(xml, "HP") || "0");
      const price = parseInt(getTag(xml, "Price") || "0");
      const rarity = parseInt(getTag(xml, "Rarity") || "0");
      const restricted = getTag(xml, "Restricted").toLowerCase() === "true";

      const qualityList = [];
      const qualMatch = xml.match(/<Qualities>([\s\S]*?)<\/Qualities>/i);
      if (qualMatch) {
        const qRegex = /<Quality>([\s\S]*?)<\/Quality>/gi;
        let qm;
        while ((qm = qRegex.exec(qualMatch[1])) !== null) {
          const qKey = getTag(qm[1], "Key");
          const qCount = getTag(qm[1], "Count");
          qualityList.push(formatQuality(qKey, qCount));
        }
      }

      const doc = {
        _id: generateId(),
        name: name,
        type: "weapon",
        img: "icons/svg/sword.svg",
        system: {
          description: desc,
          damage: damage,
          critical: crit,
          range: range,
          encumbrance: encumbrance,
          hardpoints: hardpoints,
          qualities: qualityList.join(", "),
          skill: skill,
          price: price,
          rarity: rarity,
          restricted: restricted,
          equipped: false,
          key: key.toLowerCase(),
          modifiers: {
            wounds: 0,
            strain: 0,
            soak: 0,
            encumbrance: 0,
            characteristics: "",
            skills: ""
          },
          attachments: []
        },
        effects: [],
        flags: {
          starwarsffg: {
            sources: sources
          }
        }
      };

      lines.push(JSON.stringify(doc));
      count++;
    } catch (err) {
      console.warn("Skipping malformed weapon entry:", err);
    }
  }

  const destFile = path.join(destDir, "weapons.db");
  fs.writeFileSync(destFile, lines.join("\n") + "\n", "utf-8");
  return { count, sourceCounts, destFile };
}

// Run compilation
console.log("==================================================");
console.log("SWFFG | Compiling OggDude Equipment Datasets...");
console.log("==================================================");

const armorRes = compileArmor();
console.log(`[ARMOR] Compiled ${armorRes.count} items -> ${armorRes.destFile}`);

const gearRes = compileGear();
console.log(`[GEAR] Compiled ${gearRes.count} items -> ${gearRes.destFile}`);

const attRes = compileAttachments();
console.log(`[ATTACHMENTS] Compiled ${attRes.count} items -> ${attRes.destFile}`);

const weaponRes = compileWeapons();
console.log(`[WEAPONS] Compiled ${weaponRes.count} items -> ${weaponRes.destFile}`);

console.log("==================================================");
console.log("Compilation complete!");
